import { renderHook } from '@testing-library/react';
import { usePageMeta } from './usePageMeta';

describe('usePageMeta', () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <title>CafeDuo</title>
      <meta name="description" content="" />
      <link rel="canonical" href="" />
      <meta property="og:url" content="" />`;
  });

  const canonical = () =>
    document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');
  const description = () =>
    document.head.querySelector('meta[name="description"]')?.getAttribute('content');

  it('follows the page the player moves to', () => {
    const { rerender } = renderHook(({ pathname }) => usePageMeta(pathname), {
      initialProps: { pathname: '/' },
    });
    expect(document.title).toBe('CafeDuo: Rakibin yan masada');
    expect(canonical()).toBe('https://cafeduotr.com/');

    rerender({ pathname: '/kafeler/' });
    expect(document.title).toMatch(/^Kafeler için CafeDuo/);
    expect(canonical()).toBe('https://cafeduotr.com/kafeler');
    expect(description()).toMatch(/Masalarınızda oyun başlasın/);
    expect(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      'https://cafeduotr.com/kafeler'
    );
  });

  it("gives signed-in screens the home page's", () => {
    renderHook(() => usePageMeta('/dashboard'));
    expect(document.title).toBe('CafeDuo: Rakibin yan masada');
    expect(canonical()).toBe('https://cafeduotr.com/');
  });
});
