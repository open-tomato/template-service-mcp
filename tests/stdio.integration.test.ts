/**
 * Smoke test verifying the server module initialises without error when
 * `MCP_TRANSPORT=stdio` is set in the environment.
 *
 * Strategy:
 * - Set `MCP_TRANSPORT=stdio` inside `vi.hoisted` so the value is in place
 *   before any module-level code (including the `createMCP()` call in
 *   `server.ts`) executes.
 * - Mock `@open-tomato/mcp` so `createMCP` is intercepted without starting
 *   a real server or touching stdin/stdout.
 * - Statically import `server.ts`, which triggers the module-level
 *   `createMCP()` call on load.
 * - Assert the import completed without throwing, `createMCP` was called,
 *   and the env var is correctly set so `resolveTransport()` would return
 *   `'stdio'`.
 */

import { afterAll, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted: set env var before any module-level code in this file runs.
// `process` is used as a global here because vi.hoisted runs before ES module
// imports are initialised — importing `node:process` would not be available.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
   
  globalThis.process.env['MCP_TRANSPORT'] = 'stdio';
  return {
    called: { value: false },
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@open-tomato/mcp', () => ({
  /**
   * Returns a minimal fake TypedClient to satisfy createMCP's clients array.
   * No HTTP calls are made — GitHubApi is never invoked during a smoke test.
   */
  createHttpClient: () => ({
    name: 'http-client',
    status: 'running',
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  }),
  /**
   * Intercepts createMCP without wiring any transport. Records that it was
   * called so the test can assert module initialisation completed.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createMCP: (_config: unknown) => {
    mocks.called.value = true;
    return { stop: vi.fn().mockResolvedValue(undefined), healthUrl: () => '' };
  },
}));

// Importing server.ts triggers the module-level createMCP() call. If anything
// throws during module initialisation, vitest will fail the entire file here.
import '../src/server.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MCP_TRANSPORT=stdio initialisation smoke test', () => {
  afterAll(() => {
    delete process.env['MCP_TRANSPORT'];
  });

  it('server module imports without throwing', () => {
    // Reaching this assertion means the static import above did not throw.
    expect(true).toBe(true);
  });

  it('createMCP is called on module load', () => {
    expect(mocks.called.value).toBe(true);
  });

  it('MCP_TRANSPORT env var is "stdio"', () => {
    expect(process.env['MCP_TRANSPORT']).toBe('stdio');
  });
});
