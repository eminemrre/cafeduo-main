import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BattleshipGame, shipLabel, toCell } from './BattleshipGame';
import { api } from '../lib/api';
import type { CompetitiveEngineState, CompetitiveGame, User } from '../types';

jest.mock('../lib/gameAudio', () => ({ playGameSfx: jest.fn() }));

jest.mock('../lib/api', () => ({
  api: { games: { get: jest.fn(), action: jest.fn() } },
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

jest.mock('./RetroButton', () => {
  const Button = ({
    children,
    disabled,
    onClick,
    variant: _variant,
    size: _size,
    ...props
  }: any) => (
    <button type="button" disabled={disabled} onClick={onClick} {...props}>
      {children}
    </button>
  );
  return { RetroButton: Button, __esModule: true, default: Button };
});

const mockApi = api as unknown as { games: { get: jest.Mock; action: jest.Mock } };

const user: User = {
  id: 1,
  username: 'ada',
  email: 'ada@example.com',
  points: 100,
  wins: 0,
  gamesPlayed: 0,
};

const engine = (overrides: Partial<CompetitiveEngineState> = {}): CompetitiveEngineState => {
  const now = Date.now();
  return {
    version: 2,
    kind: 'battleship',
    revision: 3,
    phase: 'battle',
    roundIndex: 2,
    totalRounds: 201,
    startedAt: new Date(now).toISOString(),
    phaseEndsAt: new Date(now + 20_000).toISOString(),
    updatedAt: new Date(now).toISOString(),
    players: {
      host: { name: 'ada', score: 0, hits: 0, placed: true },
      guest: { name: 'bora', score: 0, hits: 0, placed: true },
    },
    round: {
      id: 'r2',
      index: 1,
      phase: 'battle',
      turn: 'host',
      startedAt: new Date(now).toISOString(),
      endsAt: new Date(now + 20_000).toISOString(),
    },
    boards: {
      host: { shots: [{ cell: 9, hit: true }], sunk: [] },
      guest: { shots: [{ cell: 4, hit: false }], sunk: [{ size: 2, cells: [36, 37] }] },
    },
    lastShot: null,
    result: null,
    ...overrides,
  };
};

const snapshot = (
  engineState: CompetitiveEngineState,
  overrides: Partial<CompetitiveGame> = {}
): CompetitiveGame => ({
  id: 'g1',
  hostName: 'ada',
  guestName: 'bora',
  gameType: 'Amiral Battı',
  points: 10,
  table: 'MASA01',
  status: 'active',
  protocolVersion: 2,
  serverNow: new Date().toISOString(),
  gameState: { engine: engineState },
  actorView: { fleet: [{ size: 4, cells: [0, 1, 2, 3] }] },
  ...overrides,
});

const cell = (grid: string, index: number) =>
  within(screen.getByTestId(grid)).getAllByRole<HTMLButtonElement>('button')[index];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Turkish suffixes', () => {
  it('follows how the row number is read', () => {
    expect(toCell(0)).toBe("A1'e");
    expect(toCell(9)).toBe("B2'ye");
    expect(toCell(43)).toBe("D6'ya");
    expect(toCell(51)).toBe("D7'ye");
    expect(shipLabel(2)).toBe("2'lik");
    expect(shipLabel(3)).toBe("3'lük");
    expect(shipLabel(4)).toBe("4'lük");
  });
});

describe('BattleshipGame practice', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const renderPractice = (onGameEnd = jest.fn()) =>
    render(
      <BattleshipGame
        currentUser={user}
        gameId="practice-1"
        isBot
        onGameEnd={onGameEnd}
        onLeave={jest.fn()}
      />
    );

  const isShip = (index: number) =>
    cell('battleship-placement-grid', index).className.includes('duo-bs-cell--ship');

  it('places ships tap by tap and always covers the tapped cell', () => {
    renderPractice();
    expect(screen.getByTestId('battleship-confirm')).toBeDisabled();
    // The 4-ship tapped at H1 (index 7) slides back to E1-H1.
    fireEvent.click(cell('battleship-placement-grid', 7));
    for (const index of [4, 5, 6, 7]) expect(isShip(index)).toBe(true);
    // The 3-ship tapped at D1, next to it, slides to B1-D1 instead of refusing.
    fireEvent.click(cell('battleship-placement-grid', 3));
    for (const index of [1, 2, 3]) expect(isShip(index)).toBe(true);
    expect(screen.queryByText(/üst üste binemez/)).not.toBeInTheDocument();
    fireEvent.click(cell('battleship-placement-grid', 16));
    fireEvent.click(cell('battleship-placement-grid', 40));
    expect(screen.getByTestId('battleship-confirm')).not.toBeDisabled();
  });

  it('selects a placed ship by tapping it and moves it to the next tapped cell', () => {
    renderPractice();
    for (const index of [0, 16, 32, 48]) fireEvent.click(cell('battleship-placement-grid', index));
    // Tapping the 4-ship picks it; the fleet stays complete.
    fireEvent.click(cell('battleship-placement-grid', 2));
    expect(cell('battleship-placement-grid', 0).className).toContain('duo-bs-cell--picked');
    expect(screen.getByTestId('battleship-ship-0')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('battleship-confirm')).not.toBeDisabled();
    fireEvent.click(cell('battleship-placement-grid', 60));
    for (const index of [60, 61, 62, 63]) expect(isShip(index)).toBe(true);
    for (const index of [0, 1, 2, 3]) expect(isShip(index)).toBe(false);
  });

  it('turns the selected placed ship in place', () => {
    renderPractice();
    fireEvent.click(cell('battleship-placement-grid', 0));
    fireEvent.click(cell('battleship-placement-grid', 1));
    fireEvent.click(screen.getByTestId('battleship-rotate'));
    for (const index of [0, 8, 16, 24]) expect(isShip(index)).toBe(true);
    expect(isShip(1)).toBe(false);
  });

  it('plays against the bot: select, fire, the bot answers', () => {
    renderPractice();
    fireEvent.click(screen.getByTestId('battleship-shuffle'));
    fireEvent.click(screen.getByTestId('battleship-confirm'));
    expect(screen.getByTestId('battleship-battle')).toBeInTheDocument();
    expect(screen.getByTestId('battleship-turn')).toHaveTextContent('Sıra sende');

    const fire = screen.getByTestId('battleship-fire');
    expect(fire).toBeDisabled();
    fireEvent.click(cell('battleship-target-grid', 27));
    expect(fire).toHaveTextContent("D4'e ateş et");
    fireEvent.click(fire);
    expect(cell('battleship-target-grid', 27)).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('battleship-turn')).toHaveTextContent('Sıra rakipte');

    act(() => {
      jest.advanceTimersByTime(800);
    });
    expect(screen.getByTestId('battleship-turn')).toHaveTextContent('Sıra sende');
    const ownMarks = screen
      .getByTestId('battleship-own-grid')
      .querySelectorAll('.duo-bs-cell--hit, .duo-bs-cell--miss');
    expect(ownMarks).toHaveLength(1);
  });

  it('keeps a keyboard entry point after A1 has already been fired on', () => {
    renderPractice();
    fireEvent.click(screen.getByTestId('battleship-shuffle'));
    fireEvent.click(screen.getByTestId('battleship-confirm'));
    fireEvent.click(cell('battleship-target-grid', 0));
    fireEvent.click(screen.getByTestId('battleship-fire'));
    act(() => {
      jest.advanceTimersByTime(800);
    });
    const entry = cell('battleship-target-grid', 0);
    expect(entry).not.toBeDisabled();
    expect(entry).toHaveAttribute('aria-disabled', 'true');
    entry.focus();
    fireEvent.keyDown(entry, { key: 'ArrowRight' });
    expect(cell('battleship-target-grid', 1)).toHaveFocus();
  });

  it('fires on a second tap of the selected cell', () => {
    renderPractice();
    fireEvent.click(screen.getByTestId('battleship-shuffle'));
    fireEvent.click(screen.getByTestId('battleship-confirm'));
    fireEvent.click(cell('battleship-target-grid', 27));
    expect(cell('battleship-target-grid', 27)).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(cell('battleship-target-grid', 27));
    expect(cell('battleship-target-grid', 27)).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('battleship-turn')).toHaveTextContent('Sıra rakipte');
  });

  it('labels the seas with their coordinates', () => {
    renderPractice();
    const grid = screen.getByTestId('battleship-placement-grid');
    const axes = grid.closest('.duo-bs-sea');
    expect(axes).toHaveTextContent('ABCDEFGH');
    expect(axes).toHaveTextContent('12345678');
  });

  it('always shows the own fleet as a keyboard-readable grid', () => {
    renderPractice();
    fireEvent.click(screen.getByTestId('battleship-shuffle'));
    fireEvent.click(screen.getByTestId('battleship-confirm'));
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    const own = screen.getByTestId('battleship-own-grid');
    expect(within(own).getAllByRole('button')).toHaveLength(64);
    const first = within(own).getAllByRole('button')[0];
    expect(first).toHaveAttribute('aria-disabled', 'true');
    expect(first).not.toBeDisabled();
  });

  it('ends a practice match with zero points', () => {
    const onGameEnd = jest.fn();
    renderPractice(onGameEnd);
    fireEvent.click(screen.getByTestId('battleship-shuffle'));
    fireEvent.click(screen.getByTestId('battleship-confirm'));
    for (let target = 0; target < 64 && !onGameEnd.mock.calls.length; target += 1) {
      const button = cell('battleship-target-grid', target);
      if (
        !screen.queryByTestId('battleship-fire') ||
        button.getAttribute('aria-disabled') === 'true'
      ) {
        act(() => {
          jest.advanceTimersByTime(1000);
        });
        continue;
      }
      fireEvent.click(button);
      fireEvent.click(screen.getByTestId('battleship-fire'));
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(onGameEnd).toHaveBeenCalledWith(
      expect.any(String),
      0,
      expect.objectContaining({ kind: 'battleship' })
    );
  });
});

describe('BattleshipGame ranked', () => {
  it('sends the layout as a place action and shows only the server fleet', async () => {
    mockApi.games.get.mockResolvedValue(
      snapshot(
        engine({
          phase: 'placement',
          round: {
            id: 'r1',
            index: 0,
            phase: 'placement',
            turn: null,
            startedAt: new Date().toISOString(),
            endsAt: new Date(Date.now() + 45_000).toISOString(),
          },
          players: {
            host: { name: 'ada', score: 0, placed: false },
            guest: { name: 'bora', score: 0, placed: true },
          },
          boards: { host: { shots: [], sunk: [] }, guest: { shots: [], sunk: [] } },
        }),
        { actorView: undefined }
      )
    );
    mockApi.games.action.mockResolvedValue({
      success: true,
      game: snapshot(engine()),
    });
    render(
      <BattleshipGame
        currentUser={user}
        gameId="g1"
        isBot={false}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );
    await screen.findByTestId('battleship-placement');
    for (const index of [0, 8, 16, 24]) fireEvent.click(cell('battleship-placement-grid', index));
    fireEvent.click(screen.getByTestId('battleship-confirm'));
    await waitFor(() => expect(mockApi.games.action).toHaveBeenCalledTimes(1));
    const [, payload] = mockApi.games.action.mock.calls[0];
    expect(payload).toEqual(
      expect.objectContaining({ roundId: 'r1', type: 'place', layout: expect.any(Array) })
    );
    expect(payload.layout).toHaveLength(4);
    expect(payload.hit).toBeUndefined();
    await screen.findByTestId('battleship-battle');
    // Own sea draws the fleet from actorView, nothing invented locally.
    const ownShips = screen
      .getByTestId('battleship-own-grid')
      .querySelectorAll('.duo-bs-cell--ship');
    expect(ownShips).toHaveLength(4 - 0);
  });

  it('fires one cell on its own turn and draws hits, misses and sunk ships from the snapshot', async () => {
    mockApi.games.get.mockResolvedValue(snapshot(engine()));
    mockApi.games.action.mockResolvedValue({
      success: true,
      game: snapshot(
        engine({
          revision: 4,
          round: { ...engine().round!, id: 'r3', turn: 'guest' },
          boards: {
            host: engine().boards!.host,
            guest: {
              shots: [...engine().boards!.guest.shots, { cell: 27, hit: true }],
              sunk: engine().boards!.guest.sunk,
            },
          },
          lastShot: {
            by: 'host',
            cell: 27,
            hit: true,
            sunkSize: null,
            at: new Date().toISOString(),
          },
        })
      ),
    });
    render(
      <BattleshipGame
        currentUser={user}
        gameId="g1"
        isBot={false}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );
    await screen.findByTestId('battleship-battle');
    expect(screen.getByTestId('battleship-turn')).toHaveTextContent('Sıra sende');
    expect(cell('battleship-target-grid', 4).className).toContain('duo-bs-cell--miss');
    expect(cell('battleship-target-grid', 36).className).toContain('duo-bs-cell--sunk');
    expect(cell('battleship-target-grid', 4)).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByTestId('battleship-own-grid').querySelectorAll('.duo-bs-cell--hit')
    ).toHaveLength(1);

    fireEvent.click(cell('battleship-target-grid', 27));
    fireEvent.click(screen.getByTestId('battleship-fire'));
    await waitFor(() => expect(mockApi.games.action).toHaveBeenCalledTimes(1));
    expect(mockApi.games.action.mock.calls[0][1]).toEqual(
      expect.objectContaining({ roundId: 'r2', type: 'fire', cell: 27 })
    );
    await screen.findByText('D4: isabet!');
    expect(screen.getByTestId('battleship-turn')).toHaveTextContent('Sıra rakipte');
    expect(cell('battleship-target-grid', 27).className).toContain('duo-bs-cell--hit');
    expect(screen.getByTestId('battleship-fire')).toBeDisabled();
  });

  it('shows the ships the opponent kept afloat once the match is over', async () => {
    const guestFleet = [
      { size: 4, cells: [56, 57, 58, 59] },
      { size: 3, cells: [31, 39, 47] },
      { size: 3, cells: [18, 26, 34] },
      { size: 2, cells: [36, 37] },
    ];
    mockApi.games.get.mockResolvedValue(
      snapshot(
        engine({
          phase: 'finished',
          round: { ...engine().round!, phase: 'finished' },
          boards: {
            host: { shots: [], sunk: [] },
            guest: {
              shots: [
                { cell: 36, hit: true },
                { cell: 37, hit: true },
                { cell: 58, hit: true },
              ],
              sunk: [{ size: 2, cells: [36, 37] }],
            },
          },
          result: { winner: 'bora', draw: false, reason: 'fleet_sunk' } as never,
          reveal: { host: [{ size: 4, cells: [0, 1, 2, 3] }], guest: guestFleet },
        }),
        { status: 'finished' }
      )
    );
    render(
      <BattleshipGame
        currentUser={user}
        gameId="g1"
        isBot={false}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );
    await screen.findByTestId('battleship-battle');
    const target = screen.getByTestId('battleship-target-grid');
    // One sunk ship, three that got away.
    expect(target.querySelectorAll('.duo-bs-ship--under:not(.duo-bs-ship--escaped)')).toHaveLength(1);
    expect(target.querySelectorAll('.duo-bs-ship--escaped')).toHaveLength(3);
    // The hit on the escaped battleship stays visible on top of it.
    expect(cell('battleship-target-grid', 58).className).toContain('duo-bs-cell--on-ship');
    expect(screen.getByTestId('battleship-reveal-legend')).toHaveTextContent('3 gemi kaçtı');
  });

  it('cannot fire while the opponent has the turn', async () => {
    mockApi.games.get.mockResolvedValue(
      snapshot(engine({ round: { ...engine().round!, turn: 'guest' } }))
    );
    render(
      <BattleshipGame
        currentUser={user}
        gameId="g1"
        isBot={false}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );
    await screen.findByTestId('battleship-battle');
    // The next target can be picked ahead, but neither the button nor a
    // second tap sends a shot while the opponent has the turn.
    fireEvent.click(cell('battleship-target-grid', 20));
    fireEvent.click(cell('battleship-target-grid', 20));
    expect(cell('battleship-target-grid', 20)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('battleship-fire')).toBeDisabled();
    expect(screen.getByTestId('battleship-fire')).toHaveTextContent('E3 hazır · sıra rakipte');
    expect(mockApi.games.action).not.toHaveBeenCalled();
  });
});
