/**
 * @module server
 * Infrastructure layer — MCP server setup, tool registration, and HTTP listener.
 * Starts automatically when imported; the {@link MCPHandle} is exported as the
 * default export for use in tests and graceful-shutdown scenarios.
 */

import { createMCP, createHttpClient } from '@open-tomato/mcp';

import { GitHubApi } from './clients/github.js';
import { formatContext, formatPRContext } from './formatters/index.js';
import { GetBootstrapContextSchema, GetPRContextSchema } from './schemas/index.js';

/**
 * GitHub REST API client wrapped with retry and circuit-breaker protection.
 *
 * - Retry: 2 attempts with exponential backoff before propagating a failure.
 * - Circuit breaker: opens after 3 consecutive failures and stays open for 15 s.
 */
export const github = createHttpClient(new GitHubApi(), {
  retry: { attempts: 2, backoff: 'exponential' },
  circuitBreaker: { threshold: 3, timeout: 15_000 },
});

/**
 * MCP server handle returned by {@link createMCP}.
 *
 * The server starts automatically when this module is imported.
 * Call `handle.stop()` for a graceful shutdown (e.g. in tests or on SIGTERM).
 */
export default createMCP({
  serviceId: 'context-generator',
  clients: [github],
  /**
   * Register all MCP tools against the server instance.
   *
   * Called once during server initialisation, before the HTTP listener or
   * stdio transport is started.  Tool handlers close over the module-level
   * {@link github} client so they inherit its retry and circuit-breaker
   * configuration automatically.
   *
   * @param server - The MCP SDK `McpServer` instance to register tools on.
   * @param ctx    - Runtime context; `ctx.logger` is a structured Pino logger
   *                 scoped to this service.
   */
  setup(server, { logger }) {
    server.tool(
      'get-bootstrap-context',
      'Fetch GitHub repository metadata to bootstrap context for a new project.',
      GetBootstrapContextSchema,
      async (args) => {
        logger.info({ args }, 'get-bootstrap-context called');
        const data = await github.getRepo(args.owner, args.repo);
        return { content: [{ type: 'text' as const, text: formatContext(data) }] };
      },
    );

    server.tool(
      'get-pr-context',
      'Fetch GitHub pull request metadata to provide context for code review or planning.',
      GetPRContextSchema,
      async (args) => {
        logger.info({ args }, 'get-pr-context called');
        const pr = await github.getPR(args.owner, args.repo, args.prNumber);
        return { content: [{ type: 'text' as const, text: formatPRContext(pr) }] };
      },
    );
  },
});
