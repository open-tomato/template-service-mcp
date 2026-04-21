import { z } from 'zod';

/**
 * Input schema for the `get-bootstrap-context` tool.
 *
 * @property owner - GitHub account owner (user or organisation login).
 * @property repo  - Repository name (without the owner prefix).
 */
export const GetBootstrapContextSchema = {
  owner: z.string().describe('GitHub account owner (user or organisation login)'),
  repo: z.string().describe('Repository name'),
};

/**
 * Input schema for the `get-pr-context` tool.
 *
 * @property owner    - GitHub account owner (user or organisation login).
 * @property repo     - Repository name (without the owner prefix).
 * @property prNumber - Pull request number; must be a positive integer.
 */
export const GetPRContextSchema = {
  owner: z.string().describe('GitHub account owner (user or organisation login)'),
  repo: z.string().describe('Repository name'),
  prNumber: z.number().int()
    .positive()
    .describe('Pull request number'),
};
