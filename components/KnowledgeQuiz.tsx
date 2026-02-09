import React, { useEffect, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { api } from '../lib/api';
import { submitScoreAndWaitForWinner } from '../lib/multiplayer';
import { GAME_ASSETS } from '../lib/gameAssets';
import { playGameSfx } from '../lib/gameAudio';

interface KnowledgeQuizProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number) => void;
  onLeave: () => void;
}

interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: 'Türkiye Cumhuriyeti hangi yılda ilan edildi?',
    options: ['1919', '1920', '1923', '1938'],
    answerIndex: 2,
  },
  {
    question: 'Dünya üzerindeki en büyük okyanus hangisidir?',
    options: ['Atlas Okyanusu', 'Hint Okyanusu', 'Pasifik Okyanusu', 'Arktik Okyanusu'],
    answerIndex: 2,
  },
  {
    question: 'Bir byte kaç bit eder?',
    options: ['4', '6', '8', '10'],
    answerIndex: 2,
  },
  {
    question: 'Güneşe en yakın gezegen hangisidir?',
    options: ['Venüs', 'Merkür', 'Mars', 'Dünya'],
    answerIndex: 1,
  },
  {
    question: 'İstanbul Boğazı hangi iki denizi birbirine bağlar?',
    options: ['Ege - Akdeniz', 'Marmara - Karadeniz', 'Karadeniz - Ege', 'Akdeniz - Kızıldeniz'],
    answerIndex: 1,
  },
];

export const KnowledgeQuiz: React.FC<KnowledgeQuizProps> = ({
  currentUser,
  gameId,
  opponentName,
  isBot,
  onGameEnd,
  onLeave,
}) => {
  const [roundIndex, setRoundIndex] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [resolvingMatch, setResolvingMatch] = useState(false);
  const [message, setMessage] = useState('Soruları hızlı ve doğru yanıtla. En yüksek net kazanır.');
  const matchStartedAtRef = useRef<number>(Date.now());
  const advanceTimerRef = useRef<number | null>(null);

  const currentQuestion = QUIZ_QUESTIONS[roundIndex];
  const maxRounds = QUIZ_QUESTIONS.length;
  const targetName = isBot ? 'BOT' : (opponentName || 'Rakip');

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

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
        // Finishing failure should not block game completion
      }

      const points = resolvedWinner === currentUser.username ? 10 : 0;
      setMessage(points > 0 ? 'Bilgi turunu kazandın.' : 'Rakip daha yüksek net yaptı.');
      setTimeout(() => onGameEnd(resolvedWinner, points), 900);
    } catch {
      const fallbackPoints = localWinner === currentUser.username ? 10 : 0;
      setMessage('Bağlantı dalgalandı, yerel sonuç uygulandı.');
      setTimeout(() => onGameEnd(localWinner, fallbackPoints), 900);
    } finally {
      setResolvingMatch(false);
    }
  };

  const handleAnswer = (optionIndex: number) => {
    if (done || resolvingMatch || selectedOption !== null) return;

    const isCorrect = optionIndex === currentQuestion.answerIndex;
    const rivalCorrect = isBot ? Math.random() < 0.55 : Math.random() < 0.5;
    const nextPlayerScore = playerScore + (isCorrect ? 1 : 0);
    const nextOpponentScore = opponentScore + (rivalCorrect ? 1 : 0);

    setSelectedOption(optionIndex);
    setPlayerScore(nextPlayerScore);
    setOpponentScore(nextOpponentScore);
    setMessage(isCorrect ? 'Doğru cevap, puanı aldın.' : 'Yanlış cevap, tur rakibe kaydı.');
    playGameSfx(isCorrect ? 'success' : 'fail', isCorrect ? 0.3 : 0.22);

    const isLastRound = roundIndex >= maxRounds - 1;
    if (isLastRound) {
      setDone(true);
      const localWinner = nextPlayerScore >= nextOpponentScore ? currentUser.username : targetName;
      void finalizeMatch(localWinner, nextPlayerScore);
      return;
    }

    advanceTimerRef.current = window.setTimeout(() => {
      setRoundIndex((prev) => prev + 1);
      setSelectedOption(null);
      setMessage('Yeni soru hazır. Hızlı karar ver.');
      playGameSfx('select', 0.18);
    }, 700);
  };

  return (
    <div
      className="max-w-2xl mx-auto rf-panel border-cyan-400/22 rounded-xl p-6 text-white relative overflow-hidden"
      data-testid="knowledge-quiz"
      style={{
        backgroundImage: `linear-gradient(165deg, rgba(4, 17, 41, 0.92), rgba(2, 28, 52, 0.9)), url('${GAME_ASSETS.backgrounds.knowledgeQuiz}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_96%,rgba(34,211,238,0.08)_100%)] [background-size:100%_4px] opacity-50" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-pixel text-lg">Bilgi Yarışı</h2>
        <button onClick={onLeave} className="text-[var(--rf-muted)] hover:text-white text-sm">Oyundan Çık</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5 text-center">
        <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
          <div className="text-xs text-[var(--rf-muted)]">Tur</div>
          <div className="font-bold">{Math.min(roundIndex + 1, maxRounds)} / {maxRounds}</div>
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

      <div className="rounded-xl border border-cyan-400/25 bg-[#08152f]/85 p-4">
        <p className="text-base md:text-lg font-semibold text-white leading-relaxed mb-4">{currentQuestion.question}</p>
        <div className="grid grid-cols-1 gap-2.5">
          {currentQuestion.options.map((option, idx) => {
            const isPicked = selectedOption === idx;
            const isCorrect = idx === currentQuestion.answerIndex;
            const stateClass = selectedOption === null
              ? 'border-cyan-400/25 hover:border-cyan-300/45 bg-[#102348]/70 hover:bg-[#15305f]/70'
              : isPicked && isCorrect
                ? 'border-emerald-400/40 bg-emerald-500/20'
                : isPicked
                  ? 'border-rose-400/40 bg-rose-500/20'
                  : isCorrect
                    ? 'border-emerald-400/30 bg-emerald-500/10'
                    : 'border-cyan-400/20 bg-[#0d1f40]/55';
            return (
              <button
                key={`${roundIndex}-${idx}`}
                data-testid={`knowledge-option-${idx}`}
                onClick={() => handleAnswer(idx)}
                disabled={selectedOption !== null || done || resolvingMatch}
                className={`text-left rounded-lg border px-3.5 py-3 transition ${stateClass}`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {done && (
        <div className="mt-4">
          <RetroButton onClick={onLeave}>Lobiye Dön</RetroButton>
        </div>
      )}
    </div>
  );
};

