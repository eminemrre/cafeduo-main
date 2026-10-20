import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { playGameSfx } from '../lib/gameAudio';
import { ConnectionOverlay } from './ConnectionOverlay';
import {
  QUESTION_TIME_SECONDS,
  buildQuizRoundSet,
  halfAndHalf,
  quizSeed,
  scoreAnswer,
} from '../lib/knowledgeQuizQuestions';
import { useLiveScoreGame, type LiveMatchStats } from '../hooks/useLiveScoreGame';
import { QuizStageCanvas, type QuizStageHandle } from './games/QuizStageCanvas';

interface KnowledgeQuizProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (
    winner: string,
    points: number,
    stats?: LiveMatchStats & { maxRounds?: number; correctAnswers?: number }
  ) => void;
  onLeave: () => void;
  /** Fires the instant the match is settled (live.done flips true) so the
   *  parent can suppress its forfeit-confirm dialog. */
  onMatchSettled?: () => void;
}

const QUIZ_ROUND_COUNT = 10;
const QUIZ_GAME_TYPE = 'Bilgi Yarışı';
const FINALIZATION_FALLBACK_MS = 10_000;
const LEVEL_LABEL = { orta: 'Orta', zor: 'Zor' } as const;

export const KnowledgeQuiz: React.FC<KnowledgeQuizProps> = ({
  currentUser,
  gameId,
  opponentName,
  isBot,
  onGameEnd,
  onLeave,
  onMatchSettled,
}) => {
  const live = useLiveScoreGame({
    currentUser,
    gameId,
    isBot,
    mode: QUIZ_GAME_TYPE,
    submissionKeyPrefix: 'quiz',
    pollIntervalMs: 15_000,
    finalizationTimeoutMs: FINALIZATION_FALLBACK_MS,
    logName: 'KnowledgeQuiz',
    statsKind: 'quiz',
    onGameEnd: (winner, points, stats) =>
      onGameEnd(
        winner,
        points,
        stats && {
          ...stats,
          maxRounds: QUIZ_ROUND_COUNT,
          correctAnswers: correctAnswersRef.current,
        }
      ),
  });

  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [message, setMessage] = useState(
    'Hızlı doğru cevap daha çok puan getirir. Seriler ve son soru ekstra kazandırır.'
  );
  const [feedbackAnimation, setFeedbackAnimation] = useState<'correct' | 'incorrect' | null>(null);
  const [scoreAnimation, setScoreAnimation] = useState<'player' | 'opponent' | null>(null);
  const [floatingScore, setFloatingScore] = useState<string | null>(null);
  /** Per-question countdown — resets to QUESTION_TIME_SECONDS at every new
   *  round, ticks down to 0, then auto-submits a wrong answer. */
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_SECONDS);

  const advanceTimerRef = useRef<number | null>(null);
  const quizStageRef = useRef<QuizStageHandle | null>(null);
  /** Stable ref to handleAnswer so the countdown effect can call the latest
   *  version without rerunning every time handleAnswer's closure changes. */
  const handleAnswerRef = useRef<(idx: number) => void>(() => {});
  /** Correct answers in a row, for the streak bonus; the bot keeps its own. */
  const [streak, setStreak] = useState(0);
  const botStreakRef = useRef(0);
  const correctAnswersRef = useRef(0);
  /** "Yarı yarıya" can be used once per match; it hides two wrong options. */
  const [jokerUsed, setJokerUsed] = useState(false);
  const [hiddenOptions, setHiddenOptions] = useState<number[]>([]);
  /** A solo game gets a fresh set of questions every match. */
  const [soloSeed] = useState(() => `solo:${Date.now().toString(36)}`);
  const seed = gameId ? quizSeed(gameId) : soloSeed;

  const fallbackQuestion = useMemo(
    () => ({
      question: 'Soru yüklenemedi. Lütfen tekrar deneyin.',
      options: ['Seçenek A', 'Seçenek B', 'Seçenek C', 'Seçenek D'] as [
        string,
        string,
        string,
        string,
      ],
      answerIndex: 0,
      category: '',
      level: 'orta' as const,
    }),
    []
  );
  // Seeded by the game alone, so both players get the same questions in the same order.
  const quizQuestions = useMemo(() => buildQuizRoundSet(seed, QUIZ_ROUND_COUNT), [seed]);
  const maxRounds = quizQuestions.length;
  const currentQuestion =
    quizQuestions[Math.min(roundIndex, Math.max(0, maxRounds - 1))] || fallbackQuestion;
  const targetName = isBot ? 'BOT' : opponentName || 'Rakip';

  // Reset local game state when a new match starts.
  useEffect(() => {
    setRoundIndex(0);
    setSelectedOption(null);
    setStreak(0);
    setJokerUsed(false);
    setHiddenOptions([]);
    botStreakRef.current = 0;
    correctAnswersRef.current = 0;
    setMessage('Hızlı doğru cevap daha çok puan getirir. Seriler ve son soru ekstra kazandırır.');
  }, [gameId]);

  // Update status message when opponent name arrives via snapshot.
  useEffect(() => {
    if (isBot || !gameId) return;
    if (live.guestName || live.hostName) {
      setMessage(`Canlı senkron aktif. Rakip: ${live.guestName || live.hostName || targetName}`);
    }
  }, [isBot, gameId, live.guestName, live.hostName, targetName]);

  // Reflect server-side finish (set a friendly message; hook already calls onGameEnd).
  useEffect(() => {
    if (!live.done) return;
    setMessage((prev) =>
      prev.startsWith('Tur tamamlandı') || prev.startsWith('Skorun kaydedildi') ? prev : prev
    );
  }, [live.done]);

  useEffect(
    () => () => {
      if (advanceTimerRef.current) {
        window.clearTimeout(advanceTimerRef.current);
      }
    },
    []
  );

  // Pause the PixiJS overlay's animation loop once the match is over so we're
  // not burning frames while the user reads the result.
  useEffect(() => {
    quizStageRef.current?.setActive(!live.done);
  }, [live.done]);

  // Tell the parent the match is settled so the forfeit confirm gets
  // suppressed before the delayed onGameEnd actually sets gameResult.
  useEffect(() => {
    if (live.done) onMatchSettled?.();
  }, [live.done, onMatchSettled]);

  const handleAnswer = (optionIndex: number) => {
    if (live.done || live.resolvingMatch || selectedOption !== null || !currentQuestion) return;

    // optionIndex === -1 means "time ran out". We treat it as a wrong answer
    // (timer-driven), highlight the correct option, and proceed normally.
    const isTimeout = optionIndex === -1;
    const isCorrect = !isTimeout && optionIndex === currentQuestion.answerIndex;
    const isLastRound = roundIndex >= maxRounds - 1;
    const gain = scoreAnswer({
      correct: isCorrect,
      secondsLeft: timeLeft,
      streakBefore: streak,
      isFinal: isLastRound,
    });
    setStreak(gain.streak);
    if (isCorrect) correctAnswersRef.current += 1;

    // The bot answers about half the questions right, at a human pace.
    let botPoints = 0;
    if (isBot) {
      const bot = scoreAnswer({
        correct: Math.random() < 0.5,
        secondsLeft: 3 + Math.floor(Math.random() * 9),
        streakBefore: botStreakRef.current,
        isFinal: isLastRound,
      });
      botStreakRef.current = bot.streak;
      botPoints = bot.points;
    }
    const nextPlayerScore = live.playerScore + gain.points;
    const nextOpponentScore = live.opponentScore + botPoints;

    // For timeout, store a sentinel so the option grid renders all options
    // as "neither picked correct nor picked wrong" while still showing the
    // correct answer highlight via isCorrectAnswer fallback in the JSX.
    setSelectedOption(isTimeout ? -1 : optionIndex);

    setFeedbackAnimation(isCorrect ? 'correct' : 'incorrect');
    window.setTimeout(() => setFeedbackAnimation(null), 600);

    // PixiJS particle layer on top of the CSS feedback — enriches, doesn't replace.
    if (isCorrect) quizStageRef.current?.playCorrect();
    else quizStageRef.current?.playWrong();

    setScoreAnimation(isCorrect ? 'player' : 'opponent');
    window.setTimeout(() => setScoreAnimation(null), 400);

    if (isCorrect) {
      setFloatingScore(`+${gain.points}`);
      window.setTimeout(() => setFloatingScore(null), 800);
    } else {
      setFloatingScore(isTimeout ? 'Süre' : 'Yanlış');
      window.setTimeout(() => setFloatingScore(null), 700);
    }

    live.setPlayerScore(nextPlayerScore);
    live.setOpponentScore(nextOpponentScore);
    const correctText = currentQuestion.options[currentQuestion.answerIndex];
    const bonuses = [
      gain.timeBonus > 0 ? `süre +${gain.timeBonus}` : '',
      gain.streakBonus > 0 ? `seri +${gain.streakBonus}` : '',
      gain.doubled ? 'son soru ×2' : '',
    ].filter(Boolean);
    setMessage(
      isCorrect
        ? `Doğru! +${gain.points} puan${bonuses.length ? ` (${bonuses.join(', ')})` : ''}.`
        : isTimeout
          ? `Süre doldu! Doğru cevap: ${correctText}`
          : isBot
            ? 'Yanlış cevap, tur rakibe kaydı.'
            : 'Yanlış cevap. Rakip sonucu bekleniyor.'
    );
    playGameSfx(isCorrect ? 'success' : 'fail', isCorrect ? 0.3 : 0.22);

    void live.syncLiveProgress(nextPlayerScore, roundIndex + 1, isLastRound);

    if (isLastRound) {
      live.setDone(true);
      // Big multi-color celebration on the last answer (mirrors checkmate energy).
      quizStageRef.current?.playFinale();
      if (isBot || !gameId) {
        const localWinner =
          nextPlayerScore >= nextOpponentScore ? currentUser.username : targetName;
        void live.finalizeMatch(localWinner, nextPlayerScore);
        return;
      }
      // Multiplayer: wait for the server to confirm the winner via socket/poll.
      // useLiveScoreGame's finalizationTimeoutMs (10s) acts as a fallback.
      setMessage('Tur tamamlandı. Sunucu sonucu kesinleştiriyor...');
      return;
    }

    advanceTimerRef.current = window.setTimeout(() => {
      setRoundIndex((prev) => prev + 1);
      setSelectedOption(null);
      setHiddenOptions([]);
      setMessage(
        roundIndex + 1 >= maxRounds - 1
          ? 'Son soru: puanı çift sayılır.'
          : 'Yeni soru hazır. Hızlı karar ver.'
      );
      playGameSfx('select', 0.18);
    }, 900);
  };

  const playJoker = () => {
    if (jokerUsed || selectedOption !== null || live.done || live.resolvingMatch) return;
    setJokerUsed(true);
    setHiddenOptions(halfAndHalf(currentQuestion, seed));
    playGameSfx('select', 0.18);
  };

  // Keep the ref pointing at the freshest handleAnswer closure so the
  // countdown effect below can invoke it without listing handleAnswer as a
  // dependency (which would cause the timer to restart on every render).
  handleAnswerRef.current = handleAnswer;

  // Per-question countdown. Resets when:
  //   - roundIndex changes (next question)
  //   - selectedOption transitions from set → null (advance after answer)
  // Stops when:
  //   - User picks (selectedOption !== null)
  //   - Match is done or resolving (no point ticking)
  useEffect(() => {
    if (selectedOption !== null || live.done || live.resolvingMatch) return;
    setTimeLeft(QUESTION_TIME_SECONDS);
    const tick = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          window.clearInterval(tick);
          // Fire the timeout via the ref so we always call the latest
          // handleAnswer with the right closure (currentQuestion etc.).
          handleAnswerRef.current?.(-1);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [roundIndex, selectedOption, live.done, live.resolvingMatch]);

  const elapsedFraction = 1 - timeLeft / QUESTION_TIME_SECONDS;
  const timeWarning = timeLeft <= 5 && selectedOption === null && !live.done;

  return (
    <>
      <ConnectionOverlay gameId={gameId} />
      <div className="max-w-2xl mx-auto text-carbon" data-testid="knowledge-quiz">
        <header className="duo-game-head mb-6">
          <div className="min-w-0">
            <span className="duo-game-chip bg-candy-limon">{maxRounds} soru</span>
            <h2 className="duo-game-title">{QUIZ_GAME_TYPE}</h2>
            <p className="duo-game-sub truncate">Rakip: {targetName}</p>
          </div>
          <button type="button" onClick={onLeave} className="duo-quiet duo-focus shrink-0">
            Oyundan çık
          </button>
        </header>

        {/* Per-question countdown — the filled part is the elapsed time; it turns
            to the danger state in the last 5 seconds. No layout shift. */}
        <div className="mb-4 flex items-center gap-3" data-testid="quiz-countdown">
          <span className="shrink-0 text-[15px] font-medium text-carbon-muted">Süre</span>
          <div className="duo-meter flex-1">
            <span
              className={`transition-[width] duration-1000 ease-linear ${
                timeWarning ? 'bg-candy-danger' : 'bg-candy-gok'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, elapsedFraction * 100))}%` }}
            />
          </div>
          <span
            className={`w-12 shrink-0 text-right font-candy-mono text-base font-bold ${
              timeWarning ? 'text-candy-danger' : 'text-carbon'
            }`}
          >
            {timeLeft} sn
          </span>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2">
          <div className="duo-stat">
            <span className="duo-stat-label">Tur</span>
            <span className="duo-stat-value">
              {Math.min(roundIndex + 1, maxRounds)} / {maxRounds}
            </span>
            <div className="duo-meter mt-2">
              <span
                className="bg-candy-gok transition-all duration-500 ease-out"
                style={{ width: `${((roundIndex + 1) / maxRounds) * 100}%` }}
              />
            </div>
          </div>
          <div
            className={`duo-stat duo-stat--limon ${scoreAnimation === 'player' ? 'animate-score-pop' : ''}`}
          >
            <span className="duo-stat-label">Sen</span>
            <span className="duo-stat-value duo-stat-value--score">{live.playerScore}</span>
          </div>
          <div className={`duo-stat ${scoreAnimation === 'opponent' ? 'animate-score-pop' : ''}`}>
            <span className="duo-stat-label">Rakip</span>
            <span className="duo-stat-value duo-stat-value--score">{live.opponentScore}</span>
          </div>
        </div>

        <p className="duo-game-status mb-4 min-h-[2.75rem]" aria-live="polite">
          {message}
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="knowledge-meta">
          {currentQuestion.category && (
            <span className="duo-game-chip bg-candy-gok">{currentQuestion.category}</span>
          )}
          <span className="duo-game-chip bg-paper-deep">{LEVEL_LABEL[currentQuestion.level]}</span>
          {roundIndex >= maxRounds - 1 && (
            <span className="duo-game-chip bg-candy-lokum">Son soru · ×2</span>
          )}
          {streak >= 2 && (
            <span className="duo-game-chip bg-candy-fistik" data-testid="knowledge-streak">
              Seri: {streak}
            </span>
          )}
        </div>

        <div
          className={`relative overflow-hidden bg-paper-deep p-4 sm:p-5 ${feedbackAnimation === 'correct' ? 'animate-flash-green' : feedbackAnimation === 'incorrect' ? 'animate-flash-red animate-shake' : ''}`}
        >
          {/* PixiJS overlay — sits above floatingScore (z-30 vs z-20) so confetti
              renders ON TOP of the "+1" / "Yanlış" text. */}
          <QuizStageCanvas
            ref={quizStageRef}
            className="pointer-events-none absolute inset-0 z-30 h-full w-full"
          />
          {floatingScore && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <span
                className={`font-candy-display text-6xl animate-float-up ${floatingScore.startsWith('+') ? 'text-[#177A41]' : 'text-candy-danger'}`}
              >
                {floatingScore}
              </span>
            </div>
          )}
          <p
            data-testid="knowledge-question"
            className="mb-4 font-candy-body text-lg font-semibold leading-snug text-carbon md:text-xl"
          >
            {currentQuestion.question}
          </p>
          <div className="grid grid-cols-1 gap-2">
            {currentQuestion.options.map((option, idx) => {
              const isHidden = hiddenOptions.includes(idx) && selectedOption === null;
              const isPicked = selectedOption === idx;
              const isCorrect = idx === currentQuestion.answerIndex;
              // Answer states are states, never decoration: success and danger
              // fills carry paper text; the rest of the options step back.
              const stateClass =
                selectedOption === null
                  ? 'bg-paper text-carbon hover:-translate-y-0.5 active:scale-[0.98]'
                  : isCorrect
                    ? 'bg-[#177A41] text-paper'
                    : isPicked
                      ? 'bg-candy-danger text-paper'
                      : 'bg-paper text-carbon-muted opacity-55';
              const letterClass =
                selectedOption === null
                  ? 'bg-candy-limon text-carbon'
                  : isCorrect || isPicked
                    ? 'bg-paper text-carbon'
                    : 'bg-paper-dim text-carbon-muted';
              return (
                <button
                  key={`${roundIndex}-${idx}`}
                  data-testid={`knowledge-option-${idx}`}
                  onClick={() => handleAnswer(idx)}
                  disabled={isHidden || selectedOption !== null || live.done || live.resolvingMatch}
                  aria-hidden={isHidden || undefined}
                  className={`duo-focus min-h-[52px] ${isHidden ? 'invisible' : ''} text-left px-3 py-2.5 transition-[transform,background-color] duration-200 font-candy-body disabled:cursor-not-allowed ${stateClass}`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center text-sm font-bold ${letterClass}`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="font-medium">{option}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="duo-game-actions mt-5 flex flex-col gap-3 sm:flex-row">
          {!live.done && (
            <RetroButton
              onClick={playJoker}
              disabled={jokerUsed || selectedOption !== null || live.resolvingMatch}
              variant="secondary"
              data-testid="knowledge-joker"
              className="flex-1"
            >
              {jokerUsed ? 'Joker kullanıldı' : 'Yarı yarıya (1 joker)'}
            </RetroButton>
          )}
          {live.done && (
            <RetroButton onClick={onLeave} className="flex-1">
              Lobiye dön
            </RetroButton>
          )}
        </div>
      </div>
    </>
  );
};
