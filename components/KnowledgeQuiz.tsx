import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { api } from '../lib/api';
import { submitScoreAndWaitForWinner } from '../lib/multiplayer';
import { GAME_ASSETS } from '../lib/gameAssets';
import { playGameSfx } from '../lib/gameAudio';
import { socketService } from '../lib/socket';
import { buildQuizRoundSet } from '../lib/knowledgeQuizQuestions';

interface KnowledgeQuizProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number) => void;
  onLeave: () => void;
}

interface LiveSubmissionState {
  score?: number;
  roundsWon?: number;
  round?: number;
  done?: boolean;
}

interface GameSnapshot {
  id: string | number;
  status?: string;
  winner?: string | null;
  hostName?: string;
  guestName?: string | null;
  gameState?: {
    resolvedWinner?: string;
    live?: {
      submissions?: Record<string, LiveSubmissionState>;
      resolvedWinner?: string;
    };
  };
}

interface GameStateUpdatedPayload {
  type?: string;
  gameId?: string | number;
}

const QUIZ_ROUND_COUNT = 10;

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
  const [hostName, setHostName] = useState('');
  const [guestName, setGuestName] = useState('');
  const matchStartedAtRef = useRef<number>(Date.now());
  const advanceTimerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const finishHandledRef = useRef(false);
  const fallbackQuestion = useMemo(
    () => ({
      question: 'Soru yüklenemedi. Lütfen tekrar deneyin.',
      options: ['Seçenek A', 'Seçenek B', 'Seçenek C', 'Seçenek D'] as [string, string, string, string],
      answerIndex: 0,
    }),
    []
  );
  const quizQuestions = useMemo(
    () => buildQuizRoundSet(`${String(gameId || 'local')}:${String(currentUser.username || '')}`, QUIZ_ROUND_COUNT),
    [currentUser.username, gameId]
  );
  const maxRounds = quizQuestions.length;
  const currentQuestion =
    quizQuestions[Math.min(roundIndex, Math.max(0, maxRounds - 1))] || fallbackQuestion;
  const targetName = isBot ? 'BOT' : (opponentName || 'Rakip');

  const resolveActorAndOpponent = useCallback((snapshot: GameSnapshot) => {
    const actor = String(currentUser.username || '').trim().toLowerCase();
    const host = String(snapshot.hostName || '').trim();
    const guest = String(snapshot.guestName || '').trim();
    if (host && actor === host.toLowerCase()) {
      return { actorName: host, opponentKey: guest };
    }
    if (guest && actor === guest.toLowerCase()) {
      return { actorName: guest, opponentKey: host };
    }
    return { actorName: '', opponentKey: '' };
  }, [currentUser.username]);

  const finishFromServer = useCallback((winnerRaw: string | null) => {
    if (finishHandledRef.current) return;
    finishHandledRef.current = true;
    const winner = String(winnerRaw || '').trim() || 'Berabere';
    const points = winner.toLowerCase() === currentUser.username.toLowerCase() ? 10 : 0;
    setDone(true);
    setMessage(winner === 'Berabere' ? 'Oyun berabere tamamlandı.' : `${winner} kazandı.`);
    window.setTimeout(() => onGameEnd(winner, points), 700);
  }, [currentUser.username, onGameEnd]);

  const applySnapshot = useCallback((snapshot: GameSnapshot) => {
    if (snapshot.hostName) setHostName(String(snapshot.hostName));
    if (snapshot.guestName) setGuestName(String(snapshot.guestName));

    const { actorName, opponentKey } = resolveActorAndOpponent(snapshot);
    const submissions = snapshot.gameState?.live?.submissions || {};
    const actorLive = actorName ? submissions[actorName] : undefined;
    const opponentLive = opponentKey ? submissions[opponentKey] : undefined;

    if (typeof actorLive?.score === 'number') {
      setPlayerScore((prev) => Math.max(prev, Number(actorLive.score)));
    }
    if (typeof opponentLive?.score === 'number') {
      setOpponentScore((prev) => Math.max(prev, Number(opponentLive.score)));
    }

    const winner =
      String(snapshot.gameState?.resolvedWinner || snapshot.gameState?.live?.resolvedWinner || snapshot.winner || '').trim() || null;
    if (String(snapshot.status || '').toLowerCase() === 'finished') {
      finishFromServer(winner);
    }
  }, [finishFromServer, resolveActorAndOpponent]);

  const fetchSnapshot = useCallback(async (silent = false) => {
    if (isBot || !gameId) return;
    try {
      const snapshot = await api.games.get(gameId) as GameSnapshot;
      applySnapshot(snapshot);
      if (!silent) {
        setMessage(`Canlı senkron aktif. Rakip: ${snapshot.guestName || snapshot.hostName || targetName}`);
      }
    } catch (err) {
      console.error('KnowledgeQuiz snapshot error', err);
    }
  }, [applySnapshot, gameId, isBot, targetName]);

  const syncLiveProgress = useCallback(async (score: number, round: number, isDone: boolean) => {
    if (isBot || !gameId) return;
    try {
      await api.games.move(gameId, {
        liveSubmission: {
          mode: 'Bilgi Yarışı',
          score,
          roundsWon: score,
          round,
          done: isDone,
        },
      });
    } catch (err) {
      console.error('KnowledgeQuiz live submission failed', err);
    }
  }, [gameId, isBot]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        window.clearTimeout(advanceTimerRef.current);
      }
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, []);

  useEffect(() => {
    finishHandledRef.current = false;
    if (isBot || !gameId) return;
    void fetchSnapshot();
    const socket = socketService.getSocket();
    socketService.joinGame(String(gameId));

    const onRealtime = (payload: GameStateUpdatedPayload) => {
      if (String(payload?.gameId || '') !== String(gameId)) return;
      if (payload?.type === 'live_submission' || payload?.type === 'score_submission' || payload?.type === 'game_finished' || payload?.type === 'game_state') {
        void fetchSnapshot(true);
      }
    };
    socket.on('game_state_updated', onRealtime);
    pollRef.current = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      if (done) return;
      void fetchSnapshot(true);
    }, 2200);
    return () => {
      socket.off('game_state_updated', onRealtime);
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, [done, fetchSnapshot, gameId, isBot]);

  const finalizeMatch = async (localWinner: string, playerScoreValue: number) => {
    if (finishHandledRef.current) return;
    if (isBot || !gameId) {
      const points = localWinner === currentUser.username ? 10 : 0;
      finishHandledRef.current = true;
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
      finishHandledRef.current = true;
      setTimeout(() => onGameEnd(resolvedWinner, points), 900);
    } catch {
      const fallbackPoints = localWinner === currentUser.username ? 10 : 0;
      setMessage('Bağlantı dalgalandı, yerel sonuç uygulandı.');
      finishHandledRef.current = true;
      setTimeout(() => onGameEnd(localWinner, fallbackPoints), 900);
    } finally {
      setResolvingMatch(false);
    }
  };

  const handleAnswer = (optionIndex: number) => {
    if (done || resolvingMatch || selectedOption !== null || !currentQuestion) return;

    const isCorrect = optionIndex === currentQuestion.answerIndex;
    const rivalCorrect = isBot ? Math.random() < 0.55 : false;
    const nextPlayerScore = playerScore + (isCorrect ? 1 : 0);
    const nextOpponentScore = opponentScore + (rivalCorrect ? 1 : 0);

    setSelectedOption(optionIndex);
    setPlayerScore(nextPlayerScore);
    setOpponentScore(nextOpponentScore);
    setMessage(
      isCorrect
        ? 'Doğru cevap, puanı aldın.'
        : isBot
          ? 'Yanlış cevap, tur rakibe kaydı.'
          : 'Yanlış cevap. Rakip sonucu bekleniyor.'
    );
    playGameSfx(isCorrect ? 'success' : 'fail', isCorrect ? 0.3 : 0.22);

    const isLastRound = roundIndex >= maxRounds - 1;
    void syncLiveProgress(nextPlayerScore, roundIndex + 1, isLastRound);
    if (isLastRound) {
      setDone(true);
      const localWinner = isBot
        ? (nextPlayerScore >= nextOpponentScore ? currentUser.username : targetName)
        : currentUser.username;
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
      className="max-w-2xl mx-auto rf-panel rf-elevated border-cyan-400/22 rounded-xl p-6 text-white relative overflow-hidden"
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
        <p data-testid="knowledge-question" className="text-base md:text-lg font-semibold text-white leading-relaxed mb-4">
          {currentQuestion.question}
        </p>
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
