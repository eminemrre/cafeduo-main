import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HangmanGame } from './HangmanGame';
import { api } from '../lib/api';
import type { CompetitiveEngineState, CompetitiveGame, User } from '../types';

jest.mock('../lib/gameAudio', () => ({ playGameSfx: jest.fn() }));

jest.mock('../lib/api', () => ({
  api: { games: { get: jest.fn(), action: jest.fn() } },
}));

jest.mock('../lib/socket', () => ({
  socketService: {
    isConnected: jest.fn(() => false),
    onConnectionChange: jest.fn(() => jest.fn()),
    getSocket: jest.fn(() => ({ on: jest.fn(), off: jest.fn() })),
    joinGame: jest.fn(),
    leaveGame: jest.fn(),
  },
}));

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
    kind: 'hangman',
    revision: 2,
    phase: 'open',
    roundIndex: 1,
    totalRounds: 3,
    startedAt: new Date(now).toISOString(),
    phaseEndsAt: new Date(now + 60_000).toISOString(),
    updatedAt: new Date(now).toISOString(),
    players: {
      host: { name: 'ada', score: 0 },
      guest: { name: 'bora', score: 0 },
    },
    round: {
      id: 'r1',
      index: 0,
      startedAt: new Date(now).toISOString(),
      endsAt: new Date(now + 60_000).toISOString(),
      length: 5,
      category: 'Yiyecek ve içecek',
      difficulty: 1,
      maxWrong: 6,
      progress: {
        host: { revealed: 0, wrong: 0, solved: false, done: false },
        guest: { revealed: 2, wrong: 1, solved: false, done: false },
      },
    },
    result: null,
    ...overrides,
  };
};

const snapshot = (
  state: CompetitiveEngineState,
  overrides: Partial<CompetitiveGame> = {}
): CompetitiveGame => ({
  id: 'g9',
  hostName: 'ada',
  guestName: 'bora',
  gameType: 'Adam Asmaca',
  points: 10,
  table: 'MASA01',
  status: 'active',
  protocolVersion: 2,
  serverNow: new Date().toISOString(),
  gameState: { engine: state },
  actorView: {
    hangman: {
      roundId: 'r1',
      pattern: [null, null, null, null, null],
      guessed: [],
      wrong: 0,
      solved: false,
      done: false,
      points: 0,
    },
  },
  ...overrides,
});

const renderGame = (props: Partial<React.ComponentProps<typeof HangmanGame>> = {}) => {
  const onGameEnd = jest.fn();
  const onLeave = jest.fn();
  render(
    <HangmanGame
      currentUser={user}
      gameId={null}
      opponentName="bora"
      isBot
      onGameEnd={onGameEnd}
      onLeave={onLeave}
      {...props}
    />
  );
  return { onGameEnd, onLeave };
};

describe('HangmanGame practice', () => {
  // Math.random() → 0 picks the first practice word, "badem".
  let random: jest.SpyInstance;
  beforeEach(() => {
    random = jest.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => random.mockRestore());

  it('starts on a random practice word', () => {
    random.mockReturnValue(0.9999);
    renderGame();
    expect(screen.getByTestId('hangman-word').children).not.toHaveLength(5);
  });

  it('draws one tile per letter and the 29 Turkish letter keys', () => {
    renderGame();
    expect(screen.getByTestId('hangman-word').children).toHaveLength(5);
    const keys = screen.getAllByRole('button', { name: /harfi/ });
    expect(keys).toHaveLength(29);
    expect(keys.map((key) => key.textContent).join('')).not.toMatch(/[qwx]/);
    expect(screen.getByTestId('hangman-gallows')).toBeInTheDocument();
  });

  it('opens a right letter, marks a wrong one and never sends anything', async () => {
    renderGame();
    // "badem": a is in the word, z is not.
    fireEvent.click(screen.getByRole('button', { name: /^a harfi/ }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^a harfi, doğru/ })).toBeDisabled()
    );
    fireEvent.click(screen.getByRole('button', { name: /^z harfi/ }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^z harfi, yanlış/ })).toBeDisabled()
    );
    expect(mockApi.games.action).not.toHaveBeenCalled();
    expect(mockApi.games.get).not.toHaveBeenCalled();
  });

  it('accepts the whole word and reports the practice result without points', async () => {
    const { onGameEnd } = renderGame();
    fireEvent.change(screen.getByLabelText(/Kelimenin tamamı/), {
      target: { value: 'BADEM' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tahmin et' }));
    await waitFor(() => expect(screen.getByTestId('hangman-reveal')).toHaveTextContent('badem'));
    await waitFor(
      () =>
        expect(onGameEnd).toHaveBeenCalledWith(
          'ada',
          0,
          expect.objectContaining({ kind: 'hangman' })
        ),
      { timeout: 2500 }
    );
  });
});

describe('HangmanGame ranked', () => {
  it('sends a letter as a guess action and shows only the server board', async () => {
    mockApi.games.get.mockResolvedValue(snapshot(engine()));
    mockApi.games.action.mockResolvedValue({ success: true, game: snapshot(engine()) });
    const { onGameEnd } = renderGame({ isBot: false, gameId: 'g9' });

    await waitFor(() => expect(screen.getByTestId('hangman-word').children).toHaveLength(5));
    expect(screen.getByTestId('hangman-my-score')).toHaveTextContent('0 puan');
    expect(screen.getByTestId('hangman-op-score')).toHaveTextContent('0 puan');

    fireEvent.click(screen.getByRole('button', { name: /^k harfi/ }));
    await waitFor(() => expect(mockApi.games.action).toHaveBeenCalled());
    const [gameId, body] = mockApi.games.action.mock.calls[0];
    expect(gameId).toBe('g9');
    expect(body).toMatchObject({ roundId: 'r1', type: 'guess', letter: 'k' });
    expect(body.actionId).toEqual(expect.any(String));
    expect(onGameEnd).not.toHaveBeenCalled();
  });

  it('shows the category and the opponent progress counts, never their letters', async () => {
    mockApi.games.get.mockResolvedValue(snapshot(engine()));
    renderGame({ isBot: false, gameId: 'g9' });
    await waitFor(() => expect(screen.getByText('Yiyecek ve içecek')).toBeInTheDocument());
    expect(screen.getByText('2/5 harf')).toBeInTheDocument();
    expect(screen.queryByText(/bora.*harf/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/hiddenOptions|guessed/);
  });

  it('reads the opponent row from the other side when the player is the guest', async () => {
    const state = engine({
      round: {
        ...engine().round!,
        scoreDelta: undefined,
        progress: {
          host: { revealed: 3, wrong: 2, solved: false, done: false },
          guest: { revealed: 1, wrong: 0, solved: false, done: false },
        },
      },
    });
    mockApi.games.get.mockResolvedValue(snapshot(state));
    renderGame({ isBot: false, gameId: 'g9', currentUser: { ...user, username: 'bora' } });
    await waitFor(() => expect(screen.getByText('3/5 harf')).toBeInTheDocument());
    expect(screen.queryByText('1/5 harf')).not.toBeInTheDocument();
  });

  it('lists the round points as mine first, then the opponent', async () => {
    const state = engine({
      phase: 'reveal',
      round: { ...engine().round!, word: 'kahve', scoreDelta: { host: 31, guest: 4 } },
    });
    mockApi.games.get.mockResolvedValue(snapshot(state));
    renderGame({ isBot: false, gameId: 'g9', currentUser: { ...user, username: 'bora' } });
    await waitFor(() => expect(screen.getByTestId('hangman-reveal')).toHaveTextContent('kahve'));
    expect(screen.getByTestId('hangman-reveal')).toHaveTextContent('+4 / +31 puan');
  });

  it('never draws the previous round board on a new round', async () => {
    const state = engine({
      roundIndex: 2,
      round: { ...engine().round!, id: 'r2', index: 1, length: 4 },
    });
    mockApi.games.get.mockResolvedValue(
      snapshot(state, {
        actorView: {
          hangman: {
            roundId: 'r1',
            pattern: ['k', 'a', null, null, 'e'],
            guessed: ['k', 'a', 'e', 'z'],
            wrong: 1,
            solved: false,
            done: false,
            points: 3,
          },
        },
      })
    );
    renderGame({ isBot: false, gameId: 'g9' });
    await waitFor(() => expect(screen.getByTestId('hangman-word').children).toHaveLength(4));
    expect(screen.getByTestId('hangman-word')).toHaveTextContent('');
    expect(screen.getByRole('button', { name: 'k harfi' })).toBeEnabled();
  });
});
