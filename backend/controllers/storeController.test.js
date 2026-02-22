/** @jest-environment node */

jest.mock('../db', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
}));

const db = require('../db');
const storeController = require('./storeController');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createClient = () => ({
  query: jest.fn(),
  release: jest.fn(),
});

describe('storeController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getItems returns static store catalog', async () => {
    const req = {};
    const res = createRes();

    await storeController.getItems(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(Array.isArray(payload.items)).toBe(true);
    expect(payload.items.length).toBeGreaterThan(0);
  });

  it('getInventory returns user inventory from db', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 9, code: 'RANK_NEON_SWORD' }],
    });

    const req = { user: { id: 42 } };
    const res = createRes();

    await storeController.getInventory(req, res);

    expect(db.query).toHaveBeenCalledWith(
      'SELECT * FROM user_items WHERE user_id = $1 ORDER BY redeemed_at DESC',
      [42]
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      inventory: [{ id: 9, code: 'RANK_NEON_SWORD' }],
    });
  });

  it('getInventory returns 500 on db failure', async () => {
    db.query.mockRejectedValueOnce(new Error('db down'));
    const req = { user: { id: 42 } };
    const res = createRes();

    await storeController.getInventory(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Envanter alınırken hata oluştu',
    });
  });

  it('buyItem validates missing itemId', async () => {
    const client = createClient();
    db.pool.connect.mockResolvedValueOnce(client);

    const req = { user: { id: 1 }, body: {} };
    const res = createRes();

    await storeController.buyItem(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Eşya ID gerekli',
    });
    expect(client.query).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('buyItem returns 404 when item is unknown', async () => {
    const client = createClient();
    db.pool.connect.mockResolvedValueOnce(client);

    const req = { user: { id: 1 }, body: { itemId: 9999 } };
    const res = createRes();

    await storeController.buyItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Eşya bulunamadı',
    });
    expect(client.query).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('buyItem rolls back on insufficient points', async () => {
    const client = createClient();
    db.pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ points: 120 }] }) // user balance
      .mockResolvedValueOnce({}); // ROLLBACK

    const req = { user: { id: 3 }, body: { itemId: 2 } }; // item 2 => 1000
    const res = createRes();

    await storeController.buyItem(req, res);

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      'SELECT points FROM users WHERE id = $1 FOR UPDATE',
      [3]
    );
    expect(client.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Yetersiz bakiye (Cyber-Creds)',
    });
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('buyItem rolls back when item already owned', async () => {
    const client = createClient();
    db.pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ points: 5000 }] }) // user points
      .mockResolvedValueOnce({ rows: [{ id: 99 }] }) // existing item
      .mockResolvedValueOnce({}); // ROLLBACK

    const req = { user: { id: 7 }, body: { itemId: 1 } };
    const res = createRes();

    await storeController.buyItem(req, res);

    expect(client.query).toHaveBeenNthCalledWith(
      3,
      'SELECT id FROM user_items WHERE user_id = $1 AND code = $2',
      [7, 'RANK_NEON_SWORD']
    );
    expect(client.query).toHaveBeenNthCalledWith(4, 'ROLLBACK');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Bu eşyaya zaten sahipsiniz',
    });
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('buyItem commits purchase and returns updated balance', async () => {
    const client = createClient();
    db.pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ points: 1100 }] }) // user points
      .mockResolvedValueOnce({ rows: [] }) // ownership check
      .mockResolvedValueOnce({ rowCount: 1 }) // update user points
      .mockResolvedValueOnce({
        rows: [{ id: 555, user_id: 8, item_id: 1, item_title: 'Zehirli Neon Kılıç (Rütbe)', code: 'RANK_NEON_SWORD' }],
      }) // insert inventory
      .mockResolvedValueOnce({}); // COMMIT

    const req = { user: { id: 8 }, body: { itemId: '1' } };
    const res = createRes();

    await storeController.buyItem(req, res);

    expect(client.query).toHaveBeenNthCalledWith(
      4,
      'UPDATE users SET points = points - $1 WHERE id = $2',
      [500, 8]
    );
    expect(client.query).toHaveBeenNthCalledWith(6, 'COMMIT');
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Satın alma başarılı',
      inventoryItem: expect.objectContaining({ id: 555, code: 'RANK_NEON_SWORD' }),
      remainingPoints: 600,
    });
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('buyItem handles unexpected errors with rollback', async () => {
    const client = createClient();
    db.pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce(new Error('write failure')) // fail during select points
      .mockResolvedValueOnce({}); // ROLLBACK (catch)

    const req = { user: { id: 8 }, body: { itemId: 1 } };
    const res = createRes();

    await storeController.buyItem(req, res);

    expect(client.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Satın alma işlemi sırasında hata oluştu',
    });
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
