import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '../types';
import { RetroButton } from './RetroButton';
import { playGameSfx } from '../lib/gameAudio';
import { ConnectionOverlay } from './ConnectionOverlay';
import { useLiveScoreGame, type LiveMatchStats } from '../hooks/useLiveScoreGame';
import { AimStage, type AimDart, type AimFeedback } from './games/AimStage';
import {
  AIM_SPEED,
  createRhythm,
  positionAt,
  pointsFromDistance,
  type AimTrajectory,
} from '../lib/aimTrajectory';

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

const randomGaugeStart = () => 15 + Math.random() * 70;
const localRandomInt = (max: number) => Math.floor(Math.random() * max);

/** Practice uses the competitive speed and a rhythm of its own, never an easier curve. */
const createBotTrajectory = (): AimTrajectory => ({
  start: randomGaugeStart(),
  direction: Math.random() > 0.5 ? 1 : -1,
  speed: AIM_SPEED,
  rhythm: createRhythm(localRandomInt),
});

interface ShotRecord {
  position: number;
  points: number;
}

/** What each side shot in a round, as the reveals arrive (the server keeps no history view). */
type RoundHistory = Record<number, { me: ShotRecord | null; op: ShotRecord | null }>;

interface BotState {
  round: number;
  phase: 'open' | 'reveal' | 'finished';
  trajectory: AimTrajectory;
  roundStartedAt: number;
  playerShot: number | null;
  opponentShot: number | null;
  playerScore: number;
  opponentScore: number;
  message: string;
}

const createBotState = (): BotState => ({
  round: 1,
  phase: 'open',
  trajectory: createBotTrajectory(),
  roundStartedAt: Date.now(),
  playerShot: null,
  opponentShot: null,
  playerScore: 0,
  opponentScore: 0,
  message: 'Nişangah hedefin ortasından geçerken ateş et.',
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
  const [optimisticShot, setOptimisticShot] = useState<number | null>(null);
  const [feedbackKey, setFeedbackKey] = useState('');
  const [feedback, setFeedback] = useState<AimFeedback | null>(null);
  const [history, setHistory] = useState<RoundHistory>({});
  const botDoneRef = useRef(false);
  const botStartedAtRef = useRef(Date.now());
  const onGameEndRef = useRef(onGameEnd);
  const onMatchSettledRef = useRef(onMatchSettled);

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
    setFeedback(null);
    setHistory({});
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

  const serverTrajectory = serverRound?.trajectory;
  const serverStartedAt = serverRound?.startedAt;
  const serverEndsAt = serverRound?.endsAt;

  // The reticle: the shared trajectory function at the (estimated) server
  // clock, never a locally invented gauge or a per-device difficulty. Hidden
  // once the player has fired, so the faint dart shows where the shot went.
  // The last reticle the stage drew (estimated server time + position). A shot
  // fires at this frame, so it lands exactly where the player saw it.
  const lastReadRef = useRef<{ at: number; position: number } | null>(null);
  const readPosition = useCallback((): number | null => {
    if (phase !== 'open' || done || hasFired) return null;
    if (isBot) return positionAt(bot.trajectory, Date.now() - bot.roundStartedAt);
    if (!serverTrajectory || !serverStartedAt) return null;
    const at = liveServerNow();
    const elapsed = Math.max(0, at - Date.parse(serverStartedAt));
    const position = positionAt(serverTrajectory as AimTrajectory, elapsed);
    lastReadRef.current = { at, position };
    return position;
  }, [
    bot.roundStartedAt,
    bot.trajectory,
    done,
    hasFired,
    isBot,
    liveServerNow,
    phase,
    serverStartedAt,
    serverTrajectory,
  ]);

  const readTimeLeft = useCallback((): number | null => {
    if (isBot || phase !== 'open' || done || !serverStartedAt || !serverEndsAt) return null;
    const start = Date.parse(serverStartedAt);
    const end = Date.parse(serverEndsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return (end - liveServerNow()) / (end - start);
  }, [done, isBot, liveServerNow, phase, serverEndsAt, serverStartedAt]);

  useEffect(() => {
    setOptimisticShot(null);
  }, [isBot, serverRound?.id]);

  // A new round clears the last round's score popup.
  useEffect(() => {
    setFeedback(null);
  }, [round]);

  // Server reveals feed the round history (pips and darts of past rounds).
  useEffect(() => {
    if (isBot || !isReveal || !serverRound || !live.actorKey) return;
    const index = round;
    const me = actorShot
      ? { position: Number(actorShot.position), points: Number(actorShot.points || 0) }
      : null;
    const op = opponentShotData
      ? {
          position: Number(opponentShotData.position),
          points: Number(opponentShotData.points || 0),
        }
      : null;
    setHistory((prev) => {
      const current = prev[index];
      if (
        current &&
        current.me?.position === me?.position &&
        current.me?.points === me?.points &&
        current.op?.position === op?.position &&
        current.op?.points === op?.points
      ) {
        return prev;
      }
      return { ...prev, [index]: { me, op } };
    });
  }, [actorShot, isBot, isReveal, live.actorKey, opponentShotData, round, serverRound]);

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
              trajectory: createBotTrajectory(),
              roundStartedAt: Date.now(),
              playerShot: null,
              opponentShot: null,
              message: 'Yeni tur başladı. Ritim değişti, doğru anı bekle.',
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
    setFeedback({ key, points, position: bot.playerShot });
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
    setFeedback({ key, points, position: shot });
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
    const drawn = lastReadRef.current;
    const position = readPosition();
    if (position === null) return;
    if (isBot) {
      const shot = clampGauge(position);
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
      setHistory((prev) => ({
        ...prev,
        [bot.round]: {
          me: { position: shot, points: gainedPoints },
          op: { position: botShot, points: botPoints },
        },
      }));
      return;
    }
    // Fire at the frame on screen (if it is current), not at "now": the server
    // scores that moment, bounded by its latency allowance, so the shot lands
    // where the reticle was drawn rather than where it is on arrival.
    const now = liveServerNow();
    const frame = drawn && now - drawn.at >= 0 && now - drawn.at < 100 ? drawn : { at: now, position };
    const shot = clampGauge(frame.position);
    setOptimisticShot(shot);
    const shotAt = Math.round(frame.at);
    void submitLiveAction({ type: 'fire', shotAt }).then((result) => {
      if (!result.ok && result.code !== 'BUSY') setOptimisticShot(null);
    });
  }, [
    bot.opponentScore,
    bot.playerScore,
    bot.round,
    done,
    hasFired,
    isBot,
    livePending,
    liveServerNow,
    readPosition,
    submitLiveAction,
    phase,
  ]);

  const darts = useMemo<AimDart[]>(() => {
    const list: AimDart[] = [];
    for (const [key, entry] of Object.entries(history)) {
      const roundNumber = Number(key);
      if (entry.me) list.push({ round: roundNumber, side: 'me', position: entry.me.position });
      if (entry.op) list.push({ round: roundNumber, side: 'op', position: entry.op.position });
    }
    if (!history[round] && optimisticShot !== null && phase === 'open') {
      list.push({ round, side: 'me', position: optimisticShot, ghost: true });
    }
    return list;
  }, [history, optimisticShot, phase, round]);

  const pips = (side: 'me' | 'op') =>
    Array.from({ length: maxRounds }, (_, i) => {
      const roundNumber = i + 1;
      const record = history[roundNumber]?.[side];
      const missing = !record && roundNumber < round;
      return (
        <span
          key={roundNumber}
          className={`duo-aim-pip${record && record.points > 0 ? ' duo-aim-pip--hit' : ''}`}
          title={`${roundNumber}. tur`}
        >
          {record ? record.points : missing ? '–' : ''}
        </span>
      );
    });
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
        : 'Nişangah hedefin ortasından geçerken ateş et.';
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
        gauge: Math.round(readPosition() ?? playerShot ?? 50),
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
    maxRounds,
    message,
    opponentShot,
    opponentScore,
    playerScore,
    playerShot,
    readPosition,
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

      <div className="duo-aim-board mb-4" data-testid="arena-scoreboard">
        <div className="duo-aim-side duo-aim-side--me">
          <span className="duo-aim-side-name">Sen</span>
          <span className="duo-aim-side-score" data-testid="arena-score-me">
            {playerScore}
          </span>
          <span className="duo-aim-pips" aria-label="Tur puanların">
            {pips('me')}
          </span>
        </div>
        <div className="duo-aim-side duo-aim-side--op">
          <span className="duo-aim-side-name">{targetName}</span>
          <span className="duo-aim-side-score" data-testid="arena-score-op">
            {opponentScore}
          </span>
          <span className="duo-aim-pips" aria-label="Rakibin tur puanları">
            {pips('op')}
          </span>
        </div>
      </div>

      <AimStage
        round={round}
        maxRounds={maxRounds}
        readPosition={readPosition}
        readTimeLeft={readTimeLeft}
        darts={darts}
        feedback={feedback}
      />

      <p className="duo-game-status mb-5 mt-3 min-h-[44px]" aria-live="polite">
        {message}
      </p>

      <div className="duo-game-actions flex flex-col gap-3 sm:flex-row">
        <RetroButton
          onClick={fire}
          disabled={!canFire}
          data-testid="arena-fire-button"
          variant="ink"
          size="lg"
          className="min-h-[64px] flex-1"
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
