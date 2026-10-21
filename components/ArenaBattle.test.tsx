import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  AIM_GAME_TYPE,
  ArenaBattle,
  MAX_ROUNDS,
  clampGauge,
  pointsFromShot,
  shotLabel,
} from './ArenaBattle';
import { api } from '../lib/api';
import { GAME_REGISTRY } from '../shared/gameRegistry';
import type { CompetitiveEngineState, CompetitiveGame, User } from '../types';

jest.mock('../lib/gameAudio', () => ({
  playGameSfx: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  api: {
    games: {
      get: jest.fn(),
      action: jest.fn(),
    },
  },
}));

jest.mock('../lib/socket', () => ({
  socketService: {
    isConnected: jest.fn(() => true),
    onConnectionChange: jest.fn(() => jest.fn()),
    getSocket: jest.fn(() => ({ on: jest.fn(), off: jest.fn() })),
    joinGame: jest.fn(),
    leaveGame: jest.fn(),
  },
}));

// RetroButton uses motion.button — mock it as a plain button to keep disabled prop working.
jest.mock('./RetroButton', () => ({
  RetroButton: ({ children, disabled, onClick, ...props }: any) => (
    <button type="button" disabled={disabled} onClick={onClick} {...props}>
      {children}
    </button>
  ),
  __esModule: true,
  default: ({ children, disabled, onClick, ...props }: any) => (
    <button type="button" disabled={disabled} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

// PixiJS overlay requires WebGL; mock as inert canvas in tests so the
// dynamic import + app.init() don't fire in jsdom.
// `mockStageComesUp` decides whether the fake stage reports itself ready.
let mockStageComesUp = false;
jest.mock('./games/AimBattleStageCanvas', () => ({
  AimBattleStageCanvas: React.forwardRef(function MockAimBattleStageCanvas(
    props: { className?: string; onReadyChange?: (ready: boolean) => void },
    _ref: React.Ref<unknown>
  ) {
    const { onReadyChange } = props;
    React.useEffect(() => {
      if (mockStageComesUp) onReadyChange?.(true);
    }, [onReadyChange]);
    return <canvas data-testid="aim-battle-pixi-canvas" />;
  }),
}));

const mockApi = api as unknown as {
  games: { get: jest.Mock; action: jest.Mock };
};

const mockUser: User = {
  id: 1,
  username: 'emin',
  email: 'emin@example.com',
  points: 100,
  wins: 0,
  gamesPlayed: 0,
};

const buildAimEngine = (
  overrides: Partial<CompetitiveEngineState> = {}
): CompetitiveEngineState => {
  const now = Date.now();
  return {
    version: 2,
    kind: 'aim',
    revision: 1,
    phase: 'open',
    roundIndex: 1,
    totalRounds: 5,
    startedAt: new Date(now).toISOString(),
    phaseEndsAt: new Date(now + 8000).toISOString(),
    updatedAt: new Date(now).toISOString(),
    players: {
      host: { name: 'emin', score: 0, hits: 0, answered: false },
      guest: { name: 'bob', score: 0, hits: 0, answered: false },
    },
    round: {
      id: 'r1',
      index: 1,
      startedAt: new Date(now).toISOString(),
      endsAt: new Date(now + 8000).toISOString(),
      trajectory: { start: 40, direction: 1, speed: 4 / 46 },
    },
    result: null,
    ...overrides,
  };
};

const buildAimSnapshot = (overrides: Partial<CompetitiveGame> = {}): CompetitiveGame => ({
  id: 'game-1',
  hostName: 'emin',
  guestName: 'bob',
  gameType: 'Nişancı Düellosu',
  points: 10,
  table: 'MASA01',
  status: 'active',
  protocolVersion: 2,
  serverNow: new Date().toISOString(),
  gameState: { engine: buildAimEngine() },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.games.get.mockResolvedValue(buildAimSnapshot());
  mockStageComesUp = false;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ArenaBattle scoring helpers', () => {
  it('scores shots by distance from the center', () => {
    expect(clampGauge(140)).toBe(100);
    expect(clampGauge(-10)).toBe(0);
    expect(pointsFromShot(50)).toBe(3);
    expect(pointsFromShot(52.5)).toBe(3);
    expect(pointsFromShot(55)).toBe(2);
    expect(pointsFromShot(58)).toBe(1);
    expect(pointsFromShot(62)).toBe(1);
    expect(pointsFromShot(65)).toBe(0);
    expect(shotLabel(50)).toBe('Mükemmel kilit');
  });

  it('keeps the registry score cap in step with the rounds and the best shot', () => {
    expect(GAME_REGISTRY[AIM_GAME_TYPE].maxScore).toBe(MAX_ROUNDS * 3);
  });
});

describe('ArenaBattle bot practice', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders the reticle game and debug snapshot', () => {
    render(
      <ArenaBattle
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    expect(screen.getByTestId('arena-battle')).toBeInTheDocument();
    expect(screen.getByTestId('arena-fire-button')).toBeInTheDocument();
    expect(screen.getByText('Nişancı Düellosu')).toBeInTheDocument();

    const renderToText = (window as Window & { render_game_to_text?: () => string })
      .render_game_to_text;
    expect(renderToText).toBeInstanceOf(Function);
    expect(renderToText?.()).toContain('"gameType":"Nişancı Düellosu"');
    expect(renderToText?.()).toContain('"name":"emin"');
  });

  it('locks a round after firing and advances to the next round', () => {
    render(
      <ArenaBattle
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    const fireButton = screen.getByTestId('arena-fire-button');
    fireEvent.click(fireButton);
    expect(fireButton).toBeDisabled();

    act(() => {
      jest.advanceTimersByTime(800);
    });

    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    expect(screen.getByTestId('arena-fire-button')).not.toBeDisabled();
  });

  it('finishes in bot mode and reports the winner after five shots', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const onGameEnd = jest.fn();
    render(
      <ArenaBattle
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={onGameEnd}
        onLeave={jest.fn()}
      />
    );

    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(screen.getByTestId('arena-fire-button'));
      act(() => {
        jest.advanceTimersByTime(800);
      });
    }

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onGameEnd).toHaveBeenCalledWith(
      'emin',
      10,
      expect.objectContaining({ kind: 'arena', playerScore: expect.any(Number) })
    );
  });

  it('calls onLeave from the exit button', () => {
    const onLeave = jest.fn();
    render(
      <ArenaBattle
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={onLeave}
      />
    );

    fireEvent.click(screen.getByText('Oyundan çık'));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('draws the reticle in CSS while the WebGL stage is not up', () => {
    render(
      <ArenaBattle
        currentUser={mockUser}
        gameId={null}
        isBot
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );
    expect(screen.getByTestId('arena-reticle')).toBeInTheDocument();
  });

  it('leaves the reticle to the WebGL stage once it draws', () => {
    mockStageComesUp = true;
    render(
      <ArenaBattle
        currentUser={mockUser}
        gameId={null}
        isBot
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );
    expect(screen.queryByTestId('arena-reticle')).not.toBeInTheDocument();
  });
});

describe('ArenaBattle multiplayer', () => {
  it('fires with an action envelope and applies the server reveal', async () => {
    mockApi.games.action.mockResolvedValue({
      success: true,
      game: buildAimSnapshot({
        gameState: {
          engine: buildAimEngine({
            revision: 2,
            phase: 'reveal',
            players: {
              host: { name: 'emin', score: 3, answered: true },
              guest: { name: 'bob', score: 0, answered: false },
            },
            round: {
              ...buildAimEngine().round!,
              shots: {
                host: { position: 52, points: 3 },
                guest: null,
              },
              scoreDelta: { host: 3, guest: 0 },
            },
          }),
        },
      }),
    });

    render(
      <ArenaBattle
        currentUser={mockUser}
        gameId="game-1"
        isBot={false}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    const fireButton = screen.getByTestId('arena-fire-button');
    await waitFor(() => expect(fireButton).not.toBeDisabled());
    fireEvent.click(fireButton);

    await waitFor(() => expect(mockApi.games.action).toHaveBeenCalledTimes(1));
    const [gameId, payload] = mockApi.games.action.mock.calls[0];
    expect(gameId).toBe('game-1');
    expect(payload).toEqual(expect.objectContaining({ roundId: 'r1', type: 'fire' }));
    expect(payload.position).toBeUndefined();
    expect(payload.points).toBeUndefined();
    expect(payload.score).toBeUndefined();

    await screen.findByText('Atışın: Mükemmel kilit (3). Rakip ateş etmedi.');
    expect(screen.getByTestId('arena-battle')).toHaveTextContent('3');
    expect(screen.getByTestId('arena-fire-button')).toBeDisabled();
  });

  it('shows a refresh path for an active legacy snapshot', async () => {
    mockApi.games.get.mockResolvedValue(buildAimSnapshot({ protocolVersion: 1, gameState: {} }));
    render(
      <ArenaBattle
        currentUser={mockUser}
        gameId="game-1"
        isBot={false}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    await screen.findByText('İstemci güncellemesi gerekiyor');
    expect(screen.getByText('Sayfayı yenile')).toBeInTheDocument();
    expect(screen.queryByTestId('arena-fire-button')).not.toBeInTheDocument();
  });
});
