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
const { getDistanceFromLatLonInMeters } = require('../utils/geo');
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

  it('returns 400 when location is missing', async () => {
    const req = {
      params: { id: '1' },
      body: { tableNumber: 2 },
      user: { id: 77 },
    };
    const res = buildRes();

    await cafeController.checkIn(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Kafe doğrulaması için konum izni gerekli.' });
  });

  it('returns 400 for out-of-range table number', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Merkez', table_count: 5, latitude: 37.741, longitude: 29.101, radius: 150 }],
    });

    const req = {
      params: { id: '1' },
      body: { latitude: 37.741, longitude: 29.101, tableNumber: 8 },
      user: { id: 77 },
    };
    const res = buildRes();

    await cafeController.checkIn(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Masa numarası 1-5 aralığında olmalıdır.' });
  });

  it('returns 400 when user is outside allowed radius', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Merkez', table_count: 20, latitude: 37.741, longitude: 29.101, radius: 120 }],
    });
    getDistanceFromLatLonInMeters.mockReturnValueOnce(280);

    const req = {
      params: { id: '1' },
      body: { latitude: 37.739, longitude: 29.11, tableNumber: 4 },
      user: { id: 77 },
    };
    const res = buildRes();

    await cafeController.checkIn(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Kafeden çok uzaktasınız. Lütfen 120 metre içine yaklaşın.',
    });
  });

  it('returns normalized success payload', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Merkez', table_count: 20, latitude: 37.741, longitude: 29.101, radius: 150 }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const req = {
      params: { id: '1' },
      body: { latitude: 37.741, longitude: 29.101, tableNumber: 4 },
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
});
