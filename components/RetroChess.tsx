import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { api } from '../lib/api';
import { submitScoreAndWaitForWinner } from '../lib/multiplayer';
import { GAME_ASSETS } from '../lib/gameAssets';
import { playGameSfx } from '../lib/gameAudio';

interface RetroChessProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number) => void;
  onLeave: () => void;
}

interface Coord {
  x: number;
  y: number;
}

interface RoundState {
  origin: Coord;
  options: Coord[];
  answerIndex: number;
}

const BOARD_SIZE = 8;
const MAX_ROUNDS = 5;
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const KNIGHT_OFFSETS = [
  { x: 1, y: 2 },
  { x: 2, y: 1 },
  { x: 2, y: -1 },
  { x: 1, y: -2 },
  { x: -1, y: -2 },
  { x: -2, y: -1 },
  { x: -2, y: 1 },
  { x: -1, y: 2 },
];
const PIECE_ORDER = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'] as const;

const toKey = ({ x, y }: Coord) => `${x},${y}`;
const inBounds = ({ x, y }: Coord) => x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
const isSameCoord = (a: Coord, b: Coord) => a.x === b.x && a.y === b.y;

const toNotation = ({ x, y }: Coord) => `${FILES[x]}${BOARD_SIZE - y}`;

const knightMoves = (origin: Coord): Coord[] => {
  return KNIGHT_OFFSETS
    .map((offset) => ({ x: origin.x + offset.x, y: origin.y + offset.y }))
    .filter(inBounds);
};

const shuffleCoords = (coords: Coord[]): Coord[] => {
  const cloned = [...coords];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = cloned[i];
    cloned[i] = cloned[j];
    cloned[j] = tmp;
  }
  return cloned;
};

const randomCoord = (): Coord => ({
  x: Math.floor(Math.random() * BOARD_SIZE),
  y: Math.floor(Math.random() * BOARD_SIZE),
});

const createRoundState = (): RoundState => {
  let origin = randomCoord();
  let legalMoves = knightMoves(origin);
  while (legalMoves.length < 3) {
    origin = randomCoord();
    legalMoves = knightMoves(origin);
  }

  const answer = legalMoves[Math.floor(Math.random() * legalMoves.length)];
  const legalSet = new Set(legalMoves.map(toKey));
  const distractorPool = shuffleCoords(
    Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, idx) => ({
      x: idx % BOARD_SIZE,
      y: Math.floor(idx / BOARD_SIZE),
    }))
  ).filter((candidate) => {
    const candidateKey = toKey(candidate);
    return candidateKey !== toKey(answer) && !legalSet.has(candidateKey);
  });
  const distractors = distractorPool.slice(0, 3);

  const options = shuffleCoords([answer, ...distractors]);
  const answerIndex = options.findIndex((item) => isSameCoord(item, answer));

  return { origin, options, answerIndex };
};

export const RetroChess: React.FC<RetroChessProps> = ({
  currentUser,
  gameId,
  opponentName,
  isBot,
  onGameEnd,
  onLeave,
}) => {
  const [round, setRound] = useState(1);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [roundState, setRoundState] = useState<RoundState>(() => createRoundState());
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [resolvingMatch, setResolvingMatch] = useState(false);
  const [message, setMessage] = useState('Atın tek hamlede ulaşabileceği kareyi seç.');
  const matchStartedAtRef = useRef<number>(Date.now());
  const nextRoundTimerRef = useRef<number | null>(null);

  const targetName = useMemo(() => (isBot ? 'BOT' : (opponentName || 'Rakip')), [isBot, opponentName]);
  const optionsByKey = useMemo(
    () =>
      new Map(
        roundState.options.map((coord, idx) => [toKey(coord), idx])
      ),
    [roundState.options]
  );

  useEffect(() => {
    return () => {
      if (nextRoundTimerRef.current) {
        window.clearTimeout(nextRoundTimerRef.current);
      }
    };
  }, []);

  const finalizeMatch = async (localWinner: string, playerScoreValue: number) => {
    if (isBot || !gameId) {
      const points = localWinner === currentUser.username ? 12 : 0;
      setTimeout(() => onGameEnd(localWinner, points), 900);
      return;
    }

    setResolvingMatch(true);
    setMessage('Skor kaydedildi. Rakip sonucu bekleniyor...');

    try {
      const durationMs = Math.max(1, Date.now() - matchStartedAtRef.current);
      const { winner } = await submitScoreAndWaitForWinner({
        gameId,
        username: currentUser.username,
        score: playerScoreValue,
        roundsWon: playerScoreValue,
        durationMs,
      });

      const resolvedWinner = winner || localWinner;
      try {
        await api.games.finish(gameId, resolvedWinner);
      } catch {
        // Keep user flow stable if finalization request fails.
      }

      const points = resolvedWinner === currentUser.username ? 12 : 0;
      setMessage(points > 0 ? 'Retro Satranç turunu kazandın.' : 'Rakip taşları daha hızlı okudu.');
      setTimeout(() => onGameEnd(resolvedWinner, points), 900);
    } catch {
      const fallbackPoints = localWinner === currentUser.username ? 12 : 0;
      setMessage('Bağlantı dalgalandı, yerel sonuç uygulandı.');
      setTimeout(() => onGameEnd(localWinner, fallbackPoints), 900);
    } finally {
      setResolvingMatch(false);
    }
  };

  const moveToNextRound = (nextPlayer: number, nextOpponent: number) => {
    const isLast = round >= MAX_ROUNDS;
    if (isLast) {
      setDone(true);
      const localWinner = nextPlayer >= nextOpponent ? currentUser.username : targetName;
      void finalizeMatch(localWinner, nextPlayer);
      return;
    }

    nextRoundTimerRef.current = window.setTimeout(() => {
      setRound((prev) => prev + 1);
      setRoundState(createRoundState());
      setSelectedIndex(null);
      setMessage('Yeni konum yüklendi. Doğru kareyi seç.');
      playGameSfx('select', 0.2);
    }, 650);
  };

  const handleSquarePick = (optionIndex: number) => {
    if (done || resolvingMatch || selectedIndex !== null) return;

    const isCorrect = optionIndex === roundState.answerIndex;
    const rivalCorrect = isBot ? Math.random() < 0.58 : Math.random() < 0.5;
    const nextPlayer = playerScore + (isCorrect ? 1 : 0);
    const nextOpponent = opponentScore + (rivalCorrect ? 1 : 0);

    setSelectedIndex(optionIndex);
    setPlayerScore(nextPlayer);
    setOpponentScore(nextOpponent);
    setMessage(isCorrect ? 'Doğru hamle: at hedef kareye ulaştı.' : 'Yanlış kare: rakip turu aldı.');
    playGameSfx(isCorrect ? 'success' : 'fail', isCorrect ? 0.28 : 0.22);

    moveToNextRound(nextPlayer, nextOpponent);
  };

  return (
    <div
      className="max-w-3xl mx-auto rf-panel border-cyan-400/22 rounded-xl p-6 text-white relative overflow-hidden"
      data-testid="retro-chess"
      style={{
        backgroundImage: `linear-gradient(165deg, rgba(3, 16, 40, 0.94), rgba(4, 28, 56, 0.9)), url('${GAME_ASSETS.backgrounds.strategyChess}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_96%,rgba(34,211,238,0.08)_100%)] [background-size:100%_4px] opacity-55" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-pixel text-lg">Retro Satranç</h2>
        <button onClick={onLeave} className="text-[var(--rf-muted)] hover:text-white text-sm">Oyundan Çık</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5 text-center">
        <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
          <div className="text-xs text-[var(--rf-muted)]">Tur</div>
          <div className="font-bold">{Math.min(round, MAX_ROUNDS)} / {MAX_ROUNDS}</div>
        </div>
        <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
          <div className="text-xs text-[var(--rf-muted)]">Sen</div>
          <div className="font-bold">{playerScore}</div>
        </div>
        <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
          <div className="text-xs text-[var(--rf-muted)]">Rakip</div>
          <div className="font-bold">{opponentScore}</div>
        </div>
      </div>

      <p className="text-sm text-[var(--rf-muted)] mb-3">{message}</p>
      <p className="text-sm mb-5">
        Başlangıç karesi: <span className="text-cyan-300 font-semibold">{toNotation(roundState.origin)}</span>
      </p>

      <div className="mb-5 flex items-center justify-center gap-2 flex-wrap">
        {PIECE_ORDER.map((piece) => (
          <div key={piece} className="flex items-center gap-1 px-2 py-1 rounded border border-cyan-400/20 bg-[#091a36]/70">
            <img
              src={`/assets/games/retro-kit/chess/white-${piece}.png`}
              alt=""
              aria-hidden="true"
              className="w-5 h-5 object-contain"
            />
            <img
              src={`/assets/games/retro-kit/chess/black-${piece}.png`}
              alt=""
              aria-hidden="true"
              className="w-5 h-5 object-contain"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-8 gap-1.5 sm:gap-2 max-w-[560px] mx-auto" data-testid="retro-chess-board">
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, idx) => {
          const x = idx % BOARD_SIZE;
          const y = Math.floor(idx / BOARD_SIZE);
          const coord = { x, y };
          const key = toKey(coord);
          const optionIndex = optionsByKey.get(key);
          const isOption = optionIndex !== undefined;
          const isOrigin = isSameCoord(coord, roundState.origin);
          const isPicked = selectedIndex !== null && selectedIndex === optionIndex;
          const isAnswer = optionIndex === roundState.answerIndex;
          const bgClass = (x + y) % 2 === 0 ? 'bg-[#0f2748]' : 'bg-[#1b3a66]';
          const borderClass =
            selectedIndex === null
              ? 'border-cyan-400/25'
              : isPicked && isAnswer
                ? 'border-emerald-400'
                : isPicked
                  ? 'border-rose-400'
                  : isAnswer
                    ? 'border-emerald-400/40'
                    : 'border-cyan-400/15';

          return (
            <button
              key={key}
              data-testid={`retro-chess-square-${x}-${y}`}
              disabled={!isOption || done || resolvingMatch || selectedIndex !== null}
              onClick={() => {
                if (optionIndex !== undefined) {
                  handleSquarePick(optionIndex);
                }
              }}
              className={`relative aspect-square rounded border ${bgClass} ${borderClass} transition disabled:cursor-default`}
            >
              {isOrigin && (
                <img
                  src="/assets/games/retro-kit/chess/white-knight.png"
                  alt=""
                  aria-hidden="true"
                  className="w-[68%] h-[68%] object-contain mx-auto opacity-95"
                />
              )}
              {isOption && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs font-semibold text-cyan-100">
                  {toNotation(coord)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 text-xs text-[var(--rf-muted)] text-center">
        Hedef: Atın tek hamlede ulaşabileceği doğru kareyi seç.
      </div>

      {done && (
        <div className="mt-4">
          <RetroButton onClick={onLeave}>Lobiye Dön</RetroButton>
        </div>
      )}
    </div>
  );
};
