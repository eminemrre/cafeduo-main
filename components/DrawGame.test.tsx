import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DrawGame } from './DrawGame';
import { api } from '../lib/api';
import type { CompetitiveEngineState, CompetitiveGame, User } from '../types';

jest.mock('../lib/gameAudio', () => ({ playGameSfx: jest.fn() }));

jest.mock('../lib/api', () => ({
  api: { games: { get: jest.fn(), action: jest.fn(), strokes: jest.fn() } },
}));

jest.mock('../lib/socket', () => {
  const socket = { on: jest.fn(), off: jest.fn(), emit: jest.fn() };
  return {
    socketService: {
      isConnected: jest.fn(() => false),
      onConnectionChange: jest.fn(() => jest.fn()),
      getSocket: jest.fn(() => socket),
      joinGame: jest.fn(),
      leaveGame: jest.fn(),
    },
  };
});

const mockApi = api as unknown as { games: { get: jest.Mock; action: jest.Mock; strokes: jest.Mock } };

const ada: User = { id: 1, username: 'ada', email: 'ada@example.com', points: 100, wins: 0, gamesPlayed: 0 };
const bora: User = { ...ada, id: 2, username: 'bora', email: 'bora@example.com' };

const engine = (overrides: Partial<CompetitiveEngineState> = {}): CompetitiveEngineState => {
  const now = Date.now();
  return {
    version: 2,
    kind: 'draw',
    revision: 3,
    phase: 'choosing',
    roundIndex: 1,
    totalRounds: 4,
    startedAt: new Date(now).toISOString(),
    phaseEndsAt: new Date(now + 10_000).toISOString(),
    updatedAt: new Date(now).toISOString(),
    players: { host: { name: 'ada', score: 0 }, guest: { name: 'bora', score: 0 } },
    round: {
      id: 'r1',
      index: 0,
      drawer: 'host',
      startedAt: new Date(now).toISOString(),
      endsAt: new Date(now + 10_000).toISOString(),
    },
    result: null,
    ...overrides,
  };
};

const drawingRound = () => {
  const now = Date.now();
  return {
    id: 'r1',
    index: 0,
    drawer: 'host' as const,
    startedAt: new Date(now).toISOString(),
    drawStartedAt: new Date(now).toISOString(),
    endsAt: new Date(now + 75_000).toISOString(),
    length: 6,
    category: 'Ulaşım',
    difficulty: 2,
    hint: ['f', null, null, null, null, null],
    guesses: [
      { text: 'araba', close: false },
      { text: 'faytun', close: true },
    ],
    solved: false,
    reported: false,
  };
};

const snapshot = (state: CompetitiveEngineState, actorView?: CompetitiveGame['actorView']): CompetitiveGame => ({
  id: 'g5',
  hostName: 'ada',
  guestName: 'bora',
  gameType: 'Çiz Bil',
  points: 10,
  table: 'MASA01',
  status: 'active',
  protocolVersion: 2,
  serverNow: new Date().toISOString(),
  gameState: { engine: state },
  ...(actorView ? { actorView } : {}),
});

const renderGame = (user: User) =>
  render(<DrawGame currentUser={user} gameId="g5" opponentName="rakip" onGameEnd={jest.fn()} onLeave={jest.fn()} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.games.strokes.mockResolvedValue({ roundId: 'r1', ops: [] });
});

describe('DrawGame', () => {
  it('lets the drawer pick one of three words through the action endpoint', async () => {
    const view = {
      draw: {
        roundId: 'r1',
        role: 'drawer' as const,
        choices: [
          { word: 'kedi', difficulty: 1 },
          { word: 'fayton', difficulty: 2 },
          { word: 'arasta', difficulty: 3 },
        ],
      },
    };
    mockApi.games.get.mockResolvedValue(snapshot(engine(), view));
    mockApi.games.action.mockResolvedValue({ success: true, game: snapshot(engine(), view) });
    renderGame(ada);
    await waitFor(() => expect(screen.getByTestId('draw-choice-1')).toHaveTextContent('fayton'));
    fireEvent.click(screen.getByTestId('draw-choice-1'));
    await waitFor(() => expect(mockApi.games.action).toHaveBeenCalled());
    expect(mockApi.games.action.mock.calls[0][1]).toMatchObject({ roundId: 'r1', type: 'pick', optionIndex: 1 });
  });

  it('tells the guesser to wait while the drawer chooses, without any word', async () => {
    mockApi.games.get.mockResolvedValue(snapshot(engine(), { draw: { roundId: 'r1', role: 'guesser' } }));
    renderGame(bora);
    await waitFor(() => expect(screen.getByTestId('draw-waiting')).toHaveTextContent('ada'));
    expect(screen.queryByTestId('draw-choice-0')).not.toBeInTheDocument();
  });

  it('shows the guesser the hint tiles and guess log, sends guesses and a confirmed report', async () => {
    const state = engine({ phase: 'drawing', round: drawingRound() });
    mockApi.games.get.mockResolvedValue(snapshot(state, { draw: { roundId: 'r1', role: 'guesser' } }));
    mockApi.games.action.mockResolvedValue({ success: true, game: snapshot(state) });
    renderGame(bora);
    await waitFor(() => expect(screen.getByTestId('draw-hint').children).toHaveLength(6));
    expect(screen.getByTestId('draw-hint')).toHaveTextContent('f');
    expect(screen.getByTestId('draw-guesses')).toHaveTextContent('faytun · çok yakın');
    expect(mockApi.games.strokes).toHaveBeenCalledWith('g5');
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tahminin/), { target: { value: ' Fayton ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tahmin et' }));
    await waitFor(() => expect(mockApi.games.action).toHaveBeenCalledTimes(1));
    expect(mockApi.games.action.mock.calls[0][1]).toMatchObject({ type: 'solve', word: 'fayton' });

    fireEvent.click(screen.getByRole('button', { name: 'Harf ya da rakam yazdı' }));
    expect(mockApi.games.action).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Emin misin/ }));
    await waitFor(() => expect(mockApi.games.action).toHaveBeenCalledTimes(2));
    expect(mockApi.games.action.mock.calls[1][1]).toMatchObject({ type: 'report' });
  });

  it('gives the drawer the word, the labelled palette and no guess box', async () => {
    const state = engine({ phase: 'drawing', round: drawingRound() });
    mockApi.games.get.mockResolvedValue(snapshot(state, { draw: { roundId: 'r1', role: 'drawer', word: 'fayton' } }));
    renderGame(ada);
    await waitFor(() => expect(screen.getByTestId('draw-word')).toHaveTextContent('fayton'));
    expect(screen.getByRole('toolbar', { name: 'Çizim araçları' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Silgi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lokum' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByLabelText(/Tahminin/)).not.toBeInTheDocument();
  });

  it('never shows a word from an earlier round to the drawer', async () => {
    const state = engine({ phase: 'drawing', round: { ...drawingRound(), id: 'r3', index: 2 } });
    mockApi.games.get.mockResolvedValue(snapshot(state, { draw: { roundId: 'r1', role: 'drawer', word: 'kedi' } }));
    renderGame(ada);
    await waitFor(() => expect(screen.getByTestId('draw-band')).toBeInTheDocument());
    expect(screen.queryByText('kedi')).not.toBeInTheDocument();
  });

  it('reveals the word with my points first', async () => {
    const round = { ...drawingRound(), word: 'fayton', solved: true, scoreDelta: { host: 13, guest: 26 } };
    mockApi.games.get.mockResolvedValue(snapshot(engine({ phase: 'reveal', round })));
    renderGame(bora);
    await waitFor(() => expect(screen.getByTestId('draw-reveal')).toHaveTextContent('fayton'));
    expect(screen.getByTestId('draw-reveal')).toHaveTextContent('+26 / +13 puan');
  });
});
