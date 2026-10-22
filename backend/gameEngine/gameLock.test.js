const { createGameLockRegistry } = require('./gameLock');

describe('createGameLockRegistry', () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

  it('runs actions for the same game in arrival order', async () => {
    const locks = createGameLockRegistry();
    const order = [];

    const first = locks.runExclusive('7', async () => {
      order.push('first:start');
      await tick();
      order.push('first:end');
      return 'first';
    });
    const second = locks.runExclusive('7', async () => {
      order.push('second:start');
      await tick();
      order.push('second:end');
      return 'second';
    });

    await expect(Promise.all([first, second])).resolves.toEqual(['first', 'second']);
    expect(order).toEqual(['first:start', 'first:end', 'second:start', 'second:end']);
  });

  it('does not block different games', async () => {
    const locks = createGameLockRegistry();
    const order = [];

    await Promise.all([
      locks.runExclusive('1', async () => {
        order.push('one:start');
        await tick();
        order.push('one:end');
      }),
      locks.runExclusive('2', async () => {
        order.push('two:start');
        await tick();
        order.push('two:end');
      }),
    ]);

    expect(order.slice(0, 2)).toEqual(['one:start', 'two:start']);
  });

  it('keeps the queue alive after a failed task', async () => {
    const locks = createGameLockRegistry();
    const failed = locks.runExclusive('9', async () => {
      throw new Error('boom');
    });
    const next = locks.runExclusive('9', async () => 'recovered');

    await expect(failed).rejects.toThrow('boom');
    await expect(next).resolves.toBe('recovered');
  });

  it('releases the tail once the queue drains', async () => {
    const locks = createGameLockRegistry();
    await locks.runExclusive('3', async () => 'done');
    await Promise.resolve();
    expect(locks.pendingCount()).toBe(0);
  });

  it('rejects a missing game id or task', async () => {
    const locks = createGameLockRegistry();
    await expect(locks.runExclusive('', async () => null)).rejects.toThrow(/game id/);
    await expect(locks.runExclusive('1', null)).rejects.toThrow(/task function/);
  });
});
