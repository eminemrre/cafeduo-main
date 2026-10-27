/** @jest-environment node */
const { createSystemRoutes } = require('./systemRoutes');

const readiness = async (options) => {
  const router = createSystemRoutes({ appVersion: 'abc', isDbConnected: async () => true, ...options });
  const layer = router.stack.find((entry) => entry.route?.path === '/api/readiness');
  const res = { statusCode: 200, body: null };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  await layer.route.stack[0].handle({}, res);
  return res;
};

describe('GET /api/readiness', () => {
  it('reports whether an e-mail provider is configured', async () => {
    expect((await readiness({ isEmailConfigured: () => true })).body.checks.email).toBe(true);
    expect((await readiness({ isEmailConfigured: () => false })).body.checks.email).toBe(false);
  });

  it('stays ready without e-mail: the deploy gate checks it separately', async () => {
    const res = await readiness({ isEmailConfigured: () => false });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ready');
  });
});
