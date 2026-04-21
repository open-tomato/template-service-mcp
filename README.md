# context-generator MCP

A Model Context Protocol server that fetches GitHub repository and pull-request metadata for use by Claude Code and other MCP clients.

## Overview

This server exposes two tools:

- **`get-bootstrap-context`** — fetches repository metadata to bootstrap context for a new project
- **`get-pr-context`** — fetches pull-request metadata for code review or planning

It is built with `createMCP` from `@open-tomato/mcp`, which handles transport selection, health-check serving, and graceful shutdown automatically.

## Running the server

### HTTP mode (default)

```sh
GITHUB_TOKEN=ghp_... PORT=8080 bun run start
```

The MCP endpoint is available at `http://localhost:8080` (all paths). The health endpoint is served separately on port `3001`.

### stdio mode

```sh
GITHUB_TOKEN=ghp_... MCP_TRANSPORT=stdio bun run start
```

Use this mode when connecting from Claude Desktop or another stdio-based MCP client.

### Development (watch mode)

```sh
GITHUB_TOKEN=ghp_... bun run dev
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GITHUB_TOKEN` | No | — | GitHub personal access token or App installation token. Without it, requests are made unauthenticated and subject to lower rate limits. |
| `PORT` | No | `8080` | Port for the MCP HTTP transport (HTTP mode only). |
| `MCP_TRANSPORT` | No | `http` | Set to `stdio` to switch to stdio transport. |

## Health endpoint

In HTTP mode a standalone health server listens on port `3001` at `GET /health`.

**Response shape:**

```json
{
  "status": "ok",
  "serviceId": "context-generator",
  "clients": {
    "http-client": { "status": "running" }
  }
}
```

**`status` values:**

| Value | Meaning |
|---|---|
| `ok` | All clients are running normally. |
| `degraded` | One or more clients are still starting up. |
| `error` | One or more clients have entered the error state (circuit open). |

**Circuit-breaker behaviour:** The GitHub client is wrapped with a circuit breaker that opens after 3 consecutive failures and stays open for 15 seconds. While open, the client `status` will be `error` and all calls fail immediately without hitting GitHub. After 15 seconds the circuit resets and the next call is attempted.

## Tools

### `get-bootstrap-context`

Fetches GitHub repository metadata.

**Input:**

```typescript
{
  owner: string  // GitHub account or organisation login
  repo:  string  // Repository name
}
```

**Output:** Plain-text summary of the repository (name, description, language, topics, visibility, default branch, star count, open issue count, URL).

---

### `get-pr-context`

Fetches GitHub pull-request metadata.

**Input:**

```typescript
{
  owner:    string  // GitHub account or organisation login
  repo:     string  // Repository name
  prNumber: number  // Pull request number
}
```

**Output:** Plain-text summary of the pull request (title, author, state, branches, labels, draft status, merge status, URL, body).

## Architecture

```
src/
  server.ts          # createMCP call — tool registration and entry point
  clients/
    github.ts        # GitHubApi class (raw HTTP calls to GitHub REST API)
  schemas/
    index.ts         # Zod schemas: GetBootstrapContextSchema, GetPRContextSchema
  formatters/
    index.ts         # formatContext, formatPRContext — text rendering utilities
tests/
  unit/              # Unit tests for formatters, schemas, GitHubApi, and setup callback
  integration/       # Integration tests for /health and MCP tool calls over HTTP
```

`createMCP` starts the server immediately on import — no explicit `start()` call is needed. The returned handle exposes `stop()` for graceful shutdown in tests or on `SIGTERM` (which is also handled automatically).
