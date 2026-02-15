import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { api } from '../lib/api';
import { submitScoreAndWaitForWinner } from '../lib/multiplayer';
import { GAME_ASSETS } from '../lib/gameAssets';
import { playGameSfx } from '../lib/gameAudio';
import { socketService } from '../lib/socket';

interface ReflexRushProps {
  currentUser: User;
  isBot: boolean;
  gameId?: string;
  opponentName?: string;
  onGameEnd: (winner: string, points: number) => void;
  onLeave: () => void;
}

type Phase = 'ready' | 'wait' | 'go' | 'result' | 'done';

const MAX_ROUNDS = 3;
const REACTION_POINT_THRESHOLD_MS = 480;

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

export const ReflexRush: React.FC<ReflexRushProps> = ({
  currentUser,
  isBot,
  gameId,
  opponentName,
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
  const [hostName, setHostName] = useState('');
  const [guestName, setGuestName] = useState('');
  const isDone = phase === 'done';

  const roundStartRef = useRef<number>(0);
  const goTimerRef = useRef<number | null>(null);
  const matchStartedAtRef = useRef<number>(Date.now());
  const pollRef = useRef<number | null>(null);
  const finishHandledRef = useRef(false);

  const targetName = useMemo(() => {
    if (isBot) return 'BOT';
    const host = String(hostName || '').trim();
    const guest = String(guestName || '').trim();
    const actor = String(currentUser.username || '').trim().toLowerCase();
    if (host && host.toLowerCase() !== actor) return host;
    if (guest && guest.toLowerCase() !== actor) return guest;
    return opponentName || 'Rakip';
  }, [currentUser.username, guestName, hostName, isBot, opponentName]);

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
    setPhase('done');
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
      setPlayerWins((prev) => Math.max(prev, Number(actorLive.score)));
    }
    if (typeof opponentLive?.score === 'number') {
      setOpponentWins((prev) => Math.max(prev, Number(opponentLive.score)));
    }
    if (typeof actorLive?.round === 'number') {
      const completedRound = Math.max(1, Math.floor(Number(actorLive.round)));
      setRound((prev) => Math.max(prev, Math.min(MAX_ROUNDS, completedRound + 1)));
    }

    const winner =
      String(snapshot.gameState?.resolvedWinner || snapshot.gameState?.live?.resolvedWinner || snapshot.winner || '').trim() || null;
    const bothDone = Boolean(actorLive?.done) && Boolean(opponentLive?.done);
    if (String(snapshot.status || '').toLowerCase() === 'finished' || (winner && bothDone)) {
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
      console.error('ReflexRush snapshot error', err);
    }
  }, [applySnapshot, gameId, isBot, targetName]);

  const syncLiveProgress = useCallback(async (score: number, currentRound: number, isDoneRound: boolean) => {
    if (isBot || !gameId) return;
    try {
      await api.games.move(gameId, {
        liveSubmission: {
          mode: 'Refleks Avı',
          score,
          roundsWon: score,
          round: currentRound,
          done: isDoneRound,
          submissionKey: `reflex|${String(gameId)}|${currentUser.username}|${currentRound}|${score}|${isDoneRound ? 1 : 0}`,
        },
      });
    } catch (err) {
      console.error('ReflexRush live submission failed', err);
    }
  }, [currentUser.username, gameId, isBot]);

  useEffect(() => {
    return () => {
      if (goTimerRef.current) {
        window.clearTimeout(goTimerRef.current);
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
      if (isDone) return;
      void fetchSnapshot(true);
    }, 2200);
    return () => {
      socket.off('game_state_updated', onRealtime);
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, [fetchSnapshot, gameId, isBot, isDone]);

  const beginRound = () => {
    if (resolvingMatch) return;
    if (phase !== 'ready' && phase !== 'result') return;
    playGameSfx('select', 0.22);
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
      playGameSfx('hit', 0.25);
    }, delay);
  };

  const finishRound = (playerMs: number, opponentMs: number | null, early = false) => {
    const playerWon = isBot
      ? (!early && playerMs < Number(opponentMs || 9999))
      : (!early && playerMs <= REACTION_POINT_THRESHOLD_MS);
    const nextPlayerWins = playerWins + (playerWon ? 1 : 0);
    const nextOpponentWins = isBot
      ? opponentWins + (playerWon ? 0 : 1)
      : opponentWins;

    setPlayerWins(nextPlayerWins);
    setOpponentWins(nextOpponentWins);
    setLastPlayerMs(playerMs);
    setLastOpponentMs(opponentMs);
    setPhase('result');

    if (early && isBot) {
      setMessage('Erken tıkladın! Tur rakibe yazıldı.');
      playGameSfx('fail', 0.28);
    } else if (early && !isBot) {
      setMessage('Erken tıkladın. Bu tur puan alamadın.');
      playGameSfx('fail', 0.28);
    } else if (playerWon && isBot) {
      setMessage('Turu kazandın.');
      playGameSfx('success', 0.3);
    } else if (playerWon && !isBot) {
      setMessage('Hızlı tepki! Tur puanını aldın.');
      playGameSfx('success', 0.28);
    } else if (isBot) {
      setMessage('Rakip daha hızlı.');
      playGameSfx('fail', 0.24);
    } else {
      setMessage('Biraz geç kaldın. Rakibin sonucunu bekle.');
      playGameSfx('fail', 0.24);
    }

    const isLastRound = round >= MAX_ROUNDS;
    void syncLiveProgress(nextPlayerWins, round, isLastRound);
    if (!isLastRound) {
      setRound(prev => prev + 1);
      return;
    }

    setPhase('done');
    const localWinner = isBot
      ? (nextPlayerWins >= nextOpponentWins ? currentUser.username : 'BOT')
      : currentUser.username;
    void finalizeMatch(localWinner, nextPlayerWins);
  };

  const finalizeMatch = async (localWinner: string, playerRoundsWon: number) => {
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
        score: playerRoundsWon,
        roundsWon: playerRoundsWon,
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

  const handleTap = () => {
    if (resolvingMatch) return;
    if (phase === 'wait') {
      finishRound(9999, 300, true);
      return;
    }
    if (phase !== 'go') return;

    const playerMs = Math.max(1, Math.floor(performance.now() - roundStartRef.current));
    const opponentMs = isBot ? 220 + Math.floor(Math.random() * 320) : null;
    finishRound(playerMs, opponentMs);
  };

  return (
    <div
      className="max-w-2xl mx-auto rf-panel rf-elevated border-cyan-400/22 rounded-xl p-6 text-white relative overflow-hidden"
      data-testid="reflex-rush"
      style={{
        backgroundImage: `linear-gradient(165deg, rgba(3, 18, 44, 0.92), rgba(4, 28, 56, 0.9)), url('${GAME_ASSETS.backgrounds.reflexRush}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_96%,rgba(34,211,238,0.08)_100%)] [background-size:100%_4px] opacity-50" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-pixel text-lg">Refleks Avı</h2>
        <button onClick={onLeave} className="text-[var(--rf-muted)] hover:text-white text-sm">Oyundan Çık</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5 text-center">
        <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
          <div className="text-xs text-[var(--rf-muted)] flex items-center justify-center gap-1">
            <img src={GAME_ASSETS.hud.jewel} alt="" className="w-4 h-4" aria-hidden="true" />
            Tur
          </div>
          <div className="font-bold">{Math.min(round, MAX_ROUNDS)} / {MAX_ROUNDS}</div>
        </div>
        <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
          <div className="text-xs text-[var(--rf-muted)] flex items-center justify-center gap-1">
            <img src={GAME_ASSETS.hud.heart} alt="" className="w-4 h-4" aria-hidden="true" />
            Sen
          </div>
          <div className="font-bold">{playerWins}</div>
        </div>
        <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
          <div className="text-xs text-[var(--rf-muted)] flex items-center justify-center gap-1">
            <img src={GAME_ASSETS.hud.coin} alt="" className="w-4 h-4" aria-hidden="true" />
            Rakip
          </div>
          <div className="font-bold">{opponentWins}</div>
        </div>
      </div>

      <p className="text-sm text-[var(--rf-muted)] mb-4">{message}</p>

      <button
        onClick={handleTap}
        data-testid="reflex-target"
        disabled={resolvingMatch}
        className={`w-full h-40 rounded-xl border-2 transition ${
          phase === 'go'
            ? 'bg-green-500/30 border-green-400'
            : phase === 'wait'
              ? 'bg-amber-500/20 border-amber-400'
              : 'bg-[#08152f] border-cyan-400/22'
        }`}
      >
        {phase === 'go' ? 'TIKLA!' : phase === 'wait' ? 'BEKLE' : 'HEDEF'}
      </button>

      {(lastPlayerMs !== null || lastOpponentMs !== null) && (
        <div className="mt-4 text-sm text-[var(--rf-muted)]">
          <div>Son tur süreleri:</div>
          <div>Sen: {lastPlayerMs}ms</div>
          <div>Rakip: {isBot ? `${lastOpponentMs}ms` : `${targetName} canlı turu bekleniyor`}</div>
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
