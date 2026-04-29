const { createAdminHandlers } = require('./adminHandlers');
const {
  normalizeCafeCreatePayload,
  normalizeCafeUpdatePayload,
} = require('../utils/cafeAdminValidation');

const createMockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.payload = null;
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload) => {
    res.payload = payload;
    return res;
  });
  return res;
};

describe('adminHandlers', () => {
  let memoryUsers;
  let handlers;
  let isDbConnected;
  let clearCacheByPattern;

  beforeEach(() => {
    memoryUsers = [
      { id: 1, username: 'admin', email: 'admin@test.com', points: 100, role: 'admin', isAdmin: true },
      { id: 2, username: 'user', email: 'user@test.com', points: 40, role: 'user', isAdmin: false },
    ];

    isDbConnected = jest.fn().mockResolvedValue(false);
    clearCacheByPattern = jest.fn().mockResolvedValue(undefined);

    handlers = createAdminHandlers({
      pool: { query: jest.fn() },
      isDbConnected,
      bcrypt: { hash: jest.fn().mockResolvedValue('hashed') },
      logger: { error: jest.fn() },
      normalizeCafeCreatePayload,
      normalizeCafeUpdatePayload,
      clearCacheByPattern,
      getMemoryUsers: () => memoryUsers,
      setMemoryUsers: (nextUsers) => {
        memoryUsers = nextUsers;
      },
    });
  });

  it('creates user in memory mode with validated payload', async () => {
    const req = {
      body: {
        username: ' new-user ',
        email: 'NEW@MAIL.COM',
        password: '123456',
        role: 'cafe_admin',
        cafe_id: '7',
        points: '120',
      },
    };
    const res = createMockRes();

    await handlers.createUser(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.payload.username).toBe('new-user');
    expect(res.payload.email).toBe('new@mail.com');
    expect(res.payload.cafe_id).toBe(7);
    expect(memoryUsers).toHaveLength(3);
  });

  it('rejects invalid create user payload', async () => {
    const req = {
      body: {
        username: 'x',
        email: 'invalid',
        password: '123456',
      },
    };
    const res = createMockRes();

    await handlers.createUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(String(res.payload.error)).toContain('e-posta');
  });

  it('updates user role in memory mode', async () => {
    const req = {
      params: { id: '2' },
      body: { role: 'cafe_admin', cafe_id: '5' },
    };
    const res = createMockRes();

    await handlers.updateUserRole(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.success).toBe(true);
    expect(memoryUsers[1].role).toBe('cafe_admin');
    expect(memoryUsers[1].cafe_id).toBe(5);
  });

  it('updates points with validation in memory mode', async () => {
    const req = { params: { id: '2' }, body: { points: 99 } };
    const res = createMockRes();

    await handlers.updateUserPoints(req, res);

    expect(res.statusCode).toBe(200);
    expect(memoryUsers[1].points).toBe(99);
  });

  it('prevents self-delete', async () => {
    const req = { params: { id: '1' }, user: { id: 1 } };
    const res = createMockRes();

    await handlers.deleteUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(String(res.payload.error)).toContain('silemezsiniz');
  });

  it('creates cafe in memory mode with normalized payload', async () => {
    const req = {
      body: {
        name: 'Kafe A',
        address: 'Merkez',
        total_tables: 22,
        pin: '4321',
      },
    };
    const res = createMockRes();

    await handlers.createCafe(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.payload.success).toBe(true);
    expect(res.payload.cafe.total_tables).toBe(22);
    expect(res.payload.cafe.pin).toBe('4321');
  });

  it('creates cafe in db mode on legacy table_count schema', async () => {
    const pool = {
      query: jest.fn()
        .mockResolvedValueOnce({
          rows: [
            { column_name: 'id' },
            { column_name: 'name' },
            { column_name: 'latitude' },
            { column_name: 'longitude' },
            { column_name: 'table_count' },
            { column_name: 'radius' },
            { column_name: 'secondary_latitude' },
            { column_name: 'secondary_longitude' },
            { column_name: 'secondary_radius' },
            { column_name: 'daily_pin' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 7,
            name: 'Legacy Cafe',
            total_tables: 18,
            pin: '5555',
            table_count: 18,
          }],
        }),
    };
    const dbHandlers = createAdminHandlers({
      pool,
      isDbConnected: jest.fn().mockResolvedValue(true),
      bcrypt: { hash: jest.fn().mockResolvedValue('hashed') },
      logger: { error: jest.fn() },
      normalizeCafeCreatePayload,
      normalizeCafeUpdatePayload,
      getMemoryUsers: () => [],
      setMemoryUsers: () => {},
    });

    const req = {
      body: {
        name: 'Legacy Cafe',
        total_tables: 18,
        pin: '5555',
      },
    };
    const res = createMockRes();

    await dbHandlers.createCafe(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const insertSql = pool.query.mock.calls[1][0];
    expect(insertSql).toContain('table_count');
    expect(insertSql).toContain('daily_pin');
    expect(insertSql).toMatch(/INSERT INTO cafes \((?![^)]*total_tables)(?![^)]*address)/);
  });

  describe('deleteCafe (db mode)', () => {
    const createDbContext = () => {
      const client = {
        query: jest.fn(),
        release: jest.fn(),
      };
      const pool = {
        connect: jest.fn().mockResolvedValue(client),
      };
      const logger = {
        error: jest.fn(),
        warn: jest.fn(),
      };
      const cacheCleaner = jest.fn().mockResolvedValue(undefined);
      const dbHandlers = createAdminHandlers({
        pool,
        isDbConnected: jest.fn().mockResolvedValue(true),
        bcrypt: { hash: jest.fn().mockResolvedValue('hashed') },
        logger,
        normalizeCafeCreatePayload,
        normalizeCafeUpdatePayload,
        clearCacheByPattern: cacheCleaner,
        getMemoryUsers: () => [],
        setMemoryUsers: () => {},
      });

      return { dbHandlers, client, pool, logger, cacheCleaner };
    };

    it('deletes cafe and returns cleanup summary', async () => {
      const { dbHandlers, client, cacheCleaner } = createDbContext();
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Kafe B' }] }) // cafe lock
        .mockResolvedValueOnce({ rows: [{ count: 3 }] }) // cafe count
        .mockResolvedValueOnce({ rows: [{ id: 10, username: 'u1', role: 'user' }, { id: 11, username: 'a1', role: 'cafe_admin' }] }) // users
        .mockResolvedValueOnce({ rowCount: 2 }) // detach users
        .mockResolvedValueOnce({ rowCount: 4 }) // delete rewards
        .mockResolvedValueOnce({ rowCount: 3 }) // close games
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Kafe B' }] }) // delete cafe
        .mockResolvedValueOnce({}); // COMMIT

      const req = { params: { id: '2' } };
      const res = createMockRes();

      await dbHandlers.deleteCafe(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.payload.success).toBe(true);
      expect(res.payload.deletedCafe).toEqual({ id: 2, name: 'Kafe B' });
      expect(res.payload.cleanup).toEqual({
        detachedUsers: 2,
        cafeAdminsDemoted: 1,
        rewardsDeleted: 4,
        gamesForceClosed: 3,
      });
      expect(cacheCleaner).toHaveBeenCalledWith('cache:/api/cafes*');
      expect(client.release).toHaveBeenCalled();
    });

    it('rejects deleting the last cafe', async () => {
      const { dbHandlers, client } = createDbContext();
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Tek Kafe' }] }) // cafe lock
        .mockResolvedValueOnce({ rows: [{ count: 1 }] }) // cafe count
        .mockResolvedValueOnce({}); // ROLLBACK

      const req = { params: { id: '1' } };
      const res = createMockRes();

      await dbHandlers.deleteCafe(req, res);

      expect(res.statusCode).toBe(400);
      expect(String(res.payload.error)).toContain('en az bir kafe');
      expect(client.release).toHaveBeenCalled();
    });

    it('returns 404 when cafe does not exist', async () => {
      const { dbHandlers, client } = createDbContext();
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // cafe lock
        .mockResolvedValueOnce({}); // ROLLBACK

      const req = { params: { id: '999' } };
      const res = createMockRes();

      await dbHandlers.deleteCafe(req, res);

      expect(res.statusCode).toBe(404);
      expect(String(res.payload.error)).toContain('Kafe bulunamad');
      expect(client.release).toHaveBeenCalled();
    });
  });
});
