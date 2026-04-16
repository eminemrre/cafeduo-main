import { isDynamicImportError } from './chunkLoad';

describe('chunkLoad helpers', () => {
  it('detects dynamic import and chunk load errors', () => {
    expect(isDynamicImportError('error loading dynamically imported module: /assets/chunk.js')).toBe(true);
    expect(isDynamicImportError(new TypeError('Loading chunk 123 failed.'))).toBe(true);
    expect(isDynamicImportError(new Error('ChunkLoadError: Loading CSS chunk'))).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isDynamicImportError(new Error('Validation failed'))).toBe(false);
    expect(isDynamicImportError('Unauthorized')).toBe(false);
    expect(isDynamicImportError(null)).toBe(false);
  });
});

