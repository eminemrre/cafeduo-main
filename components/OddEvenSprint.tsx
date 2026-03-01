import React, { useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { submitScoreAndWaitForWinner } from '../lib/multiplayer';
import { GAME_ASSETS } from '../lib/gameAssets';
import { playGameSfx } from '../lib/gameAudio';

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
  const [showNumberReveal, setShowNumberReveal] = useState(false);
  const [lastGuess, setLastGuess] = useState<Guess | null>(null);
  const [scoreAnimation, setScoreAnimation] = useState<'player' | 'opponent' | null>(null);
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
      const { winner, finished } = await submitScoreAndWaitForWinner({
        gameId,
        username: currentUser.username,
        score: playerScoreValue,
        roundsWon: playerScoreValue,
        durationMs,
      });

      if (!finished) {
        setMessage('Sunucu sonucu henüz kesinleştirmedi. Lobiye dönüp birkaç saniye sonra tekrar kontrol et.');
        setTimeout(() => onGameEnd('Sonuç Bekleniyor', 0), 900);
        return;
      }

      const resolvedWinner = winner || 'Berabere';
      const points = winner && winner === currentUser.username ? 10 : 0;
      setMessage(
        !winner
          ? 'Maç berabere tamamlandı.'
          : points > 0
            ? 'Maçı kazandın.'
            : 'Maçı rakip aldı.'
      );
      setTimeout(() => onGameEnd(resolvedWinner, points), 900);
    } catch {
      setMessage('Bağlantı sorunu: sonuç sunucudan doğrulanamadı. Lobiye dönüp tekrar kontrol et.');
      setTimeout(() => onGameEnd('Sonuç Bekleniyor', 0), 900);
    } finally {
      setResolvingMatch(false);
    }
  };

  const handleGuess = (guess: Guess) => {
    if (done || resolvingMatch) return;
    playGameSfx('select', 0.22);
    setLastGuess(guess);
    
    // Number reveal animation
    const number = 1 + Math.floor(Math.random() * 20);
    setShowNumberReveal(true);
    setLastNumber(number);

    setTimeout(() => {
      const parity: Guess = number % 2 === 0 ? 'cift' : 'tek';
      const playerWon = guess === parity;

      const nextPlayer = playerScore + (playerWon ? 1 : 0);
      const nextOpponent = opponentScore + (playerWon ? 0 : 1);
      
      // Score animation
      setScoreAnimation(playerWon ? 'player' : 'opponent');
      setTimeout(() => setScoreAnimation(null), 400);
      
      setPlayerScore(nextPlayer);
      setOpponentScore(nextOpponent);
      setMessage(playerWon ? 'Doğru tahmin, tur sende.' : 'Yanlış tahmin, tur rakibe gitti.');
      playGameSfx(playerWon ? 'success' : 'fail', playerWon ? 0.28 : 0.24);

      if (round >= MAX_ROUNDS) {
        setDone(true);
        const localWinner = nextPlayer >= nextOpponent ? currentUser.username : target;
        void finalizeMatch(localWinner, nextPlayer);
        return;
      }

      setTimeout(() => {
        setRound(prev => prev + 1);
        setShowNumberReveal(false);
        setLastGuess(null);
      }, 1200);
    }, 500);
  };

  return (
    <div
      className="max-w-2xl mx-auto rf-screen-card noise-bg p-4 sm:p-6 text-white relative overflow-hidden"
      data-testid="odd-even-sprint"
      style={{
        backgroundImage: `linear-gradient(165deg, rgba(4, 17, 41, 0.92), rgba(2, 28, 52, 0.9)), url('${GAME_ASSETS.backgrounds.oddEvenSprint}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_95%,rgba(34,211,238,0.09)_100%)] [background-size:100%_4px] opacity-60" />
      <div className="relative z-10">
        <div className="rf-terminal-strip mb-2">Sistem TR-X // Parite Çatışması</div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-[0.08em] leading-none">
            Çift Tek Sprint
          </h2>
          <button
            onClick={onLeave}
            className="shrink-0 px-3 py-2 border border-rose-400/45 bg-rose-500/12 text-rose-200 hover:bg-rose-500/24 transition-colors text-xs uppercase tracking-[0.16em]"
          >
            Oyundan Çık
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5 mb-5 text-center">
          <div className="rf-screen-card-muted p-3 transition-all duration-300">
            <div className="text-xs text-[var(--rf-muted)] flex items-center justify-center gap-1">
              <img src={GAME_ASSETS.hud.jewel} alt="" className="w-4 h-4" aria-hidden="true" />
              Tur
            </div>
            <div className="font-bold text-cyan-100">{Math.min(round, MAX_ROUNDS)} / {MAX_ROUNDS}</div>
          </div>
          <div className={`rf-screen-card-muted p-3 transition-all duration-300 ${scoreAnimation === 'player' ? 'animate-score-pop' : ''}`}>
            <div className="text-xs text-[var(--rf-muted)] flex items-center justify-center gap-1">
              <img src={GAME_ASSETS.hud.heart} alt="" className="w-4 h-4" aria-hidden="true" />
              Sen
            </div>
            <div className="font-bold text-cyan-100">{playerScore}</div>
          </div>
          <div className={`rf-screen-card-muted p-3 transition-all duration-300 ${scoreAnimation === 'opponent' ? 'animate-score-pop' : ''}`}>
            <div className="text-xs text-[var(--rf-muted)] flex items-center justify-center gap-1">
              <img src={GAME_ASSETS.hud.coin} alt="" className="w-4 h-4" aria-hidden="true" />
              Rakip
            </div>
            <div className="font-bold text-cyan-100">{opponentScore}</div>
          </div>
        </div>

        <p className="text-sm text-[var(--rf-muted)] mb-4 pl-3 border-l-2 border-cyan-400/55 min-h-[2rem] flex items-center">{message}</p>

        <div className="flex gap-3">
          <button
            data-testid="guess-even"
            onClick={() => handleGuess('cift')}
            disabled={done || resolvingMatch || showNumberReveal}
            className={`flex-1 relative overflow-hidden p-4 font-semibold border-2 tracking-[0.18em] transition-all duration-200
              ${lastGuess === 'cift' ? 'border-cyan-300 scale-105' : 'border-cyan-300/35'}
              disabled:opacity-50 disabled:cursor-not-allowed
              hover:scale-105 hover:border-cyan-300/60 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)]
              bg-gradient-to-br from-[#0f3a67] via-[#0d3159] to-[#0a2845]
              before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_120%,rgba(34,211,238,0.15),transparent_70%)]
              after:absolute after:inset-0 after:bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,rgba(34,211,238,0.03)_2px,rgba(34,211,238,0.03)_4px)]`}
          >
            ÇİFT
          </button>
          <button
            data-testid="guess-odd"
            onClick={() => handleGuess('tek')}
            disabled={done || resolvingMatch || showNumberReveal}
            className={`flex-1 relative overflow-hidden p-4 font-semibold border-2 tracking-[0.18em] transition-all duration-200
              ${lastGuess === 'tek' ? 'border-fuchsia-300 scale-105' : 'border-fuchsia-400/35'}
              disabled:opacity-50 disabled:cursor-not-allowed
              hover:scale-105 hover:border-fuchsia-400/60 hover:shadow-[0_0_20px_rgba(217,70,239,0.3)]
              bg-gradient-to-br from-[#273145] via-[#1f2838] to-[#181f2c]
              before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_120%,rgba(217,70,239,0.12),transparent_70%)]
              after:absolute after:inset-0 after:bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,rgba(217,70,239,0.03)_2px,rgba(217,70,239,0.03)_4px)]`}
          >
            TEK
          </button>
        </div>

        <div className={`mt-4 text-sm rf-screen-card-muted p-4 text-center transition-all duration-300 ${showNumberReveal ? 'animate-number-reveal' : ''}`}>
          <div className="text-xs text-[var(--rf-muted)] mb-1">Açılan Sayı</div>
          <div className={`text-3xl font-bold ${lastNumber ? (lastNumber % 2 === 0 ? 'text-cyan-300' : 'text-fuchsia-300') : 'text-[var(--rf-muted)]'}`}>
            {lastNumber ?? '-'}
          </div>
        </div>

        {done && (
          <div className="mt-4">
            <RetroButton onClick={onLeave}>Lobiye Dön</RetroButton>
          </div>
        )}
      </div>
    </div>
  );
};
