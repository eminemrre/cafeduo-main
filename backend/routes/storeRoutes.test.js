/** @jest-environment node */

describe('storeRoutes', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    jest.resetModules();
    process.env.JWT_SECRET = 'store-routes-test-secret';
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.dontMock('../db');
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it('loads router without undefined handlers and registers expected endpoints', () => {
    jest.doMock('../db', () => ({
      query: jest.fn(),
      pool: { query: jest.fn(), connect: jest.fn() },
      isDbConnected: jest.fn().mockResolvedValue(false),
    }));

    const router = require('./storeRoutes');
    const routeLayers = router.stack.filter((layer) => layer.route);

    const routeSummary = routeLayers.map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
      handlers: layer.route.stack.map((item) => typeof item.handle),
    }));

    expect(routeSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/items', methods: ['get'] }),
        expect.objectContaining({ path: '/inventory', methods: ['get'] }),
        expect.objectContaining({ path: '/buy', methods: ['post'] }),
      ])
    );

    routeSummary.forEach((entry) => {
      entry.handlers.forEach((handlerType) => {
        expect(handlerType).toBe('function');
      });
    });
  });
});
