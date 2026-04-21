# Drizzle + Postgres (opt-in)

Out of the box the template does not touch a database. Enable this when
your MCP server needs durable storage or reads from an existing SQL
schema.

## Dependencies to add

```sh
bun add drizzle-orm pg
bun add -d drizzle-kit @types/pg
```

## How to enable

1. Copy `examples/drizzle-db.ts.example` → `src/db/client.ts` (drop the
   `.example` suffix).
2. Update `src/config.ts` to require `DATABASE_URL`:

   ```ts
   const EnvSchema = z.object({
     LOG_LEVEL: z.enum([...]).default('info'),
     MCP_TRANSPORT: z.enum(['stdio', 'http']).optional(),
     DATABASE_URL: z.string().url(),
   });
   ```

3. Add `DATABASE_URL` to both `.env.example` and `.env`:

   ```text
   DATABASE_URL=postgres://user:pass@localhost:5432/mydb
   ```

4. Use `db` from inside tool handlers:

   ```ts
   import { db } from '../db/client.js';
   import { eq } from 'drizzle-orm';
   import { users } from '../db/schema.js';

   export async function handleGetUser({ id }: { id: string }) {
     const [row] = await db.select().from(users).where(eq(users.id, id));
     return { content: [{ type: 'text' as const, text: JSON.stringify(row) }] };
   }
   ```

5. Close the pool on shutdown. `createMCP` registers its own `SIGTERM`
   handler that does **not** know about your pool — wire a `closeDb()`
   call onto your own handler, or have the dependency accept `deps`
   from `@open-tomato/service-core` and provide an `onStop` hook.

## Notes

- The example client uses a single shared `Pool` with default size.
  Tune `max`, idle timeouts, and SSL per your deployment.
- For schema and migrations, run `bunx drizzle-kit` commands from the
  template root once `drizzle.config.ts` is in place.
- Tests that touch the database should spin up a disposable Postgres —
  see Testcontainers or a docker-compose stack.
