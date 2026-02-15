import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { api } from '../lib/api';
import { submitScoreAndWaitForWinner } from '../lib/multiplayer';
import { GAME_ASSETS } from '../lib/gameAssets';
import { playGameSfx } from '../lib/gameAudio';
import { socketService } from '../lib/socket';

interface ArenaBattleProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number) => void;
  onLeave: () => void;
  onMinimize?: () => void;
}

interface LiveSubmissionState {
  score?: number;
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

const MAX_ROUNDS = 5;
const GAUGE_STEP = 4;
const GAUGE_TICK_MS = 46;

const clampGauge = (value: number) => Math.max(0, Math.min(100, value));

const pointsFromShot = (shot: number): number => {
  const distance = Math.abs(50 - shot);
  if (distance <= 4) return 3;
  if (distance <= 10) return 2;
  if (distance <= 18) return 1;
  return 0;
};

const shotLabel = (shot: number): string => {
  const points = pointsFromShot(shot);
  if (points === 3) return 'Mükemmel atış';
  if (points === 2) return 'İyi atış';
  if (points === 1) return 'Sınırda isabet';
  return 'Iskaladın';
};

const randomGaugeStart = () => 15 + Math.random() * 70;

export const ArenaBattle: React.FC<ArenaBattleProps> = ({
  currentUser,
  gameId,
  opponentName,
  isBot,
  onGameEnd,
  onLeave,
}) => {
  const [round, setRound] = useState(1);
  const [gauge, setGauge] = useState(50);
  const [roundLocked, setRoundLocked] = useState(false);
  const [playerShot, setPlayerShot] = useState<number | null>(null);
  const [opponentShot, setOpponentShot] = useState<number | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [message, setMessage] = useState('Nişan çubuğu hareket ederken en doğru anda ateş et.');
  const [done, setDone] = useState(false);
  const [resolvingMatch, setResolvingMatch] = useState(false);
  const [hostName, setHostName] = useState('');
  const [guestName, setGuestName] = useState('');

  const directionRef = useRef<1 | -1>(1);
  const nextRoundTimeoutRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const finishHandledRef = useRef(false);
  const matchStartedAtRef = useRef<number>(Date.now());

  const target = useMemo(() => (isBot ? 'BOT' : (opponentName || 'Rakip')), [isBot, opponentName]);

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
    if (typeof actorLive?.round === 'number') {
      const safeRound = Math.max(1, Math.floor(Number(actorLive.round)));
      setRound((prev) => Math.max(prev, Math.min(MAX_ROUNDS, safeRound)));
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
        setMessage(`Canlı eşleşme aktif. Rakip: ${snapshot.guestName || snapshot.hostName || target}`);
      }
    } catch (err) {
      console.error('ArenaBattle snapshot error', err);
    }
  }, [applySnapshot, gameId, isBot, target]);

  const syncLiveProgress = useCallback(async (score: number, currentRound: number, isDoneRound: boolean) => {
    if (isBot || !gameId) return;
    try {
      await api.games.move(gameId, {
        liveSubmission: {
          mode: 'Tank Düellosu',
          score,
          roundsWon: score,
          round: currentRound,
          done: isDoneRound,
          submissionKey: `arena|${String(gameId)}|${currentUser.username}|${currentRound}|${score}|${isDoneRound ? 1 : 0}`,
        },
      });
    } catch (err) {
      console.error('ArenaBattle live submission failed', err);
    }
  }, [currentUser.username, gameId, isBot]);

  useEffect(() => {
    finishHandledRef.current = false;
    matchStartedAtRef.current = Date.now();
    setRound(1);
    setPlayerScore(0);
    setOpponentScore(0);
    setRoundLocked(false);
    setPlayerShot(null);
    setOpponentShot(null);
    setDone(false);
    setResolvingMatch(false);
    setMessage('Nişan çubuğu hareket ederken en doğru anda ateş et.');
  }, [gameId]);

  useEffect(() => {
    setRoundLocked(false);
    setPlayerShot(null);
    setOpponentShot(null);
    directionRef.current = Math.random() > 0.5 ? 1 : -1;
    setGauge(randomGaugeStart());
  }, [round]);

  useEffect(() => {
    if (done || resolvingMatch) return;
    const interval = window.setInterval(() => {
      setGauge((prev) => {
        let next = prev + directionRef.current * GAUGE_STEP;
        if (next >= 100) {
          next = 100;
          directionRef.current = -1;
        } else if (next <= 0) {
          next = 0;
          directionRef.current = 1;
        }
        return next;
      });
    }, GAUGE_TICK_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [done, resolvingMatch, round]);

  useEffect(() => {
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

  useEffect(() => {
    return () => {
      if (nextRoundTimeoutRef.current) {
        window.clearTimeout(nextRoundTimeoutRef.current);
      }
    };
  }, []);

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
      const { winner, finished } = await submitScoreAndWaitForWinner({
        gameId,
        username: currentUser.username,
        score: playerScoreValue,
        roundsWon: playerScoreValue,
        durationMs,
      });

      if (!finished) {
        setMessage('Sunucu sonucu henüz kesinleştirmedi. Lobiye dönüp birkaç saniye sonra tekrar kontrol et.');
        finishHandledRef.current = true;
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
      finishHandledRef.current = true;
      setTimeout(() => onGameEnd(resolvedWinner, points), 900);
    } catch {
      setMessage('Bağlantı sorunu: sonuç sunucudan doğrulanamadı.');
      finishHandledRef.current = true;
      setTimeout(() => onGameEnd('Sonuç Bekleniyor', 0), 900);
    } finally {
      setResolvingMatch(false);
    }
  };

  const fire = () => {
    if (done || resolvingMatch || roundLocked) return;
    setRoundLocked(true);

    const shot = clampGauge(gauge);
    const gainedPoints = pointsFromShot(shot);
    const nextPlayerScore = playerScore + gainedPoints;
    let nextOpponentScore = opponentScore;

    setPlayerShot(shot);
    setPlayerScore(nextPlayerScore);
    playGameSfx(gainedPoints > 0 ? 'success' : 'fail', gainedPoints > 0 ? 0.24 : 0.2);

    if (isBot) {
      const botShot = clampGauge(50 + (Math.random() * 2 - 1) * 42);
      const botPoints = pointsFromShot(botShot);
      nextOpponentScore += botPoints;
      setOpponentShot(botShot);
      setOpponentScore(nextOpponentScore);
      setMessage(`Atışın: ${shotLabel(shot)} (${gainedPoints} puan). BOT: ${shotLabel(botShot)} (${botPoints} puan).`);
    } else {
      setMessage(`Atışın: ${shotLabel(shot)} (${gainedPoints} puan). Rakip güncellemesi bekleniyor...`);
    }

    const isLastRound = round >= MAX_ROUNDS;
    void syncLiveProgress(nextPlayerScore, round, isLastRound);

    if (isLastRound) {
      setDone(true);
      const localWinner = isBot
        ? (nextPlayerScore >= nextOpponentScore ? currentUser.username : 'BOT')
        : currentUser.username;
      void finalizeMatch(localWinner, nextPlayerScore);
      return;
    }

    nextRoundTimeoutRef.current = window.setTimeout(() => {
      setRound((prev) => prev + 1);
      setMessage('Yeni tur başladı. Merkezi vurmak için doğru anı yakala.');
      playGameSfx('select', 0.18);
    }, 750);
  };

  const gaugeMarkerLeft = `${gauge}%`;
  const canFire = !done && !resolvingMatch && !roundLocked;

  return (
    <div
      className="max-w-2xl mx-auto rf-panel rf-elevated border-cyan-400/22 rounded-xl p-6 text-white relative overflow-hidden"
      data-testid="arena-battle"
      style={{
        backgroundImage: `linear-gradient(165deg, rgba(4, 17, 41, 0.92), rgba(2, 28, 52, 0.9)), url('${GAME_ASSETS.backgrounds.rhythmCopy}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_96%,rgba(34,211,238,0.08)_100%)] [background-size:100%_4px] opacity-50" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-pixel text-lg">Tank Düellosu</h2>
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

      <div className="rounded-xl border border-cyan-400/25 bg-[#08152f]/85 p-4 mb-4">
        <div className="flex items-center justify-between text-xs text-[var(--rf-muted)] mb-2">
          <span>Nişan Çubuğu</span>
          <span>{Math.round(gauge)}%</span>
        </div>
        <div className="relative h-8 rounded-full border border-cyan-400/20 bg-[#061329] overflow-hidden">
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-7 bg-emerald-400/25 border-x border-emerald-300/45" />
          <div className="absolute inset-y-0 left-[calc(50%-18px)] w-9 border-x border-cyan-300/30" />
          <div
            className="absolute top-0 h-full w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.7)]"
            style={{ left: `calc(${gaugeMarkerLeft} - 4px)` }}
          />
        </div>
        <div className="mt-2 text-xs text-[var(--rf-muted)]">
          Merkez (50) çevresine ne kadar yakın vurursan o kadar fazla puan alırsın.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
        <div className="rounded-lg border border-cyan-400/20 bg-[#081733]/75 p-3">
          <div className="text-[var(--rf-muted)] mb-1">Son Atışın</div>
          <div className="font-semibold">{playerShot === null ? '-' : `${Math.round(playerShot)}%`}</div>
        </div>
        <div className="rounded-lg border border-cyan-400/20 bg-[#081733]/75 p-3">
          <div className="text-[var(--rf-muted)] mb-1">Rakip Atışı</div>
          <div className="font-semibold">{opponentShot === null ? '-' : `${Math.round(opponentShot)}%`}</div>
        </div>
      </div>

      <div className="flex gap-3">
        <RetroButton onClick={fire} disabled={!canFire} data-testid="tank-fire-button">
          ATEŞ ET
        </RetroButton>
        {done && (
          <RetroButton onClick={onLeave} variant="secondary">
            Lobiye Dön
          </RetroButton>
        )}
      </div>
    </div>
  );
};
