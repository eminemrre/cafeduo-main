/**
 * Additional branch coverage tests for lib/socket.ts
 * Targets uncovered branches: resolveSocketUrl fallback paths, enforceBrowserHttps
 */

import { normalizeBaseUrl } from './socket';

describe('socket.ts branch coverage', () => {
  describe('normalizeBaseUrl', () => {
    it('returns empty string-based URL for relative path', () => {
      const result = normalizeBaseUrl('/api');
      expect(result).toBe('');
    });

    it('prepends http:// for localhost', () => {
      expect(normalizeBaseUrl('localhost:3001')).toBe('http://localhost:3001');
    });

    it('prepends http:// for 127.0.0.1', () => {
      expect(normalizeBaseUrl('127.0.0.1:3001')).toBe('http://127.0.0.1:3001');
    });

    it('prepends https:// for non-local hostnames', () => {
      expect(normalizeBaseUrl('cafeduotr.com')).toBe('https://cafeduotr.com');
    });

    it('strips trailing slashes', () => {
      expect(normalizeBaseUrl('https://example.com/')).toBe('https://example.com');
    });

    it('strips /api suffix', () => {
      expect(normalizeBaseUrl('https://example.com/api')).toBe('https://example.com');
    });

    it('trims input whitespace', () => {
      expect(normalizeBaseUrl('  https://example.com  ')).toBe('https://example.com');
    });

    it('passes through https URLs', () => {
      expect(normalizeBaseUrl('https://example.com')).toBe('https://example.com');
    });

    it('passes through http URLs', () => {
      expect(normalizeBaseUrl('http://example.com')).toBe('http://example.com');
    });

    it('upgrades http to https when browser is on https (protocolOverride)', () => {
      const result = normalizeBaseUrl('http://example.com', { protocol: 'https:' });
      expect(result).toBe('https://example.com');
    });

    it('keeps http://localhost even when browser is on https', () => {
      const result = normalizeBaseUrl('http://localhost:3001', { protocol: 'https:' });
      expect(result).toBe('http://localhost:3001');
    });

    it('keeps http://127.0.0.1 even when browser is on https', () => {
      const result = normalizeBaseUrl('http://127.0.0.1:3001', { protocol: 'https:' });
      expect(result).toBe('http://127.0.0.1:3001');
    });

    it('does not upgrade when protocol is http:', () => {
      const result = normalizeBaseUrl('http://example.com', { protocol: 'http:' });
      expect(result).toBe('http://example.com');
    });

    it('does not upgrade https URLs', () => {
      const result = normalizeBaseUrl('https://example.com', { protocol: 'https:' });
      expect(result).toBe('https://example.com');
    });
  });
});
