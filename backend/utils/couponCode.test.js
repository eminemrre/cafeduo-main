const { generateCouponCode } = require('./couponCode');

describe('generateCouponCode', () => {
  it('produces CD-XXXX-XXXX-XXXX codes', () => {
    const code = generateCouponCode();

    expect(code).toMatch(/^CD-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(code).toHaveLength(17);
  });

  it('does not repeat itself', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateCouponCode()));

    expect(codes.size).toBe(50);
  });
});
