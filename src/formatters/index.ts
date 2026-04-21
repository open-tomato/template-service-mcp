import type { GitHubRepo, GitHubPR } from '../clients/github.js';

/**
 * Formats a GitHub repository metadata object into a human-readable text block.
 *
 * @param repo - The {@link GitHubRepo} object returned by the GitHub API.
 * @returns A formatted string describing the repository.
 */
export function formatContext(repo: GitHubRepo): string {
  return JSON.stringify(repo, null, 2);
}

/**
 * Formats a GitHub pull request metadata object into a human-readable text block.
 *
 * @param pr - The {@link GitHubPR} object returned by the GitHub API.
 * @returns A formatted string describing the pull request.
 */
export function formatPRContext(pr: GitHubPR): string {
  return JSON.stringify(pr, null, 2);
}
