# Tool handler conventions

Every tool lives in a single file under `src/tools/`. The file exports
four things so `src/server.ts` can assemble them in one
`server.registerTool` call:

```ts
// src/tools/my-tool.ts
import { z } from 'zod';

export const myToolName = 'my-tool' as const;
export const myToolDescription =
  'Short, action-oriented description — the client shows this to the LLM.';

export const myToolInputSchema = {
  // Each field is a zod schema. `describe()` surfaces documentation to
  // the client, which matters for LLM tool selection.
  owner: z.string().describe('GitHub org or user'),
  repo: z.string().describe('Repository name'),
};

export interface MyToolInput {
  owner: string;
  repo: string;
}

export function handleMyTool({ owner, repo }: MyToolInput): {
  content: Array<{ type: 'text'; text: string }>;
} {
  // Business logic here.
  return { content: [{ type: 'text', text: `${owner}/${repo}` }] };
}
```

Then in `src/server.ts`:

```ts
import {
  myToolName,
  myToolDescription,
  myToolInputSchema,
  handleMyTool,
} from './tools/my-tool.js';

// Inside the setup() callback:
server.registerTool(
  myToolName,
  { description: myToolDescription, inputSchema: myToolInputSchema },
  handleMyTool,
);
```

## Input validation

- The `inputSchema` must be a **zod raw shape** — an object of zod
  schemas, not a full `z.object(...)`. `@modelcontextprotocol/sdk` wraps
  it in `z.object()` internally.
- Each input field should call `.describe('...')` with a one-line
  explanation. The MCP client exposes these to the LLM when it chooses
  which tool to call.
- Add `.default(...)` to make a field optional with a sensible fallback.

## Return shape

Every handler returns `{ content: [{ type, text }, ...] }`. `type` is
`'text'` in the common case. Other supported values include `'image'`,
`'audio'`, and `'resource'` — see the MCP SDK docs for the full list.

Use `as const` on the `type` literal inside the content array so
TypeScript preserves the narrow type rather than widening to `string`.

## Error shape

Throw a regular `Error` from the handler. `@open-tomato/mcp` will
surface the message through the MCP `error` channel; the client receives
a JSON-RPC error response with the thrown message.

For structured errors, throw an instance of a subclass or return
`{ content: [...], isError: true }`. See the SDK docs.

## Logging

If your tool needs structured logging, accept `logger` from
`setup(server, { logger }) { ... }` and pass it to the handler — or read
it from a module-level closure. The logger is scoped to the service's
`serviceId` and emits Pino JSON lines.

## Testing

Every tool should have a vitest file under `tests/` that uses
`InMemoryTransport.createLinkedPair()` from
`@modelcontextprotocol/sdk/inMemory.js` — see
[`tests/echo.test.ts`](../tests/echo.test.ts) as the canonical example.
The test creates an `McpServer`, registers the tool, then connects a
`Client` over a linked in-memory transport and calls it.
