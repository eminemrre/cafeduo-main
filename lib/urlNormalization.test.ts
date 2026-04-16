import { normalizeApiBaseUrl } from './api';
import { normalizeBaseUrl } from './socket';

describe('URL normalization helpers', () => {
  it('normalizes API base URL with https for host-only value', () => {
    expect(normalizeApiBaseUrl('cafeduo-api.onrender.com')).toBe('https://cafeduo-api.onrender.com');
  });

  it('normalizes API base URL with http for localhost', () => {
    expect(normalizeApiBaseUrl('localhost:3001')).toBe('http://localhost:3001');
  });

  it('strips /api suffix for relative URL values', () => {
    expect(normalizeApiBaseUrl('/api')).toBe('');
  });

  it('normalizes socket URLs for hosts and strips trailing /api', () => {
    expect(normalizeBaseUrl('localhost:3001')).toBe('http://localhost:3001');
    expect(normalizeBaseUrl('cafeduotr.com')).toBe('https://cafeduotr.com');
    expect(normalizeBaseUrl('https://api.example.com/api')).toBe('https://api.example.com');
    expect(normalizeBaseUrl('https://api.example.com///')).toBe('https://api.example.com');
  });

  it('enforces https in browsers already running on https except for localhost', () => {
    expect(normalizeBaseUrl('http://example.com', { protocol: 'https:' })).toBe('https://example.com');
    expect(normalizeBaseUrl('http://localhost:3001', { protocol: 'https:' })).toBe('http://localhost:3001');
  });
});
