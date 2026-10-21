/**
 * tournamentJobs unit tests
 *
 * finalizeOneTournament is the only place that mints prize coupons. The job
 * runs outside a request, so these tests drive it with a hand-rolled pg-client
 * mock that records statements and can simulate a unique-code collision.
 */

jest.mock('../utils/transaction', () => ({
  rollbackQuietly: jest.fn(async () => {}),
}));

const { finalizeOneTournament } = require('./tournamentJobs');

const TOURNAMENT = {
  id: 7,
  cafe_id: 3,
  name: 'Kafe Kupası',
  status: 'finalizing',
  prize_tiers: [
    { rank: 1, reward_id: 11 },
    { rank: 2, reward_id: 12 },
  ],
};

const makeLogger = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() });

const makeHarness = ({ onInsert }) => {
  const queries = [];
  let insertCalls = 0;

  const client = {
    query: jest.fn(async (sql, params = []) => {
      queries.push({ sql, params });

      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      if (/FROM tournaments WHERE id = \$1 FOR UPDATE/i.test(sql)) {
        return { rows: [TOURNAMENT] };
      }
      if (/FROM tournament_points tp/i.test(sql)) {
        return {
          rows: [
            { user_id: 101, username: 'ayse', total_points: '5.00' },
            { user_id: 102, username: 'burak', total_points: '4.00' },
          ],
        };
      }
      if (/FROM rewards WHERE id = ANY/i.test(sql)) {
        return {
          rows: [
            { id: 11, title: 'Filtre Kahve' },
            { id: 12, title: 'Çay' },
          ],
        };
      }
      if (/INSERT INTO user_items/i.test(sql)) {
        insertCalls += 1;
        return onInsert(insertCalls, params);
      }
      if (/UPDATE tournaments SET status = 'finished'/i.test(sql)) {
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`unexpected query: ${sql}`);
    }),
    release: jest.fn(),
  };

  return {
    pool: { connect: jest.fn(async () => client) },
    client,
    queries,
    insertCalls: () => insertCalls,
  };
};

const runFinalize = async (harness, logger) => {
  await finalizeOneTournament({
    pool: harness.pool,
    logger,
    tournamentId: TOURNAMENT.id,
    clearCache: jest.fn(async () => undefined),
  });
};

describe('finalizeOneTournament', () => {
  it('inserts every prize with one UNNEST statement', async () => {
    const harness = makeHarness({
      onInsert: (call, params) => ({
        rows: params[3].map((code, index) => ({ id: 900 + index, code })),
      }),
    });
    const logger = makeLogger();

    await runFinalize(harness, logger);

    expect(harness.insertCalls()).toBe(1);
    expect(harness.client.query).toHaveBeenCalledWith('COMMIT');
    expect(logger.info).toHaveBeenCalledWith(
      'Tournament finalized',
      expect.objectContaining({
        awarded: [
          { userId: 101, rank: 1, rewardId: 11, userItemId: 900 },
          { userId: 102, rank: 2, rewardId: 12, userItemId: 901 },
        ],
      })
    );
    expect(logger.warn).not.toHaveBeenCalled();

    const insert = harness.queries.find(({ sql }) => /INSERT INTO user_items/i.test(sql));
    expect(insert.params[0]).toEqual([101, 102]);
    expect(insert.params[1]).toEqual([11, 12]);
    expect(insert.params[2]).toEqual(['Filtre Kahve', 'Çay']);
    expect(new Set(insert.params[3]).size).toBe(2);
  });

  it('retries only the colliding row with a fresh code', async () => {
    let firstBatchCodes = [];
    const harness = makeHarness({
      onInsert: (call, params) => {
        const codes = params[3];
        if (call === 1) {
          firstBatchCodes = codes;
          // Second code hit the unique index: ON CONFLICT returned only the first.
          return { rows: [{ id: 900, code: codes[0] }] };
        }
        return { rows: [{ id: 901, code: codes[0] }] };
      },
    });
    const logger = makeLogger();

    await runFinalize(harness, logger);

    expect(harness.insertCalls()).toBe(2);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'Tournament finalized',
      expect.objectContaining({
        awarded: [
          { userId: 101, rank: 1, rewardId: 11, userItemId: 900 },
          { userId: 102, rank: 2, rewardId: 12, userItemId: 901 },
        ],
      })
    );

    const retry = harness.queries.filter(({ sql }) => /INSERT INTO user_items/i.test(sql))[1];
    expect(retry.params[0]).toEqual([102]);
    expect(retry.params[1]).toEqual([12]);
    expect(retry.params[3]).toHaveLength(1);
    expect(firstBatchCodes).not.toContain(retry.params[3][0]);
  });

  it('gives up after three attempts and still finishes the tournament', async () => {
    const harness = makeHarness({
      onInsert: (call, params) => ({
        rows: params[0]
          .map((userId, index) => ({ userId, code: params[3][index] }))
          .filter(({ userId }) => userId !== 102)
          .map(({ code }, index) => ({ id: 900 + call * 10 + index, code })),
      }),
    });
    const logger = makeLogger();

    await runFinalize(harness, logger);

    expect(harness.insertCalls()).toBe(3);
    expect(logger.warn).toHaveBeenCalledWith(
      'Tournament prize coupon generation gave up after 3 attempts',
      expect.objectContaining({ tournamentId: TOURNAMENT.id, userId: 102, rewardId: 12 })
    );
    expect(harness.client.query).toHaveBeenCalledWith('COMMIT');
  });
});
