/** @jest-environment node */
const { createTestEmailRoutes } = require('./testEmailRoutes');

describe('test e-mail inbox route', () => {
  it('does not exist in production or without EMAIL_CAPTURE', () => {
    expect(createTestEmailRoutes({ env: { NODE_ENV: 'production', EMAIL_CAPTURE: 'true' } })).toBeNull();
    expect(createTestEmailRoutes({ env: { NODE_ENV: 'test' } })).toBeNull();
  });

  it('lists the captured e-mails of one address, newest first', () => {
    const capturedEmails = jest.fn(() => [{ template: 'verify_email', text: 'link' }]);
    const router = createTestEmailRoutes({ env: { NODE_ENV: 'development', EMAIL_CAPTURE: 'true' }, capturedEmails });
    const layer = router.stack.find((entry) => entry.route?.path === '/api/test/emails');
    const res = { json: jest.fn(), status: jest.fn(() => res) };
    layer.route.stack[0].handle({ query: { to: 'Ada@Example.com' } }, res);
    expect(capturedEmails).toHaveBeenCalledWith('ada@example.com');
    expect(res.json).toHaveBeenCalledWith({ emails: [{ template: 'verify_email', text: 'link' }] });
  });
});
