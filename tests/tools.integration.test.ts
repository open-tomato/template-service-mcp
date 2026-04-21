/**
 * Integration tests verifying each MCP tool (`get-bootstrap-context`,
 * `get-pr-context`) is callable over HTTP and returns a response with the
 * correct shape and content.
 *
 * Strategy:
 * - Start a real `McpServer` with the tools registered and mock fixtures as
 *   return values (no real GitHub API calls).
 * - Wire the transport via a standalone Node.js HTTP server (not through
 *   `createMCP`/`wireHttpTransport`) so we can:
 *   a) Use stateful mode (`sessionIdGenerator`) — `wireHttpTransport` uses
 *      stateless mode which throws on any request after the first.
 *   b) Properly stream SSE responses via a readable-stream pipe instead of
 *      `fetchRes.text()`, which hangs on SSE.
 * - Use a SINGLE shared MCP `Client` for all tests: `McpServer` supports
 *   one session at a time and rejects a second `initialize` with
 *   "Server already initialized". Sharing avoids re-initializing per test.
 *
 * Port 8093 is reserved for this file.
 */

import type { GitHubPR, GitHubRepo } from '../src/clients/github.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { formatContext, formatPRContext } from '../src/formatters/index.js';
import { GetBootstrapContextSchema, GetPRContextSchema } from '../src/schemas/index.js';

// ---------------------------------------------------------------------------
// Port constants
// ---------------------------------------------------------------------------

const MCP_PORT = 8093;
const MCP_URL = `http://localhost:${MCP_PORT}`;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const repoFixture: GitHubRepo = {
  id: 1,
  name: 'Hello-World',
  full_name: 'octocat/Hello-World',
  description: 'My first repository',
  default_branch: 'main',
  language: 'JavaScript',
  topics: ['octocat', 'atom'],
  visibility: 'public',
  html_url: 'https://github.com/octocat/Hello-World',
  stargazers_count: 1000,
  open_issues_count: 5,
};

const prFixture: GitHubPR = {
  id: 200,
  number: 42,
  title: 'fix: correct bug',
  body: 'Fixes the bug.',
  state: 'open',
  html_url: 'https://github.com/octocat/Hello-World/pull/42',
  user: { login: 'octocat' },
  head: { ref: 'fix/bug', sha: 'aaabbb' },
  base: { ref: 'main', sha: 'cccddd' },
  labels: [{ name: 'bug' }],
  draft: false,
  merged_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
};

// ---------------------------------------------------------------------------
// HTTP server helper
//
// Adapts Node.js IncomingMessage → Web Request, calls the MCP transport's
// handleRequest(), then pipes the Web Response (which may be an SSE stream)
// back to the Node.js ServerResponse without buffering via .text().
// ---------------------------------------------------------------------------

async function adaptNodeRequest(nodeReq: IncomingMessage, port: number): Promise<Request> {
  const url = new URL(nodeReq.url ?? '/', `http://localhost:${port}`);
  const headers = new Headers();
  for (const [key, rawVal] of Object.entries(nodeReq.headers)) {
    if (rawVal != null) {
      headers.set(key, Array.isArray(rawVal)
        ? rawVal.join(', ')
        : rawVal);
    }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of nodeReq) {
    chunks.push(chunk as Buffer);
  }
  const body = chunks.length > 0
    ? Buffer.concat(chunks)
    : null;
  return new Request(url.toString(), { method: nodeReq.method ?? 'GET', headers, body });
}

async function pipeWebResponse(fetchRes: Response, nodeRes: ServerResponse): Promise<void> {
  const resHeaders: Record<string, string> = {};
  fetchRes.headers.forEach((val, key) => {
    resHeaders[key] = val;
  });
  nodeRes.writeHead(fetchRes.status, resHeaders);

  if (!fetchRes.body) {
    nodeRes.end();
    return;
  }

  const reader = fetchRes.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      nodeRes.write(value);
    }
  } catch {
    // Stream aborted (e.g. client disconnected) — ignore.
  } finally {
    reader.releaseLock();
  }
  nodeRes.end();
}

function startTestHttpServer(
  port: number,
  handleFetch: (req: Request) => Response | Promise<Response>,
): { stop: () => void } {
  const httpServer = createServer(async (nodeReq: IncomingMessage, nodeRes: ServerResponse) => {
    try {
      const fetchReq = await adaptNodeRequest(nodeReq, port);
      const fetchRes = await handleFetch(fetchReq);
      await pipeWebResponse(fetchRes, nodeRes);
    } catch {
      if (!nodeRes.headersSent) {
        nodeRes.writeHead(500);
      }
      nodeRes.end();
    }
  });
  httpServer.listen(port);
  return { stop: () => { httpServer.close(); } };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitUntil(
  fn: () => Promise<boolean>,
  { timeout = 5000, interval = 50 } = {},
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`waitUntil timed out after ${timeout}ms`);
}

type TextContent = { type: 'text'; text: string };

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('tool HTTP integration', () => {
  let mcpTransport: WebStandardStreamableHTTPServerTransport;
  let httpServer: { stop: () => void };
  /** Single shared client — McpServer only accepts one initialize handshake. */
  let client: Client;

  beforeAll(async () => {
    const mcpServer = new McpServer({ name: 'context-generator', version: '1.0.0' });

    mcpTransport = new WebStandardStreamableHTTPServerTransport({
      // Stateful mode: the same transport instance handles the full multi-request
      // MCP handshake (initialize → notifications/initialized → tool calls).
      sessionIdGenerator: () => randomUUID(),
    });

    mcpServer.tool(
      'get-bootstrap-context',
      'Fetch GitHub repository metadata.',
      GetBootstrapContextSchema,
      async () => ({
        content: [{ type: 'text' as const, text: formatContext(repoFixture) }],
      }),
    );

    mcpServer.tool(
      'get-pr-context',
      'Fetch GitHub pull request metadata.',
      GetPRContextSchema,
      async () => ({
        content: [{ type: 'text' as const, text: formatPRContext(prFixture) }],
      }),
    );

    await mcpServer.connect(mcpTransport);

    httpServer = startTestHttpServer(MCP_PORT, (req) => mcpTransport.handleRequest(req));

    // Connect the shared client, retrying until the server is ready.
    // Once connected, McpServer is initialized and subsequent callTool()
    // reuses the established session without re-initializing.
    await waitUntil(async () => {
      const c = new Client({ name: 'test-client', version: '1.0.0' });
      try {
        await c.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));
        client = c;
        return true;
      } catch {
        await c.close().catch(() => {});
        return false;
      }
    });
  });

  afterAll(async () => {
    await client?.close();
    await mcpTransport.close();
    httpServer?.stop();
  });

  // -------------------------------------------------------------------------
  // get-bootstrap-context
  // -------------------------------------------------------------------------

  describe('get-bootstrap-context', () => {
    it('is callable over HTTP and returns a content array', async () => {
      const result = await client.callTool({
        name: 'get-bootstrap-context',
        arguments: { owner: 'octocat', repo: 'Hello-World' },
      });

      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
    });

    it('returns a single text content item', async () => {
      const result = await client.callTool({
        name: 'get-bootstrap-context',
        arguments: { owner: 'octocat', repo: 'Hello-World' },
      });

      expect(result.content).toHaveLength(1);
      expect((result.content as TextContent[])[0].type).toBe('text');
    });

    it('returns the formatted repository context as text', async () => {
      const result = await client.callTool({
        name: 'get-bootstrap-context',
        arguments: { owner: 'octocat', repo: 'Hello-World' },
      });

      const text = (result.content as TextContent[])[0].text;
      expect(text).toBe(formatContext(repoFixture));
    });

    it('response text round-trips to the repo fixture', async () => {
      const result = await client.callTool({
        name: 'get-bootstrap-context',
        arguments: { owner: 'octocat', repo: 'Hello-World' },
      });

      const text = (result.content as TextContent[])[0].text;
      expect(JSON.parse(text)).toEqual(repoFixture);
    });
  });

  // -------------------------------------------------------------------------
  // get-pr-context
  // -------------------------------------------------------------------------

  describe('get-pr-context', () => {
    it('is callable over HTTP and returns a content array', async () => {
      const result = await client.callTool({
        name: 'get-pr-context',
        arguments: { owner: 'octocat', repo: 'Hello-World', prNumber: 42 },
      });

      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
    });

    it('returns a single text content item', async () => {
      const result = await client.callTool({
        name: 'get-pr-context',
        arguments: { owner: 'octocat', repo: 'Hello-World', prNumber: 42 },
      });

      expect(result.content).toHaveLength(1);
      expect((result.content as TextContent[])[0].type).toBe('text');
    });

    it('returns the formatted pull request context as text', async () => {
      const result = await client.callTool({
        name: 'get-pr-context',
        arguments: { owner: 'octocat', repo: 'Hello-World', prNumber: 42 },
      });

      const text = (result.content as TextContent[])[0].text;
      expect(text).toBe(formatPRContext(prFixture));
    });

    it('response text round-trips to the PR fixture', async () => {
      const result = await client.callTool({
        name: 'get-pr-context',
        arguments: { owner: 'octocat', repo: 'Hello-World', prNumber: 42 },
      });

      const text = (result.content as TextContent[])[0].text;
      expect(JSON.parse(text)).toEqual(prFixture);
    });
  });
});
