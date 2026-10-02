const buildSecurityHeadersOptions = ({ production = false } = {}) => ({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Dev tooling needs eval; production assets do not.
      scriptSrc: production ? ["'self'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: production ? ["'self'", 'wss:'] : ["'self'", 'wss:', 'ws:'],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  frameguard: { action: 'deny' },
  crossOriginEmbedderPolicy: false,
});
module.exports = { buildSecurityHeadersOptions };
