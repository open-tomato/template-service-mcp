/**
 * @module queries/tag-intersection
 * Infrastructure layer — tag-based artifact and guideline queries.
 * Implements AND semantics across tag categories, OR within a category.
 * Consumed by {@link tools/get-bootstrap-context}, {@link tools/get-planning-context}, {@link tools/get-task-context}.
 */

import { and, eq, gte, inArray } from 'drizzle-orm';

import { db } from '../db/client.js';
import {
  type Artifact,
  type ArtifactType,
  type Guideline,
  type TagCategory,
  artifactTags,
  artifacts,
  guidelines,
  tags,
} from '../db/schema.js';

export type TagFilter = {
  category: TagCategory;
  values: string[];
};

/**
 * Returns artifact IDs that satisfy all category filters (AND across categories, OR within).
 * Filters with empty values arrays are skipped.
 * Returns null when all filters are empty (caller decides how to handle).
 */
async function getMatchingArtifactIds(filters: TagFilter[]): Promise<string[] | null> {
  const activeFilters = filters.filter((f) => f.values.length > 0);
  if (activeFilters.length === 0) return null;

  // For each category, get the set of artifact IDs that have at least one matching tag
  const idSets = await Promise.all(
    activeFilters.map(async ({ category, values }) => {
      const rows = await db
        .select({ artifactId: artifactTags.artifactId })
        .from(artifactTags)
        .innerJoin(tags, eq(tags.id, artifactTags.tagId))
        .where(and(eq(tags.category, category), inArray(tags.value, values)));
      return new Set(rows.map((r) => r.artifactId));
    }),
  );

  // Intersect all sets: AND semantics across categories
  const [first, ...rest] = idSets;
  if (!first) return [];
  const intersection = rest.reduce(
    (acc, set) => new Set([...acc].filter((id) => set.has(id))),
    first,
  );

  return [...intersection];
}

/**
 * Queries artifacts matching tag filters, optionally filtered by artifact type and/or created-after timestamp.
 *
 * @param filters - Tag category filters (AND across categories, OR within)
 * @param types - Optional artifact types to include; all types returned if omitted
 * @param since - Optional lower bound on `created_at`; only newer artifacts returned if provided
 * @returns Matching artifacts ordered by creation date descending
 */
export async function queryArtifacts(
  filters: TagFilter[],
  types?: ArtifactType[],
  since?: Date,
): Promise<Artifact[]> {
  const ids = await getMatchingArtifactIds(filters);

  // No active filters and no type constraint → return nothing (avoid full table scan)
  if (ids === null && !types?.length) return [];

  const conditions = [];

  if (ids !== null) {
    if (ids.length === 0) return [];
    conditions.push(inArray(artifacts.id, ids));
  }

  if (types?.length) {
    conditions.push(inArray(artifacts.type, types));
  }

  if (since) {
    conditions.push(gte(artifacts.createdAt, since));
  }

  return db
    .select()
    .from(artifacts)
    .where(conditions.length > 0
      ? and(...conditions)
      : undefined)
    .orderBy(artifacts.createdAt);
}

/**
 * Queries guidelines whose source artifact matches the tag filters.
 * Optionally returns only guidelines updated after `since`.
 *
 * @param filters - Tag category filters (AND across categories, OR within)
 * @param since - Optional lower bound on `updated_at` for delta queries
 * @returns Matching guidelines ordered by update date descending
 */
export async function queryGuidelines(filters: TagFilter[], since?: Date): Promise<Guideline[]> {
  const ids = await getMatchingArtifactIds(filters);

  if (ids === null || ids.length === 0) return [];

  const conditions = [inArray(guidelines.artifactId, ids)];

  if (since) {
    conditions.push(gte(guidelines.updatedAt, since));
  }

  return db
    .select()
    .from(guidelines)
    .where(and(...conditions))
    .orderBy(guidelines.updatedAt);
}
