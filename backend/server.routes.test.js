const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(__dirname, 'server.js');
const ADMIN_ROUTES_PATH = path.join(__dirname, 'routes', 'adminRoutes.js');
const COMMERCE_ROUTES_PATH = path.join(__dirname, 'routes', 'commerceRoutes.js');
const PROFILE_ROUTES_PATH = path.join(__dirname, 'routes', 'profileRoutes.js');
const SYSTEM_ROUTES_PATH = path.join(__dirname, 'routes', 'systemRoutes.js');
const GAME_ROUTES_PATH = path.join(__dirname, 'routes', 'gameRoutes.js');
const STORE_ROUTES_PATH = path.join(__dirname, 'routes', 'storeRoutes.js');

const extractAppRouteMap = (source) => {
  const routeRegex = /app\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g;
  const routeMap = new Map();
  let match;

  while ((match = routeRegex.exec(source)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = match[2];
    const key = `${method} ${routePath}`;
    if (!routeMap.has(key)) {
      routeMap.set(key, 0);
    }
    routeMap.set(key, routeMap.get(key) + 1);
  }

  return routeMap;
};

const extractRouterRouteMap = (source, mountPrefix = '') => {
  const routeRegex = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g;
  const routeMap = new Map();
  let match;

  while ((match = routeRegex.exec(source)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = `${mountPrefix}${match[2]}`;
    const key = `${method} ${routePath}`;
    if (!routeMap.has(key)) {
      routeMap.set(key, 0);
    }
    routeMap.set(key, routeMap.get(key) + 1);
  }

  return routeMap;
};

const mergeRouteMaps = (...maps) => {
  const merged = new Map();
  for (const routeMap of maps) {
    for (const [key, count] of routeMap.entries()) {
      merged.set(key, (merged.get(key) || 0) + count);
    }
  }
  return merged;
};

describe('backend/server.js route registry', () => {
  const serverSource = fs.readFileSync(SERVER_PATH, 'utf8');
  const adminRouteSource = fs.readFileSync(ADMIN_ROUTES_PATH, 'utf8');
  const commerceRouteSource = fs.readFileSync(COMMERCE_ROUTES_PATH, 'utf8');
  const profileRouteSource = fs.readFileSync(PROFILE_ROUTES_PATH, 'utf8');
  const systemRouteSource = fs.readFileSync(SYSTEM_ROUTES_PATH, 'utf8');
  const gameRouteSource = fs.readFileSync(GAME_ROUTES_PATH, 'utf8');
  const storeRouteSource = fs.readFileSync(STORE_ROUTES_PATH, 'utf8');
  const routeMap = mergeRouteMaps(
    extractAppRouteMap(serverSource),
    extractRouterRouteMap(adminRouteSource, '/api/admin'),
    extractRouterRouteMap(commerceRouteSource, '/api'),
    extractRouterRouteMap(profileRouteSource, '/api'),
    extractRouterRouteMap(systemRouteSource, ''),
    extractRouterRouteMap(gameRouteSource, '/api'),
    extractRouterRouteMap(storeRouteSource, '/api/store')
  );

  it('does not include duplicate app.<method>(path) definitions', () => {
    const duplicates = [...routeMap.entries()].filter(([, count]) => count > 1);
    expect(duplicates).toEqual([]);
  });

  it('keeps critical production endpoints registered once', () => {
    const expectedSingleRoutes = [
      'GET /api/games',
      'POST /api/games',
      'POST /api/games/:id/join',
      'POST /api/games/:id/draw-offer',
      'POST /api/games/:id/resign',
      'GET /api/users/:username/game-history',
      'GET /api/users/:username/active-game',
      'POST /api/admin/cafes',
      'PUT /api/admin/cafes/:id',
      'DELETE /api/admin/cafes/:id',
      'POST /api/rewards',
      'GET /api/rewards',
      'DELETE /api/rewards/:id',
      'POST /api/shop/buy',
      'GET /api/shop/inventory/:userId',
      'GET /api/store/items',
      'GET /api/store/inventory',
      'POST /api/store/buy',
      'GET /api/leaderboard',
      'GET /api/achievements/:userId',
      'PUT /api/users/:id',
      'GET /api/meta/version',
      'GET /health',
    ];

    for (const routeKey of expectedSingleRoutes) {
      expect(routeMap.get(routeKey)).toBe(1);
    }
  });
});
