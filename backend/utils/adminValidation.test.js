const {
  normalizeAdminCreateUserPayload,
  normalizeRoleUpdatePayload,
  normalizePointsUpdatePayload,
} = require('./adminValidation');

describe('adminValidation', () => {
  describe('normalizeAdminCreateUserPayload', () => {
    it('normalizes valid admin create payload', () => {
      const result = normalizeAdminCreateUserPayload({
        username: '  TestUser  ',
        email: ' TEST@MAIL.COM ',
        password: '123456',
        department: ' Bilgisayar ',
        role: 'cafe_admin',
        cafe_id: '7',
        points: '250',
      });

      expect(result.ok).toBe(true);
      expect(result.value).toEqual({
        username: 'TestUser',
        email: 'test@mail.com',
        password: '123456',
        department: 'Bilgisayar',
        role: 'cafe_admin',
        points: 250,
        cafeId: 7,
      });
    });

    it('rejects invalid email and short password', () => {
      const invalidEmail = normalizeAdminCreateUserPayload({
        username: 'user',
        email: 'invalid-mail',
        password: '123456',
      });
      expect(invalidEmail.ok).toBe(false);
      expect(invalidEmail.error).toContain('e-posta');

      const shortPassword = normalizeAdminCreateUserPayload({
        username: 'user',
        email: 'a@b.com',
        password: '123',
      });
      expect(shortPassword.ok).toBe(false);
      expect(shortPassword.error).toContain('Şifre');
    });

    it('requires cafe for cafe_admin role', () => {
      const result = normalizeAdminCreateUserPayload({
        username: 'user',
        email: 'user@test.com',
        password: '123456',
        role: 'cafe_admin',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Kafe yöneticisi');
    });
  });

  describe('normalizeRoleUpdatePayload', () => {
    it('accepts admin role without cafe', () => {
      const result = normalizeRoleUpdatePayload({ role: 'admin' });
      expect(result.ok).toBe(true);
      expect(result.value).toEqual({ role: 'admin', cafeId: null });
    });

    it('rejects cafe_admin without cafe id', () => {
      const result = normalizeRoleUpdatePayload({ role: 'cafe_admin' });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Kafe yöneticisi');
    });
  });

  describe('normalizePointsUpdatePayload', () => {
    it('accepts non-negative integers', () => {
      expect(normalizePointsUpdatePayload({ points: 0 })).toEqual({ ok: true, value: 0 });
      expect(normalizePointsUpdatePayload({ points: '75' })).toEqual({ ok: true, value: 75 });
    });

    it('rejects negative or non-integer values', () => {
      expect(normalizePointsUpdatePayload({ points: -1 }).ok).toBe(false);
      expect(normalizePointsUpdatePayload({ points: '1.5' }).ok).toBe(false);
      expect(normalizePointsUpdatePayload({ points: 'x' }).ok).toBe(false);
    });
  });
});

