/**
 * Integration tests: MCP tool invocation against seeded data.
 *
 * Spawns the MCP server as a subprocess (stdio transport) and calls each of
 * the three tools via the MCP Client SDK, verifying structured responses.
 *
 * Requires a running Postgres instance (DATABASE_URL in ../.env).
 *
 * Usage:
 *   cd mcp-knowledge-server && bun --env-file=../.env test tests/tools.test.ts
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { env as envVars } from 'bun';
import { test, expect, beforeAll, afterAll, describe } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { tags, repos, artifacts, artifactTags, guidelines } from '../src/db/schema.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(__dirname, '..');
const DATABASE_URL = envVars['DATABASE_URL'];

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required — run with: bun --env-file=../.env test');
}

// ---------------------------------------------------------------------------
// Isolated tag values used by this test suite
// ---------------------------------------------------------------------------

const T_STACK = '__mcp_test_nextjs__';
const T_FEATURE = '__mcp_test_auth__';
const T_DEP = '__mcp_test_db__';

// ---------------------------------------------------------------------------
// DB fixture state
// ---------------------------------------------------------------------------

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle({ client: pool });

let testRepoId: string;
let testTagIds: string[] = [];
let artifactAgentsMdId: string;
let artifactSkillsMdId: string;
let artifactToolDefId: string;
let testGuidelineId: string;

// ---------------------------------------------------------------------------
// MCP client state
// ---------------------------------------------------------------------------

let client: Client;
let transport: StdioClientTransport;

// ---------------------------------------------------------------------------
// Setup: DB fixtures
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const insertedTags = await db
    .insert(tags)
    .values([
      { category: 'stack', value: T_STACK },
      { category: 'feature_type', value: T_FEATURE },
      { category: 'dependency', value: T_DEP },
    ])
    .returning();

  testTagIds = insertedTags.map((t) => t.id);
  const [stackTag, featureTag, depTag] = insertedTags as [
    (typeof tags.$inferSelect),
    (typeof tags.$inferSelect),
    (typeof tags.$inferSelect),
  ];

  const [repo] = await db
    .insert(repos)
    .values({
      nwo: '__mcp_test_owner__/__mcp_test_repo__',
      ownerId: '__mcp_test_owner__',
      repoGithubId: '__mcp_test_gh_888__',
      score: 90,
    })
    .returning();

  testRepoId = repo!.id;

  // AGENTS_MD — tagged with stack
  const [agentsMd] = await db
    .insert(artifacts)
    .values({
      repoId: testRepoId,
      type: 'AGENTS_MD',
      content: '# Test AGENTS.md\nConventions for the test nextjs stack.',
      summary: 'Test agents.md for nextjs stack.',
    })
    .returning();

  artifactAgentsMdId = agentsMd!.id;
  await db.insert(artifactTags).values({ artifactId: artifactAgentsMdId, tagId: stackTag!.id });

  // SKILLS_MD — tagged with stack + feature + dep (shows up in all three tools)
  const [skillsMd] = await db
    .insert(artifacts)
    .values({
      repoId: testRepoId,
      type: 'SKILLS_MD',
      content: '# Test SKILLS.md\nJWT authentication skill using a database.',
      summary: 'Test skill: auth + database for nextjs.',
    })
    .returning();

  artifactSkillsMdId = skillsMd!.id;
  await db.insert(artifactTags).values([
    { artifactId: artifactSkillsMdId, tagId: stackTag!.id },
    { artifactId: artifactSkillsMdId, tagId: featureTag!.id },
    { artifactId: artifactSkillsMdId, tagId: depTag!.id },
  ]);

  // TOOL_DEF — tagged with stack only
  const [toolDef] = await db
    .insert(artifacts)
    .values({
      repoId: testRepoId,
      type: 'TOOL_DEF',
      content: '{"name":"test_tool","description":"A test tool for nextjs."}',
      summary: 'Test tool definition for nextjs.',
    })
    .returning();

  artifactToolDefId = toolDef!.id;
  await db.insert(artifactTags).values({ artifactId: artifactToolDefId, tagId: stackTag!.id });

  // Guideline linked to SKILLS_MD
  const [guideline] = await db
    .insert(guidelines)
    .values({
      artifactId: artifactSkillsMdId,
      title: 'Test auth guideline',
      content: 'Always use httpOnly cookies for JWT storage.',
      stackCanonical: 'test-nextjs-typescript',
    })
    .returning();

  testGuidelineId = guideline!.id;
}, 30_000);

// ---------------------------------------------------------------------------
// Setup: MCP client
// ---------------------------------------------------------------------------

beforeAll(async () => {
  transport = new StdioClientTransport({
    command: 'bun',
    args: ['index.ts'],
    cwd: SERVER_DIR,
    env: { ...envVars, DATABASE_URL },
    stderr: 'pipe',
  });

  client = new Client({ name: 'test-client', version: '0.0.1' });
  await client.connect(transport);
}, 30_000);

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterAll(async () => {
  await client.close();

  if (testRepoId) {
    // Cascade deletes artifacts, artifact_tags, guidelines via FK
    await db.delete(repos).where(eq(repos.id, testRepoId));
  }
  if (testTagIds.length > 0) {
    await db.delete(tags).where(inArray(tags.id, testTagIds));
  }

  await pool.end();
}, 30_000);

// ---------------------------------------------------------------------------
// Helper: parse tool result text content
// ---------------------------------------------------------------------------

function parseToolResult<T>(result: Awaited<ReturnType<Client['callTool']>>): T {
  const first = result.content[0];
  if (!first || first.type !== 'text') throw new Error('Expected text content in tool result');
  return JSON.parse(first.text) as T;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('get_bootstrap_context', () => {
  test('returns agents_md, skills, and tool_definitions for matching stack', async () => {
    const result = await client.callTool({
      name: 'get_bootstrap_context',
      arguments: { stacks: [T_STACK], libraries: [] },
    });

    const output = parseToolResult<{
      agents_md: string;
      skills: { id: string; type: string }[];
      tool_definitions: { id: string; type: string }[];
    }>(result);

    expect(output.agents_md).toContain('Test AGENTS.md');
    expect(output.skills.map((s) => s.id)).toContain(artifactSkillsMdId);
    expect(output.tool_definitions.map((t) => t.id)).toContain(artifactToolDefId);
  });

  test('returns empty results for unknown stack', async () => {
    const result = await client.callTool({
      name: 'get_bootstrap_context',
      arguments: { stacks: ['__nonexistent_stack_xyz__'], libraries: [] },
    });

    // Empty results are not errors — isError must be absent or false
    expect(result.isError).toBeFalsy();

    const output = parseToolResult<{
      agents_md: string;
      skills: unknown[];
      tool_definitions: unknown[];
    }>(result);

    expect(output.agents_md).toBe('');
    expect(output.skills).toHaveLength(0);
    expect(output.tool_definitions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Real bootstrap test — uses actual seeded tag values from seed-artifacts.ts
// ---------------------------------------------------------------------------

describe('get_bootstrap_context — real project bootstrap', () => {
  test('nextjs + typescript stack returns seeded AGENTS.md and SKILLS_MD', async () => {
    const result = await client.callTool({
      name: 'get_bootstrap_context',
      arguments: { stacks: ['nextjs', 'typescript'], libraries: [] },
    });

    const output = parseToolResult<{
      agents_md: string;
      skills: { id: string; type: string; content: string; summary: string }[];
      tool_definitions: { id: string; type: string }[];
    }>(result);

    // agents_md should contain the seeded AGENTS_MD content
    expect(output.agents_md).toContain('Next.js App Router');
    expect(output.agents_md).toContain('TypeScript strict mode');

    // skills should include the JWT auth skill (tagged nextjs)
    const skillContents = output.skills.map((s) => s.content);
    expect(skillContents.some((c) => c.includes('JWT'))).toBe(true);

    // tool_definitions should include the tRPC tool (tagged nextjs)
    expect(output.tool_definitions.length).toBeGreaterThan(0);
    const toolContents = output.tool_definitions.map((t) => t.content);
    expect(toolContents.some((c) => c.includes('create_trpc_route'))).toBe(true);
  });

  test('nextjs + trpc library filter returns tRPC tool definition', async () => {
    const result = await client.callTool({
      name: 'get_bootstrap_context',
      arguments: { stacks: ['nextjs'], libraries: ['trpc'] },
    });

    const output = parseToolResult<{
      agents_md: string;
      skills: { id: string }[];
      tool_definitions: { id: string; content: string }[];
    }>(result);

    // When filtering by both nextjs (stack) AND trpc (library), only artifacts
    // tagged with both categories should appear — that is the TOOL_DEF artifact
    expect(output.tool_definitions.some((t) => t.content.includes('create_trpc_route'))).toBe(true);

    // The AGENTS_MD is tagged nextjs+typescript, not nextjs+trpc — so agents_md is empty
    expect(output.agents_md).toBe('');
  });
});

describe('get_planning_context', () => {
  test('returns guidelines and skills for matching feature + dependency', async () => {
    const result = await client.callTool({
      name: 'get_planning_context',
      arguments: {
        task_type: 'feature',
        feature_types: [T_FEATURE],
        dependencies: [T_DEP],
      },
    });

    const output = parseToolResult<{
      guidelines: { id: string }[];
      skills: { id: string }[];
      is_delta: boolean;
    }>(result);

    expect(output.is_delta).toBe(false);
    expect(output.guidelines.map((g) => g.id)).toContain(testGuidelineId);
    expect(output.skills.map((s) => s.id)).toContain(artifactSkillsMdId);
  });

  test('is_delta is true when last_fetched_at is provided', async () => {
    const past = new Date(Date.now() - 60_000).toISOString(); // 1 minute ago

    const result = await client.callTool({
      name: 'get_planning_context',
      arguments: {
        task_type: 'feature',
        feature_types: [T_FEATURE],
        dependencies: [T_DEP],
        last_fetched_at: past,
      },
    });

    const output = parseToolResult<{
      guidelines: unknown[];
      skills: unknown[];
      is_delta: boolean;
    }>(result);

    expect(output.is_delta).toBe(true);
    // Items created in beforeAll are newer than `past`, so they should still appear
    expect(output.guidelines.length).toBeGreaterThan(0);
  });

  test('delta with future timestamp returns empty results', async () => {
    const future = new Date(Date.now() + 60_000).toISOString(); // 1 minute in future

    const result = await client.callTool({
      name: 'get_planning_context',
      arguments: {
        task_type: 'feature',
        feature_types: [T_FEATURE],
        dependencies: [T_DEP],
        last_fetched_at: future,
      },
    });

    // Empty delta is not an error
    expect(result.isError).toBeFalsy();

    const output = parseToolResult<{
      guidelines: unknown[];
      skills: unknown[];
      is_delta: boolean;
    }>(result);

    expect(output.is_delta).toBe(true);
    expect(output.guidelines).toHaveLength(0);
    expect(output.skills).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Real planning test — uses actual seeded tag values from seed-artifacts.ts
// ---------------------------------------------------------------------------

describe('get_planning_context — real feature plan', () => {
  test('authentication + database returns seeded guideline and JWT skill', async () => {
    const result = await client.callTool({
      name: 'get_planning_context',
      arguments: {
        task_type: 'feature',
        feature_types: ['authentication'],
        dependencies: ['database'],
      },
    });

    const output = parseToolResult<{
      guidelines: { id: string; title: string; content: string }[];
      skills: { id: string; type: string; content: string }[];
      is_delta: boolean;
    }>(result);

    expect(output.is_delta).toBe(false);

    // Seeded guideline should appear
    const guidelineTitles = output.guidelines.map((g) => g.title);
    expect(guidelineTitles.some((t) => t.includes('JWT Auth'))).toBe(true);
    const guidelineContent = output.guidelines.map((g) => g.content).join(' ');
    expect(guidelineContent).toContain('jose');
    expect(guidelineContent).toContain('httpOnly');

    // Seeded SKILLS_MD should appear
    const skillContents = output.skills.map((s) => s.content).join(' ');
    expect(skillContents).toContain('JWT');
    expect(skillContents).toContain('Postgres');
  });

  test('delta: second call with last_fetched_at=now returns empty results', async () => {
    // First call — full fetch
    await client.callTool({
      name: 'get_planning_context',
      arguments: {
        task_type: 'feature',
        feature_types: ['authentication'],
        dependencies: ['database'],
      },
    });

    // Second call with timestamp after seeded data was created
    const now = new Date().toISOString();
    const deltaResult = await client.callTool({
      name: 'get_planning_context',
      arguments: {
        task_type: 'feature',
        feature_types: ['authentication'],
        dependencies: ['database'],
        last_fetched_at: now,
      },
    });

    const deltaOutput = parseToolResult<{
      guidelines: unknown[];
      skills: unknown[];
      is_delta: boolean;
    }>(deltaResult);

    expect(deltaOutput.is_delta).toBe(true);
    // Nothing created after `now`, so both lists must be empty
    expect(deltaOutput.guidelines).toHaveLength(0);
    expect(deltaOutput.skills).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Real chore task test — uses actual seeded tag values from seed-artifacts.ts
// ---------------------------------------------------------------------------

describe('get_task_context — real chore task', () => {
  test('authentication feature type returns seeded JWT skill artifact', async () => {
    const result = await client.callTool({
      name: 'get_task_context',
      arguments: { feature_types: ['authentication'], ephemeral: true },
    });

    const output = parseToolResult<{
      artifacts: { id: string; type: string; content: string; summary: string }[];
    }>(result);

    // Seeded SKILLS_MD (JWT Authentication) is tagged with authentication feature_type
    expect(output.artifacts.length).toBeGreaterThan(0);
    const contents = output.artifacts.map((a) => a.content).join(' ');
    expect(contents).toContain('JWT');
    expect(contents).toContain('jose');

    // All returned artifacts must have a feature_type tag — only SKILLS_MD qualifies
    const types = output.artifacts.map((a) => a.type);
    expect(types).toContain('SKILLS_MD');
  });

  test('ephemeral call writes no session state — repeated calls return identical results', async () => {
    const args = { feature_types: ['authentication'], ephemeral: true as const };

    const first = parseToolResult<{ artifacts: { id: string }[] }>(
      await client.callTool({ name: 'get_task_context', arguments: args }),
    );
    const second = parseToolResult<{ artifacts: { id: string }[] }>(
      await client.callTool({ name: 'get_task_context', arguments: args }),
    );

    // Identical results across calls confirms no state was mutated
    expect(first.artifacts.map((a) => a.id).sort()).toEqual(
      second.artifacts.map((a) => a.id).sort(),
    );
  });
});

describe('get_task_context', () => {
  test('returns raw artifacts for matching feature type', async () => {
    const result = await client.callTool({
      name: 'get_task_context',
      arguments: { feature_types: [T_FEATURE], ephemeral: true },
    });

    const output = parseToolResult<{
      artifacts: { id: string; type: string }[];
    }>(result);

    expect(output.artifacts.map((a) => a.id)).toContain(artifactSkillsMdId);
  });

  test('returns empty array for unknown feature type', async () => {
    const result = await client.callTool({
      name: 'get_task_context',
      arguments: { feature_types: ['__nonexistent_feature__'], ephemeral: true },
    });

    // Empty results are not errors
    expect(result.isError).toBeFalsy();

    const output = parseToolResult<{ artifacts: unknown[] }>(result);

    expect(output.artifacts).toHaveLength(0);
  });
});
