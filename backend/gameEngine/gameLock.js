/**
 * In-process serialization of actions per game.
 *
 * PostgreSQL games use `SELECT ... FOR UPDATE` inside a transaction. The
 * memory fallback has no such lock, so it queues actions for one game id on a
 * promise chain. Both paths therefore apply actions in arrival order and a
 * double-click cannot score twice.
 */

const createGameLockRegistry = () => {
  /** @type {Map<string, Promise<void>>} */
  const tails = new Map();

  const runExclusive = (gameId, task) => {
    if (typeof task !== 'function') {
      return Promise.reject(new TypeError('runExclusive requires a task function'));
    }
    const key = String(gameId ?? '').trim();
    if (!key) return Promise.reject(new Error('runExclusive requires a game id'));

    const previous = tails.get(key) || Promise.resolve();
    const run = previous.catch(() => undefined).then(task);
    const tail = run.then(
      () => undefined,
      () => undefined
    );
    tails.set(key, tail);
    void tail.finally(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return run;
  };

  const pendingCount = () => tails.size;

  return { runExclusive, pendingCount };
};

const defaultRegistry = createGameLockRegistry();

module.exports = {
  createGameLockRegistry,
  defaultRegistry,
};
