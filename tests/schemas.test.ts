import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { GetBootstrapContextSchema, GetPRContextSchema } from '../src/schemas/index.js';

// ---------------------------------------------------------------------------
// GetBootstrapContextSchema
// ---------------------------------------------------------------------------

const BootstrapSchema = z.object(GetBootstrapContextSchema);

describe('GetBootstrapContextSchema', () => {
  describe('valid payloads', () => {
    it('accepts owner and repo as non-empty strings', () => {
      const result = BootstrapSchema.safeParse({ owner: 'octocat', repo: 'Hello-World' });
      expect(result.success).toBe(true);
    });

    it('accepts an owner with hyphens and dots', () => {
      const result = BootstrapSchema.safeParse({ owner: 'my-org.io', repo: 'my-repo' });
      expect(result.success).toBe(true);
    });

    it('accepts an empty string for owner and repo', () => {
      // Zod string() allows empty strings by default
      const result = BootstrapSchema.safeParse({ owner: '', repo: '' });
      expect(result.success).toBe(true);
    });

    it('ignores unknown extra fields', () => {
      const result = BootstrapSchema.safeParse({ owner: 'octocat', repo: 'Hello-World', extra: 'ignored' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>)['extra']).toBeUndefined();
      }
    });
  });

  describe('invalid payloads', () => {
    it('rejects missing owner', () => {
      const result = BootstrapSchema.safeParse({ repo: 'Hello-World' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'owner')).toBe(true);
      }
    });

    it('rejects missing repo', () => {
      const result = BootstrapSchema.safeParse({ owner: 'octocat' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'repo')).toBe(true);
      }
    });

    it('rejects numeric owner', () => {
      const result = BootstrapSchema.safeParse({ owner: 123, repo: 'Hello-World' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'owner')).toBe(true);
      }
    });

    it('rejects numeric repo', () => {
      const result = BootstrapSchema.safeParse({ owner: 'octocat', repo: 456 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'repo')).toBe(true);
      }
    });

    it('rejects null owner', () => {
      const result = BootstrapSchema.safeParse({ owner: null, repo: 'Hello-World' });
      expect(result.success).toBe(false);
    });

    it('rejects null repo', () => {
      const result = BootstrapSchema.safeParse({ owner: 'octocat', repo: null });
      expect(result.success).toBe(false);
    });

    it('rejects completely empty object', () => {
      const result = BootstrapSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path[0]);
        expect(paths).toContain('owner');
        expect(paths).toContain('repo');
      }
    });
  });
});

// ---------------------------------------------------------------------------
// GetPRContextSchema
// ---------------------------------------------------------------------------

const PRSchema = z.object(GetPRContextSchema);

describe('GetPRContextSchema', () => {
  describe('valid payloads', () => {
    it('accepts owner, repo, and a positive integer prNumber', () => {
      const result = PRSchema.safeParse({ owner: 'octocat', repo: 'Hello-World', prNumber: 1 });
      expect(result.success).toBe(true);
    });

    it('accepts a large prNumber', () => {
      const result = PRSchema.safeParse({ owner: 'octocat', repo: 'Hello-World', prNumber: 99999 });
      expect(result.success).toBe(true);
    });

    it('ignores unknown extra fields', () => {
      const result = PRSchema.safeParse({ owner: 'octocat', repo: 'Hello-World', prNumber: 7, extra: true });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>)['extra']).toBeUndefined();
      }
    });
  });

  describe('invalid payloads', () => {
    it('rejects missing owner', () => {
      const result = PRSchema.safeParse({ repo: 'Hello-World', prNumber: 1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'owner')).toBe(true);
      }
    });

    it('rejects missing repo', () => {
      const result = PRSchema.safeParse({ owner: 'octocat', prNumber: 1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'repo')).toBe(true);
      }
    });

    it('rejects missing prNumber', () => {
      const result = PRSchema.safeParse({ owner: 'octocat', repo: 'Hello-World' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'prNumber')).toBe(true);
      }
    });

    it('rejects prNumber of zero', () => {
      const result = PRSchema.safeParse({ owner: 'octocat', repo: 'Hello-World', prNumber: 0 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'prNumber')).toBe(true);
      }
    });

    it('rejects negative prNumber', () => {
      const result = PRSchema.safeParse({ owner: 'octocat', repo: 'Hello-World', prNumber: -1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'prNumber')).toBe(true);
      }
    });

    it('rejects fractional prNumber', () => {
      const result = PRSchema.safeParse({ owner: 'octocat', repo: 'Hello-World', prNumber: 1.5 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'prNumber')).toBe(true);
      }
    });

    it('rejects string prNumber', () => {
      const result = PRSchema.safeParse({ owner: 'octocat', repo: 'Hello-World', prNumber: '7' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'prNumber')).toBe(true);
      }
    });

    it('rejects null prNumber', () => {
      const result = PRSchema.safeParse({ owner: 'octocat', repo: 'Hello-World', prNumber: null });
      expect(result.success).toBe(false);
    });

    it('rejects completely empty object', () => {
      const result = PRSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path[0]);
        expect(paths).toContain('owner');
        expect(paths).toContain('repo');
        expect(paths).toContain('prNumber');
      }
    });
  });
});
