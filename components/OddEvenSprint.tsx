import React, { useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { api } from '../lib/api';
import { submitScoreAndWaitForWinner } from '../lib/multiplayer';

interface OddEvenSprintProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number) => void;
  onLeave: () => void;
  onMinimize?: () => void;
}

type Guess = 'cift' | 'tek';

const MAX_ROUNDS = 5;

export const OddEvenSprint: React.FC<OddEvenSprintProps> = ({
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
  const [lastNumber, setLastNumber] = useState<number | null>(null);
  const [message, setMessage] = useState('Her tur çift veya tek seç. 5 tur sonunda skor belirlenir.');
  const [done, setDone] = useState(false);
  const [resolvingMatch, setResolvingMatch] = useState(false);
  const matchStartedAtRef = useRef<number>(Date.now());

  const target = isBot ? 'BOT' : (opponentName || 'Rakip');

  const finalizeMatch = async (localWinner: string, playerScoreValue: number) => {
    if (isBot || !gameId) {
      const points = localWinner === currentUser.username ? 10 : 0;
      setTimeout(() => onGameEnd(localWinner, points), 900);
      return;
    }

    setResolvingMatch(true);
    setMessage('Skorun kaydedildi. Rakip sonucu bekleniyor...');

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
        // Finishing failures should not block the game flow
      }

      const points = resolvedWinner === currentUser.username ? 10 : 0;
      setMessage(points > 0 ? 'Maçı kazandın.' : 'Maçı rakip aldı.');
      setTimeout(() => onGameEnd(resolvedWinner, points), 900);
    } catch {
      const fallbackPoints = localWinner === currentUser.username ? 10 : 0;
      setMessage('Bağlantı dalgalandı, yerel sonuç uygulandı.');
      setTimeout(() => onGameEnd(localWinner, fallbackPoints), 900);
    } finally {
      setResolvingMatch(false);
    }
  };

  const handleGuess = (guess: Guess) => {
    if (done || resolvingMatch) return;
    const number = 1 + Math.floor(Math.random() * 20);
    setLastNumber(number);

    const parity: Guess = number % 2 === 0 ? 'cift' : 'tek';
    const playerWon = guess === parity;

    const nextPlayer = playerScore + (playerWon ? 1 : 0);
    const nextOpponent = opponentScore + (playerWon ? 0 : 1);
    setPlayerScore(nextPlayer);
    setOpponentScore(nextOpponent);
    setMessage(playerWon ? 'Doğru tahmin, tur sende.' : 'Yanlış tahmin, tur rakibe gitti.');

    if (round >= MAX_ROUNDS) {
      setDone(true);
      const localWinner = nextPlayer >= nextOpponent ? currentUser.username : target;
      void finalizeMatch(localWinner, nextPlayer);
      return;
    }

    setRound(prev => prev + 1);
  };

  return (
    <div className="max-w-2xl mx-auto rf-panel border-cyan-400/22 rounded-xl p-6 text-white" data-testid="odd-even-sprint">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-pixel text-lg">Çift Tek Sprint</h2>
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

      <p className="text-sm text-[var(--rf-muted)] mb-4">{message}</p>

      <div className="flex gap-3">
        <button
          data-testid="guess-even"
          onClick={() => handleGuess('cift')}
          disabled={done || resolvingMatch}
          className="flex-1 bg-[#0f3a67] hover:bg-[#145289] disabled:opacity-50 rounded-xl p-4 font-semibold border border-cyan-300/35"
        >
          ÇİFT
        </button>
        <button
          data-testid="guess-odd"
          onClick={() => handleGuess('tek')}
          disabled={done || resolvingMatch}
          className="flex-1 bg-[#273145] hover:bg-[#35435e] disabled:opacity-50 rounded-xl p-4 font-semibold border border-slate-300/30"
        >
          TEK
        </button>
      </div>

      <div className="mt-4 text-sm text-[var(--rf-muted)]">
        Açılan sayı: {lastNumber ?? '-'}
      </div>

      {done && (
        <div className="mt-4">
          <RetroButton onClick={onLeave}>Lobiye Dön</RetroButton>
        </div>
      )}
    </div>
  );
};
