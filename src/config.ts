import process from 'node:process';

import { z } from 'zod';

/**
 * Environment schema for the template MCP service.
 *
 * No variable is required by default — the template must run out of the
 * box with `bun src/index.ts`. Opt-in features (see `docs/database.md`)
 * extend this schema with their own required vars.
 */
const EnvSchema = z.object({
  /** Log level forwarded to the Pino-based logger in `@open-tomato/logger`. */
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  /**
   * Transport the MCP server uses. `stdio` is required by Claude Desktop
   * and MCP Inspector; leave unset (or set `http`) to use HTTP.
   */
  MCP_TRANSPORT: z.enum(['stdio', 'http']).optional(),

  // Uncomment when you enable the Drizzle opt-in (see docs/database.md):
  // DATABASE_URL: z.string().url(),
});

export type Config = z.infer<typeof EnvSchema>;

export const config: Config = EnvSchema.parse(process.env);
