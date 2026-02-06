import React, { useEffect, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { api } from '../lib/api';
import { submitScoreAndWaitForWinner } from '../lib/multiplayer';

interface RockPaperScissorsProps {
  currentUser: User;
  isBot: boolean;
  gameId?: string;
  onGameEnd: (winner: string, points: number) => void;
  onLeave: () => void;
}

type Phase = 'ready' | 'wait' | 'go' | 'result' | 'done';

const MAX_ROUNDS = 3;

export const RockPaperScissors: React.FC<RockPaperScissorsProps> = ({
  currentUser,
  isBot,
  gameId,
  onGameEnd,
  onLeave,
}) => {
  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(1);
  const [playerWins, setPlayerWins] = useState(0);
  const [opponentWins, setOpponentWins] = useState(0);
  const [message, setMessage] = useState('Hazır olduğunda başla. Hedef yeşil olduğunda en hızlı tıklayan kazanır.');
  const [lastPlayerMs, setLastPlayerMs] = useState<number | null>(null);
  const [lastOpponentMs, setLastOpponentMs] = useState<number | null>(null);
  const [resolvingMatch, setResolvingMatch] = useState(false);

  const roundStartRef = useRef<number>(0);
  const goTimerRef = useRef<number | null>(null);
  const matchStartedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    return () => {
      if (goTimerRef.current) {
        window.clearTimeout(goTimerRef.current);
      }
    };
  }, []);

  const beginRound = () => {
    if (resolvingMatch) return;
    if (phase !== 'ready' && phase !== 'result') return;
    if (round === 1) {
      matchStartedAtRef.current = Date.now();
    }
    setPhase('wait');
    setLastPlayerMs(null);
    setLastOpponentMs(null);
    setMessage('Bekle... Erken tıklarsan turu kaybedersin.');

    const delay = 800 + Math.floor(Math.random() * 1400);
    goTimerRef.current = window.setTimeout(() => {
      roundStartRef.current = performance.now();
      setPhase('go');
      setMessage('Şimdi!');
    }, delay);
  };

  const finishRound = (playerMs: number, opponentMs: number, early = false) => {
    const playerWon = !early && playerMs < opponentMs;
    const nextPlayerWins = playerWins + (playerWon ? 1 : 0);
    const nextOpponentWins = opponentWins + (playerWon ? 0 : 1);

    setPlayerWins(nextPlayerWins);
    setOpponentWins(nextOpponentWins);
    setLastPlayerMs(playerMs);
    setLastOpponentMs(opponentMs);
    setPhase('result');

    if (early) {
      setMessage('Erken tıkladın! Tur rakibe yazıldı.');
    } else if (playerWon) {
      setMessage('Turu kazandın.');
    } else {
      setMessage('Rakip daha hızlı.');
    }

    const isLastRound = round >= MAX_ROUNDS;
    if (!isLastRound) {
      setRound(prev => prev + 1);
      return;
    }

    setPhase('done');
    const localWinner = nextPlayerWins >= nextOpponentWins ? currentUser.username : (isBot ? 'BOT' : 'Rakip');
    void finalizeMatch(localWinner, nextPlayerWins);
  };

  const finalizeMatch = async (localWinner: string, playerRoundsWon: number) => {
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
        score: playerRoundsWon,
        roundsWon: playerRoundsWon,
        durationMs,
      });

      const resolvedWinner = winner || localWinner;
      try {
        await api.games.finish(gameId, resolvedWinner);
      } catch {
        // Sonucu finalize etme başarısız olsa da oyuncu akışını durdurma
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

  const handleTap = () => {
    if (resolvingMatch) return;
    if (phase === 'wait') {
      finishRound(9999, 300, true);
      return;
    }
    if (phase !== 'go') return;

    const playerMs = Math.max(1, Math.floor(performance.now() - roundStartRef.current));
    const opponentMs = isBot ? 220 + Math.floor(Math.random() * 320) : 260 + Math.floor(Math.random() * 260);
    finishRound(playerMs, opponentMs);
  };

  return (
    <div className="max-w-2xl mx-auto bg-[#151921] border border-gray-700 rounded-xl p-6 text-white" data-testid="reflex-rush">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-pixel text-lg">Refleks Avı</h2>
        <button onClick={onLeave} className="text-gray-300 hover:text-white text-sm">Oyundan Çık</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5 text-center">
        <div className="bg-[#0f141a] p-3 rounded border border-gray-800">
          <div className="text-xs text-gray-400">Tur</div>
          <div className="font-bold">{Math.min(round, MAX_ROUNDS)} / {MAX_ROUNDS}</div>
        </div>
        <div className="bg-[#0f141a] p-3 rounded border border-gray-800">
          <div className="text-xs text-gray-400">Sen</div>
          <div className="font-bold">{playerWins}</div>
        </div>
        <div className="bg-[#0f141a] p-3 rounded border border-gray-800">
          <div className="text-xs text-gray-400">Rakip</div>
          <div className="font-bold">{opponentWins}</div>
        </div>
      </div>

      <p className="text-sm text-gray-300 mb-4">{message}</p>

      <button
        onClick={handleTap}
        data-testid="reflex-target"
        disabled={resolvingMatch}
        className={`w-full h-40 rounded-xl border-2 transition ${
          phase === 'go'
            ? 'bg-green-500/30 border-green-400'
            : phase === 'wait'
              ? 'bg-amber-500/20 border-amber-400'
              : 'bg-[#0f141a] border-gray-700'
        }`}
      >
        {phase === 'go' ? 'TIKLA!' : phase === 'wait' ? 'BEKLE' : 'HEDEF'}
      </button>

      {(lastPlayerMs !== null || lastOpponentMs !== null) && (
        <div className="mt-4 text-sm text-gray-300">
          <div>Son tur süreleri:</div>
          <div>Sen: {lastPlayerMs}ms</div>
          <div>Rakip: {lastOpponentMs}ms</div>
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <RetroButton onClick={beginRound} disabled={phase === 'wait' || phase === 'go' || phase === 'done' || resolvingMatch}>
          Yeni Tur
        </RetroButton>
      </div>
    </div>
  );
};
