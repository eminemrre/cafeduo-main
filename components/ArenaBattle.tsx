import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';
import type { User } from '../types';
import { RetroButton } from './RetroButton';
import { playGameSfx } from '../lib/gameAudio';
import { ConnectionOverlay } from './ConnectionOverlay';
import { useLiveScoreGame, type LiveMatchStats } from '../hooks/useLiveScoreGame';
import { AimBattleStageCanvas, type AimBattleStageHandle } from './games/AimBattleStageCanvas';
import type { HitTier } from '../lib/pixi/aimBattleStage';
import { positionAt, pointsFromDistance, AIM_GAUGE_STEP, AIM_TICK_MS } from '../lib/aimTrajectory';

interface ArenaBattleProps {
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

interface ArenaWindow extends Window {
  render_game_to_text?: () => string;
}

export const AIM_GAME_TYPE = 'Nişancı Düellosu';
export const MAX_ROUNDS = 5;
const BOT_WIN_REWARD = 10;

export const clampGauge = (value: number) => Math.max(0, Math.min(100, value));

/** The same zones the server scores with (`shared/aimTrajectory.js`). */
export const pointsFromShot = (shot: number): number => pointsFromDistance(50 - clampGauge(shot));

export const shotLabel = (shot: number): string => {
  const points = pointsFromShot(shot);
  if (points === 3) return 'Mükemmel kilit';
  if (points === 2) return 'Temiz isabet';
  if (points === 1) return 'Sınırda temas';
  return 'Iska';
};

const tierFromPoints = (points: number): HitTier => {
  if (points >= 3) return 'hit3';
  if (points === 2) return 'hit2';
  if (points === 1) return 'hit1';
  return 'miss';
};

const randomGaugeStart = () => 15 + Math.random() * 70;

interface BotState {
  round: number;
  phase: 'open' | 'reveal' | 'finished';
  gauge: number;
  direction: 1 | -1;
  playerShot: number | null;
  opponentShot: number | null;
  playerScore: number;
  opponentScore: number;
  message: string;
}

const createBotState = (): BotState => ({
  round: 1,
  phase: 'open',
  gauge: randomGaugeStart(),
  direction: Math.random() > 0.5 ? 1 : -1,
  playerShot: null,
  opponentShot: null,
  playerScore: 0,
  opponentScore: 0,
  message: 'Nişangah merkezden geçerken ateş et.',
});

export const ArenaBattle: React.FC<ArenaBattleProps> = ({
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
    mode: AIM_GAME_TYPE,
    submissionKeyPrefix: 'arena',
    pollIntervalMs: 15_000,
    logName: 'ArenaBattle',
    statsKind: 'arena',
    onGameEnd,
  });

  const liveEngine = live.engine;
  const livePending = live.pending;
  const liveServerNow = live.serverNow;
  const submitLiveAction = live.submitAction;

  const [bot, setBot] = useState<BotState>(() => createBotState());
  const [serverGauge, setServerGauge] = useState(50);
  const [optimisticShot, setOptimisticShot] = useState<number | null>(null);
  const [feedbackKey, setFeedbackKey] = useState('');
  const pixiStageRef = useRef<AimBattleStageHandle | null>(null);
  const botDoneRef = useRef(false);
  const botStartedAtRef = useRef(Date.now());
  const onGameEndRef = useRef(onGameEnd);
  const onMatchSettledRef = useRef(onMatchSettled);
  const [pixiReady, setPixiReady] = useState(false);

  useEffect(() => {
    onGameEndRef.current = onGameEnd;
  }, [onGameEnd]);

  useEffect(() => {
    onMatchSettledRef.current = onMatchSettled;
  }, [onMatchSettled]);

  useEffect(() => {
    setBot(createBotState());
    setOptimisticShot(null);
    setFeedbackKey('');
    botDoneRef.current = false;
    botStartedAtRef.current = Date.now();
  }, [gameId]);

  const phase = isBot ? bot.phase : liveEngine?.phase || 'open';
  const done = isBot ? bot.phase === 'finished' : live.done;
  const loading = !isBot && !liveEngine && !live.protocolError;
  const round = isBot ? bot.round : Math.max(1, liveEngine?.roundIndex || 1);
  const maxRounds = isBot ? MAX_ROUNDS : liveEngine?.totalRounds || MAX_ROUNDS;
  const serverRound = isBot ? null : liveEngine?.round || null;
  const actorShot = !isBot && live.actorKey ? (serverRound?.shots?.[live.actorKey] ?? null) : null;
  const opponentShotData =
    !isBot && live.actorKey
      ? (serverRound?.shots?.[live.actorKey === 'host' ? 'guest' : 'host'] ?? null)
      : null;
  const isReveal = phase === 'reveal' || (phase === 'finished' && Boolean(serverRound));
  const gauge = isBot ? bot.gauge : isReveal ? (actorShot?.position ?? serverGauge) : serverGauge;
  const playerShot = isBot
    ? bot.playerShot
    : isReveal
      ? (actorShot?.position ?? null)
      : optimisticShot;
  const opponentShot = isBot
    ? bot.opponentShot
    : isReveal
      ? (opponentShotData?.position ?? null)
      : null;
  const playerScore = isBot ? bot.playerScore : live.playerScore;
  const opponentScore = isBot ? bot.opponentScore : live.opponentScore;
  const target = isBot ? 'BOT' : live.opponent?.name || opponentName || 'Rakip';
  const targetName = target;
  const hasFired = isBot
    ? bot.playerShot !== null
    : Boolean(live.player?.answered) || optimisticShot !== null;

  // Bot practice keeps the same 4 / 46 ms competitive speed on every device.
  useEffect(() => {
    if (!isBot || bot.phase !== 'open') return undefined;
    const interval = window.setInterval(() => {
      setBot((prev) => {
        if (prev.phase !== 'open') return prev;
        let next = prev.gauge + prev.direction * AIM_GAUGE_STEP;
        let direction = prev.direction;
        if (next >= 100) {
          next = 100;
          direction = -1;
        } else if (next <= 0) {
          next = 0;
          direction = 1;
        }
        return { ...prev, gauge: next, direction };
      });
    }, AIM_TICK_MS);
    return () => window.clearInterval(interval);
  }, [bot.phase, isBot]);

  // Server reticle: the shared trajectory function and the server clock, never
  // a locally invented gauge or a per-device difficulty.
  useEffect(() => {
    if (isBot || phase !== 'open' || !serverRound?.trajectory || !serverRound.startedAt) {
      return undefined;
    }
    const startedAt = Date.parse(serverRound.startedAt);
    const trajectory = serverRound.trajectory;
    const tick = () => {
      const elapsed = Math.max(0, liveServerNow() - startedAt);
      setServerGauge(positionAt(trajectory, elapsed));
    };
    tick();
    const interval = window.setInterval(tick, AIM_TICK_MS);
    return () => window.clearInterval(interval);
  }, [
    isBot,
    liveServerNow,
    phase,
    serverRound?.id,
    serverRound?.startedAt,
    serverRound?.trajectory,
  ]);

  useEffect(() => {
    setOptimisticShot(null);
  }, [isBot, serverRound?.id]);

  useEffect(() => {
    pixiStageRef.current?.setReticleX(gauge);
  }, [gauge]);

  useEffect(() => {
    pixiStageRef.current?.setActive(!done);
  }, [done]);

  // Bot reveal pacing.
  useEffect(() => {
    if (!isBot || bot.phase !== 'reveal') return undefined;
    const timer = window.setTimeout(() => {
      setBot((prev) =>
        prev.round >= MAX_ROUNDS
          ? {
              ...prev,
              phase: 'finished',
              message: prev.playerScore >= prev.opponentScore ? 'Maçı kazandın.' : 'Maçı BOT aldı.',
            }
          : {
              ...prev,
              round: prev.round + 1,
              phase: 'open',
              gauge: randomGaugeStart(),
              direction: Math.random() > 0.5 ? 1 : -1,
              playerShot: null,
              opponentShot: null,
              message: 'Yeni tur başladı. Merkezi yakalamak için doğru anı bekle.',
            }
      );
    }, 750);
    return () => window.clearTimeout(timer);
  }, [bot.phase, bot.round, isBot]);

  // Bot feedback is local practice only; no wallet or stats are written here.
  useEffect(() => {
    if (!isBot || bot.phase !== 'reveal' || bot.playerShot === null) return;
    const key = `bot:${bot.round}`;
    if (feedbackKey === key) return;
    setFeedbackKey(key);
    const points = pointsFromShot(bot.playerShot);
    const tier = tierFromPoints(points);
    pixiStageRef.current?.flash(tier);
    pixiStageRef.current?.showScorePopup(
      points > 0 ? `+${points} ${shotLabel(bot.playerShot)}` : shotLabel(bot.playerShot),
      tier
    );
    playGameSfx(points > 0 ? 'success' : 'fail', points > 0 ? 0.24 : 0.2);
  }, [bot.phase, bot.playerShot, bot.round, feedbackKey, isBot]);

  useEffect(() => {
    if (!isBot || bot.phase !== 'finished' || botDoneRef.current) return undefined;
    botDoneRef.current = true;
    const won = bot.playerScore >= bot.opponentScore;
    const stats: LiveMatchStats = {
      kind: 'arena',
      playerScore: bot.playerScore,
      opponentScore: bot.opponentScore,
      durationMs: Math.max(0, Date.now() - botStartedAtRef.current),
      maxRounds: MAX_ROUNDS,
    };
    const timer = window.setTimeout(() => {
      onGameEndRef.current(won ? currentUser.username : 'BOT', won ? BOT_WIN_REWARD : 0, stats);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [bot.opponentScore, bot.phase, bot.playerScore, currentUser.username, isBot]);

  // Server feedback comes only from the revealed snapshot.
  useEffect(() => {
    if (isBot || phase !== 'reveal' || !serverRound || !live.actorKey) return;
    const key = `server:${liveEngine?.revision}:${serverRound.id}`;
    if (feedbackKey === key) return;
    setFeedbackKey(key);
    const shot = actorShot?.position;
    if (shot === undefined || shot === null) {
      playGameSfx('fail', 0.2);
      return;
    }
    const points = Number(actorShot?.points || 0);
    const tier = tierFromPoints(points);
    pixiStageRef.current?.flash(tier);
    pixiStageRef.current?.showScorePopup(
      points > 0 ? `+${points} ${shotLabel(shot)}` : shotLabel(shot),
      tier
    );
    playGameSfx(points > 0 ? 'success' : 'fail', points > 0 ? 0.24 : 0.2);
  }, [
    actorShot?.points,
    actorShot?.position,
    feedbackKey,
    isBot,
    live.actorKey,
    liveEngine?.revision,
    phase,
    serverRound,
  ]);

  useEffect(() => {
    const finished = isBot ? bot.phase === 'finished' : live.done;
    if (finished) onMatchSettledRef.current?.();
  }, [bot.phase, isBot, live.done]);

  const fire = useCallback(() => {
    if (phase !== 'open' || hasFired || done || livePending) return;
    if (isBot) {
      const shot = clampGauge(bot.gauge);
      const gainedPoints = pointsFromShot(shot);
      const botShot = clampGauge(50 + (Math.random() * 2 - 1) * 42);
      const botPoints = pointsFromShot(botShot);
      const nextPlayerScore = bot.playerScore + gainedPoints;
      const nextOpponentScore = bot.opponentScore + botPoints;
      setBot((prev) => ({
        ...prev,
        phase: 'reveal',
        playerShot: shot,
        opponentShot: botShot,
        playerScore: nextPlayerScore,
        opponentScore: nextOpponentScore,
        message: `Atışın: ${shotLabel(shot)} (${gainedPoints}). BOT: ${shotLabel(botShot)} (${botPoints}).`,
      }));
      return;
    }
    const shot = clampGauge(gauge);
    setOptimisticShot(shot);
    void submitLiveAction({ type: 'fire' }).then((result) => {
      if (!result.ok && result.code !== 'BUSY') setOptimisticShot(null);
    });
  }, [
    bot.gauge,
    bot.opponentScore,
    bot.playerScore,
    done,
    gauge,
    hasFired,
    isBot,
    livePending,
    submitLiveAction,
    phase,
  ]);

  const accuracy = Math.max(0, 100 - Math.abs(50 - gauge) * 2);
  const participants =
    live.hostName || live.guestName
      ? `${live.hostName || currentUser.username} / ${live.guestName || targetName}`
      : `${currentUser.username} / ${targetName}`;

  const message = useMemo(() => {
    if (isBot) return bot.message;
    if (live.protocolError) return live.error || 'İstemci güncel değil.';
    if (loading) return 'Sunucu turu hazırlıyor...';
    if (livePending) return 'Atışın sunucuya gönderiliyor...';
    if (live.error) return live.error;
    if (done) {
      const result = liveEngine?.result;
      if (result?.cancelled) return 'Maç ödülsüz iptal edildi.';
      if (!result?.winner) return 'Maç berabere bitti.';
      return result.winner === currentUser.username
        ? 'Maçı kazandın.'
        : `Maçı ${result.winner} aldı.`;
    }
    if (phase === 'open') {
      return hasFired
        ? 'Atışın kaydedildi. Rakip bekleniyor...'
        : 'Nişangah merkezden geçerken ateş et.';
    }
    if (phase === 'reveal') {
      const my = actorShot?.position;
      const other = opponentShotData?.position;
      const myPoints = Number(actorShot?.points || 0);
      const otherPoints = Number(opponentShotData?.points || 0);
      if (my === undefined || my === null) {
        return other === undefined || other === null
          ? 'İki taraf da ateş etmedi. Sunucu turu kapatıyor...'
          : `Atış yapmadın. Rakip: ${shotLabel(other)} (${otherPoints}).`;
      }
      return other === undefined || other === null
        ? `Atışın: ${shotLabel(my)} (${myPoints}). Rakip ateş etmedi.`
        : `Atışın: ${shotLabel(my)} (${myPoints}). Rakip: ${shotLabel(other)} (${otherPoints}).`;
    }
    return 'Sunucu sonucu bekleniyor...';
  }, [
    actorShot?.points,
    actorShot?.position,
    bot.message,
    currentUser.username,
    done,
    hasFired,
    isBot,
    liveEngine?.result,
    live.error,
    livePending,
    live.protocolError,
    loading,
    opponentShotData?.points,
    opponentShotData?.position,
    phase,
  ]);

  useEffect(() => {
    const arenaWindow = window as ArenaWindow;
    const renderGameToText = () =>
      JSON.stringify({
        mode: done ? 'finished' : 'playing',
        gameType: AIM_GAME_TYPE,
        round,
        maxRounds,
        player: { name: currentUser.username, score: playerScore, lastShot: playerShot },
        opponent: { name: targetName, score: opponentScore, lastShot: opponentShot },
        gauge: Math.round(gauge),
        message,
      });
    arenaWindow.render_game_to_text = renderGameToText;
    return () => {
      if (arenaWindow.render_game_to_text === renderGameToText) {
        delete arenaWindow.render_game_to_text;
      }
    };
  }, [
    currentUser.username,
    done,
    gauge,
    maxRounds,
    message,
    opponentShot,
    opponentScore,
    playerScore,
    playerShot,
    round,
    targetName,
  ]);

  const canFire = phase === 'open' && !hasFired && !livePending && !done && !loading;

  if (live.protocolError) {
    return (
      <div className="mx-auto max-w-3xl text-carbon" data-testid="arena-battle">
        <ConnectionOverlay gameId={gameId} />
        <header className="duo-game-head mb-6">
          <div className="min-w-0">
            <span className="duo-game-chip bg-candy-lokum">{AIM_GAME_TYPE}</span>
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
    );
  }

  return (
    <div
      className="mx-auto max-w-3xl text-carbon"
      data-testid="arena-battle"
      aria-busy={loading || livePending}
    >
      <ConnectionOverlay gameId={gameId} />
      <header className="duo-game-head mb-6">
        <div className="min-w-0">
          <span className="duo-game-chip bg-candy-lokum">{maxRounds} tur</span>
          {!isBot && phase === 'open' && (
            <span className="duo-game-chip ml-2 bg-paper-deep">{live.secondsLeft} sn</span>
          )}
          <h2 className="duo-game-title">{AIM_GAME_TYPE}</h2>
          <p className="duo-game-sub truncate">{participants}</p>
        </div>
        <button type="button" onClick={onLeave} className="duo-quiet duo-focus shrink-0">
          Oyundan çık
        </button>
      </header>

      <div className="mb-5 grid grid-cols-3 gap-2">
        <div className="duo-stat">
          <span className="duo-stat-label">Tur</span>
          <span className="duo-stat-value">
            {Math.min(round, maxRounds)} / {maxRounds}
          </span>
        </div>
        <div className="duo-stat duo-stat--lokum">
          <span className="duo-stat-label">Sen</span>
          <span className="duo-stat-value duo-stat-value--score">{playerScore}</span>
        </div>
        <div className="duo-stat">
          <span className="duo-stat-label">Rakip</span>
          <span className="duo-stat-value duo-stat-value--score">{opponentScore}</span>
        </div>
      </div>

      <div className="relative mb-5 aspect-[2/1] overflow-hidden bg-paper-deep">
        {/* PixiJS WebGL overlay — fills the stage, renders animated reticle + hit effects */}
        <AimBattleStageCanvas
          ref={pixiStageRef}
          onReadyChange={setPixiReady}
          className="absolute inset-0 h-full w-full"
        />
        {!pixiReady && (
          <>
            {/* Without the WebGL stage: the centre line and the reticle, drawn in CSS. */}
            <span
              className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-carbon/30"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-carbon"
              style={{ left: `${gauge}%` }}
              data-testid="arena-reticle"
              aria-hidden="true"
            >
              <Crosshair size={56} strokeWidth={2.5} />
            </div>
          </>
        )}
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between font-candy-mono text-xs text-carbon-muted">
          <span>0</span>
          <span className="bg-paper px-2 py-0.5 font-semibold text-carbon">Merkez 50</span>
          <span>100</span>
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-semibold text-carbon">Nişan kilidi</span>
          <span className="font-candy-mono text-sm font-semibold text-carbon">
            {Math.round(gauge)}% · isabet {Math.round(accuracy)}%
          </span>
        </div>
        <div className="duo-meter">
          <span className="bg-candy-lokum transition-[width]" style={{ width: `${accuracy}%` }} />
        </div>
        <p className="duo-game-status mt-3" aria-live="polite">
          {message}
        </p>
      </div>

      <ul className="duo-tear mb-6 pt-3 text-[15px]">
        <li className="duo-leader-row">
          <span className="text-carbon-muted">Son atışın</span>
          <span className="duo-leader-dots" aria-hidden="true" />
          <span className="duo-leader-value text-carbon">
            {playerShot === null ? '–' : `${Math.round(playerShot)}% · ${shotLabel(playerShot)}`}
          </span>
        </li>
        <li className="duo-leader-row">
          <span className="text-carbon-muted">Rakip atışı</span>
          <span className="duo-leader-dots" aria-hidden="true" />
          <span className="duo-leader-value text-carbon">
            {opponentShot === null
              ? '–'
              : `${Math.round(opponentShot)}% · ${shotLabel(opponentShot)}`}
          </span>
        </li>
      </ul>

      <div className="duo-game-actions flex flex-col gap-3 sm:flex-row">
        <RetroButton
          onClick={fire}
          disabled={!canFire}
          data-testid="arena-fire-button"
          size="lg"
          className="flex-1"
        >
          {livePending
            ? 'Gönderiliyor...'
            : hasFired && phase === 'open'
              ? 'Rakip bekleniyor'
              : 'Ateş et'}
        </RetroButton>
        {done && (
          <RetroButton onClick={onLeave} variant="secondary" size="lg" className="flex-1">
            Lobiye dön
          </RetroButton>
        )}
      </div>
    </div>
  );
};

export default ArenaBattle;
