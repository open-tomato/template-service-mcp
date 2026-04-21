import type { GitHubRepo, GitHubPR } from '../src/clients/github.js';

import { describe, it, expect } from 'vitest';

import { formatContext, formatPRContext } from '../src/formatters/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseRepo: GitHubRepo = {
  id: 1,
  name: 'my-repo',
  full_name: 'owner/my-repo',
  description: 'A test repository',
  default_branch: 'main',
  language: 'TypeScript',
  topics: ['typescript', 'testing'],
  visibility: 'public',
  html_url: 'https://github.com/owner/my-repo',
  stargazers_count: 42,
  open_issues_count: 3,
};

const basePR: GitHubPR = {
  id: 100,
  number: 7,
  title: 'feat: add formatters',
  body: 'This PR adds formatter utilities.',
  state: 'open',
  html_url: 'https://github.com/owner/my-repo/pull/7',
  user: { login: 'alice' },
  head: { ref: 'feature/formatters', sha: 'abc123' },
  base: { ref: 'main', sha: 'def456' },
  labels: [{ name: 'enhancement' }],
  draft: false,
  merged_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
};

// ---------------------------------------------------------------------------
// formatContext
// ---------------------------------------------------------------------------

describe('formatContext', () => {
  it('returns pretty-printed JSON for a nominal repo', () => {
    const result = formatContext(baseRepo);
    expect(result).toBe(JSON.stringify(baseRepo, null, 2));
  });

  it('output is valid JSON that round-trips to the original object', () => {
    const result = formatContext(baseRepo);
    expect(JSON.parse(result)).toEqual(baseRepo);
  });

  it('handles null description', () => {
    const repo: GitHubRepo = { ...baseRepo, description: null };
    const result = formatContext(repo);
    const parsed = JSON.parse(result) as GitHubRepo;
    expect(parsed.description).toBeNull();
  });

  it('handles null language', () => {
    const repo: GitHubRepo = { ...baseRepo, language: null };
    const result = formatContext(repo);
    const parsed = JSON.parse(result) as GitHubRepo;
    expect(parsed.language).toBeNull();
  });

  it('handles empty topics array', () => {
    const repo: GitHubRepo = { ...baseRepo, topics: [] };
    const result = formatContext(repo);
    const parsed = JSON.parse(result) as GitHubRepo;
    expect(parsed.topics).toEqual([]);
  });

  it('handles zero counts', () => {
    const repo: GitHubRepo = { ...baseRepo, stargazers_count: 0, open_issues_count: 0 };
    const result = formatContext(repo);
    const parsed = JSON.parse(result) as GitHubRepo;
    expect(parsed.stargazers_count).toBe(0);
    expect(parsed.open_issues_count).toBe(0);
  });

  it('preserves all fields in the output', () => {
    const result = formatContext(baseRepo);
    const parsed = JSON.parse(result) as GitHubRepo;
    expect(parsed).toEqual(baseRepo);
  });
});

// ---------------------------------------------------------------------------
// formatPRContext
// ---------------------------------------------------------------------------

describe('formatPRContext', () => {
  it('returns pretty-printed JSON for a nominal PR', () => {
    const result = formatPRContext(basePR);
    expect(result).toBe(JSON.stringify(basePR, null, 2));
  });

  it('output is valid JSON that round-trips to the original object', () => {
    const result = formatPRContext(basePR);
    expect(JSON.parse(result)).toEqual(basePR);
  });

  it('handles null body', () => {
    const pr: GitHubPR = { ...basePR, body: null };
    const result = formatPRContext(pr);
    const parsed = JSON.parse(result) as GitHubPR;
    expect(parsed.body).toBeNull();
  });

  it('handles null merged_at for an open PR', () => {
    const pr: GitHubPR = { ...basePR, merged_at: null, state: 'open' };
    const result = formatPRContext(pr);
    const parsed = JSON.parse(result) as GitHubPR;
    expect(parsed.merged_at).toBeNull();
  });

  it('handles a merged PR with merged_at timestamp', () => {
    const pr: GitHubPR = { ...basePR, state: 'closed', merged_at: '2024-01-03T12:00:00Z' };
    const result = formatPRContext(pr);
    const parsed = JSON.parse(result) as GitHubPR;
    expect(parsed.merged_at).toBe('2024-01-03T12:00:00Z');
    expect(parsed.state).toBe('closed');
  });

  it('handles empty labels array', () => {
    const pr: GitHubPR = { ...basePR, labels: [] };
    const result = formatPRContext(pr);
    const parsed = JSON.parse(result) as GitHubPR;
    expect(parsed.labels).toEqual([]);
  });

  it('handles multiple labels', () => {
    const pr: GitHubPR = { ...basePR, labels: [{ name: 'bug' }, { name: 'priority: high' }] };
    const result = formatPRContext(pr);
    const parsed = JSON.parse(result) as GitHubPR;
    expect(parsed.labels).toEqual([{ name: 'bug' }, { name: 'priority: high' }]);
  });

  it('handles draft PR', () => {
    const pr: GitHubPR = { ...basePR, draft: true };
    const result = formatPRContext(pr);
    const parsed = JSON.parse(result) as GitHubPR;
    expect(parsed.draft).toBe(true);
  });

  it('preserves nested head and base refs', () => {
    const result = formatPRContext(basePR);
    const parsed = JSON.parse(result) as GitHubPR;
    expect(parsed.head).toEqual({ ref: 'feature/formatters', sha: 'abc123' });
    expect(parsed.base).toEqual({ ref: 'main', sha: 'def456' });
  });

  it('preserves all fields in the output', () => {
    const result = formatPRContext(basePR);
    const parsed = JSON.parse(result) as GitHubPR;
    expect(parsed).toEqual(basePR);
  });
});
