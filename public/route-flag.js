// Runs before the first paint. index.html carries a static copy of the landing's
// first screen for crawlers and for the moment before JavaScript loads; every
// other route hides it so a signed-in player never sees the landing flash.
if (window.location.pathname !== '/') {
  document.documentElement.setAttribute('data-shell', 'app');
}
