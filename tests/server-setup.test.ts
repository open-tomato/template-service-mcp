/**
 * Unit tests for the `setup` callback in `src/server.ts`.
 *
 * Strategy: mock `@open-tomato/mcp` so that
 * - `createHttpClient` returns a fake client with spied `getRepo`/`getPR` methods
 * - `createMCP` captures the `setup` callback without starting any server
 *
 * The captured callback is then invoked with a fake `McpServer` that records
 * tool registrations. Each registered handler is called directly so we can
 * assert it calls the correct client method and returns the expected shape.
 */

import type { GitHubRepo, GitHubPR } from '../src/clients/github.js';

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

import { formatContext, formatPRContext } from '../src/formatters/index.js';

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
// Hoisted mock state — must run before vi.mock factories
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  mockGetRepo: vi.fn(),
  mockGetPR: vi.fn(),
  // Mutable container so the vi.mock factory can set the captured setup fn
  setup: { fn: null as ((...args: unknown[]) => void | Promise<void>) | null },
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@open-tomato/mcp', () => ({
  /**
   * Returns a fake TypedClient whose getRepo/getPR are the hoisted spies.
   * The module-level `github` variable in server.ts becomes this object.
   */
  createHttpClient: () => ({
    getRepo: mocks.mockGetRepo,
    getPR: mocks.mockGetPR,
    name: 'http-client',
    status: 'running',
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  }),
  /**
   * Captures the setup callback from createMCP config without starting
   * any real server or transport.
   */
  createMCP: (config: { setup: (...args: unknown[]) => unknown }) => {
    mocks.setup.fn = config.setup as (...args: unknown[]) => void | Promise<void>;
    return { stop: vi.fn().mockResolvedValue(undefined), healthUrl: () => '' };
  },
}));

// Importing server.ts triggers the module-level createMCP() call, which
// captures the setup callback into mocks.setup.fn via the mock above.
import '../src/server.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<{ content: Array<{ type: string; text: string }> }>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('setup callback', () => {
  /** Handlers registered by the setup callback, keyed by tool name. */
  const registeredTools = new Map<string, ToolHandler>();

  const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

  const mockServer = {
    tool: vi.fn(
      (
        name: string,
        _description: string,
        _schema: unknown,
        handler: ToolHandler,
      ) => {
        registeredTools.set(name, handler);
      },
    ),
  };

  beforeAll(async () => {
    if (!mocks.setup.fn) throw new Error('createMCP was not called — server.ts may not have been imported');
    await mocks.setup.fn(mockServer, { logger: mockLogger, clients: {} });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Tool registration
  // -------------------------------------------------------------------------

  it('registers the get-bootstrap-context tool', () => {
    expect(registeredTools.has('get-bootstrap-context')).toBe(true);
  });

  it('registers the get-pr-context tool', () => {
    expect(registeredTools.has('get-pr-context')).toBe(true);
  });

  it('registers exactly two tools', () => {
    expect(registeredTools.size).toBe(2);
  });

  // -------------------------------------------------------------------------
  // get-bootstrap-context handler
  // -------------------------------------------------------------------------

  describe('get-bootstrap-context handler', () => {
    it('calls github.getRepo with owner and repo from args', async () => {
      mocks.mockGetRepo.mockResolvedValueOnce(repoFixture);
      const handler = registeredTools.get('get-bootstrap-context')!;

      await handler({ owner: 'octocat', repo: 'Hello-World' });

      expect(mocks.mockGetRepo).toHaveBeenCalledOnce();
      expect(mocks.mockGetRepo).toHaveBeenCalledWith('octocat', 'Hello-World');
    });

    it('does not call github.getPR', async () => {
      mocks.mockGetRepo.mockResolvedValueOnce(repoFixture);
      const handler = registeredTools.get('get-bootstrap-context')!;

      await handler({ owner: 'octocat', repo: 'Hello-World' });

      expect(mocks.mockGetPR).not.toHaveBeenCalled();
    });

    it('returns a single text content item', async () => {
      mocks.mockGetRepo.mockResolvedValueOnce(repoFixture);
      const handler = registeredTools.get('get-bootstrap-context')!;

      const result = await handler({ owner: 'octocat', repo: 'Hello-World' });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });

    it('returns the formatContext output as the text value', async () => {
      mocks.mockGetRepo.mockResolvedValueOnce(repoFixture);
      const handler = registeredTools.get('get-bootstrap-context')!;

      const result = await handler({ owner: 'octocat', repo: 'Hello-World' });

      expect(result.content[0].text).toBe(formatContext(repoFixture));
    });

    it('text is valid JSON that round-trips to the repo fixture', async () => {
      mocks.mockGetRepo.mockResolvedValueOnce(repoFixture);
      const handler = registeredTools.get('get-bootstrap-context')!;

      const result = await handler({ owner: 'octocat', repo: 'Hello-World' });

      expect(JSON.parse(result.content[0].text)).toEqual(repoFixture);
    });

    it('logs the call with the provided args', async () => {
      mocks.mockGetRepo.mockResolvedValueOnce(repoFixture);
      const handler = registeredTools.get('get-bootstrap-context')!;

      await handler({ owner: 'octocat', repo: 'Hello-World' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        { args: { owner: 'octocat', repo: 'Hello-World' } },
        'get-bootstrap-context called',
      );
    });

    it('propagates errors thrown by github.getRepo', async () => {
      mocks.mockGetRepo.mockRejectedValueOnce(new Error('GitHub API error 404'));
      const handler = registeredTools.get('get-bootstrap-context')!;

      await expect(
        handler({ owner: 'octocat', repo: 'missing' }),
      ).rejects.toThrow('GitHub API error 404');
    });
  });

  // -------------------------------------------------------------------------
  // get-pr-context handler
  // -------------------------------------------------------------------------

  describe('get-pr-context handler', () => {
    it('calls github.getPR with owner, repo, and prNumber from args', async () => {
      mocks.mockGetPR.mockResolvedValueOnce(prFixture);
      const handler = registeredTools.get('get-pr-context')!;

      await handler({ owner: 'octocat', repo: 'Hello-World', prNumber: 42 });

      expect(mocks.mockGetPR).toHaveBeenCalledOnce();
      expect(mocks.mockGetPR).toHaveBeenCalledWith('octocat', 'Hello-World', 42);
    });

    it('does not call github.getRepo', async () => {
      mocks.mockGetPR.mockResolvedValueOnce(prFixture);
      const handler = registeredTools.get('get-pr-context')!;

      await handler({ owner: 'octocat', repo: 'Hello-World', prNumber: 42 });

      expect(mocks.mockGetRepo).not.toHaveBeenCalled();
    });

    it('returns a single text content item', async () => {
      mocks.mockGetPR.mockResolvedValueOnce(prFixture);
      const handler = registeredTools.get('get-pr-context')!;

      const result = await handler({ owner: 'octocat', repo: 'Hello-World', prNumber: 42 });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });

    it('returns the formatPRContext output as the text value', async () => {
      mocks.mockGetPR.mockResolvedValueOnce(prFixture);
      const handler = registeredTools.get('get-pr-context')!;

      const result = await handler({ owner: 'octocat', repo: 'Hello-World', prNumber: 42 });

      expect(result.content[0].text).toBe(formatPRContext(prFixture));
    });

    it('text is valid JSON that round-trips to the PR fixture', async () => {
      mocks.mockGetPR.mockResolvedValueOnce(prFixture);
      const handler = registeredTools.get('get-pr-context')!;

      const result = await handler({ owner: 'octocat', repo: 'Hello-World', prNumber: 42 });

      expect(JSON.parse(result.content[0].text)).toEqual(prFixture);
    });

    it('logs the call with the provided args', async () => {
      mocks.mockGetPR.mockResolvedValueOnce(prFixture);
      const handler = registeredTools.get('get-pr-context')!;

      await handler({ owner: 'octocat', repo: 'Hello-World', prNumber: 42 });

      expect(mockLogger.info).toHaveBeenCalledWith(
        { args: { owner: 'octocat', repo: 'Hello-World', prNumber: 42 } },
        'get-pr-context called',
      );
    });

    it('propagates errors thrown by github.getPR', async () => {
      mocks.mockGetPR.mockRejectedValueOnce(new Error('GitHub API error 404'));
      const handler = registeredTools.get('get-pr-context')!;

      await expect(
        handler({ owner: 'octocat', repo: 'Hello-World', prNumber: 99 }),
      ).rejects.toThrow('GitHub API error 404');
    });
  });
});
