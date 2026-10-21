jest.mock('../gameEngine/settlement', () => ({
  finalizeEngineGameById: jest.fn(),
}));

const { finalizeEngineGameById } = require('../gameEngine/settlement');
const { runGameEngineTick } = require('./gameEngineJobs');

const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };

describe('runGameEngineTick', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing without a database', async () => {
    const pool = { query: jest.fn() };
    const result = await runGameEngineTick({
      pool,
      isDbConnected: async () => false,
      logger,
    });
    expect(result).toEqual({ processed: 0, failed: 0 });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('finalizes a bounded batch and keeps going after one failure', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] }),
    };
    finalizeEngineGameById
      .mockResolvedValueOnce({ id: 1 })
      .mockRejectedValueOnce(new Error('deadlock'))
      .mockResolvedValueOnce({ id: 3 });

    const result = await runGameEngineTick({
      pool,
      isDbConnected: async () => true,
      logger,
      nowMs: Date.parse('2026-10-21T12:00:00.000Z'),
      batchSize: 25,
    });

    expect(result).toEqual({ processed: 2, failed: 1 });
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/LIMIT \$3/);
    expect(params[1]).toBe('2026-10-21T12:00:00.000Z');
    expect(params[2]).toBe(25);
    expect(finalizeEngineGameById).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalledWith(
      'Game engine tick failed',
      expect.objectContaining({ gameId: 2 })
    );
  });
});
