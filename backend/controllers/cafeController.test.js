jest.mock('../db', () => ({
  pool: {
    query: jest.fn(),
  },
  isDbConnected: jest.fn(),
}));

jest.mock('../middleware/cache', () => ({
  cache: jest.fn(),
  clearCache: jest.fn(),
}));

jest.mock('../utils/geo', () => ({
  getDistanceFromLatLonInMeters: jest.fn(() => 10),
}));

const { pool, isDbConnected } = require('../db');
const cafeController = require('./cafeController');

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('cafeController.checkIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isDbConnected.mockResolvedValue(true);
  });

  it('returns 400 for wrong pin', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Merkez', daily_pin: '1234', table_count: 10 }],
    });

    const req = {
      params: { id: '1' },
      body: { pin: '9999', tableNumber: 2 },
      user: { id: 77 },
    };
    const res = buildRes();

    await cafeController.checkIn(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Hatalı PIN kodu.' });
  });

  it('returns 400 for out-of-range table number', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Merkez', daily_pin: '1234', table_count: 5 }],
    });

    const req = {
      params: { id: '1' },
      body: { pin: '1234', tableNumber: 8 },
      user: { id: 77 },
    };
    const res = buildRes();

    await cafeController.checkIn(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Masa numarası 1-5 aralığında olmalıdır.' });
  });

  it('returns normalized success payload', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Merkez', daily_pin: '1234', table_count: 20 }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const req = {
      params: { id: '1' },
      body: { pin: '1234', tableNumber: 4 },
      user: { id: 77 },
    };
    const res = buildRes();

    await cafeController.checkIn(req, res);

    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      'UPDATE users SET cafe_id = $1, table_number = $2 WHERE id = $3',
      ['1', 4, 77]
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        cafeName: 'Merkez',
        table: 'MASA04',
      })
    );
  });

  it('falls back to base pin when daily pin is default 0000', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Merkez', daily_pin: '0000', pin: '5555', table_count: 20 }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const req = {
      params: { id: '1' },
      body: { pin: '5555', tableNumber: 6 },
      user: { id: 77 },
    };
    const res = buildRes();

    await cafeController.checkIn(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        table: 'MASA06',
      })
    );
  });
});
