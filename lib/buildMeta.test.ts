import { BUILD_META } from './buildMeta';

describe('BUILD_META', () => {
  it('exposes a non-empty version payload for UI badges', () => {
    expect(BUILD_META.version).toBeTruthy();
    expect(BUILD_META.shortVersion).toBeTruthy();
    expect(BUILD_META.shortVersion.length).toBeLessThanOrEqual(12);
  });
});

