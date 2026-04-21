import type { GitHubRepo, GitHubPR } from '../src/clients/github.js';

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GitHubApi } from '../src/clients/github.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const repoFixture: GitHubRepo = {
  id: 1,
  name: 'Hello-World',
  full_name: 'octocat/Hello-World',
  description: 'My first repository',
  default_branch: 'main',
  language: 'JavaScript',
  topics: ['octocat', 'atom'],
  visibility: 'public',
  html_url: 'https://github.com/octocat/Hello-World',
  stargazers_count: 1000,
  open_issues_count: 5,
};

const prFixture: GitHubPR = {
  id: 200,
  number: 42,
  title: 'fix: correct bug',
  body: 'Fixes the bug.',
  state: 'open',
  html_url: 'https://github.com/octocat/Hello-World/pull/42',
  user: { login: 'octocat' },
  head: { ref: 'fix/bug', sha: 'aaabbb' },
  base: { ref: 'main', sha: 'cccddd' },
  labels: [{ name: 'bug' }],
  draft: false,
  merged_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function mockErrorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ message: 'Not Found' }),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// GitHubApi.getRepo
// ---------------------------------------------------------------------------

describe('GitHubApi.getRepo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the correct URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse(repoFixture));
    const api = new GitHubApi('https://api.github.com', undefined);

    await api.getRepo('octocat', 'Hello-World');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/octocat/Hello-World');
  });

  it('returns the parsed repo object on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse(repoFixture));
    const api = new GitHubApi('https://api.github.com', undefined);

    const result = await api.getRepo('octocat', 'Hello-World');

    expect(result).toEqual(repoFixture);
  });

  it('includes Authorization header when token is provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse(repoFixture));
    const api = new GitHubApi('https://api.github.com', 'ghp_test_token');

    await api.getRepo('octocat', 'Hello-World');

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer ghp_test_token');
  });

  it('omits Authorization header when no token is provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse(repoFixture));
    const api = new GitHubApi('https://api.github.com', undefined);

    await api.getRepo('octocat', 'Hello-World');

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('always includes Accept and X-GitHub-Api-Version headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse(repoFixture));
    const api = new GitHubApi('https://api.github.com', undefined);

    await api.getRepo('octocat', 'Hello-World');

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Accept']).toBe('application/vnd.github+json');
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  it('throws when the API returns a non-2xx status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockErrorResponse(404));
    const api = new GitHubApi('https://api.github.com', undefined);

    await expect(api.getRepo('octocat', 'missing-repo')).rejects.toThrow(
      'GitHub API error 404 fetching repo octocat/missing-repo',
    );
  });

  it('throws for a 500 server error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockErrorResponse(500));
    const api = new GitHubApi('https://api.github.com', undefined);

    await expect(api.getRepo('octocat', 'Hello-World')).rejects.toThrow('GitHub API error 500');
  });

  it('uses a custom baseUrl when provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse(repoFixture));
    const api = new GitHubApi('https://github.example.com', undefined);

    await api.getRepo('octocat', 'Hello-World');

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://github.example.com/repos/octocat/Hello-World');
  });
});

// ---------------------------------------------------------------------------
// GitHubApi.getPR
// ---------------------------------------------------------------------------

describe('GitHubApi.getPR', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the correct URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse(prFixture));
    const api = new GitHubApi('https://api.github.com', undefined);

    await api.getPR('octocat', 'Hello-World', 42);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/octocat/Hello-World/pulls/42');
  });

  it('returns the parsed PR object on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse(prFixture));
    const api = new GitHubApi('https://api.github.com', undefined);

    const result = await api.getPR('octocat', 'Hello-World', 42);

    expect(result).toEqual(prFixture);
  });

  it('includes Authorization header when token is provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse(prFixture));
    const api = new GitHubApi('https://api.github.com', 'ghp_test_token');

    await api.getPR('octocat', 'Hello-World', 42);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer ghp_test_token');
  });

  it('omits Authorization header when no token is provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse(prFixture));
    const api = new GitHubApi('https://api.github.com', undefined);

    await api.getPR('octocat', 'Hello-World', 42);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('always includes Accept and X-GitHub-Api-Version headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse(prFixture));
    const api = new GitHubApi('https://api.github.com', undefined);

    await api.getPR('octocat', 'Hello-World', 42);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Accept']).toBe('application/vnd.github+json');
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  it('throws when the API returns a non-2xx status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockErrorResponse(404));
    const api = new GitHubApi('https://api.github.com', undefined);

    await expect(api.getPR('octocat', 'Hello-World', 42)).rejects.toThrow(
      'GitHub API error 404 fetching PR #42 in octocat/Hello-World',
    );
  });

  it('throws for a 401 unauthorized error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockErrorResponse(401));
    const api = new GitHubApi('https://api.github.com', undefined);

    await expect(api.getPR('octocat', 'Hello-World', 1)).rejects.toThrow('GitHub API error 401');
  });

  it('uses a custom baseUrl when provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockOkResponse(prFixture));
    const api = new GitHubApi('https://github.example.com', undefined);

    await api.getPR('octocat', 'Hello-World', 7);

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://github.example.com/repos/octocat/Hello-World/pulls/7');
  });
});
