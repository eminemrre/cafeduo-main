import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '../types';
import { RetroButton } from './RetroButton';
import { playGameSfx } from '../lib/gameAudio';
import { ConnectionOverlay } from './ConnectionOverlay';
import {
  QUESTION_TIME_SECONDS,
  buildQuizRoundSet,
  halfAndHalf,
  quizSeed,
  scoreAnswer,
  type QuizQuestion,
} from '../lib/knowledgeQuizQuestions';
import { useLiveScoreGame, type LiveMatchStats } from '../hooks/useLiveScoreGame';
import { QuizStageCanvas, type QuizStageHandle } from './games/QuizStageCanvas';

interface KnowledgeQuizProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number, stats?: LiveMatchStats) => void;
  onLeave: () => void;
  /** Fires the instant the match is settled (live.done flips true) so the
   *  parent can suppress its forfeit-confirm dialog. */
  onMatchSettled?: () => void;
}

const QUIZ_ROUND_COUNT = 10;
const QUIZ_GAME_TYPE = 'Bilgi Yarışı';
const BOT_WIN_REWARD = 10;
const LEVEL_LABEL = { orta: 'Orta', zor: 'Zor' } as const;

interface BotState {
  seed: string;
  questions: QuizQuestion[];
  roundIndex: number;
  phase: 'open' | 'reveal' | 'finished';
  timeLeft: number;
  selectedOption: number | null;
  correctIndex: number | null;
  hiddenOptions: number[];
  jokerUsed: boolean;
  streak: number;
  botStreak: number;
  playerScore: number;
  opponentScore: number;
  correctAnswers: number;
  lastGain: number;
  correctText: string;
}

const createBotState = (gameId: string | number | null): BotState => {
  const seed = quizSeed(gameId ?? `practice:${Date.now().toString(36)}`);
  return {
    seed,
    questions: buildQuizRoundSet(seed, QUIZ_ROUND_COUNT),
    roundIndex: 0,
    phase: 'open',
    timeLeft: QUESTION_TIME_SECONDS,
    selectedOption: null,
    correctIndex: null,
    hiddenOptions: [],
    jokerUsed: false,
    streak: 0,
    botStreak: 0,
    playerScore: 0,
    opponentScore: 0,
    correctAnswers: 0,
    lastGain: 0,
    correctText: '',
  };
};

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
    logName: 'KnowledgeQuiz',
    statsKind: 'quiz',
    onGameEnd,
  });

  const liveEngine = live.engine;
  const livePlayer = live.player;
  const livePending = live.pending;
  const livePendingType = live.pendingType;
  const submitLiveAction = live.submitAction;

  const [bot, setBot] = useState<BotState>(() => createBotState(gameId));
  const [optimisticPick, setOptimisticPick] = useState<number | null>(null);
  const [feedbackAnimation, setFeedbackAnimation] = useState<'correct' | 'incorrect' | null>(null);
  const [scoreAnimation, setScoreAnimation] = useState<'player' | 'opponent' | null>(null);
  const [floatingScore, setFloatingScore] = useState<string | null>(null);
  const quizStageRef = useRef<QuizStageHandle | null>(null);
  const botDoneRef = useRef(false);
  const botStartedAtRef = useRef(Date.now());
  const feedbackKeyRef = useRef('');
  const feedbackTimersRef = useRef<number[]>([]);
  const finalePlayedRef = useRef(false);
  const onGameEndRef = useRef(onGameEnd);
  const onMatchSettledRef = useRef(onMatchSettled);

  useEffect(() => {
    onGameEndRef.current = onGameEnd;
  }, [onGameEnd]);

  useEffect(() => {
    onMatchSettledRef.current = onMatchSettled;
  }, [onMatchSettled]);

  useEffect(() => {
    setBot(createBotState(gameId));
    setOptimisticPick(null);
    botDoneRef.current = false;
    botStartedAtRef.current = Date.now();
    feedbackKeyRef.current = '';
    finalePlayedRef.current = false;
  }, [gameId]);

  useEffect(() => {
    if (isBot) return;
    setOptimisticPick(null);
  }, [isBot, liveEngine?.round?.id]);

  useEffect(
    () => () => {
      feedbackTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    },
    []
  );

  const showFeedback = useCallback(
    (correct: boolean, points: number, timeoutLabel: 'Süre' | 'Yanlış') => {
      feedbackTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      feedbackTimersRef.current = [];
      setFeedbackAnimation(correct ? 'correct' : 'incorrect');
      setScoreAnimation(correct ? 'player' : 'opponent');
      setFloatingScore(correct ? `+${points}` : timeoutLabel);
      if (correct) quizStageRef.current?.playCorrect();
      else quizStageRef.current?.playWrong();
      playGameSfx(correct ? 'success' : 'fail', correct ? 0.3 : 0.22);
      feedbackTimersRef.current.push(
        window.setTimeout(() => setFeedbackAnimation(null), 600),
        window.setTimeout(() => setScoreAnimation(null), 400),
        window.setTimeout(() => setFloatingScore(null), 800)
      );
    },
    []
  );

  const answerBot = useCallback((optionIndex: number) => {
    // Keep the updater pure; StrictMode may invoke it twice in development.
    const botCorrect = Math.random() < 0.5;
    const botSeconds = 3 + Math.floor(Math.random() * 9);
    setBot((prev) => {
      if (prev.phase !== 'open') return prev;
      const question = prev.questions[prev.roundIndex];
      if (!question) return prev;
      const isTimeout = optionIndex === -1;
      const isCorrect = !isTimeout && optionIndex === question.answerIndex;
      const isLastRound = prev.roundIndex >= prev.questions.length - 1;
      const gain = scoreAnswer({
        correct: isCorrect,
        secondsLeft: prev.timeLeft,
        streakBefore: prev.streak,
        isFinal: isLastRound,
      });
      const botGain = scoreAnswer({
        correct: botCorrect,
        secondsLeft: botSeconds,
        streakBefore: prev.botStreak,
        isFinal: isLastRound,
      });
      return {
        ...prev,
        phase: 'reveal',
        selectedOption: isTimeout ? -1 : optionIndex,
        correctIndex: question.answerIndex,
        correctText: question.options[question.answerIndex],
        playerScore: prev.playerScore + gain.points,
        opponentScore: prev.opponentScore + botGain.points,
        streak: gain.streak,
        botStreak: botGain.streak,
        correctAnswers: prev.correctAnswers + (isCorrect ? 1 : 0),
        lastGain: gain.points,
      };
    });
  }, []);

  // Bot countdown and reveal pacing. Multiplayer pacing is owned by the server.
  useEffect(() => {
    if (!isBot || bot.phase !== 'open') return undefined;
    const interval = window.setInterval(() => {
      setBot((prev) =>
        prev.phase === 'open' ? { ...prev, timeLeft: Math.max(0, prev.timeLeft - 1) } : prev
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, [bot.phase, bot.roundIndex, isBot]);

  useEffect(() => {
    if (!isBot || bot.phase !== 'open' || bot.timeLeft > 0) return;
    answerBot(-1);
  }, [answerBot, bot.phase, bot.timeLeft, isBot]);

  useEffect(() => {
    if (!isBot || bot.phase !== 'reveal') return undefined;
    const timer = window.setTimeout(() => {
      setBot((prev) =>
        prev.roundIndex >= prev.questions.length - 1
          ? { ...prev, phase: 'finished' }
          : {
              ...prev,
              roundIndex: prev.roundIndex + 1,
              phase: 'open',
              timeLeft: QUESTION_TIME_SECONDS,
              selectedOption: null,
              correctIndex: null,
              hiddenOptions: [],
              lastGain: 0,
              correctText: '',
            }
      );
    }, 900);
    return () => window.clearTimeout(timer);
  }, [bot.phase, bot.roundIndex, isBot]);

  useEffect(() => {
    if (!isBot || bot.phase !== 'reveal') return;
    const key = `bot:${bot.roundIndex}`;
    if (feedbackKeyRef.current === key) return;
    feedbackKeyRef.current = key;
    const correct = bot.selectedOption !== null && bot.selectedOption === bot.correctIndex;
    showFeedback(correct, bot.lastGain, bot.selectedOption === -1 ? 'Süre' : 'Yanlış');
  }, [
    bot.correctIndex,
    bot.lastGain,
    bot.phase,
    bot.roundIndex,
    bot.selectedOption,
    isBot,
    showFeedback,
  ]);

  useEffect(() => {
    if (!isBot || bot.phase !== 'finished' || botDoneRef.current) return undefined;
    botDoneRef.current = true;
    const won = bot.playerScore >= bot.opponentScore;
    const winner = won ? currentUser.username : 'BOT';
    const stats: LiveMatchStats = {
      kind: 'quiz',
      playerScore: bot.playerScore,
      opponentScore: bot.opponentScore,
      durationMs: Math.max(0, Date.now() - botStartedAtRef.current),
      maxRounds: bot.questions.length,
      correctAnswers: bot.correctAnswers,
    };
    const timer = window.setTimeout(() => {
      onGameEndRef.current(winner, won ? BOT_WIN_REWARD : 0, stats);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [
    bot.correctAnswers,
    bot.opponentScore,
    bot.phase,
    bot.playerScore,
    bot.questions.length,
    currentUser.username,
    isBot,
  ]);

  useEffect(() => {
    if (isBot || !liveEngine || liveEngine.phase !== 'reveal' || !liveEngine.round) return;
    const key = `server:${liveEngine.revision}:${liveEngine.round.id}`;
    if (feedbackKeyRef.current === key) return;
    feedbackKeyRef.current = key;
    const pick = live.actorKey ? (liveEngine.round.picks?.[live.actorKey] ?? null) : null;
    const correct = pick !== null && pick === liveEngine.round.correctIndex;
    const points = live.actorKey ? Number(liveEngine.round.scoreDelta?.[live.actorKey] || 0) : 0;
    showFeedback(correct, points, pick === null ? 'Süre' : 'Yanlış');
  }, [isBot, live.actorKey, liveEngine?.phase, liveEngine?.revision, liveEngine, showFeedback]);

  useEffect(() => {
    const done = isBot ? bot.phase === 'finished' : live.done;
    quizStageRef.current?.setActive(!done);
    if (done && !finalePlayedRef.current) {
      finalePlayedRef.current = true;
      quizStageRef.current?.playFinale();
    }
  }, [bot.phase, isBot, live.done]);

  useEffect(() => {
    if (isBot ? bot.phase === 'finished' : live.done) onMatchSettledRef.current?.();
  }, [bot.phase, isBot, live.done]);

  const handleAnswer = useCallback(
    (optionIndex: number) => {
      const phase = isBot ? bot.phase : liveEngine?.phase;
      if (phase !== 'open' || (isBot ? bot.selectedOption !== null : livePending)) return;
      if (isBot) {
        answerBot(optionIndex);
        return;
      }
      if (livePlayer?.answered) return;
      setOptimisticPick(optionIndex);
      void submitLiveAction({ type: 'answer', optionIndex }).then((result) => {
        if (!result.ok && result.code !== 'BUSY') setOptimisticPick(null);
      });
    },
    [
      answerBot,
      bot.phase,
      bot.selectedOption,
      isBot,
      liveEngine?.phase,
      livePending,
      livePlayer?.answered,
      submitLiveAction,
    ]
  );

  const playJoker = useCallback(() => {
    const phase = isBot ? bot.phase : liveEngine?.phase;
    if (phase !== 'open') return;
    if (isBot) {
      if (bot.jokerUsed || bot.selectedOption !== null) return;
      const question = bot.questions[bot.roundIndex];
      if (!question) return;
      setBot((prev) => ({
        ...prev,
        jokerUsed: true,
        hiddenOptions: halfAndHalf(question, prev.seed),
      }));
      playGameSfx('select', 0.18);
      return;
    }
    if (livePlayer?.jokerUsed || livePlayer?.answered || livePending) return;
    void submitLiveAction({ type: 'joker' });
  }, [
    bot.jokerUsed,
    bot.phase,
    bot.questions,
    bot.roundIndex,
    bot.selectedOption,
    isBot,
    liveEngine?.phase,
    livePending,
    livePlayer?.answered,
    livePlayer?.jokerUsed,
    submitLiveAction,
  ]);

  const phase = isBot ? bot.phase : liveEngine?.phase || 'open';
  const isReveal = phase === 'reveal';
  const done = isBot ? bot.phase === 'finished' : live.done;
  const roundIndex = isBot ? bot.roundIndex : Math.max(0, (liveEngine?.roundIndex || 1) - 1);
  const maxRounds = isBot ? bot.questions.length : liveEngine?.totalRounds || QUIZ_ROUND_COUNT;
  const currentQuestion = isBot ? bot.questions[bot.roundIndex] : undefined;
  const questionText = isBot
    ? currentQuestion?.question
    : liveEngine?.round?.question || (liveEngine ? 'Soru yüklenemedi.' : 'Tur hazırlanıyor...');
  const options = isBot ? currentQuestion?.options || [] : liveEngine?.round?.options || [];
  const category = isBot ? currentQuestion?.category : liveEngine?.round?.category;
  const level = isBot ? currentQuestion?.level : liveEngine?.round?.level;
  const correctIndex = isBot
    ? bot.correctIndex
    : isReveal || done
      ? (liveEngine?.round?.correctIndex ?? null)
      : null;
  const serverPick = isBot
    ? null
    : live.actorKey
      ? (liveEngine?.round?.picks?.[live.actorKey] ?? null)
      : null;
  const selectedOption = isBot
    ? bot.selectedOption
    : phase === 'open'
      ? optimisticPick
      : serverPick;
  const hiddenOptions = isBot ? bot.hiddenOptions : liveEngine?.round?.hiddenOptions || [];
  const jokerUsed = isBot ? bot.jokerUsed : Boolean(livePlayer?.jokerUsed);
  const streak = isBot ? bot.streak : Number(livePlayer?.streak || 0);
  const playerScore = isBot ? bot.playerScore : live.playerScore;
  const opponentScore = isBot ? bot.opponentScore : live.opponentScore;
  const secondsLeft = isBot ? bot.timeLeft : phase === 'open' ? live.secondsLeft : 0;
  const hasAnswered = isBot
    ? bot.selectedOption !== null
    : phase !== 'open' || Boolean(livePlayer?.answered) || optimisticPick !== null;
  const isLastRound = roundIndex >= maxRounds - 1;
  const targetName = isBot ? 'BOT' : live.opponent?.name || opponentName || 'Rakip';
  const correctText = correctIndex !== null ? options[correctIndex] : '';
  const pointsThisRound = isBot
    ? bot.lastGain
    : live.actorKey
      ? Number(liveEngine?.round?.scoreDelta?.[live.actorKey] || 0)
      : 0;

  const loading = !isBot && !liveEngine && !live.protocolError;
  const scoreMismatch = !isBot && live.protocolError;

  const message = useMemo(() => {
    if (isBot) {
      if (bot.phase === 'finished') {
        return bot.playerScore >= bot.opponentScore
          ? 'Antrenman tamamlandı. Maçı kazandın.'
          : 'Antrenman tamamlandı. Rakip bu kez önde.';
      }
      if (bot.phase === 'reveal') {
        if (bot.selectedOption === -1) return `Süre doldu! Doğru cevap: ${bot.correctText}`;
        return bot.selectedOption === bot.correctIndex
          ? `Doğru! +${bot.lastGain} puan.`
          : `Yanlış cevap. Doğru cevap: ${bot.correctText}`;
      }
      return isLastRound
        ? 'Son soru: puanı çift sayılır. Hızlı karar ver.'
        : 'Hızlı doğru cevap daha çok puan getirir. Seriler ve son soru ekstra kazandırır.';
    }
    if (live.protocolError) return live.error || 'İstemci güncel değil.';
    if (loading) return 'Sunucu turu hazırlıyor...';
    if (livePending) {
      return livePendingType === 'joker' ? 'Joker uygulanıyor...' : 'Cevabın gönderiliyor...';
    }
    if (live.error) return live.error;
    if (phase === 'open') {
      if (hasAnswered) return 'Cevabın kaydedildi. Rakip bekleniyor...';
      return isLastRound
        ? 'Son soru: puanı çift sayılır. Hızlı karar ver.'
        : 'Hızlı doğru cevap daha çok puan getirir. Seriler ve son soru ekstra kazandırır.';
    }
    if (phase === 'reveal') {
      if (serverPick === null) return `Süre doldu! Doğru cevap: ${correctText}`;
      if (serverPick === correctIndex) return `Doğru! +${pointsThisRound} puan.`;
      return `Yanlış cevap. Doğru cevap: ${correctText}`;
    }
    if (done) {
      const winner = liveEngine?.result?.winner;
      if (liveEngine?.result?.cancelled) return 'Maç ödülsüz iptal edildi.';
      if (!winner) return 'Maç berabere bitti.';
      return winner === currentUser.username ? 'Maçı kazandın.' : `Maçı ${winner} aldı.`;
    }
    return 'Sunucu sonucu bekleniyor...';
  }, [
    bot.correctIndex,
    bot.correctText,
    bot.lastGain,
    bot.opponentScore,
    bot.phase,
    bot.playerScore,
    bot.selectedOption,
    correctIndex,
    correctText,
    currentUser.username,
    done,
    hasAnswered,
    isBot,
    isLastRound,
    liveEngine?.result?.cancelled,
    liveEngine?.result?.winner,
    live.error,
    livePending,
    livePendingType,
    live.protocolError,
    loading,
    phase,
    pointsThisRound,
    serverPick,
  ]);

  const elapsedFraction =
    phase === 'open' ? 1 - Math.min(QUESTION_TIME_SECONDS, secondsLeft) / QUESTION_TIME_SECONDS : 1;
  const timeWarning = secondsLeft <= 5 && secondsLeft > 0 && !hasAnswered && !done;

  if (scoreMismatch) {
    return (
      <>
        <ConnectionOverlay gameId={gameId} />
        <div className="mx-auto max-w-2xl text-carbon" data-testid="knowledge-quiz">
          <header className="duo-game-head mb-6">
            <div className="min-w-0">
              <span className="duo-game-chip bg-candy-limon">{QUIZ_GAME_TYPE}</span>
              <h2 className="duo-game-title">İstemci güncellemesi gerekiyor</h2>
            </div>
            <button type="button" onClick={onLeave} className="duo-quiet duo-focus shrink-0">
              Oyundan çık
            </button>
          </header>
          <p className="duo-game-status mb-4" aria-live="assertive">
            {live.error}
          </p>
          <RetroButton onClick={() => window.location.reload()} className="w-full">
            Sayfayı yenile
          </RetroButton>
        </div>
      </>
    );
  }

  return (
    <>
      <ConnectionOverlay gameId={gameId} />
      <div
        className="max-w-2xl mx-auto text-carbon"
        data-testid="knowledge-quiz"
        aria-busy={loading || livePending}
      >
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
              className={`transition-[width] duration-200 ease-linear ${
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
            {secondsLeft} sn
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
            <span className="duo-stat-value duo-stat-value--score">{playerScore}</span>
          </div>
          <div className={`duo-stat ${scoreAnimation === 'opponent' ? 'animate-score-pop' : ''}`}>
            <span className="duo-stat-label">Rakip</span>
            <span className="duo-stat-value duo-stat-value--score">{opponentScore}</span>
          </div>
        </div>

        <p className="duo-game-status mb-4 min-h-[2.75rem]" aria-live="polite">
          {message}
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="knowledge-meta">
          {category && <span className="duo-game-chip bg-candy-gok">{category}</span>}
          {level && <span className="duo-game-chip bg-paper-deep">{LEVEL_LABEL[level]}</span>}
          {isLastRound && <span className="duo-game-chip bg-candy-lokum">Son soru · ×2</span>}
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
            {questionText}
          </p>
          <div className="grid grid-cols-1 gap-2">
            {options.map((option, idx) => {
              const isHidden = phase === 'open' && hiddenOptions.includes(idx);
              const isPicked = selectedOption === idx;
              const isCorrect = correctIndex !== null && idx === correctIndex;
              const revealed = phase !== 'open';
              const stateClass = !revealed
                ? 'bg-paper text-carbon hover:-translate-y-0.5 active:scale-[0.98]'
                : isCorrect
                  ? 'bg-[#177A41] text-paper'
                  : isPicked
                    ? 'bg-candy-danger text-paper'
                    : 'bg-paper text-carbon-muted opacity-55';
              const letterClass = !revealed
                ? 'bg-candy-limon text-carbon'
                : isCorrect || isPicked
                  ? 'bg-paper text-carbon'
                  : 'bg-paper-dim text-carbon-muted';
              return (
                <button
                  type="button"
                  key={`${roundIndex}-${idx}`}
                  data-testid={`knowledge-option-${idx}`}
                  onClick={() => handleAnswer(idx)}
                  disabled={
                    isHidden || phase !== 'open' || hasAnswered || livePending || done || loading
                  }
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
          {!done && (
            <RetroButton
              onClick={playJoker}
              disabled={jokerUsed || phase !== 'open' || hasAnswered || livePending || loading}
              variant="secondary"
              data-testid="knowledge-joker"
              className="flex-1"
            >
              {jokerUsed ? 'Joker kullanıldı' : 'Yarı yarıya (1 joker)'}
            </RetroButton>
          )}
          {done && (
            <RetroButton onClick={onLeave} className="flex-1">
              Lobiye dön
            </RetroButton>
          )}
        </div>
      </div>
    </>
  );
};

export default KnowledgeQuiz;
