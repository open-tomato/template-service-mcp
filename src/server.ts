/**
 * MCP server entrypoint — constructs the server via `createMCP` and
 * registers every tool. Transport selection (stdio vs HTTP) is resolved
 * inside `@open-tomato/mcp` from the `MCP_TRANSPORT` env var.
 */

import { createMCP } from '@open-tomato/mcp';

import {
  echoDescription,
  echoInputSchema,
  echoName,
  handleEcho,
} from './tools/echo.js';

export default createMCP({
  serviceId: '@open-tomato/template-service-mcp',
  setup(server) {
    // While this template uses `file:` refs for `@open-tomato/*` packages,
    // TypeScript sees two nominally-distinct copies of the MCP SDK + zod
    // (one via the template's node_modules, one via the linked package's),
    // which triggers a deep-instantiation error on `registerTool`. The
    // runtime types are identical — so we erase the compile-time shape
    // here. Adopters who replace the `file:` refs with a published/github
    // ref (see README "Adapting the template") drop this cast.
    (server as unknown as {
      registerTool: (
        name: string,
        config: { description: string; inputSchema: typeof echoInputSchema },
        cb: typeof handleEcho,
      ) => void;
    }).registerTool(
      echoName,
      { description: echoDescription, inputSchema: echoInputSchema },
      handleEcho,
    );
  },
});
