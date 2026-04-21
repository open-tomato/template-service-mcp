# template-service-mcp — agent notes

This folder is a **template**, not a running service. It is the canonical
starting point for a new MCP server in the open-tomato ecosystem. When
you adopt it, everything in `src/` is a baseline — replace freely.

Umbrella context and conventions live in [../AGENTS.md](../AGENTS.md).
That file is authoritative for package-linking policy, commit format,
and refactor deletion rules.

## Golden rules for edits to this folder

1. **Template, not service.** Do not add domain code here. If you find
   yourself writing business logic, you are probably meant to be in a
   concrete service repo.
2. **Keep `src/` minimal.** `index.ts` + `server.ts` + `config.ts` +
   `tools/echo.ts` are the whole template. New patterns belong in
   `examples/` with a matching `docs/*.md` guide.
3. **Examples stay out of the TS program.** The `.example` suffix is
   the mechanism — don't add `examples/*.ts` or include it in
   `tsconfig.json`.
4. **Shared packages via `file:` refs.** Template consumers switch to
   published semver or GitHub refs when they adopt — see the README's
   "Adapting the template" section.
5. **Verify before commit.** `bun install && bun lint && bun run test &&
   bun run build` must stay green.

## Known caveats

- **SDK type cast in `src/server.ts`.** The template uses `file:` refs
  to `@open-tomato/mcp`, which causes Bun to install two nominally
  distinct copies of `@modelcontextprotocol/sdk` and `zod` (one per
  package boundary). TypeScript sees them as different types, triggering
  a deep-instantiation error on `server.registerTool`. The cast in
  `server.ts` erases that shape mismatch — once adopters replace the
  `file:` refs with a single published/GitHub ref, the cast is no longer
  necessary and should be dropped.
- **Tests excluded from `tsconfig.json`.** Following the umbrella
  gotcha-resolution pattern, `**/*.test.ts` is excluded so strict-mode
  type errors in test helpers don't block migration. Tests are still
  type-checked by vitest at runtime.
