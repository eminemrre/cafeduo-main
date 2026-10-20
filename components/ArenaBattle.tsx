import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { playGameSfx } from '../lib/gameAudio';
import { ConnectionOverlay } from './ConnectionOverlay';
import { useLiveScoreGame, type LiveMatchStats } from '../hooks/useLiveScoreGame';
import { AimBattleStageCanvas, type AimBattleStageHandle } from './games/AimBattleStageCanvas';
import type { HitTier } from '../lib/pixi/aimBattleStage';

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
const MAX_ROUNDS = 5;

// Difficulty knobs. Original (desktop) values were 4 / 46. The user
// reported the game is way too easy on mobile — touch devices have
// less precise inputs but a smaller travel area, so a tap usually
// lands within the perfect window almost by accident. To keep desktop
// feel intact while raising the mobile bar, we detect touch hardware
// at component mount and pick a harder pair of values.
//
// `pointer: coarse` covers phones + tablets (and most game-controller
// touchpads); desktops with a mouse get `pointer: fine`. Falling back
// to the desktop pair on the server / SSR / non-DOM environments.
const detectTouchDifficulty = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { step: 4, tickMs: 46 };
  }
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (coarse) {
    return { step: 7, tickMs: 32 };
  }
  return { step: 4, tickMs: 46 };
};

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

const tierFromPoints = (points: number): HitTier => {
  if (points >= 3) return 'hit3';
  if (points === 2) return 'hit2';
  if (points === 1) return 'hit1';
  return 'miss';
};

const randomGaugeStart = () => 15 + Math.random() * 70;

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
    pollIntervalMs: 2200,
    logName: 'ArenaBattle',
    statsKind: 'arena',
    onGameEnd,
  });

  // Pick difficulty once at mount; React picks this up via useMemo so we
  // don't re-detect on every render. Tests can still run in JSDOM where
  // window.matchMedia is shim'd; detectTouchDifficulty returns the
  // desktop pair there, keeping unit-test behaviour stable.
  const difficulty = useMemo(() => detectTouchDifficulty(), []);
  const GAUGE_STEP = difficulty.step;
  const GAUGE_TICK_MS = difficulty.tickMs;

  const [round, setRound] = useState(1);
  const [gauge, setGauge] = useState(50);
  const [roundLocked, setRoundLocked] = useState(false);
  const [playerShot, setPlayerShot] = useState<number | null>(null);
  const [opponentShot, setOpponentShot] = useState<number | null>(null);
  const [message, setMessage] = useState('Nişangah merkezden geçerken ateş et.');

  const directionRef = useRef<1 | -1>(1);
  const nextRoundTimeoutRef = useRef<number | null>(null);
  const pixiStageRef = useRef<AimBattleStageHandle | null>(null);

  const target = useMemo(() => (isBot ? 'BOT' : opponentName || 'Rakip'), [isBot, opponentName]);

  useEffect(() => {
    setRound(1);
    setRoundLocked(false);
    setPlayerShot(null);
    setOpponentShot(null);
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
    if (live.done || live.resolvingMatch) return undefined;
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
  }, [live.done, live.resolvingMatch, round, GAUGE_STEP, GAUGE_TICK_MS]);

  // Push the bouncing gauge value into the PixiJS overlay each tick so the
  // animated reticle stays in sync with the underlying state.
  useEffect(() => {
    pixiStageRef.current?.setReticleX(gauge);
  }, [gauge]);

  // Pause the PixiJS overlay's animation loop on match end so we're not
  // burning frames on a finished battle waiting for the user to leave.
  useEffect(() => {
    pixiStageRef.current?.setActive(!live.done);
  }, [live.done]);

  // Tell the parent the match is settled so the forfeit confirm gets
  // suppressed before the delayed onGameEnd actually sets gameResult.
  useEffect(() => {
    if (live.done) onMatchSettled?.();
  }, [live.done, onMatchSettled]);

  // Surface a friendly status message when the snapshot tells us who joined.
  useEffect(() => {
    if (isBot || !gameId) return;
    if (live.guestName || live.hostName) {
      setMessage(`Canlı eşleşme aktif. Rakip: ${live.guestName || live.hostName || target}`);
    }
  }, [isBot, gameId, live.guestName, live.hostName, target]);

  // Track server round to keep local UI in sync with multiplayer state.
  useEffect(() => {
    if (live.serverRound !== null) {
      setRound((prev) => Math.max(prev, Math.min(MAX_ROUNDS, live.serverRound!)));
    }
  }, [live.serverRound]);

  useEffect(() => {
    const arenaWindow = window as ArenaWindow;
    const renderGameToText = () =>
      JSON.stringify({
        mode: live.done ? 'finished' : 'playing',
        gameType: AIM_GAME_TYPE,
        round,
        maxRounds: MAX_ROUNDS,
        player: { name: currentUser.username, score: live.playerScore, lastShot: playerShot },
        opponent: { name: target, score: live.opponentScore, lastShot: opponentShot },
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
    gauge,
    live.done,
    live.opponentScore,
    live.playerScore,
    message,
    opponentShot,
    playerShot,
    round,
    target,
  ]);

  useEffect(
    () => () => {
      if (nextRoundTimeoutRef.current) {
        window.clearTimeout(nextRoundTimeoutRef.current);
      }
    },
    []
  );

  const fire = () => {
    if (live.done || live.resolvingMatch || roundLocked) return;
    setRoundLocked(true);

    const shot = clampGauge(gauge);
    const gainedPoints = pointsFromShot(shot);
    const nextPlayerScore = live.playerScore + gainedPoints;
    let nextOpponentScore = live.opponentScore;

    setPlayerShot(shot);
    live.setPlayerScore(nextPlayerScore);
    playGameSfx(gainedPoints > 0 ? 'success' : 'fail', gainedPoints > 0 ? 0.24 : 0.2);

    // PixiJS visual feedback at the reticle position
    const tier = tierFromPoints(gainedPoints);
    pixiStageRef.current?.flash(tier);
    pixiStageRef.current?.showScorePopup(
      gainedPoints > 0 ? `+${gainedPoints} ${shotLabel(shot)}` : shotLabel(shot),
      tier
    );

    if (isBot) {
      const botShot = clampGauge(50 + (Math.random() * 2 - 1) * 42);
      const botPoints = pointsFromShot(botShot);
      nextOpponentScore += botPoints;
      setOpponentShot(botShot);
      live.setOpponentScore(nextOpponentScore);
      setMessage(
        `Atışın: ${shotLabel(shot)} (${gainedPoints}). BOT: ${shotLabel(botShot)} (${botPoints}).`
      );
    } else {
      setMessage(`Atışın: ${shotLabel(shot)} (${gainedPoints}). Rakip güncellemesi bekleniyor...`);
    }

    const isLastRound = round >= MAX_ROUNDS;
    void live.syncLiveProgress(nextPlayerScore, round, isLastRound);

    if (isLastRound) {
      live.setDone(true);
      const localWinner = isBot
        ? nextPlayerScore >= nextOpponentScore
          ? currentUser.username
          : 'BOT'
        : currentUser.username;
      setMessage(
        isBot
          ? nextPlayerScore >= nextOpponentScore
            ? 'Maçı kazandın.'
            : 'Maçı rakip aldı.'
          : 'Skorun kaydedildi. Rakip sonucu bekleniyor...'
      );
      void live.finalizeMatch(localWinner, nextPlayerScore);
      return;
    }

    nextRoundTimeoutRef.current = window.setTimeout(() => {
      setRound((prev) => prev + 1);
      setMessage('Yeni tur başladı. Merkezi yakalamak için doğru anı bekle.');
      playGameSfx('select', 0.18);
    }, 750);
  };

  const canFire = !live.done && !live.resolvingMatch && !roundLocked;
  const accuracy = Math.max(0, 100 - Math.abs(50 - gauge) * 2);
  const participants =
    live.hostName || live.guestName
      ? `${live.hostName || currentUser.username} / ${live.guestName || target}`
      : `${currentUser.username} / ${target}`;

  return (
    <div className="mx-auto max-w-3xl text-carbon" data-testid="arena-battle">
      <ConnectionOverlay gameId={gameId} />
      <header className="duo-game-head mb-6">
        <div className="min-w-0">
          <span className="duo-game-chip bg-candy-lokum">{MAX_ROUNDS} tur</span>
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
            {Math.min(round, MAX_ROUNDS)} / {MAX_ROUNDS}
          </span>
        </div>
        <div className="duo-stat duo-stat--lokum">
          <span className="duo-stat-label">Sen</span>
          <span className="duo-stat-value duo-stat-value--score">{live.playerScore}</span>
        </div>
        <div className="duo-stat">
          <span className="duo-stat-label">Rakip</span>
          <span className="duo-stat-value duo-stat-value--score">{live.opponentScore}</span>
        </div>
      </div>

      <div className="relative mb-5 aspect-[2/1] overflow-hidden bg-paper-deep">
        {/* PixiJS WebGL overlay — fills the stage, renders animated reticle + hit effects */}
        <AimBattleStageCanvas ref={pixiStageRef} className="absolute inset-0 h-full w-full" />
        {/* CSS reticle kept as a11y/test fallback and for environments without WebGL */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-carbon pointer-events-none opacity-0"
          style={{ left: `${gauge}%` }}
          data-testid="arena-reticle"
          aria-hidden="true"
        >
          <Crosshair size={42} />
        </div>
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
          Ateş et
        </RetroButton>
        {live.done && (
          <RetroButton onClick={onLeave} variant="secondary" size="lg" className="flex-1">
            Lobiye dön
          </RetroButton>
        )}
      </div>
    </div>
  );
};

export default ArenaBattle;
