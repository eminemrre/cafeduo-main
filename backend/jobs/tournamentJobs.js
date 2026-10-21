/**
 * Tournament background jobs.
 *
 * Runs every TOURNAMENT_JOB_INTERVAL_MS (default 60s) and:
 *   1) flips `scheduled` → `active` for tournaments whose start_at has passed
 *   2) flips `active` → `finalizing` → `finished` for tournaments whose end_at has passed,
 *      ranks users by SUM(tournament_points.points) desc, walks prize_tiers,
 *      and INSERTs the prize rows in one UNNEST batch (unique coupon code
 *      CD-XXXX-XXXX-XXXX, up to 3 attempts for colliding codes).
 *
 * Mirrors the registerGameCleanupJobs pattern (setInterval + pool query +
 * structured logger) so it shares the same restart story.
 */
const { rollbackQuietly } = require('../utils/transaction');
const { generateCouponCode } = require('../utils/couponCode');

const TOURNAMENT_JOB_INTERVAL_MS = Number(process.env.TOURNAMENT_JOB_INTERVAL_MS || 60_000);

/**
 * Distribute prizes for one tournament. Caller holds no transaction — we
 * open our own BEGIN/COMMIT here so a partial failure rolls back cleanly.
 */
const finalizeOneTournament = async ({ pool, logger, tournamentId, clearCache }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Re-read with FOR UPDATE so a second job tick can't double-finalize.
    const tournamentRes = await client.query(
      `SELECT id, cafe_id, name, status, prize_tiers
       FROM tournaments WHERE id = $1 FOR UPDATE`,
      [tournamentId]
    );
    if (tournamentRes.rows.length === 0) {
      await rollbackQuietly(client);
      return;
    }
    const tournament = tournamentRes.rows[0];
    if (tournament.status !== 'finalizing') {
      // Some other tick beat us to it.
      await rollbackQuietly(client);
      return;
    }

    const prizeTiers = Array.isArray(tournament.prize_tiers) ? tournament.prize_tiers : [];
    if (prizeTiers.length === 0) {
      // No prizes — just mark finished.
      await client.query(
        `UPDATE tournaments SET status = 'finished', finalized_at = now() WHERE id = $1`,
        [tournament.id]
      );
      await client.query('COMMIT');
      logger.info('Tournament finished (no prizes)', { tournamentId: tournament.id });
      return;
    }

    // Pull top N by total points. N = number of prize tiers.
    const topN = prizeTiers.length;
    const standingsRes = await client.query(
      `SELECT u.id AS user_id, u.username,
              SUM(tp.points)::NUMERIC(8,2) AS total_points
       FROM tournament_points tp
       JOIN users u ON u.id = tp.user_id
       WHERE tp.tournament_id = $1
       GROUP BY u.id, u.username
       ORDER BY total_points DESC, u.username ASC
       LIMIT $2`,
      [tournament.id, topN]
    );
    const standings = standingsRes.rows;

    // Map tier rank → reward_id
    const rankToReward = new Map(prizeTiers.map((t) => [Number(t.rank), Number(t.reward_id)]));

    // Pre-fetch the rewards we need so we can copy titles into user_items.
    const rewardIds = Array.from(new Set([...rankToReward.values()]));
    let rewardsByIdRaw = { rows: [] };
    if (rewardIds.length > 0) {
      rewardsByIdRaw = await client.query(
        `SELECT id, title FROM rewards WHERE id = ANY($1) AND cafe_id = $2`,
        [rewardIds, tournament.cafe_id]
      );
    }
    const rewardsById = new Map(rewardsByIdRaw.rows.map((r) => [r.id, r.title]));

    const usedCodes = new Set();
    const nextCode = () => {
      let code = generateCouponCode();
      while (usedCodes.has(code)) code = generateCouponCode();
      usedCodes.add(code);
      return code;
    };

    const awardRows = [];
    for (let i = 0; i < standings.length; i += 1) {
      const rank = i + 1;
      const rewardId = rankToReward.get(rank);
      if (!rewardId) continue;
      awardRows.push({
        userId: standings[i].user_id,
        rank,
        rewardId,
        rewardTitle: rewardsById.get(rewardId) || 'Turnuva Ödülü',
        code: nextCode(),
      });
    }

    // One INSERT for the whole prize batch. A code collision (unique index on
    // user_items.code) silently skips that row, so retry only the missing ones
    // with fresh codes.
    const awarded = [];
    let pending = awardRows;
    for (let attempt = 0; attempt < 3 && pending.length > 0; attempt += 1) {
      const inserted = await client.query(
        `INSERT INTO user_items (user_id, item_id, item_title, code, cafe_id)
         SELECT reward.user_id, reward.item_id, reward.item_title, reward.code, reward.cafe_id
         FROM UNNEST($1::int[], $2::int[], $3::text[], $4::text[], $5::int[])
              AS reward(user_id, item_id, item_title, code, cafe_id)
         ON CONFLICT (code) DO NOTHING
         RETURNING id, code`,
        [
          pending.map((row) => row.userId),
          pending.map((row) => row.rewardId),
          pending.map((row) => row.rewardTitle),
          pending.map((row) => row.code),
          pending.map(() => tournament.cafe_id),
        ]
      );

      const insertedByCode = new Map(inserted.rows.map((row) => [row.code, row.id]));
      pending = pending.filter((row) => {
        const userItemId = insertedByCode.get(row.code);
        if (userItemId === undefined) return true;
        awarded.push({
          userId: row.userId,
          rank: row.rank,
          rewardId: row.rewardId,
          userItemId,
        });
        return false;
      });

      if (pending.length > 0) {
        pending = pending.map((row) => ({ ...row, code: nextCode() }));
      }
    }

    for (const row of pending) {
      logger.warn('Tournament prize coupon generation gave up after 3 attempts', {
        tournamentId: tournament.id,
        userId: row.userId,
        rewardId: row.rewardId,
      });
    }

    awarded.sort((a, b) => a.rank - b.rank);

    await client.query(
      `UPDATE tournaments SET status = 'finished', finalized_at = now() WHERE id = $1`,
      [tournament.id]
    );

    await client.query('COMMIT');

    logger.info('Tournament finalized', {
      tournamentId: tournament.id,
      cafeId: tournament.cafe_id,
      name: tournament.name,
      awarded,
    });

    if (typeof clearCache === 'function') {
      await clearCache('cache:/api/tournaments*').catch(() => undefined);
    }
  } catch (err) {
    try {
      await rollbackQuietly(client);
    } catch {
      // ignore — rollback failure is logged below as part of the original error
    }
    logger.error('Tournament finalization failed', {
      tournamentId,
      error: err?.message || String(err),
    });
  } finally {
    client.release();
  }
};

const registerTournamentJobs = ({ pool, isDbConnected, logger, clearCache }) => {
  const tick = async () => {
    try {
      if (!(await isDbConnected())) return;

      // 1) scheduled → active
      const activated = await pool.query(
        `UPDATE tournaments SET status = 'active'
         WHERE status = 'scheduled' AND start_at <= now()
         RETURNING id, cafe_id, name`
      );
      if (activated.rowCount > 0) {
        logger.info(`🏁 ${activated.rowCount} tournament(s) activated`, {
          ids: activated.rows.map((r) => r.id),
        });
        if (typeof clearCache === 'function') {
          await clearCache('cache:/api/tournaments*').catch(() => undefined);
        }
      }

      // 2) active → finalizing (claim before doing the heavy work)
      const claimed = await pool.query(
        `UPDATE tournaments SET status = 'finalizing'
         WHERE status = 'active' AND end_at <= now()
         RETURNING id`
      );

      for (const row of claimed.rows) {
        await finalizeOneTournament({ pool, logger, tournamentId: row.id, clearCache });
      }
    } catch (err) {
      logger.error('Tournament job tick failed', { error: err?.message || String(err) });
    }
  };

  // Fire one immediately on boot so a crash mid-tournament can recover
  // without waiting a full interval.
  setTimeout(tick, 5_000);
  setInterval(tick, TOURNAMENT_JOB_INTERVAL_MS);
  logger.info(`⏱  Tournament job registered (every ${TOURNAMENT_JOB_INTERVAL_MS}ms)`);
};

module.exports = { registerTournamentJobs, finalizeOneTournament };
