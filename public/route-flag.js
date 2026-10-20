// Runs before the first paint. Each public page's HTML carries a static copy of its own
// first screen, for crawlers and for the moment before JavaScript loads. When this HTML is
// shown for another address (the app's routes, or the service worker answering with the
// home page's file) the copy is hidden, so nobody sees the wrong page flash.
(function () {
  var meta = document.querySelector('meta[name="cafeduo:shell-path"]');
  var shellPath = meta ? meta.getAttribute('content') : '/';
  var path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path !== shellPath) {
    document.documentElement.setAttribute('data-shell', 'app');
  }
})();
