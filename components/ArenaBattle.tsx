import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { api } from '../lib/api';
import { submitScoreAndWaitForWinner } from '../lib/multiplayer';

interface ArenaBattleProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number) => void;
  onLeave: () => void;
  onMinimize?: () => void;
}

const PAD_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];
const MAX_ROUNDS = 4;

export const ArenaBattle: React.FC<ArenaBattleProps> = ({
  currentUser,
  gameId,
  opponentName,
  isBot,
  onGameEnd,
  onLeave,
}) => {
  const [round, setRound] = useState(1);
  const [sequence, setSequence] = useState<number[]>([]);
  const [cursor, setCursor] = useState(0);
  const [showing, setShowing] = useState(true);
  const [activePad, setActivePad] = useState<number | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [message, setMessage] = useState('Diziyi izle, sonra birebir tekrar et.');
  const [done, setDone] = useState(false);
  const [resolvingMatch, setResolvingMatch] = useState(false);
  const matchStartedAtRef = useRef<number>(Date.now());

  const target = useMemo(() => (isBot ? 'BOT' : (opponentName || 'Rakip')), [isBot, opponentName]);

  useEffect(() => {
    if (round === 1) {
      matchStartedAtRef.current = Date.now();
    }
  }, [round]);

  useEffect(() => {
    const length = Math.min(3 + round, 6);
    const newSequence = Array.from({ length }, () => Math.floor(Math.random() * 4));
    setSequence(newSequence);
    setCursor(0);
    setShowing(true);
    setMessage('Dizi oynatılıyor...');
  }, [round]);

  useEffect(() => {
    if (!showing || sequence.length === 0) return;
    let i = 0;
    const interval = window.setInterval(() => {
      setActivePad(sequence[i]);
      window.setTimeout(() => setActivePad(null), 280);
      i += 1;
      if (i >= sequence.length) {
        window.clearInterval(interval);
        window.setTimeout(() => {
          setShowing(false);
          setMessage('Şimdi sırayı doğru tekrar et.');
        }, 350);
      }
    }, 460);
    return () => window.clearInterval(interval);
  }, [showing, sequence]);

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
        // Finishing failures should not block the UI flow
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

  const endMatchIfNeeded = (nextPlayer: number, nextOpponent: number, nextRound: number) => {
    if (nextRound <= MAX_ROUNDS) return;
    setDone(true);
    const localWinner = nextPlayer >= nextOpponent ? currentUser.username : target;
    setMessage(localWinner === currentUser.username ? 'Maç sonucu hesaplanıyor...' : 'Maç sonucu hesaplanıyor...');
    void finalizeMatch(localWinner, nextPlayer);
  };

  const nextRound = (playerWon: boolean) => {
    const nextPlayer = playerScore + (playerWon ? 1 : 0);
    const nextOpponent = opponentScore + (playerWon ? 0 : 1);
    setPlayerScore(nextPlayer);
    setOpponentScore(nextOpponent);
    setRound(prev => {
      const r = prev + 1;
      endMatchIfNeeded(nextPlayer, nextOpponent, r);
      return r;
    });
  };

  const pressPad = (idx: number) => {
    if (showing || done || resolvingMatch) return;
    if (sequence[cursor] === idx) {
      const nextCursor = cursor + 1;
      setCursor(nextCursor);
      if (nextCursor >= sequence.length) {
        setMessage('Doğru! Tur sende.');
        nextRound(true);
      }
      return;
    }
    setMessage('Yanlış pad, tur rakibe gitti.');
    nextRound(false);
  };

  return (
    <div className="max-w-2xl mx-auto bg-[#151921] border border-gray-700 rounded-xl p-6 text-white" data-testid="rhythm-copy">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-pixel text-lg">Ritim Kopyala</h2>
        <button onClick={onLeave} className="text-gray-300 hover:text-white text-sm">Oyundan Çık</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5 text-center">
        <div className="bg-[#0f141a] p-3 rounded border border-gray-800">
          <div className="text-xs text-gray-400">Tur</div>
          <div className="font-bold">{Math.min(round, MAX_ROUNDS)} / {MAX_ROUNDS}</div>
        </div>
        <div className="bg-[#0f141a] p-3 rounded border border-gray-800">
          <div className="text-xs text-gray-400">Sen</div>
          <div className="font-bold">{playerScore}</div>
        </div>
        <div className="bg-[#0f141a] p-3 rounded border border-gray-800">
          <div className="text-xs text-gray-400">Rakip</div>
          <div className="font-bold">{opponentScore}</div>
        </div>
      </div>

      <p className="text-sm text-gray-300 mb-4">{message}</p>

      <div className="grid grid-cols-2 gap-3">
        {PAD_COLORS.map((color, idx) => (
          <button
            key={idx}
            data-testid={`rhythm-pad-${idx}`}
            onClick={() => pressPad(idx)}
            disabled={resolvingMatch}
            className={`h-24 rounded-xl border-2 border-white/10 transition ${
              activePad === idx ? 'scale-95 opacity-100' : 'opacity-80'
            } ${color}`}
          />
        ))}
      </div>

      {done && (
        <div className="mt-4">
          <RetroButton onClick={onLeave}>Lobiye Dön</RetroButton>
        </div>
      )}
    </div>
  );
};
