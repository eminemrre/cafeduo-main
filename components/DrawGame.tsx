/**
 * Çiz Bil — the ranked draw-and-guess duel.
 *
 * The server engine (`backend/gameEngine/drawEngine.js`) owns the words, the
 * clock, the hints and every point; the client sends `pick {optionIndex}`,
 * `solve {word}` and `report` through the action endpoint. The drawer's
 * choices and word come back only as `actorView.draw`.
 *
 * Strokes are the one input sent over Socket.IO (`draw_strokes`): the server
 * accepts them only from the current drawer and relays them; after a reload
 * or reconnect the round is replayed from `GET /games/:id/strokes`. Strokes
 * cannot change a score. There is no practice mode: a bot cannot read a
 * drawing.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '../types';
import { api } from '../lib/api';
import { socketService } from '../lib/socket';
import { playGameSfx } from '../lib/gameAudio';
import { normalizeGuess } from '../lib/turkishText';
import {
  PALETTE,
  WIDTHS,
  createStrokeBatcher,
  mergeReplay,
  type StrokeOp,
  type StrokePoint,
} from '../lib/drawCanvas';
import { useLiveScoreGame, type LiveMatchStats } from '../hooks/useLiveScoreGame';
import { RetroButton } from './RetroButton';
import { DrawCanvas, type DrawCanvasHandle } from './draw/DrawCanvas';

export const DRAW_GAME_TYPE = 'Çiz Bil';
const FLUSH_MS = 50;
/** How long a refused stroke packet's message stays up. */
export const REJECTION_VISIBLE_MS = 4_000;
const MULTIPLIER_LABEL: Record<number, string> = { 1: '×1', 2: '×1,2', 3: '×1,5' };
const WIDTH_LABEL = ['İnce', 'Orta', 'Kalın'];
const REJECT_MESSAGE: Record<string, string> = {
  NOT_DRAWING: 'Çizim şu an kapalı.',
  ROUND_FULL: 'Bu turun çizim sınırı doldu.',
  NOT_IN_ROOM: 'Bağlantı yenileniyor…',
};

interface DrawGameProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  onGameEnd: (winner: string, points: number, stats?: LiveMatchStats) => void;
  onLeave: () => void;
  onMatchSettled?: () => void;
}

const Dots = ({ level }: { level: number }) => (
  <span className="duo-hm-dots" aria-label={`zorluk ${level}/3`}>
    {[1, 2, 3].map((dot) => (
      <span key={dot} className={`duo-hm-dot${dot <= level ? ' duo-hm-dot--on' : ''}`} aria-hidden="true" />
    ))}
  </span>
);

export const DrawGame: React.FC<DrawGameProps> = ({
  currentUser,
  gameId,
  opponentName,
  onGameEnd,
  onLeave,
  onMatchSettled,
}) => {
  const live = useLiveScoreGame({
    currentUser,
    gameId,
    isBot: false,
    mode: DRAW_GAME_TYPE,
    submissionKeyPrefix: 'draw',
    pollIntervalMs: 15_000,
    logName: 'DrawGame',
    statsKind: 'draw',
    onGameEnd,
  });

  const engine = live.engine;
  const round = engine?.round || null;
  const phase = engine?.phase || null;
  // Labels fall back to host; the drawer role (tools, word) needs a real seat.
  const myKey = live.actorKey || 'host';
  const opKey = myKey === 'host' ? 'guest' : 'host';
  const role: 'drawer' | 'guesser' =
    live.actorKey && round?.drawer === live.actorKey ? 'drawer' : 'guesser';
  const privateView = live.snapshot?.actorView?.draw;
  const draw = privateView && privateView.roundId === round?.id ? privateView : null;
  const opponent = live.opponent?.name || opponentName || 'Rakip';
  const roomId = gameId === null ? '' : String(gameId);

  const canvasRef = useRef<DrawCanvasHandle>(null);
  const batcherRef = useRef(createStrokeBatcher());
  const strokeIdRef = useRef(0);
  const roundRef = useRef<string | null>(null);
  /** The replay in flight, if any; live packets wait in its buffer. */
  const replayRef = useRef<{ buffer: StrokeOp[] } | null>(null);
  const rejectTimerRef = useRef<number | null>(null);
  const onMatchSettledRef = useRef(onMatchSettled);
  const [color, setColor] = useState(0);
  const [width, setWidth] = useState(1);
  const [attempt, setAttempt] = useState('');
  const [confirmReport, setConfirmReport] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    onMatchSettledRef.current = onMatchSettled;
  }, [onMatchSettled]);
  useEffect(() => {
    if (live.done) onMatchSettledRef.current?.();
  }, [live.done]);

  const drawing = phase === 'drawing';
  const canDraw = drawing && role === 'drawer';

  // Clock: choosing counts down to its deadline, drawing to the end of the round.
  useEffect(() => {
    if (phase !== 'choosing' && phase !== 'drawing') return undefined;
    const timer = window.setInterval(() => setTick((value) => value + 1), 250);
    return () => window.clearInterval(timer);
  }, [phase]);
  const deadline = drawing ? round?.endsAt : engine?.phaseEndsAt;
  const seconds = deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - live.serverNow()) / 1000)) : 0;

  // ------------------------------------------------------------ strokes
  // Each replay owns its buffer: live packets wait there (not drawn yet) and
  // are merged without the ones the replay already holds. A newer replay
  // takes over the buffer; an older one finishing never disturbs it.
  const replay = useCallback(async () => {
    if (!roomId) return;
    const session = { buffer: [] as StrokeOp[] };
    const previous = replayRef.current;
    if (previous) session.buffer.push(...previous.buffer);
    replayRef.current = session;
    let ops: StrokeOp[] | null = null;
    try {
      const result = await api.games.strokes(roomId);
      if (result?.roundId && result.roundId === roundRef.current) ops = result.ops || [];
    } catch {
      // A failed replay only loses the past; live packets still apply below.
    }
    if (replayRef.current !== session) return;
    replayRef.current = null;
    if (ops) canvasRef.current?.replace(mergeReplay(ops, session.buffer));
    else canvasRef.current?.append(session.buffer);
  }, [roomId]);

  // A new round starts on a clean board; drawing and reveal replay what exists.
  useEffect(() => {
    const id = round?.id || null;
    if (roundRef.current !== id) {
      roundRef.current = id;
      batcherRef.current = createStrokeBatcher();
      strokeIdRef.current = 0;
      canvasRef.current?.replace([]);
      setAttempt('');
      setConfirmReport(false);
    }
    if (phase === 'drawing' || phase === 'reveal') void replay();
  }, [round?.id, phase, replay]);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket || !roomId) return undefined;
    const onStrokes = (payload: { gameId?: string; roundId?: string; ops?: StrokeOp[] }) => {
      if (String(payload?.gameId) !== roomId || payload?.roundId !== roundRef.current) return;
      const ops = Array.isArray(payload.ops) ? payload.ops : [];
      if (replayRef.current) replayRef.current.buffer.push(...ops);
      else canvasRef.current?.append(ops);
    };
    const onRejected = (payload: { code?: string }) => {
      const message = REJECT_MESSAGE[String(payload?.code)] || 'Çizim gönderilemedi.';
      setLocalError(message);
      if (rejectTimerRef.current !== null) window.clearTimeout(rejectTimerRef.current);
      rejectTimerRef.current = window.setTimeout(() => {
        rejectTimerRef.current = null;
        setLocalError((current) => (current === message ? null : current));
      }, REJECTION_VISIBLE_MS);
    };
    const onConnect = (): void => {
      void replay();
    };
    socket.on('draw_strokes', onStrokes);
    socket.on('draw_rejected', onRejected);
    socket.on('connect', onConnect);
    return () => {
      if (rejectTimerRef.current !== null) window.clearTimeout(rejectTimerRef.current);
      socket.off('draw_strokes', onStrokes);
      socket.off('draw_rejected', onRejected);
      socket.off('connect', onConnect);
    };
  }, [roomId, replay]);

  // The drawer's packets leave every 50 ms while drawing.
  useEffect(() => {
    if (!canDraw || !roomId || !round?.id) return undefined;
    const roundId = round.id;
    const timer = window.setInterval(() => {
      const ops = batcherRef.current.flush();
      if (!ops.length) return;
      socketService.getSocket()?.emit('draw_strokes', { gameId: roomId, roundId, ops });
    }, FLUSH_MS);
    return () => window.clearInterval(timer);
  }, [canDraw, roomId, round?.id]);

  const beginStroke = () => {
    if (!canDraw) return null;
    strokeIdRef.current = (strokeIdRef.current + 1) % 10_000;
    const stroke = { id: strokeIdRef.current, c: color, w: width };
    batcherRef.current.begin(stroke.id, stroke.c, stroke.w);
    return stroke;
  };
  const addPoint = (point: StrokePoint) => batcherRef.current.add(point);
  const endStroke = () => batcherRef.current.end();
  const clearBoard = () => {
    batcherRef.current.clear();
    canvasRef.current?.append([{ t: 'clear' }]);
  };

  // ------------------------------------------------------------ actions
  const pick = async (optionIndex: number) => {
    setLocalError(null);
    const result = await live.submitAction({ type: 'pick', optionIndex });
    if (!result.ok && result.message) setLocalError(result.message);
  };

  const guess = async (event: React.FormEvent) => {
    event.preventDefault();
    const word = normalizeGuess(attempt);
    if (!word || !drawing || role !== 'guesser') return;
    setAttempt('');
    setLocalError(null);
    const result = await live.submitAction({ type: 'solve', word });
    if (!result.ok && result.message) setLocalError(result.message);
  };

  const report = async () => {
    if (!confirmReport) {
      setConfirmReport(true);
      return;
    }
    setConfirmReport(false);
    const result = await live.submitAction({ type: 'report' });
    if (!result.ok && result.message) setLocalError(result.message);
  };

  // A solved round sounds once.
  const solvedKey = phase === 'reveal' && round?.solved ? round.id : null;
  useEffect(() => {
    if (solvedKey) playGameSfx('success');
  }, [solvedKey]);

  // ------------------------------------------------------------ view
  if (!engine) {
    return (
      <section className="duo-game" aria-label={DRAW_GAME_TYPE} data-testid="draw-game">
        <header className="duo-game-head mb-6">
          <div>
            <span className="duo-game-chip bg-candy-portakal">{DRAW_GAME_TYPE}</span>
            <h2 className="duo-game-title">Tuval hazırlanıyor</h2>
          </div>
          <button type="button" onClick={onLeave} className="duo-quiet duo-focus shrink-0">
            Oyundan çık
          </button>
        </header>
        <p role="status" className="duo-game-status" aria-live="polite">
          {live.protocolError ? live.error : 'Bağlantı kuruluyor…'}
        </p>
      </section>
    );
  }

  const drawerName = round?.drawer ? engine.players?.[round.drawer]?.name || '' : '';
  const outcome = engine.result
    ? engine.result.winner === currentUser.username
      ? 'Kazandın'
      : engine.result.winner
        ? `${engine.result.winner} kazandı`
        : 'Berabere'
    : null;
  const guesses = round?.guesses || [];
  const hint = round?.hint || [];
  const delta = round?.scoreDelta;

  return (
    <section
      className="duo-game duo-draw"
      aria-label={DRAW_GAME_TYPE}
      data-testid="draw-game"
      data-phase={phase || 'loading'}
      data-role={role}
    >
      <header className="duo-game-head mb-4">
        <div className="min-w-0">
          <span className="duo-game-chip bg-candy-portakal">
            Tur {engine.roundIndex || 1}/{engine.totalRounds || 4}
          </span>
          {(phase === 'choosing' || drawing) && (
            <span className="duo-game-chip ml-2 bg-paper-deep" data-testid="draw-seconds">
              {seconds} sn
            </span>
          )}
          <h2 className="duo-game-title">{DRAW_GAME_TYPE}</h2>
          <p className="duo-game-sub truncate">
            {currentUser.username} {live.playerScore} · {opponent} {live.opponentScore}
          </p>
        </div>
        <button type="button" onClick={onLeave} className="duo-quiet duo-focus shrink-0">
          Oyundan çık
        </button>
      </header>

      {phase === 'choosing' && role === 'drawer' && (
        <div className="duo-draw-choices" role="group" aria-label="Çizeceğin kelimeyi seç">
          <p className="duo-draw-lead">Çizeceğin kelimeyi seç. Zor kelime daha çok puan getirir.</p>
          {(draw?.choices || []).map((choice, index) => (
            <button
              key={choice.word}
              type="button"
              className="duo-draw-choice duo-focus"
              onClick={() => void pick(index)}
              disabled={live.pending}
              data-testid={`draw-choice-${index}`}
            >
              <span className="duo-draw-choice-word">{choice.word}</span>
              <span className="duo-draw-choice-meta">
                <Dots level={choice.difficulty} /> {MULTIPLIER_LABEL[choice.difficulty] || ''}
              </span>
            </button>
          ))}
          {!draw?.choices?.length && <p role="status">Kelimeler geliyor…</p>}
        </div>
      )}
      {phase === 'choosing' && role === 'guesser' && (
        <p className="duo-game-status" role="status" data-testid="draw-waiting">
          {drawerName || opponent} çizeceği kelimeyi seçiyor…
        </p>
      )}

      {(drawing || phase === 'reveal') && (
        <div className="duo-draw-band" data-testid="draw-band">
          {role === 'drawer' && draw?.word ? (
            <p className="duo-draw-word">
              Çiz: <strong data-testid="draw-word">{draw.word}</strong>
            </p>
          ) : (
            <ol className="duo-hm-word duo-draw-hint" data-testid="draw-hint" aria-label={`${round?.length || 0} harf`}>
              {(phase === 'reveal' && round?.word ? [...round.word] : hint).map((letter, index) => (
                <li key={index} className={`duo-hm-tile${letter ? ' duo-hm-tile--open' : ''}`}>
                  <span aria-hidden="true">{letter || ''}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="duo-draw-meta">
            {round?.category} <Dots level={round?.difficulty || 1} />
          </p>
        </div>
      )}

      <div className="duo-draw-stage">
        <DrawCanvas
          ref={canvasRef}
          editable={canDraw}
          onBegin={beginStroke}
          onPoint={addPoint}
          onEnd={endStroke}
          label={canDraw ? 'Çizim tahtası, çizmek için parmağını sürükle' : `${drawerName || opponent} çiziyor`}
        />
        {canDraw && (
          <div className="duo-draw-tools" role="toolbar" aria-label="Çizim araçları">
            <div className="duo-draw-swatches">
              {PALETTE.map((entry, index) => (
                <button
                  key={entry.name}
                  type="button"
                  className={`duo-draw-swatch duo-focus${color === index ? ' duo-draw-swatch--on' : ''}${entry.eraser ? ' duo-draw-swatch--eraser' : ''}`}
                  style={{ background: entry.value }}
                  aria-label={entry.name}
                  aria-pressed={color === index}
                  onClick={() => setColor(index)}
                />
              ))}
            </div>
            <div className="duo-draw-widths">
              {WIDTHS.map((size, index) => (
                <button
                  key={size}
                  type="button"
                  className={`duo-draw-width duo-focus${width === index ? ' duo-draw-width--on' : ''}`}
                  aria-label={WIDTH_LABEL[index]}
                  aria-pressed={width === index}
                  onClick={() => setWidth(index)}
                >
                  <span style={{ width: 6 + index * 6, height: 6 + index * 6 }} aria-hidden="true" />
                </button>
              ))}
              <RetroButton variant="ghost" onClick={clearBoard} data-testid="draw-clear">
                Temizle
              </RetroButton>
            </div>
            <p className="duo-draw-rule">Harf ve rakam yazmak yasak; yalnız çiz.</p>
          </div>
        )}
      </div>

      {drawing && role === 'guesser' && (
        <form className="duo-hm-solve" onSubmit={guess}>
          <label className="duo-hm-solve-label" htmlFor="draw-attempt">
            Tahminin <span>istediğin kadar dene</span>
          </label>
          <div className="duo-hm-solve-row">
            <input
              id="draw-attempt"
              className="duo-hm-input"
              value={attempt}
              onChange={(event) => setAttempt(event.target.value)}
              placeholder={`${round?.length || ''} harf`}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="send"
            />
            <RetroButton type="submit" variant="ink" className="shrink-0" disabled={!attempt.trim() || live.pending}>
              Tahmin et
            </RetroButton>
          </div>
        </form>
      )}

      {(drawing || phase === 'reveal') && guesses.length > 0 && (
        <ol className="duo-draw-guesses" aria-label="Tahminler" data-testid="draw-guesses">
          {guesses
            .slice(-8)
            .reverse()
            .map((entry, index) => (
              <li key={`${entry.text}-${index}`} className={entry.close ? 'duo-draw-guess--close' : ''}>
                {entry.text}
                {entry.close && <span> · çok yakın</span>}
              </li>
            ))}
        </ol>
      )}

      {drawing && role === 'guesser' && (
        <button type="button" className="duo-quiet duo-focus duo-draw-report" onClick={() => void report()}>
          {confirmReport ? 'Emin misin? Tur puansız biter' : 'Harf ya da rakam yazdı'}
        </button>
      )}

      {phase === 'reveal' && round && (
        <p className="duo-hm-reveal" role="status" data-testid="draw-reveal">
          Kelime: <strong>{round.word}</strong>
          {round.reported ? ' · bildirildi, puan yok' : round.solved ? ' · bulundu' : ' · bulunamadı'}
          {delta && (
            <span className="duo-hm-delta">
              {' '}
              +{delta[myKey]} / +{delta[opKey]} puan
            </span>
          )}
        </p>
      )}

      {phase === 'finished' && outcome && (
        <p className="duo-hm-outcome" role="status">
          {outcome}
        </p>
      )}

      {(localError || live.error) && (
        <p className="duo-bs-error" role="alert">
          {localError || live.error}
        </p>
      )}
    </section>
  );
};

export default DrawGame;
