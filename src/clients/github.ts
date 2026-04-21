/**
 * @module clients/github
 * HTTP client for the GitHub REST API.
 * Consumed by {@link server} via `createHttpClient`.
 */

/** Minimal shape of a GitHub repository returned by the REST API. */
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  default_branch: string;
  language: string | null;
  topics: string[];
  visibility: string;
  html_url: string;
  stargazers_count: number;
  open_issues_count: number;
}

/** Minimal shape of a GitHub pull request returned by the REST API. */
export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user: {
    login: string;
  };
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  labels: Array<{ name: string }>;
  draft: boolean;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * HTTP client for the GitHub REST API.
 *
 * Authenticates using the `GITHUB_TOKEN` environment variable when present.
 * Intended to be wrapped with `createHttpClient` from `@open-tomato/mcp`
 * to gain retry and circuit-breaker protection.
 */
export class GitHubApi {
  readonly #baseUrl: string;
  readonly #token: string | undefined;

  /**
   * @param baseUrl - GitHub REST API base URL. Defaults to `https://api.github.com`.
   * @param token   - Personal access token or GitHub App installation token used
   *                  for authentication. Falls back to `GITHUB_TOKEN` env var.
   */
  constructor(
    baseUrl = 'https://api.github.com',
    token: string | undefined = process.env['GITHUB_TOKEN'],
  ) {
    this.#baseUrl = baseUrl;
    this.#token = token;
  }

  /**
   * Fetch metadata for a GitHub repository.
   *
   * @param owner - The account owner of the repository (user or organisation login).
   * @param repo  - The name of the repository.
   * @returns A {@link GitHubRepo} object with the repository metadata.
   * @throws {Error} When the GitHub API returns a non-2xx response.
   */
  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    const url = `${this.#baseUrl}/repos/${owner}/${repo}`;
    const res = await fetch(url, { headers: this.#headers() });

    if (!res.ok) {
      throw new Error(`GitHub API error ${res.status} fetching repo ${owner}/${repo}`);
    }

    return res.json() as Promise<GitHubRepo>;
  }

  /**
   * Fetch metadata for a pull request.
   *
   * @param owner    - The account owner of the repository (user or organisation login).
   * @param repo     - The name of the repository.
   * @param prNumber - The pull request number.
   * @returns A {@link GitHubPR} object with the pull request metadata.
   * @throws {Error} When the GitHub API returns a non-2xx response.
   */
  async getPR(owner: string, repo: string, prNumber: number): Promise<GitHubPR> {
    const url = `${this.#baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`;
    const res = await fetch(url, { headers: this.#headers() });

    if (!res.ok) {
      throw new Error(`GitHub API error ${res.status} fetching PR #${prNumber} in ${owner}/${repo}`);
    }

    return res.json() as Promise<GitHubPR>;
  }

  #headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (this.#token) {
      headers['Authorization'] = `Bearer ${this.#token}`;
    }

    return headers;
  }
}
