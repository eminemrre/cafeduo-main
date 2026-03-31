const { createGameService } = require('./gameService');

describe('gameService', () => {
  it('routes waiting game query to cafe-scoped repository method', async () => {
    const gameRepository = {
      listWaitingGamesByCafe: jest.fn().mockResolvedValue([{ id: 1 }]),
      listWaitingGamesByTable: jest.fn(),
      listWaitingGames: jest.fn(),
      findLatestActiveGameByUsername: jest.fn(),
    };

    const service = createGameService({
      isDbConnected: jest.fn().mockResolvedValue(true),
      gameRepository,
      getMemoryGames: () => [],
      getMemoryUsers: () => [],
      supportedGameTypes: new Set(['Tank Düellosu']),
    });

    const result = await service.listWaitingGames({
      adminActor: false,
      hasCheckIn: true,
      actorCafeId: 3,
      actorTableCode: 'MASA03',
      requestedTableCode: null,
      scopeAllRequested: true,
    });

    expect(gameRepository.listWaitingGamesByCafe).toHaveBeenCalledWith({ cafeId: 3 });
    expect(result).toEqual([{ id: 1 }]);
  });

  it('filters waiting games in memory mode by table and same-cafe scope', async () => {
    const service = createGameService({
      isDbConnected: jest.fn().mockResolvedValue(false),
      gameRepository: {},
      getMemoryGames: () => [
        { id: 1, hostName: 'u1', gameType: 'Tank Düellosu', table: 'MASA05', status: 'waiting' },
        { id: 2, hostName: 'u2', gameType: 'Tank Düellosu', table: 'MASA07', status: 'waiting' },
      ],
      getMemoryUsers: () => [
        { username: 'u1', cafe_id: 1 },
        { username: 'u2', cafe_id: 2 },
      ],
      supportedGameTypes: new Set(['Tank Düellosu']),
    });

    const result = await service.listWaitingGames({
      adminActor: false,
      hasCheckIn: true,
      actorCafeId: 1,
      actorTableCode: 'MASA05',
      requestedTableCode: null,
      scopeAllRequested: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('returns active game for user in memory fallback', async () => {
    const service = createGameService({
      isDbConnected: jest.fn().mockResolvedValue(false),
      gameRepository: {},
      getMemoryGames: () => [
        { id: 10, hostName: 'u1', status: 'active', gameType: 'Tank Düellosu' },
      ],
      getMemoryUsers: () => [],
      supportedGameTypes: new Set(['Tank Düellosu']),
    });

    const game = await service.getActiveGameForUser('u1');
    expect(game).toMatchObject({ id: 10 });
  });
});

