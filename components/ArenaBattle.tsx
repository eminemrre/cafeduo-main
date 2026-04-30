import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, RadioTower, Target, Trophy } from 'lucide-react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { api } from '../lib/api';
import { submitScoreAndWaitForWinner } from '../lib/multiplayer';
import { playGameSfx } from '../lib/gameAudio';
import { socketService } from '../lib/socket';
import { ConnectionOverlay } from './ConnectionOverlay';

interface ArenaBattleProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number) => void;
  onLeave: () => void;
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

interface ArenaWindow extends Window {
  render_game_to_text?: () => string;
}

export const AIM_GAME_TYPE = 'Nişancı Düellosu';
const MAX_ROUNDS = 5;
const GAUGE_STEP = 4;
const GAUGE_TICK_MS = 46;

export const clampGauge = (value: number) => Math.max(0, Math.min(100, value));

export const pointsFromShot = (shot: number): number => {
  const distance = Math.abs(50 - clampGauge(shot));
  if (distance <= 4) return 3;
  if (distance <= 10) return 2;
  if (distance <= 18) return 1;
  return 0;
};

export const shotLabel = (shot: number): string => {
  const points = pointsFromShot(shot);
  if (points === 3) return 'Mükemmel kilit';
  if (points === 2) return 'Temiz isabet';
  if (points === 1) return 'Sınırda temas';
  return 'Iska';
};

const randomGaugeStart = () => 15 + Math.random() * 70;
const normalizeName = (value: unknown) => String(value || '').trim();

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
  const [message, setMessage] = useState('Nişangah merkezden geçerken ateş et.');
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
    const actor = normalizeName(currentUser.username).toLowerCase();
    const host = normalizeName(snapshot.hostName);
    const guest = normalizeName(snapshot.guestName);
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
    const winner = normalizeName(winnerRaw) || 'Berabere';
    const points = winner.toLowerCase() === normalizeName(currentUser.username).toLowerCase() ? 10 : 0;
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
      normalizeName(snapshot.gameState?.resolvedWinner || snapshot.gameState?.live?.resolvedWinner || snapshot.winner) || null;
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
          mode: AIM_GAME_TYPE,
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
    setMessage('Nişangah merkezden geçerken ateş et.');
  }, [gameId]);

  useEffect(() => {
    setRoundLocked(false);
    setPlayerShot(null);
    setOpponentShot(null);
    directionRef.current = Math.random() > 0.5 ? 1 : -1;
    setGauge(randomGaugeStart());
  }, [round]);

  useEffect(() => {
    if (done || resolvingMatch) return undefined;
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

    return () => window.clearInterval(interval);
  }, [done, resolvingMatch, round]);

  useEffect(() => {
    if (isBot || !gameId) return undefined;
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
      if (document.visibilityState === 'hidden' || done) return;
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
    const arenaWindow = window as ArenaWindow;
    const renderGameToText = () => JSON.stringify({
      mode: done ? 'finished' : 'playing',
      gameType: AIM_GAME_TYPE,
      round,
      maxRounds: MAX_ROUNDS,
      player: {
        name: currentUser.username,
        score: playerScore,
        lastShot: playerShot,
      },
      opponent: {
        name: target,
        score: opponentScore,
        lastShot: opponentShot,
      },
      gauge: Math.round(gauge),
      message,
    });
    arenaWindow.render_game_to_text = renderGameToText;
    return () => {
      if (arenaWindow.render_game_to_text === renderGameToText) {
        delete arenaWindow.render_game_to_text;
      }
    };
  }, [currentUser.username, done, gauge, message, opponentScore, opponentShot, playerScore, playerShot, round, target]);

  useEffect(() => () => {
    if (nextRoundTimeoutRef.current) {
      window.clearTimeout(nextRoundTimeoutRef.current);
    }
  }, []);

  const finalizeMatch = async (localWinner: string, playerScoreValue: number) => {
    if (finishHandledRef.current) return;
    if (isBot || !gameId) {
      const points = localWinner === currentUser.username ? 10 : 0;
      finishHandledRef.current = true;
      window.setTimeout(() => onGameEnd(localWinner, points), 900);
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
        window.setTimeout(() => onGameEnd('Sonuç Bekleniyor', 0), 900);
        return;
      }

      const resolvedWinner = winner || 'Berabere';
      const points = winner && winner === currentUser.username ? 10 : 0;
      setMessage(!winner ? 'Maç berabere tamamlandı.' : points > 0 ? 'Maçı kazandın.' : 'Maçı rakip aldı.');
      finishHandledRef.current = true;
      window.setTimeout(() => onGameEnd(resolvedWinner, points), 900);
    } catch {
      setMessage('Bağlantı sorunu: sonuç sunucudan doğrulanamadı.');
      finishHandledRef.current = true;
      window.setTimeout(() => onGameEnd('Sonuç Bekleniyor', 0), 900);
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
      setMessage(`Atışın: ${shotLabel(shot)} (${gainedPoints}). BOT: ${shotLabel(botShot)} (${botPoints}).`);
    } else {
      setMessage(`Atışın: ${shotLabel(shot)} (${gainedPoints}). Rakip güncellemesi bekleniyor...`);
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
      setMessage('Yeni tur başladı. Merkezi yakalamak için doğru anı bekle.');
      playGameSfx('select', 0.18);
    }, 750);
  };

  const canFire = !done && !resolvingMatch && !roundLocked;
  const accuracy = Math.max(0, 100 - Math.abs(50 - gauge) * 2);
  const participants = hostName || guestName ? `${hostName || currentUser.username} / ${guestName || target}` : `${currentUser.username} / ${target}`;

  return (
    <div
      className="cd-game-stage cd-pixel-panel mx-auto max-w-3xl p-4 sm:p-6 text-white"
      data-testid="arena-battle"
    >
      <ConnectionOverlay gameId={gameId} />
      <div className="relative z-10">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-[rgba(16,231,255,0.2)] pb-4">
          <div>
            <p className="cd-system-label text-[#10E7FF]">LIVE TARGET LOCK</p>
            <h2 className="font-display text-2xl text-white sm:text-4xl">{AIM_GAME_TYPE}</h2>
            <p className="mt-2 text-xs text-[#A5ADB8] sm:text-sm">{participants}</p>
          </div>
          <button onClick={onLeave} className="cd-icon-button text-[#A5ADB8] hover:text-white">
            Oyundan Çık
          </button>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3 text-center">
          <div className="cd-stat-tile">
            <Target size={18} />
            <span>Tur</span>
            <strong>{Math.min(round, MAX_ROUNDS)} / {MAX_ROUNDS}</strong>
          </div>
          <div className="cd-stat-tile border-[#10E7FF]/45">
            <Trophy size={18} />
            <span>Sen</span>
            <strong>{playerScore}</strong>
          </div>
          <div className="cd-stat-tile border-[#FF3045]/45">
            <RadioTower size={18} />
            <span>Rakip</span>
            <strong>{opponentScore}</strong>
          </div>
        </div>

        <div className="cd-reticle-stage mb-5">
          <div className="cd-reticle-grid" />
          <div className="cd-reticle-center" />
          <div
            className="cd-reticle-sight"
            style={{ left: `${gauge}%` }}
            data-testid="arena-reticle"
          >
            <Crosshair size={42} />
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-[#A5ADB8]">
            <span>0</span>
            <span className="text-[#39FF6A]">MERKEZ 50</span>
            <span>100</span>
          </div>
        </div>

        <div className="mb-5 cd-pixel-panel-muted p-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="cd-system-label text-[#10E7FF]">Nişan Kilidi</span>
            <span className="text-[#FFD338]">{Math.round(gauge)}% / isabet {Math.round(accuracy)}%</span>
          </div>
          <div className="cd-progress-track">
            <div className="cd-progress-fill" style={{ width: `${accuracy}%` }} />
          </div>
          <p className="mt-3 text-sm text-[#A5ADB8]">{message}</p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 text-xs">
          <div className="cd-pixel-panel-muted p-3">
            <div className="text-[#A5ADB8]">Son Atışın</div>
            <div className="mt-1 font-bold text-white">{playerShot === null ? '-' : `${Math.round(playerShot)}% - ${shotLabel(playerShot)}`}</div>
          </div>
          <div className="cd-pixel-panel-muted p-3">
            <div className="text-[#A5ADB8]">Rakip Atışı</div>
            <div className="mt-1 font-bold text-white">{opponentShot === null ? '-' : `${Math.round(opponentShot)}% - ${shotLabel(opponentShot)}`}</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <RetroButton onClick={fire} disabled={!canFire} data-testid="arena-fire-button" className="flex-1">
            ATEŞ ET
          </RetroButton>
          {done && (
            <RetroButton onClick={onLeave} variant="secondary" className="flex-1">
              Lobiye Dön
            </RetroButton>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArenaBattle;
