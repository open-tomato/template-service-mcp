/**
 * MCP Knowledge Server entry point.
 * Imports server.ts which triggers createMCP to start the server automatically.
 *
 * Optional env:
 *   GITHUB_TOKEN  — GitHub personal access token for authenticated API requests
 *   PORT          — HTTP port to bind (default determined by createMCP)
 *   MCP_TRANSPORT — Transport mode: 'http' (default) or 'stdio'
 */

await import('./src/server.js');

export {};
