/**
 * @module db/schema
 * Infrastructure layer — Drizzle ORM table definitions and inferred TypeScript types.
 * Mirrors the main vibe-toolbox schema for use in the MCP server.
 * Consumed by {@link queries/tag-intersection}.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  real,
  boolean,
  integer,
  jsonb,
  timestamp,
  primaryKey,
  uniqueIndex,
  vector,
} from 'drizzle-orm/pg-core';

// --- Enums ---

export const tagCategoryEnum = pgEnum('tag_category', [
  'library',
  'stack',
  'feature_type',
  'dependency',
]);

export const artifactTypeEnum = pgEnum('artifact_type', [
  'AGENTS_MD',
  'SKILLS_MD',
  'CLAUDE_MD',
  'SNIPPET',
  'TOOL_DEF',
]);

// --- Tables ---

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey()
    .defaultRandom(),
  category: tagCategoryEnum('category').notNull(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at').notNull()
    .defaultNow(),
});

export const repos = pgTable('repos', {
  id: uuid('id').primaryKey()
    .defaultRandom(),
  nwo: text('nwo').notNull()
    .unique(),
  ownerId: text('owner_id').notNull(),
  repoGithubId: text('repo_github_id').notNull()
    .unique(),
  score: real('score'),
  isMonitored: boolean('is_monitored').notNull()
    .default(false),
  blobShaMap: jsonb('blob_sha_map'),
  lastCheckedAt: timestamp('last_checked_at'),
  createdAt: timestamp('created_at').notNull()
    .defaultNow(),
});

export const repoTags = pgTable(
  'repo_tags',
  {
    repoId: uuid('repo_id').notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id').notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.repoId, t.tagId] })],
);

export const artifacts = pgTable('artifacts', {
  id: uuid('id').primaryKey()
    .defaultRandom(),
  repoId: uuid('repo_id').notNull()
    .references(() => repos.id, { onDelete: 'cascade' }),
  type: artifactTypeEnum('type').notNull(),
  content: text('content').notNull(),
  summary: text('summary'),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at').notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at').notNull()
    .defaultNow(),
}, (t) => [uniqueIndex('artifacts_repo_id_type_unique').on(t.repoId, t.type)]);

export const artifactTags = pgTable(
  'artifact_tags',
  {
    artifactId: uuid('artifact_id').notNull()
      .references(() => artifacts.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id').notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.artifactId, t.tagId] })],
);

export const guidelines = pgTable('guidelines', {
  id: uuid('id').primaryKey()
    .defaultRandom(),
  artifactId: uuid('artifact_id').notNull()
    .references(() => artifacts.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  version: integer('version').notNull()
    .default(1),
  stackCanonical: text('stack_canonical'),
  createdAt: timestamp('created_at').notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at').notNull()
    .defaultNow(),
});

export const queryLog = pgTable('query_log', {
  id: uuid('id').primaryKey()
    .defaultRandom(),
  toolName: text('tool_name').notNull(),
  inputTags: jsonb('input_tags').notNull(),
  resultCount: integer('result_count').notNull(),
  queriedAt: timestamp('queried_at').notNull()
    .defaultNow(),
});

export const pipelineLog = pgTable('pipeline_log', {
  id: uuid('id').primaryKey()
    .defaultRandom(),
  nwo: text('nwo').notNull(),
  repoId: uuid('repo_id').references(() => repos.id, { onDelete: 'set null' }),
  outcome: text('outcome').notNull(),
  filesFetched: integer('files_fetched').notNull()
    .default(0),
  filesAccepted: integer('files_accepted').notNull()
    .default(0),
  artifactsWritten: integer('artifacts_written').notNull()
    .default(0),
  runAt: timestamp('run_at').notNull()
    .defaultNow(),
});

// --- Inferred types ---

export type Tag = typeof tags.$inferSelect;
export type Artifact = typeof artifacts.$inferSelect;
export type Guideline = typeof guidelines.$inferSelect;

export type TagCategory = (typeof tagCategoryEnum.enumValues)[number];
export type ArtifactType = (typeof artifactTypeEnum.enumValues)[number];
