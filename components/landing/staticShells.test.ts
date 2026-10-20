import fs from 'fs';
import path from 'path';
import { PUBLIC_PAGES } from './routePages';
import { renderPageHtml, renderSitemap } from './staticShells';

const indexHtml = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf-8');

const read = (html: string, pattern: RegExp) => html.match(pattern)?.[1];

describe('public page HTML', () => {
  const pages = PUBLIC_PAGES.map((page) => ({ page, html: renderPageHtml(indexHtml, page) }));

  it('gives every page its own title, description and canonical address', () => {
    const titles = pages.map(({ html }) => read(html, /<title>([^<]*)<\/title>/));
    const descriptions = pages.map(({ html }) =>
      read(html, /name="description" content="([^"]*)"/)
    );
    const canonicals = pages.map(({ html }) => read(html, /rel="canonical" href="([^"]*)"/));
    expect(new Set(titles).size).toBe(pages.length);
    expect(new Set(descriptions).size).toBe(pages.length);
    expect(canonicals).toEqual([
      'https://cafeduotr.com/',
      'https://cafeduotr.com/kafeler',
      'https://cafeduotr.com/gizlilik',
    ]);
  });

  it('ships readable structured data naming the page', () => {
    for (const { page, html } of pages) {
      const jsonLd = read(html, /<script type="application\/ld\+json">([^<]*)<\/script>/);
      const graph = JSON.parse(String(jsonLd))['@graph'];
      const webPage = graph.find((node: { '@type': string }) => node['@type'] === 'WebPage');
      expect(webPage.name).toBe(page.title);
      expect(
        graph.find((node: { '@type': string }) => node['@type'] === 'Organization').sameAs
      ).toEqual(expect.arrayContaining(['https://instagram.com/cafeduotr']));
    }
  });

  it("puts the page's own first screen in #root, marked with its address", () => {
    const [players, owners, privacy] = pages.map(({ html }) => html);
    expect(players).toContain('yan masada.');
    expect(owners).toContain('Kahve sizden.');
    expect(owners).toContain('İlk 2 kafe, ilk ay');
    expect(privacy).toContain('Gizlilik Politikası ve KVKK Aydınlatma Metni');
    expect(owners).toContain('<meta name="cafeduo:shell-path" content="/kafeler" />');
    for (const { html } of pages) {
      expect(html).not.toMatch(/riso-|club-landing/);
      expect(html.match(/<h1\b/g)).toHaveLength(1);
    }
  });

  it('keeps the sign-in dialog links out of the crawl', () => {
    for (const { html } of pages) {
      for (const link of html.match(/<a [^>]*href="\/\?auth=[^>]*>/g) ?? []) {
        expect(link).toContain('rel="nofollow"');
      }
    }
  });

  it('can be rendered again from its own output', () => {
    const once = renderPageHtml(indexHtml, PUBLIC_PAGES[0]);
    expect(renderPageHtml(once, PUBLIC_PAGES[1])).toBe(renderPageHtml(indexHtml, PUBLIC_PAGES[1]));
  });

  it('refuses an index.html without the markers', () => {
    expect(() => renderPageHtml('<html></html>', PUBLIC_PAGES[0])).toThrow(/markers/);
  });

  it('lists every public page in the sitemap', () => {
    const sitemap = renderSitemap('2026-10-20');
    expect(sitemap.match(/<loc>/g)).toHaveLength(PUBLIC_PAGES.length);
    expect(sitemap).toContain('<loc>https://cafeduotr.com/kafeler</loc>');
  });
});
