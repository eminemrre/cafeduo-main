import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { playGameSfx } from '../lib/gameAudio';
import { ConnectionOverlay } from './ConnectionOverlay';
import { buildQuizRoundSet } from '../lib/knowledgeQuizQuestions';
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
    stats?: LiveMatchStats & { maxRounds?: number }
  ) => void;
  onLeave: () => void;
  /** Fires the instant the match is settled (live.done flips true) so the
   *  parent can suppress its forfeit-confirm dialog. */
  onMatchSettled?: () => void;
}

const QUIZ_ROUND_COUNT = 10;
const QUIZ_GAME_TYPE = 'Bilgi Yarışı';
const FINALIZATION_FALLBACK_MS = 10_000;
/** Per-question time limit (seconds). When 0 is reached the question is
 *  auto-submitted as wrong and the next round starts. Pure client-side in V1
 *  — multiplayer doesn't yet enforce this server-side. */
const QUESTION_TIME_SECONDS = 15;

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
      onGameEnd(winner, points, stats && { ...stats, maxRounds: QUIZ_ROUND_COUNT }),
  });

  const [roundIndex, setRoundIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [message, setMessage] = useState('Soruları hızlı ve doğru yanıtla. En yüksek net kazanır.');
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
    }),
    []
  );
  const quizQuestions = useMemo(
    () =>
      buildQuizRoundSet(
        `${String(gameId || 'local')}:${String(currentUser.username || '')}`,
        QUIZ_ROUND_COUNT
      ),
    [currentUser.username, gameId]
  );
  const maxRounds = quizQuestions.length;
  const currentQuestion =
    quizQuestions[Math.min(roundIndex, Math.max(0, maxRounds - 1))] || fallbackQuestion;
  const targetName = isBot ? 'BOT' : opponentName || 'Rakip';

  // Reset local game state when a new match starts.
  useEffect(() => {
    setRoundIndex(0);
    setSelectedOption(null);
    setMessage('Soruları hızlı ve doğru yanıtla. En yüksek net kazanır.');
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
    const rivalCorrect = isBot ? Math.random() < 0.55 : false;
    const nextPlayerScore = live.playerScore + (isCorrect ? 1 : 0);
    const nextOpponentScore = live.opponentScore + (rivalCorrect ? 1 : 0);

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
      setFloatingScore('+1');
      window.setTimeout(() => setFloatingScore(null), 800);
    } else {
      setFloatingScore(isTimeout ? '⏱' : '✕');
      window.setTimeout(() => setFloatingScore(null), 700);
    }

    live.setPlayerScore(nextPlayerScore);
    live.setOpponentScore(nextOpponentScore);
    const correctText = currentQuestion.options[currentQuestion.answerIndex];
    setMessage(
      isCorrect
        ? 'Doğru cevap, puanı aldın.'
        : isTimeout
          ? `Süre doldu! Doğru cevap: ${correctText}`
          : isBot
            ? 'Yanlış cevap, tur rakibe kaydı.'
            : 'Yanlış cevap. Rakip sonucu bekleniyor.'
    );
    playGameSfx(isCorrect ? 'success' : 'fail', isCorrect ? 0.3 : 0.22);

    const isLastRound = roundIndex >= maxRounds - 1;
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
      setMessage('Yeni soru hazır. Hızlı karar ver.');
      playGameSfx('select', 0.18);
    }, 700);
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

  return (
    <>
      <ConnectionOverlay gameId={gameId} />
      <div
        className="max-w-2xl mx-auto border-2 border-carbon bg-paper riso-shadow-md p-4 sm:p-6 text-carbon relative overflow-hidden"
        data-testid="knowledge-quiz"
      >
        {/* Riso confetti accents */}
        <div
          aria-hidden="true"
          className="absolute top-3 right-3 h-2 w-12 bg-riso-mustard rotate-[-4deg] hidden sm:block pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute top-6 right-16 h-2 w-6 bg-riso-pink rotate-[6deg] hidden sm:block pointer-events-none"
        />
        <div className="relative z-10">
          <div className="font-riso-mono text-xs uppercase tracking-[0.18em] text-carbon-soft mb-2">
            Sistem TR-X // Bilgi Tarayıcı
          </div>
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="font-riso-display text-2xl sm:text-3xl uppercase tracking-[0.08em] leading-none text-carbon">
              {QUIZ_GAME_TYPE}
            </h2>
            <button
              onClick={onLeave}
              className="riso-focus riso-press shrink-0 px-3 py-2 border-2 border-carbon bg-riso-pink text-carbon riso-shadow-sm transition-all font-riso-display text-xs uppercase tracking-[0.16em]"
            >
              Oyundan Çık
            </button>
          </div>

          {/* Per-question countdown bar — pure visual, no layout shift. Bar
              widens left→right as time runs out (filled portion = elapsed),
              flips to riso-redox + pulse in the last 5 seconds. */}
          {(() => {
            const elapsedFraction = 1 - timeLeft / QUESTION_TIME_SECONDS;
            const warning = timeLeft <= 5 && selectedOption === null && !live.done;
            return (
              <div
                className="mb-4 border-2 border-carbon bg-paper-deep px-3 py-2 flex items-center gap-3"
                data-testid="quiz-countdown"
              >
                <span className="font-riso-mono text-[10px] uppercase tracking-[0.16em] text-carbon-muted font-bold shrink-0">
                  Süre
                </span>
                <div className="flex-1 h-2 bg-paper-dim border-2 border-carbon overflow-hidden">
                  <div
                    className={`h-full transition-[width] duration-1000 ease-linear ${
                      warning ? 'bg-riso-redox animate-pulse' : 'bg-riso-blue'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, elapsedFraction * 100))}%` }}
                  />
                </div>
                <span
                  className={`font-riso-mono text-sm font-bold tracking-wider shrink-0 ${
                    warning ? 'text-riso-redox' : 'text-carbon'
                  }`}
                >
                  {timeLeft}s
                </span>
              </div>
            );
          })()}

          <div className="grid grid-cols-3 gap-2.5 mb-5 text-center">
            <div className="border-2 border-carbon bg-paper-deep p-3">
              <div className="text-xs text-carbon-muted mb-1">Tur</div>
              <div className="font-bold text-carbon">
                {Math.min(roundIndex + 1, maxRounds)} / {maxRounds}
              </div>
              <div className="mt-2 h-1.5 bg-paper-dim border border-carbon overflow-hidden">
                <div
                  className="h-full bg-riso-blue transition-all duration-500 ease-out"
                  style={{ width: `${((roundIndex + 1) / maxRounds) * 100}%` }}
                />
              </div>
            </div>
            <div
              className={`border-2 border-carbon bg-paper-deep p-3 transition-all duration-300 ${scoreAnimation === 'player' ? 'animate-score-pop' : ''}`}
            >
              <div className="text-xs text-carbon-muted">Sen</div>
              <div className="font-bold text-carbon">{live.playerScore}</div>
            </div>
            <div
              className={`border-2 border-carbon bg-paper-deep p-3 transition-all duration-300 ${scoreAnimation === 'opponent' ? 'animate-score-pop' : ''}`}
            >
              <div className="text-xs text-carbon-muted">Rakip</div>
              <div className="font-bold text-carbon">{live.opponentScore}</div>
            </div>
          </div>

          <p className="text-sm text-carbon-muted mb-4 pl-3 border-l-2 border-carbon min-h-[2rem] flex items-center">
            {message}
          </p>

          <div
            className={`border-2 border-carbon bg-paper-deep p-4 transition-all duration-300 relative overflow-hidden ${feedbackAnimation === 'correct' ? 'animate-flash-green animate-glow-pulse' : feedbackAnimation === 'incorrect' ? 'animate-flash-red animate-shake' : ''}`}
          >
            {/* PixiJS overlay — sits above floatingScore (z-30 vs z-20) so confetti
                renders ON TOP of the "+1" / "✕" text. CSS feedback (border/shadow
                on the option button + flash on this card) stays intact below. */}
            <QuizStageCanvas
              ref={quizStageRef}
              className="pointer-events-none absolute inset-0 z-30 h-full w-full"
            />
            {floatingScore && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <span
                  className={`text-6xl font-bold animate-float-up ${floatingScore === '+1' ? 'text-riso-spring drop-shadow-[0_0_20px_rgba(52,211,153,0.6)]' : 'text-riso-pink-deep drop-shadow-[0_0_20px_rgba(244,63,94,0.6)]'}`}
                >
                  {floatingScore}
                </span>
              </div>
            )}
            <p
              data-testid="knowledge-question"
              className="text-base md:text-lg font-riso-display font-bold text-carbon leading-relaxed mb-4 uppercase tracking-[0.04em]"
            >
              {currentQuestion.question}
            </p>
            <div className="grid grid-cols-1 gap-2.5">
              {currentQuestion.options.map((option, idx) => {
                const isPicked = selectedOption === idx;
                const isCorrect = idx === currentQuestion.answerIndex;
                const stateClass =
                  selectedOption === null
                    ? 'border-carbon bg-paper hover:bg-paper-dim hover:-translate-y-[1px] hover:shadow-[3px_3px_0_0_rgba(20,20,19,1)]'
                    : isPicked && isCorrect
                      ? 'border-carbon bg-riso-spring/40 ring-2 ring-riso-spring scale-[1.02]'
                      : isPicked
                        ? 'border-carbon bg-riso-redox/30 ring-2 ring-riso-redox scale-[1.02]'
                        : isCorrect
                          ? 'border-carbon bg-riso-spring/25'
                          : 'border-carbon-muted bg-paper-dim opacity-55';
                const leftBorderClass =
                  selectedOption === null
                    ? ''
                    : isPicked && isCorrect
                      ? 'border-l-[6px] border-l-riso-spring'
                      : isPicked
                        ? 'border-l-[6px] border-l-riso-redox'
                        : isCorrect
                          ? 'border-l-[6px] border-l-riso-spring/60'
                          : '';
                return (
                  <button
                    key={`${roundIndex}-${idx}`}
                    data-testid={`knowledge-option-${idx}`}
                    onClick={() => handleAnswer(idx)}
                    disabled={selectedOption !== null || live.done || live.resolvingMatch}
                    className={`text-left border-2 px-3.5 py-3 transition-all duration-200 font-riso-body text-carbon disabled:cursor-not-allowed ${stateClass} ${leftBorderClass}`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 border-2 border-carbon flex items-center justify-center font-riso-display text-xs font-bold shrink-0 ${
                          selectedOption === null
                            ? 'bg-riso-blue text-carbon'
                            : isPicked && isCorrect
                              ? 'bg-riso-spring text-carbon'
                              : isPicked
                                ? 'bg-riso-redox text-carbon'
                                : isCorrect
                                  ? 'bg-riso-spring/60 text-carbon'
                                  : 'bg-paper text-carbon-muted'
                        }`}
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

          {live.done && (
            <div className="mt-4">
              <RetroButton onClick={onLeave}>Lobiye Dön</RetroButton>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
