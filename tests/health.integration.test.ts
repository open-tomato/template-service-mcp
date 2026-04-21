/**
 * Integration tests for the `/health` HTTP endpoint.
 *
 * Strategy: start `startHealthServer` (the same function `createMCP` uses
 * internally) on a dedicated port with a fake `TypedClient` that represents
 * the wrapped GitHub API client. Make real HTTP requests against the running
 * server and assert the response shape.
 *
 * Port 3100 is reserved for this file to avoid EADDRINUSE conflicts with
 * other integration test files (default 3001, create-mcp.test.ts uses 3099).
 *
 * The `bun-polyfill.ts` setup file (configured in vitest.config.ts) provides
 * a Node.js-compatible `Bun.serve` shim so `startHealthServer` can run under
 * vitest without a real Bun runtime.
 */

import type { TypedClient } from '@open-tomato/mcp';

import { startHealthServer } from '@open-tomato/mcp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HEALTH_PORT = 3100;
const HEALTH_PATH = '/health';
const HEALTH_URL = `http://localhost:${HEALTH_PORT}${HEALTH_PATH}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient(name: string, status: string): TypedClient<unknown> {
  return { name, status, start: async () => {}, stop: async () => {} } as unknown as TypedClient<unknown>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('/health endpoint integration', () => {
  let server: ReturnType<typeof startHealthServer>;

  afterEach(() => {
    server?.stop();
  });

  describe('with a running client', () => {
    beforeEach(() => {
      server = startHealthServer({
        port: HEALTH_PORT,
        path: HEALTH_PATH,
        serviceId: 'context-generator',
        clients: [makeClient('http-client', 'running')],
      });
    });

    it('returns HTTP 200', async () => {
      const res = await fetch(HEALTH_URL);
      expect(res.status).toBe(200);
    });

    it('returns JSON content-type', async () => {
      const res = await fetch(HEALTH_URL);
      expect(res.headers.get('content-type')).toMatch(/application\/json/);
    });

    it('returns status "ok"', async () => {
      const res = await fetch(HEALTH_URL);
      const body = await res.json() as Record<string, unknown>;
      expect(body.status).toBe('ok');
    });

    it('returns the correct serviceId', async () => {
      const res = await fetch(HEALTH_URL);
      const body = await res.json() as Record<string, unknown>;
      expect(body.serviceId).toBe('context-generator');
    });

    it('returns clients map with http-client entry', async () => {
      const res = await fetch(HEALTH_URL);
      const body = await res.json() as Record<string, unknown>;
      expect(body.clients).toEqual({ 'http-client': { status: 'running' } });
    });

    it('returns the full expected shape', async () => {
      const res = await fetch(HEALTH_URL);
      const body = await res.json();
      expect(body).toEqual({
        status: 'ok',
        serviceId: 'context-generator',
        clients: {
          'http-client': { status: 'running' },
        },
      });
    });
  });

  describe('with a client in error state', () => {
    beforeEach(() => {
      server = startHealthServer({
        port: HEALTH_PORT,
        path: HEALTH_PATH,
        serviceId: 'context-generator',
        clients: [makeClient('http-client', 'error')],
      });
    });

    it('returns aggregate status "error"', async () => {
      const res = await fetch(HEALTH_URL);
      const body = await res.json() as Record<string, unknown>;
      expect(body.status).toBe('error');
    });

    it('reflects the client error status in the clients map', async () => {
      const res = await fetch(HEALTH_URL);
      const body = await res.json() as Record<string, unknown>;
      expect(body.clients).toEqual({ 'http-client': { status: 'error' } });
    });
  });

  describe('with a client in starting state', () => {
    beforeEach(() => {
      server = startHealthServer({
        port: HEALTH_PORT,
        path: HEALTH_PATH,
        serviceId: 'context-generator',
        clients: [makeClient('http-client', 'starting')],
      });
    });

    it('returns aggregate status "degraded"', async () => {
      const res = await fetch(HEALTH_URL);
      const body = await res.json() as Record<string, unknown>;
      expect(body.status).toBe('degraded');
    });
  });

  describe('non-health paths', () => {
    beforeEach(() => {
      server = startHealthServer({
        port: HEALTH_PORT,
        path: HEALTH_PATH,
        serviceId: 'context-generator',
        clients: [],
      });
    });

    it('returns 404 for unknown paths', async () => {
      const res = await fetch(`http://localhost:${HEALTH_PORT}/unknown`);
      expect(res.status).toBe(404);
    });

    it('returns 404 for root path', async () => {
      const res = await fetch(`http://localhost:${HEALTH_PORT}/`);
      expect(res.status).toBe(404);
    });
  });
});
