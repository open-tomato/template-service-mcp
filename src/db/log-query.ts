/**
 * @module db/log-query
 * Infrastructure layer — fire-and-forget query logging to query_log table.
 * Consumed by MCP tool handlers.
 */

import { db } from './client.js';
import { queryLog } from './schema.js';

export type TagFilter = { category: string; values: string[] };

export async function logQuery(
  toolName: string,
  inputTags: TagFilter[],
  resultCount: number,
): Promise<void> {
  await db.insert(queryLog).values({ toolName, inputTags, resultCount });
}
