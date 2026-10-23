/**
 * Amiral Battı — placement and battle screens.
 *
 * Ranked games run on the server engine (`backend/gameEngine/battleshipEngine.js`):
 * the client sends `place {layout}` and `fire {cell}` and draws the returned
 * snapshot. It never decides a hit, a sunk ship, a turn or a winner. The
 * player's own fleet comes back only as `actorView.fleet`; the opponent's is
 * never on the client until a ship sinks.
 *
 * Practice (`isBot`) is local and unranked: the same shared rules, a hunt/
 * target bot, no clock, no points.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '../types';
import { RetroButton } from './RetroButton';
import { ConnectionOverlay } from './ConnectionOverlay';
import { playGameSfx } from '../lib/gameAudio';
import { useLiveScoreGame, type LiveMatchStats } from '../hooks/useLiveScoreGame';
import {
  BOARD_SIZE,
  CELL_COUNT,
  FLEET,
  FLEET_CELLS,
  MAX_MISSED_TURNS,
  cellName,
  randomLayout,
  shipCells,
  validateLayout,
  type LayoutEntry,
  type ShipDirection,
} from '../lib/battleship';
import { chooseBotShot } from '../lib/battleshipBot';
import { placeCovering, rotateInPlace, shipAt } from '../lib/battleshipPlacement';

export const BATTLESHIP_GAME_TYPE = 'Amiral Battı';
const BOT_SHOT_DELAY_MS = 750;

interface BattleshipGameProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number, stats?: LiveMatchStats) => void;
  onLeave: () => void;
  onMatchSettled?: () => void;
}

interface Board {
  shots: { cell: number; hit: boolean }[];
  sunk: { size: number; cells: number[] }[];
}

interface Ship {
  size: number;
  cells: number[];
}

interface ShotNote {
  by: 'me' | 'op';
  cell: number | null;
  hit: boolean;
  sunkSize: number | null;
  key: string;
}

type Phase = 'loading' | 'placement' | 'battle' | 'finished';

interface BotGame {
  phase: 'placement' | 'battle' | 'finished';
  myShips: Ship[];
  botShips: Ship[];
  /** Shots fired at me / at the bot. */
  myBoard: Board;
  opBoard: Board;
  turn: 'me' | 'op';
  last: ShotNote | null;
  startedAt: number;
}

const emptyBoard = (): Board => ({ shots: [], sunk: [] });
const emptyDraft = (): (LayoutEntry | null)[] => FLEET.map((): LayoutEntry | null => null);
const randomInt = (max: number) => Math.floor(Math.random() * max);

const createBotGame = (): BotGame => ({
  phase: 'placement',
  myShips: [],
  botShips: [],
  myBoard: emptyBoard(),
  opBoard: emptyBoard(),
  turn: 'me',
  last: null,
  startedAt: Date.now(),
});

/** Applies one practice shot; mirrors the server rule (no extra shot on a hit). */
const shootPractice = (game: BotGame, by: 'me' | 'op', cell: number): BotGame => {
  const targetShips = by === 'me' ? game.botShips : game.myShips;
  const board = by === 'me' ? game.opBoard : game.myBoard;
  const ship = targetShips.find((candidate) => candidate.cells.includes(cell)) || null;
  const shots = [...board.shots, { cell, hit: Boolean(ship) }];
  const sunk = [...board.sunk];
  let sunkSize: number | null = null;
  if (ship && ship.cells.every((c) => shots.some((shot) => shot.cell === c && shot.hit))) {
    sunk.push({ size: ship.size, cells: [...ship.cells] });
    sunkSize = ship.size;
  }
  const nextBoard = { shots, sunk };
  const finished = sunk.length >= targetShips.length;
  return {
    ...game,
    ...(by === 'me' ? { opBoard: nextBoard } : { myBoard: nextBoard }),
    phase: finished ? 'finished' : 'battle',
    turn: by === 'me' ? 'op' : 'me',
    last: { by, cell, hit: Boolean(ship), sunkSize, key: `${by}-${cell}` },
  };
};

const hitsOn = (board: Board) => board.shots.filter((shot) => shot.hit).length;

// Turkish suffixes follow how the row number is read: bir'e, iki'ye, altı'ya.
const DATIVE: Record<string, string> = {
  '1': "'e",
  '2': "'ye",
  '3': "'e",
  '4': "'e",
  '5': "'e",
  '6': "'ya",
  '7': "'ye",
  '8': "'e",
};
/** "D4" → "D4'e", "B2" → "B2'ye". */
export const toCell = (cell: number) => {
  const name = cellName(cell);
  return `${name}${DATIVE[name.slice(-1)] || "'e"}`;
};
/** 2 → "2'lik", 3 → "3'lük", 4 → "4'lük". */
export const shipLabel = (size: number) => `${size}${size === 2 ? "'lik" : "'lük"}`;

const COLUMNS = Array.from({ length: BOARD_SIZE }, (_, index) => String.fromCharCode(65 + index));
const ROWS = Array.from({ length: BOARD_SIZE }, (_, index) => String(index + 1));

const describeShot = (note: ShotNote, opponent: string): string => {
  if (note.cell === null) {
    return note.by === 'me' ? 'Süren doldu, sıranı kaçırdın.' : `${opponent} sırasını kaçırdı.`;
  }
  const who =
    note.by === 'me' ? `${cellName(note.cell)}: ` : `${opponent} ${toCell(note.cell)} attı: `;
  if (!note.hit) return `${who}ıska.`;
  if (note.sunkSize) {
    return note.by === 'me'
      ? `${who}isabet! ${shipLabel(note.sunkSize)} gemiyi batırdın.`
      : `${who}isabet. ${shipLabel(note.sunkSize)} gemin battı.`;
  }
  return `${who}isabet!`;
};

const HitMark: React.FC<{ tone: 'ink' | 'deniz' }> = ({ tone }) => (
  <svg viewBox="0 0 10 10" className="duo-bs-mark" aria-hidden="true">
    <path
      d="M1.6 1.6L8.4 8.4M8.4 1.6L1.6 8.4"
      stroke={tone === 'ink' ? '#17140F' : '#2EC4B6'}
      strokeWidth="2.2"
    />
  </svg>
);

/** The aim mark on the picked target cell. */
const AimMark: React.FC = () => (
  <svg viewBox="0 0 20 20" className="duo-bs-aim" aria-hidden="true">
    <circle cx="10" cy="10" r="5.5" fill="none" stroke="#17140F" strokeWidth="2" />
    <path d="M10 0.5V6M10 14V19.5M0.5 10H6M14 10H19.5" stroke="#17140F" strokeWidth="2" />
  </svg>
);

/** A placed ship in the tray. */
const CheckMark: React.FC = () => (
  <svg viewBox="0 0 16 16" className="duo-bs-check" aria-hidden="true">
    <path d="M3 8.5L6.5 12L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
  </svg>
);

interface GridProps {
  label: string;
  board: Board;
  ships?: Ship[];
  /** Ship cells of a placement draft, drawn as ships. */
  preview?: Set<number>;
  /** Cells of the ship picked for moving, drawn in deniz. */
  picked?: Set<number>;
  interactive: boolean;
  selected?: number | null;
  onCell?: (cell: number) => void;
  size?: 'full' | 'compact';
  testId: string;
  lastKey?: string | null;
}

/** Column letters above and row numbers beside a full-size sea. */
const SeaAxes: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="duo-bs-sea">
    <span className="duo-bs-axis duo-bs-axis--cols" aria-hidden="true">
      {COLUMNS.map((letter) => (
        <span key={letter}>{letter}</span>
      ))}
    </span>
    <span className="duo-bs-axis duo-bs-axis--rows" aria-hidden="true">
      {ROWS.map((row) => (
        <span key={row}>{row}</span>
      ))}
    </span>
    {children}
  </div>
);

/** One 8x8 sea. Cells are buttons with a roving tab stop and arrow-key moves. */
const SeaGrid: React.FC<GridProps> = ({
  label,
  board,
  ships = [],
  preview,
  picked,
  interactive,
  selected = null,
  onCell,
  size = 'full',
  testId,
  lastKey,
}) => {
  const [focusCell, setFocusCell] = useState(selected ?? 0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const shotMap = useMemo(() => {
    const map = new Map<number, boolean>();
    board.shots.forEach((shot) => map.set(shot.cell, shot.hit));
    return map;
  }, [board.shots]);
  const sunkCells = useMemo(() => new Set(board.sunk.flatMap((ship) => ship.cells)), [board.sunk]);
  const shipSet = useMemo(() => new Set(ships.flatMap((ship) => ship.cells)), [ships]);
  const lastCell = lastKey ? Number(lastKey.split('-')[1]) : null;

  useEffect(() => {
    if (selected !== null && selected !== undefined) setFocusCell(selected);
  }, [selected]);

  const move = (event: React.KeyboardEvent, cell: number) => {
    const row = Math.floor(cell / BOARD_SIZE);
    const col = cell % BOARD_SIZE;
    const next =
      event.key === 'ArrowRight' && col < BOARD_SIZE - 1
        ? cell + 1
        : event.key === 'ArrowLeft' && col > 0
          ? cell - 1
          : event.key === 'ArrowDown' && row < BOARD_SIZE - 1
            ? cell + BOARD_SIZE
            : event.key === 'ArrowUp' && row > 0
              ? cell - BOARD_SIZE
              : null;
    if (next === null) return;
    event.preventDefault();
    setFocusCell(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      className={`duo-bs-grid duo-bs-grid--${size}`}
      role="group"
      aria-label={label}
      data-testid={testId}
    >
      {Array.from({ length: CELL_COUNT }, (_, cell) => {
        const shot = shotMap.get(cell);
        const isSunk = sunkCells.has(cell);
        const isShip = shipSet.has(cell) || Boolean(preview?.has(cell));
        const state = isSunk
          ? 'sunk'
          : shot === true
            ? 'hit'
            : shot === false
              ? 'miss'
              : isShip
                ? 'ship'
                : 'sea';
        const stateLabel = {
          sunk: 'batık gemi',
          hit: 'isabet',
          miss: 'ıska',
          ship: 'gemin',
          sea: 'boş',
        }[state];
        const canPick = interactive && (preview ? true : shot === undefined);
        const isPicked = Boolean(picked?.has(cell));
        const className = [
          'duo-bs-cell',
          `duo-bs-cell--${state}`,
          isPicked ? 'duo-bs-cell--picked' : '',
          selected === cell ? 'duo-bs-cell--selected' : '',
          lastCell === cell ? 'duo-bs-cell--fresh' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={cell}
            ref={(element) => {
              refs.current[cell] = element;
            }}
            type="button"
            className={className}
            tabIndex={cell === focusCell ? 0 : -1}
            aria-label={`${cellName(cell)}, ${stateLabel}`}
            aria-pressed={selected === cell ? true : undefined}
            aria-disabled={!canPick}
            onKeyDown={(event) => move(event, cell)}
            onFocus={() => setFocusCell(cell)}
            onClick={() => {
              if (canPick) onCell?.(cell);
            }}
            data-cell={cell}
          >
            {state === 'hit' && <HitMark tone="ink" />}
            {state === 'sunk' && <HitMark tone="deniz" />}
            {selected === cell && state === 'sea' && <AimMark />}
          </button>
        );
      })}
    </div>
  );
};

/** One side of the scoreboard: name, hits scored and that player's fleet (sunk ships hollow). */
const FleetSide: React.FC<{
  name: string;
  hits: number;
  sunk: number[];
  me: boolean;
  turn: boolean;
  testId: string;
}> = ({ name, hits, sunk, me, turn, testId }) => {
  const remaining = [...sunk];
  return (
    <div
      className={`duo-bs-side-card${me ? ' duo-bs-side-card--me' : ''}${turn ? ' duo-bs-side-card--turn' : ''}`}
      data-testid={testId}
    >
      <span className="duo-bs-side-name">{name}</span>
      <span className="duo-bs-side-score">
        {hits}
        <span className="duo-bs-side-of">/{FLEET_CELLS}</span>
      </span>
      <span className="duo-bs-fleet-ships" aria-hidden="true">
        {FLEET.map((size, index) => {
          const at = remaining.indexOf(size);
          const isSunk = at >= 0;
          if (isSunk) remaining.splice(at, 1);
          return (
            <span
              key={`${size}-${index}`}
              className={`duo-bs-fleet-ship${isSunk ? ' duo-bs-fleet-ship--sunk' : ''}`}
              style={{ width: `${size * 10}px` }}
            />
          );
        })}
      </span>
      <span className="sr-only">
        {hits} isabet, {sunk.length} / {FLEET.length} gemisi battı
      </span>
    </div>
  );
};

export const BattleshipGame: React.FC<BattleshipGameProps> = ({
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
    mode: BATTLESHIP_GAME_TYPE,
    submissionKeyPrefix: 'battleship',
    pollIntervalMs: 15_000,
    logName: 'BattleshipGame',
    statsKind: 'battleship',
    onGameEnd,
  });

  const [bot, setBot] = useState<BotGame>(() => createBotGame());
  const [draft, setDraft] = useState<(LayoutEntry | null)[]>(() => emptyDraft());
  /** The ship the next grid tap places or moves; null once every ship is placed. */
  const [activeShip, setActiveShip] = useState<number | null>(0);
  const [direction, setDirection] = useState<ShipDirection>('h');
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const botDoneRef = useRef(false);
  const onGameEndRef = useRef(onGameEnd);
  const onMatchSettledRef = useRef(onMatchSettled);
  const lastSoundRef = useRef<string | null>(null);

  useEffect(() => {
    onGameEndRef.current = onGameEnd;
    onMatchSettledRef.current = onMatchSettled;
  }, [onGameEnd, onMatchSettled]);

  useEffect(() => {
    setBot(createBotGame());
    setDraft(emptyDraft());
    setActiveShip(0);
    setTarget(null);
    botDoneRef.current = false;
  }, [gameId, isBot]);

  // ---------------------------------------------------------------- view model
  const engine = live.engine;
  const actorKey = live.actorKey;
  const otherKey = actorKey === 'host' ? 'guest' : 'host';
  const opponent = isBot ? 'BOT' : live.opponent?.name || opponentName || 'Rakip';

  const phase: Phase = isBot
    ? bot.phase
    : !engine
      ? 'loading'
      : engine.phase === 'placement' || engine.phase === 'battle' || engine.phase === 'finished'
        ? engine.phase
        : 'loading';
  const done = isBot ? bot.phase === 'finished' : live.done;

  const myBoard: Board = isBot
    ? bot.myBoard
    : (actorKey && engine?.boards?.[actorKey]) || emptyBoard();
  const opBoard: Board = isBot
    ? bot.opBoard
    : (actorKey && engine?.boards?.[otherKey]) || emptyBoard();
  const serverFleet = live.snapshot?.actorView?.fleet;
  const myShips: Ship[] = isBot ? bot.myShips : serverFleet || [];
  const myPlaced = isBot
    ? bot.phase !== 'placement'
    : Boolean(actorKey && engine?.players?.[actorKey]?.placed);
  const opPlaced = isBot ? true : Boolean(engine?.players?.[otherKey]?.placed);
  const myTurn = isBot
    ? bot.phase === 'battle' && bot.turn === 'me'
    : phase === 'battle' && engine?.round?.turn === actorKey;
  const serverLastShot = engine?.lastShot;
  const lastNote = useMemo<ShotNote | null>(() => {
    if (isBot) return bot.last;
    if (!serverLastShot || !actorKey) return null;
    return {
      by: serverLastShot.by === actorKey ? 'me' : 'op',
      cell: serverLastShot.cell,
      hit: serverLastShot.hit,
      sunkSize: serverLastShot.sunkSize,
      key: `${serverLastShot.by}-${serverLastShot.cell ?? 'x'}-${serverLastShot.at}`,
    };
  }, [actorKey, bot.last, isBot, serverLastShot]);
  const missed = !isBot && actorKey ? Number(engine?.players?.[actorKey]?.missedTurns || 0) : 0;

  // ---------------------------------------------------------- placement draft
  const draftShips = useMemo(
    () =>
      draft.map((entry, index) =>
        entry ? shipCells(entry.cell, entry.dir, FLEET[index]) || [] : []
      ),
    [draft]
  );
  const previewCells = useMemo(() => new Set(draftShips.flat()), [draftShips]);
  const pickedCells = useMemo(
    () => new Set(activeShip !== null && draft[activeShip] ? draftShips[activeShip] : []),
    [activeShip, draft, draftShips]
  );
  const draftComplete = draft.every(Boolean);
  const activePlaced = activeShip !== null && Boolean(draft[activeShip]);
  const activeDirection: ShipDirection =
    activeShip !== null && draft[activeShip] ? draft[activeShip]!.dir : direction;

  const pickShip = (index: number) => {
    setPlacementError(null);
    setActiveShip(index);
    if (draft[index]) setDirection(draft[index]!.dir);
  };

  const rotate = () => {
    setPlacementError(null);
    if (activeShip !== null && draft[activeShip]) {
      const turned = rotateInPlace(draft, activeShip);
      if (!turned) {
        setPlacementError('Burada dönecek yer yok. Önce gemiyi başka bir kareye taşı.');
        return;
      }
      setDraft(turned);
      setDirection(turned[activeShip]!.dir);
      return;
    }
    setDirection((prev) => (prev === 'h' ? 'v' : 'h'));
  };

  const placeAt = (cell: number) => {
    setPlacementError(null);
    const owner = shipAt(draft, cell);
    if (owner >= 0) {
      // A tap on the picked ship turns it; a tap on another ship picks that one.
      if (owner === activeShip) rotate();
      else pickShip(owner);
      return;
    }
    if (activeShip === null) {
      setPlacementError('Taşımak için önce bir gemiye dokun.');
      return;
    }
    const next = placeCovering(draft, activeShip, cell, activeDirection);
    if (!next) {
      setPlacementError(
        `${shipLabel(FLEET[activeShip])} gemi bu kareye sığmıyor. Başka bir kare seç.`
      );
      return;
    }
    setDraft(next);
    setDirection(next[activeShip]!.dir);
    const nextEmpty = next.findIndex((entry) => entry === null);
    setActiveShip(nextEmpty >= 0 ? nextEmpty : null);
  };

  const shuffle = async () => {
    setPlacementError(null);
    if (!isBot) {
      const result = await live.submitAction({ type: 'place', auto: true });
      if (!result.ok && result.message) setPlacementError(result.message);
      return;
    }
    setDraft(randomLayout(randomInt));
    setActiveShip(null);
  };

  const confirmFleet = async () => {
    if (!draftComplete) return;
    const layout = draft as LayoutEntry[];
    const checked = validateLayout(layout);
    if (checked.ok === false) {
      setPlacementError(checked.message);
      return;
    }
    if (isBot) {
      const botLayout = validateLayout(randomLayout(randomInt));
      if (!botLayout.ok) return;
      setBot((prev) => ({
        ...prev,
        phase: 'battle',
        turn: 'me',
        myShips: checked.ships.map(({ size, cells }) => ({ size, cells })),
        botShips: botLayout.ships.map(({ size, cells }) => ({ size, cells })),
        startedAt: Date.now(),
      }));
      return;
    }
    const result = await live.submitAction({ type: 'place', layout });
    if (!result.ok && result.message) setPlacementError(result.message);
  };

  // ---------------------------------------------------------------- battle
  const fire = async (cell: number | null = target) => {
    if (cell === null || !myTurn || live.pending) return;
    if (opBoard.shots.some((shot) => shot.cell === cell)) return;
    setTarget(null);
    if (isBot) {
      setBot((prev) => shootPractice(prev, 'me', cell));
      return;
    }
    await live.submitAction({ type: 'fire', cell });
  };

  // Practice bot turn.
  useEffect(() => {
    if (!isBot || bot.phase !== 'battle' || bot.turn !== 'op') return undefined;
    const timer = window.setTimeout(() => {
      setBot((prev) => {
        if (prev.phase !== 'battle' || prev.turn !== 'op') return prev;
        const cell = chooseBotShot(prev.myBoard.shots, prev.myBoard.sunk);
        return cell === null ? prev : shootPractice(prev, 'op', cell);
      });
    }, BOT_SHOT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [bot.phase, bot.turn, isBot]);

  // Practice end: local only, no points.
  useEffect(() => {
    if (!isBot || bot.phase !== 'finished' || botDoneRef.current) return undefined;
    botDoneRef.current = true;
    const won = bot.opBoard.sunk.length >= FLEET.length;
    const stats: LiveMatchStats = {
      kind: 'battleship',
      playerScore: hitsOn(bot.opBoard),
      opponentScore: hitsOn(bot.myBoard),
      durationMs: Math.max(0, Date.now() - bot.startedAt),
    };
    const timer = window.setTimeout(() => {
      onGameEndRef.current(won ? currentUser.username : 'BOT', 0, stats);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [bot, currentUser.username, isBot]);

  useEffect(() => {
    if (done) onMatchSettledRef.current?.();
  }, [done]);

  // A target may be picked ahead during the opponent's turn; one that has been
  // fired on (here or by a refreshed snapshot) is dropped.
  useEffect(() => {
    if (target !== null && opBoard.shots.some((shot) => shot.cell === target)) setTarget(null);
  }, [opBoard.shots, target]);

  // First tap aims, a second tap on the same cell fires.
  const aimAt = (cell: number) => {
    if (cell === target && myTurn) {
      void fire(cell);
      return;
    }
    setTarget(cell);
  };

  // One sound per revealed shot.
  useEffect(() => {
    if (!lastNote || lastNote.cell === null || lastSoundRef.current === lastNote.key) return;
    lastSoundRef.current = lastNote.key;
    const good = lastNote.by === 'me' ? lastNote.hit : !lastNote.hit;
    playGameSfx(good ? 'success' : 'fail', lastNote.hit ? 0.24 : 0.16);
  }, [lastNote]);

  // ---------------------------------------------------------------- copy
  const status = (() => {
    if (!isBot && live.protocolError) return live.error || 'İstemci güncel değil.';
    if (phase === 'loading') return 'Sunucu maçı hazırlıyor...';
    if (!isBot && live.error) return live.error;
    if (phase === 'placement') {
      if (myPlaced) {
        return opPlaced ? 'İki filo da hazır.' : `Filon hazır. ${opponent} filosunu yerleştiriyor.`;
      }
      if (activeShip !== null && activePlaced) {
        return `${shipLabel(FLEET[activeShip])} gemi seçili: başka bir kareye dokunup taşı, gemiye yeniden dokunup döndür.`;
      }
      if (activeShip !== null) {
        return `${shipLabel(FLEET[activeShip])} gemiyi koymak için bir kareye dokun.`;
      }
      return draftComplete
        ? 'Filon hazır. Onayla ya da taşımak için bir gemiye dokun.'
        : 'Bir gemi seç.';
    }
    if (phase === 'finished') {
      if (isBot) {
        return bot.opBoard.sunk.length >= FLEET.length
          ? 'BOT filosunu batırdın.'
          : 'BOT filonu batırdı.';
      }
      const result = engine?.result;
      if (result?.cancelled) return 'Maç ödülsüz iptal edildi.';
      if (!result?.winner) return 'Maç berabere bitti.';
      return result.winner === currentUser.username
        ? 'Rakip filoyu batırdın. Maçı kazandın.'
        : `Maçı ${result.winner} aldı.`;
    }
    if (lastNote) return describeShot(lastNote, opponent);
    return myTurn
      ? 'Rakip sularda bir kareye dokun, ateş etmek için yeniden dokun.'
      : `${opponent} nişan alıyor.`;
  })();

  if (!isBot && live.protocolError) {
    return (
      <div className="mx-auto max-w-3xl text-carbon" data-testid="battleship-game">
        <ConnectionOverlay gameId={gameId} />
        <header className="duo-game-head mb-6">
          <div className="min-w-0">
            <span className="duo-game-chip bg-candy-deniz">{BATTLESHIP_GAME_TYPE}</span>
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

  const seconds = !isBot && (phase === 'placement' || phase === 'battle') ? live.secondsLeft : null;
  const myHits = hitsOn(opBoard);
  const theirHits = hitsOn(myBoard);

  return (
    <div
      className="mx-auto max-w-5xl text-carbon"
      data-testid="battleship-game"
      data-phase={phase}
      aria-busy={phase === 'loading' || live.pending}
    >
      <ConnectionOverlay gameId={gameId} />
      <header className="duo-game-head mb-5">
        <div className="min-w-0">
          <span className="duo-game-chip bg-candy-deniz">{isBot ? 'Antrenman' : '8×8'}</span>
          {seconds !== null && (
            <span className="duo-game-chip ml-2 bg-paper-deep" data-testid="battleship-seconds">
              {seconds} sn
            </span>
          )}
          <h2 className="duo-game-title">{BATTLESHIP_GAME_TYPE}</h2>
          <p className="duo-game-sub truncate">
            {currentUser.username} / {opponent}
          </p>
        </div>
        <button type="button" onClick={onLeave} className="duo-quiet duo-focus shrink-0">
          Oyundan çık
        </button>
      </header>

      {phase === 'placement' && !myPlaced && (
        <section aria-labelledby="bs-placement-title" data-testid="battleship-placement">
          <h3 id="bs-placement-title" className="duo-bs-heading">
            Filonu yerleştir
          </h3>
          <div className="duo-bs-tray" role="group" aria-label="Gemiler">
            {FLEET.map((size, index) => {
              const placed = Boolean(draft[index]);
              const active = activeShip === index;
              return (
                <button
                  key={`ship-${index}`}
                  type="button"
                  className={`duo-bs-tray-ship duo-focus${active ? ' duo-bs-tray-ship--active' : ''}${placed ? ' duo-bs-tray-ship--placed' : ''}`}
                  aria-pressed={active}
                  aria-label={`${shipLabel(size)} gemi${placed ? ', yerinde' : ''}`}
                  onClick={() => pickShip(index)}
                  data-testid={`battleship-ship-${index}`}
                >
                  <span className="duo-bs-tray-hull" aria-hidden="true">
                    {Array.from({ length: size }, (_, part) => (
                      <i key={part} />
                    ))}
                  </span>
                  <span className="duo-bs-tray-name">{shipLabel(size)}</span>
                  {placed && <CheckMark />}
                </button>
              );
            })}
          </div>
          <div className="duo-bs-layout">
            <SeaAxes>
              <SeaGrid
                label="Senin suların, filonu yerleştir"
                board={emptyBoard()}
                preview={previewCells}
                picked={pickedCells}
                interactive
                onCell={placeAt}
                testId="battleship-placement-grid"
              />
            </SeaAxes>
            <div className="duo-bs-panel">
              <p
                className={`duo-game-status${placementError ? ' duo-bs-error' : ''}`}
                aria-live="polite"
              >
                {placementError || status}
              </p>
              <div className="duo-bs-tools">
                <RetroButton
                  variant="secondary"
                  onClick={rotate}
                  data-testid="battleship-rotate"
                  aria-label={`Döndür, şimdi ${activeDirection === 'h' ? 'yatay' : 'dikey'}`}
                >
                  Döndür · {activeDirection === 'h' ? 'yatay' : 'dikey'}
                </RetroButton>
                <RetroButton
                  variant="ghost"
                  disabled={live.pending}
                  onClick={() => void shuffle()}
                  data-testid="battleship-shuffle"
                >
                  {isBot ? 'Rastgele dağıt' : 'Rastgele yerleştir'}
                </RetroButton>
              </div>
              {!isBot && (
                <p className="text-sm text-carbon-muted">
                  Rastgele yerleştirme filonu hemen onaylar; yerleşimi sunucu seçer.
                </p>
              )}
            </div>
          </div>
          <div className="duo-bs-action">
            <RetroButton
              variant="ink"
              size="lg"
              className="min-h-[56px] w-full"
              disabled={!draftComplete || live.pending}
              onClick={() => void confirmFleet()}
              data-testid="battleship-confirm"
            >
              {live.pending
                ? 'Gönderiliyor...'
                : draftComplete
                  ? 'Filoyu onayla'
                  : `${draft.filter(Boolean).length}/${FLEET.length} gemi yerinde`}
            </RetroButton>
          </div>
        </section>
      )}

      {(phase === 'battle' || phase === 'finished' || (phase === 'placement' && myPlaced)) && (
        <section aria-label="Savaş" data-testid="battleship-battle">
          <div
            className={`duo-bs-turn${myTurn ? ' duo-bs-turn--mine' : ''}`}
            data-testid="battleship-turn"
          >
            <span>
              {phase === 'placement'
                ? 'Rakip bekleniyor'
                : phase === 'finished'
                  ? 'Maç bitti'
                  : myTurn
                    ? 'Sıra sende'
                    : 'Sıra rakipte'}
            </span>
            {seconds !== null && <span>{seconds} sn</span>}
          </div>
          <div className="duo-bs-board">
            <FleetSide
              name="Sen"
              hits={myHits}
              sunk={myBoard.sunk.map((ship) => ship.size)}
              me
              turn={phase === 'battle' && myTurn}
              testId="battleship-my-fleet"
            />
            <FleetSide
              name={opponent}
              hits={theirHits}
              sunk={opBoard.sunk.map((ship) => ship.size)}
              me={false}
              turn={phase === 'battle' && !myTurn}
              testId="battleship-op-fleet"
            />
          </div>
          {missed > 0 && phase === 'battle' && (
            <p className="duo-bs-warning">
              Üst üste {missed} sıranı kaçırdın. {MAX_MISSED_TURNS}. kaçırışta maçı kaybedersin.
            </p>
          )}
          <p className="duo-game-status duo-bs-status" aria-live="polite">
            {status}
          </p>

          <div className="duo-bs-layout">
            <div className="min-w-0">
              <h3 className="duo-bs-subhead">{opponent} suları</h3>
              <SeaAxes>
                <SeaGrid
                  label={`${opponent} suları`}
                  board={opBoard}
                  interactive={phase === 'battle' && !live.pending}
                  selected={target}
                  onCell={aimAt}
                  testId="battleship-target-grid"
                  lastKey={
                    lastNote?.by === 'me' && lastNote.cell !== null ? `x-${lastNote.cell}` : null
                  }
                />
              </SeaAxes>
            </div>
            <div className="duo-bs-panel">
              <h3 className="duo-bs-subhead">Senin suların</h3>
              <SeaGrid
                label="Senin suların"
                board={myBoard}
                ships={myShips}
                interactive={false}
                size="compact"
                testId="battleship-own-grid"
                lastKey={
                  lastNote?.by === 'op' && lastNote.cell !== null ? `x-${lastNote.cell}` : null
                }
              />
              {phase === 'finished' && (
                <RetroButton onClick={onLeave} variant="secondary" size="lg" className="w-full">
                  Lobiye dön
                </RetroButton>
              )}
            </div>
          </div>
          {phase === 'battle' && (
            <div className="duo-bs-action">
              <RetroButton
                variant="ink"
                size="lg"
                className="min-h-[56px] w-full"
                disabled={!myTurn || target === null || live.pending}
                onClick={() => void fire()}
                data-testid="battleship-fire"
              >
                {live.pending
                  ? 'Gönderiliyor...'
                  : !myTurn
                    ? target !== null
                      ? `${cellName(target)} hazır · sıra rakipte`
                      : 'Sıra rakipte'
                    : target !== null
                      ? `${toCell(target)} ateş et`
                      : 'Bir kare seç'}
              </RetroButton>
            </div>
          )}
        </section>
      )}

      {phase === 'loading' && (
        <p className="duo-game-status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
};

export default BattleshipGame;
