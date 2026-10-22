import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { KnowledgeQuiz } from './KnowledgeQuiz';
import { api } from '../lib/api';
import type { CompetitiveEngineState, CompetitiveGame, User } from '../types';

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

// PixiJS overlay requires WebGL; mock as inert canvas in tests so the
// dynamic import + app.init() don't fire in jsdom.
jest.mock('./games/QuizStageCanvas', () => ({
  QuizStageCanvas: React.forwardRef(function MockQuizStageCanvas(
    _props: { className?: string },
    _ref: React.Ref<unknown>
  ) {
    return <canvas data-testid="quiz-pixi-canvas" />;
  }),
}));

const mockApi = api as unknown as {
  games: { get: jest.Mock; action: jest.Mock };
};

const mockUser: User = {
  id: 1,
  username: 'emin',
  email: 'emin@example.com',
  points: 120,
  wins: 0,
  gamesPlayed: 0,
};

const buildEngine = (overrides: Partial<CompetitiveEngineState> = {}): CompetitiveEngineState => {
  const now = Date.now();
  return {
    version: 2,
    kind: 'quiz',
    revision: 1,
    phase: 'open',
    roundIndex: 1,
    totalRounds: 10,
    startedAt: new Date(now).toISOString(),
    phaseEndsAt: new Date(now + 15_000).toISOString(),
    updatedAt: new Date(now).toISOString(),
    players: {
      host: { name: 'emin', score: 0, correct: 0, streak: 0, answered: false, jokerUsed: false },
      guest: { name: 'bob', score: 0, correct: 0, streak: 0, answered: false, jokerUsed: false },
    },
    round: {
      id: 'r1',
      index: 1,
      startedAt: new Date(now).toISOString(),
      endsAt: new Date(now + 15_000).toISOString(),
      question: 'Sunucudan gelen soru?',
      options: ['A seçeneği', 'B seçeneği', 'C seçeneği', 'D seçeneği'],
      category: 'Genel kültür',
      level: 'orta',
    },
    result: null,
    ...overrides,
  };
};

const buildSnapshot = (overrides: Partial<CompetitiveGame> = {}): CompetitiveGame => ({
  id: 'game-1',
  hostName: 'emin',
  guestName: 'bob',
  gameType: 'Bilgi Yarışı',
  points: 10,
  table: 'MASA01',
  status: 'active',
  protocolVersion: 2,
  serverNow: new Date().toISOString(),
  gameState: { engine: buildEngine() },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.games.get.mockResolvedValue(buildSnapshot());
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('KnowledgeQuiz bot practice', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.01);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('plays all rounds and resolves local winner in bot mode', () => {
    const onGameEnd = jest.fn();
    const { buildQuizRoundSet, quizSeed } = jest.requireActual(
      '../lib/knowledgeQuizQuestions'
    ) as typeof import('../lib/knowledgeQuizQuestions');
    const quizSet = buildQuizRoundSet(quizSeed(1), 10);
    render(
      <KnowledgeQuiz
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={onGameEnd}
        onLeave={jest.fn()}
      />
    );

    quizSet.forEach((question, idx) => {
      expect(screen.getByTestId('knowledge-question')).toHaveTextContent(question.question);
      fireEvent.click(screen.getByTestId(`knowledge-option-${question.answerIndex}`));
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      if (idx === quizSet.length - 1) {
        act(() => {
          jest.advanceTimersByTime(1000);
        });
      }
    });

    expect(onGameEnd).toHaveBeenCalledWith(
      'emin',
      10,
      expect.objectContaining({ kind: 'quiz', playerScore: 320, correctAnswers: 10 })
    );
  });

  it('hides two wrong options once with the 50:50 joker', () => {
    const { buildQuizRoundSet, quizSeed } = jest.requireActual(
      '../lib/knowledgeQuizQuestions'
    ) as typeof import('../lib/knowledgeQuizQuestions');
    const [question] = buildQuizRoundSet(quizSeed(1), 10);
    render(
      <KnowledgeQuiz
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('knowledge-joker'));
    const disabled = [0, 1, 2, 3].filter(
      (idx) => (screen.getByTestId(`knowledge-option-${idx}`) as HTMLButtonElement).disabled
    );
    expect(disabled).toHaveLength(2);
    expect(disabled).not.toContain(question.answerIndex);
    expect(screen.getByTestId('knowledge-joker')).toBeDisabled();
    expect(screen.getByTestId('knowledge-joker')).toHaveTextContent('Joker kullanıldı');
  });

  it('shows the category and level of the question and counts a streak', () => {
    const { buildQuizRoundSet, quizSeed } = jest.requireActual(
      '../lib/knowledgeQuizQuestions'
    ) as typeof import('../lib/knowledgeQuizQuestions');
    const quizSet = buildQuizRoundSet(quizSeed(1), 10);
    render(
      <KnowledgeQuiz
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );
    expect(screen.getByTestId('knowledge-meta')).toHaveTextContent(quizSet[0].category);
    for (const question of quizSet.slice(0, 2)) {
      fireEvent.click(screen.getByTestId(`knowledge-option-${question.answerIndex}`));
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(screen.getByTestId('knowledge-streak')).toHaveTextContent('Seri: 2');
  });

  it('calls onLeave from header button', () => {
    const onLeave = jest.fn();
    render(
      <KnowledgeQuiz
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
});

describe('KnowledgeQuiz multiplayer', () => {
  it('renders the server question and sends only an action envelope', async () => {
    mockApi.games.action.mockResolvedValue({
      success: true,
      game: buildSnapshot({
        gameState: {
          engine: buildEngine({
            revision: 2,
            phase: 'reveal',
            players: {
              host: { name: 'emin', score: 18, answered: true },
              guest: { name: 'bob', score: 0, answered: false },
            },
            round: {
              ...buildEngine().round!,
              correctIndex: 1,
              picks: { host: 1, guest: null },
              scoreDelta: { host: 18, guest: 0 },
            },
          }),
        },
      }),
    });

    render(
      <KnowledgeQuiz
        currentUser={mockUser}
        gameId="game-1"
        isBot={false}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    await screen.findByText('Sunucudan gelen soru?');
    expect(screen.getByText('A seçeneği')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('knowledge-option-1'));

    await waitFor(() => expect(mockApi.games.action).toHaveBeenCalledTimes(1));
    const [gameId, payload] = mockApi.games.action.mock.calls[0];
    expect(gameId).toBe('game-1');
    expect(payload).toEqual(
      expect.objectContaining({ roundId: 'r1', type: 'answer', optionIndex: 1 })
    );
    expect(payload.payload).toBeUndefined();
    expect(payload.score).toBeUndefined();
    expect(payload.winner).toBeUndefined();

    await screen.findByText('Doğru! +18 puan.');
    expect(screen.getByTestId('knowledge-quiz')).toHaveTextContent('18');
  });

  it('shows a refresh path for an active legacy snapshot', async () => {
    mockApi.games.get.mockResolvedValue(buildSnapshot({ protocolVersion: 1, gameState: {} }));
    render(
      <KnowledgeQuiz
        currentUser={mockUser}
        gameId="game-1"
        isBot={false}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    await screen.findByText('İstemci güncellemesi gerekiyor');
    expect(screen.getByText('Sayfayı yenile')).toBeInTheDocument();
    expect(screen.queryByTestId('knowledge-option-0')).not.toBeInTheDocument();
  });
});
