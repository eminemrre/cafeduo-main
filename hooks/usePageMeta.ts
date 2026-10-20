import { useEffect } from 'react';
import { PUBLIC_PAGES, findPublicPage, pageUrl } from '../components/landing/routePages';

const setAttribute = (selector: string, attribute: string, value: string) => {
  document.head.querySelector(selector)?.setAttribute(attribute, value);
};

/**
 * Keep the title, description and canonical address in step with the page while the player
 * moves around the app; the HTML each public page ships with only covers the first load.
 * Signed-in screens carry the home page's.
 */
export const usePageMeta = (pathname: string) => {
  useEffect(() => {
    const page = findPublicPage(pathname) ?? PUBLIC_PAGES[0];
    const url = pageUrl(page.path);
    document.title = page.title;
    setAttribute('meta[name="description"]', 'content', page.description);
    setAttribute('link[rel="canonical"]', 'href', url);
    setAttribute('meta[property="og:title"]', 'content', page.title);
    setAttribute('meta[property="og:description"]', 'content', page.description);
    setAttribute('meta[property="og:url"]', 'content', url);
    setAttribute('meta[name="twitter:title"]', 'content', page.title);
    setAttribute('meta[name="twitter:description"]', 'content', page.description);
  }, [pathname]);
};
