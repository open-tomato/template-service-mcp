# template-service-mcp

A minimal [Model Context Protocol](https://modelcontextprotocol.io) (MCP)
service boilerplate built on top of
[`@open-tomato/mcp`](../packages/service/mcp). Copy this folder as the
starting point for a new MCP server that hosts tools, resources, or
prompts for Claude Desktop, Claude Code, or any MCP-capable client.

## What MCP is

MCP is an open protocol that lets LLM applications discover and call
capabilities exposed by external servers. A server advertises `tools`
(callable functions), `resources` (readable documents), and `prompts`
(reusable prompt templates); the client uses them during a conversation.

The server talks to the client over a **transport**. Two are in play in
this template:

- **`stdio`** — the server reads JSON-RPC messages from `stdin` and writes
  responses to `stdout`. This is what Claude Desktop and most local MCP
  clients use. Launch with `MCP_TRANSPORT=stdio bun src/index.ts`.
- **`http`** — the server listens on `PORT` (default `8080`) using the
  `WebStandardStreamableHTTPServerTransport`. Useful for deployed
  servers. This is the default when `MCP_TRANSPORT` is unset.

`@open-tomato/mcp` handles transport wiring, health endpoints (HTTP
mode), and `SIGTERM` draining — the template only needs to hand it a
`setup(server, ctx)` callback where tools are registered.

## Quick start

```sh
bun install
cp .env.example .env   # optional — the template runs with no env vars
MCP_TRANSPORT=stdio bun src/index.ts
```

Exercise the server with the official
[MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```sh
bunx @modelcontextprotocol/inspector bun src/index.ts
```

Set `MCP_TRANSPORT=stdio` in the inspector's env, then call the `echo`
tool with `{ "text": "hello" }` — it should return the same string.

## What is in the template

```text
src/
├── index.ts          # entrypoint — validates env then starts server
├── server.ts         # createMCP call + tool registration
├── config.ts         # zod env schema (LOG_LEVEL, MCP_TRANSPORT)
└── tools/
    └── echo.ts       # sample tool: zod schema, description, handler
tests/
└── echo.test.ts      # in-memory MCP Client <-> Server round-trip
```

Nothing else. No database, no opinion about HTTP clients — those are
opt-in (see below).

## Adding a tool

1. Create `src/tools/my-tool.ts`, exporting `name`, `description`,
   `inputSchema`, and a `handler` function. See
   [`src/tools/echo.ts`](./src/tools/echo.ts) as the canonical example and
   [`docs/tools.md`](./docs/tools.md) for conventions.
2. In [`src/server.ts`](./src/server.ts), import the pieces and call
   `server.registerTool(name, { description, inputSchema }, handler)`.
3. Add a vitest file under `tests/` following `tests/echo.test.ts`.

## Opt-in features

| Feature | Example | Docs |
|---------|---------|------|
| Drizzle + Postgres | [`examples/drizzle-db.ts.example`](./examples/drizzle-db.ts.example) | [`docs/database.md`](./docs/database.md) |

## Adapting the template

The `@open-tomato/*` packages in `package.json` use `file:` refs pointing
at the sibling `../packages/` tree. That works inside the open-tomato
umbrella but not after you copy the template elsewhere. Pick one:

1. **Published semver** (preferred once packages are on the npm org
   registry): `"@open-tomato/mcp": "^1.0.0"`
2. **GitHub ref** (pre-publish): `"@open-tomato/mcp": "user/open-tomato-mcp#semver:^1.0.0"`
3. **Relative `file:` path** — keep `file:` but update paths for the new
   layout.

## Scripts

| Command | Purpose |
|---------|---------|
| `bun run dev` | Watch-mode server (`bun --watch src/index.ts`) |
| `bun run start` | One-shot run |
| `bun run build` | Type-check (`tsc --noEmit`) |
| `bun run check-types` | Alias for `build` |
| `bun run lint` | ESLint |
| `bun run test` | Vitest |
