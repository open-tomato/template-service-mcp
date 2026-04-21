/**
 * Process entrypoint — validates env via `./config.js` and then imports
 * `./server.js`, which triggers `createMCP` to start the server.
 *
 * Run locally over stdio (for Claude Desktop and MCP Inspector):
 *
 *   MCP_TRANSPORT=stdio bun src/index.ts
 *
 * Run over HTTP (default when `MCP_TRANSPORT` is unset):
 *
 *   bun src/index.ts
 */

import './config.js';
import './server.js';
