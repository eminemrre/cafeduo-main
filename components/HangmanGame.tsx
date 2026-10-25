/**
 * Adam Asmaca — the ranked duel and the local practice match.
 *
 * Ranked games run on the server engine (`backend/gameEngine/hangmanEngine.js`):
 * the client sends `guess {letter}` and `solve {word}` and draws the returned
 * snapshot. It never decides a letter's place, a life, a point or a winner.
 * Both players solve the same word, so the letters of a board come back only
 * as `actorView.hangman`, and the word is public only once its round is over.
 *
 * Practice (`isBot`) is local and unranked: the same rules from
 * `lib/hangmanPractice.ts`, a bot that opens letters on a human-ish cadence,
 * no points.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '../types';
import { playGameSfx } from '../lib/gameAudio';
import { RetroButton } from './RetroButton';
import { useLiveScoreGame, type LiveMatchStats } from '../hooks/useLiveScoreGame';
import { isTurkishLetter, normalizeGuess } from '../lib/turkishText';
import {
  PRACTICE_MAX_WRONG,
  advancePractice,
  chooseBotLetter,
  createPracticeGame,
  guessLetter,
  pickPracticeWord,
  practiceView,
  shouldBotSolve,
  solveWord,
  type PracticeGame,
} from '../lib/hangmanPractice';

export const HANGMAN_GAME_TYPE = 'Adam Asmaca';

/** Turkish Q keyboard without q, w and x, which Turkish does not use. */
const KEY_ROWS = [
  ['e', 'r', 't', 'y', 'u', 'ı', 'o', 'p', 'ğ', 'ü'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ş', 'i'],
  ['z', 'c', 'v', 'b', 'n', 'm', 'ö', 'ç'],
];
const BOT_MIN_DELAY_MS = 4_500;
const BOT_MAX_DELAY_MS = 8_500;

interface HangmanGameProps {
  currentUser: User;
  gameId: string | number | null;
  opponentName?: string;
  isBot: boolean;
  onGameEnd: (winner: string, points: number, stats?: LiveMatchStats) => void;
  onLeave: () => void;
  onMatchSettled?: () => void;
}

interface BoardView {
  pattern: (string | null)[];
  guessed: string[];
  wrong: number;
  solved: boolean;
  done: boolean;
  points: number;
}

const EMPTY_VIEW: BoardView = {
  pattern: [],
  guessed: [],
  wrong: 0,
  solved: false,
  done: false,
  points: 0,
};

/** The six strokes of the drawing; `wrong` lives lost draws that many. */
const Gallows = ({ wrong, max }: { wrong: number; max: number }) => (
  <svg
    className="duo-hm-gallows"
    viewBox="0 0 120 140"
    role="img"
    aria-label={`Adam Asmaca çizimi: ${max} hakkın ${wrong} tanesi gitti`}
    data-testid="hangman-gallows"
  >
    <g className="duo-hm-gallows-wood" strokeLinecap="round">
      <line x1="18" y1="130" x2="96" y2="130" />
      <line x1="40" y1="130" x2="40" y2="16" />
      <line x1="40" y1="16" x2="84" y2="16" />
      <line x1="84" y1="16" x2="84" y2="32" />
    </g>
    <g className="duo-hm-gallows-body" strokeLinecap="round">
      {wrong > 0 && <circle cx="84" cy="43" r="11" />}
      {wrong > 1 && <line x1="84" y1="54" x2="84" y2="86" />}
      {wrong > 2 && <line x1="84" y1="62" x2="66" y2="76" />}
      {wrong > 3 && <line x1="84" y1="62" x2="102" y2="76" />}
      {wrong > 4 && <line x1="84" y1="86" x2="70" y2="108" />}
      {wrong > 5 && <line x1="84" y1="86" x2="98" y2="108" />}
    </g>
  </svg>
);

const Lives = ({ wrong, max }: { wrong: number; max: number }) => (
  <span className="duo-hm-lives" aria-label={`${max - wrong} hak kaldı`}>
    {Array.from({ length: max }, (_, index) => (
      <span
        key={index}
        className={`duo-hm-life${index < max - wrong ? '' : ' duo-hm-life--lost'}`}
        aria-hidden="true"
      />
    ))}
  </span>
);

const WordTiles = ({ pattern, solved }: { pattern: (string | null)[]; solved: boolean }) => (
  <ol className={`duo-hm-word${solved ? ' duo-hm-word--solved' : ''}`} data-testid="hangman-word">
    {pattern.map((letter, index) => (
      <li
        key={index}
        className={`duo-hm-tile${letter ? ' duo-hm-tile--open' : ''}`}
        aria-label={letter ? `${index + 1}. harf ${letter}` : `${index + 1}. harf kapalı`}
      >
        <span aria-hidden="true">{letter || ''}</span>
      </li>
    ))}
  </ol>
);

export const HangmanGame: React.FC<HangmanGameProps> = ({
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
    mode: HANGMAN_GAME_TYPE,
    submissionKeyPrefix: 'hangman',
    pollIntervalMs: 15_000,
    logName: 'HangmanGame',
    statsKind: 'hangman',
    onGameEnd,
  });

  const [practice, setPractice] = useState<PracticeGame>(() =>
    createPracticeGame({ word: pickPracticeWord() })
  );
  /** Latest practice state, so two taps in one frame build on each other. */
  const practiceRef = useRef(practice);
  practiceRef.current = practice;
  const [now, setNow] = useState(() => Date.now());
  const [attempt, setAttempt] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const attemptRef = useRef<HTMLInputElement>(null);
  const practiceDoneRef = useRef(false);
  const onGameEndRef = useRef(onGameEnd);
  const onMatchSettledRef = useRef(onMatchSettled);
  const lastSoundRef = useRef<string | null>(null);

  useEffect(() => {
    onGameEndRef.current = onGameEnd;
    onMatchSettledRef.current = onMatchSettled;
  }, [onGameEnd, onMatchSettled]);

  useEffect(() => {
    const fresh = createPracticeGame({ word: pickPracticeWord() });
    practiceRef.current = fresh;
    setPractice(fresh);
    setAttempt('');
    setLocalError(null);
    practiceDoneRef.current = false;
  }, [gameId, isBot]);

  // ---------------------------------------------------------------- view model
  const engine = live.engine;
  const opponent = isBot ? 'BOT' : live.opponent?.name || opponentName || 'Rakip';
  const rankedPhase =
    engine?.phase === 'open' || engine?.phase === 'reveal' || engine?.phase === 'finished'
      ? engine.phase
      : null;
  const phase = isBot ? (practice.phase === 'finished' ? 'finished' : 'open') : rankedPhase;
  const round = engine?.round || null;
  const serverBoard = live.snapshot?.actorView?.hangman;
  const myKey = live.actorKey || 'host';
  const opKey = myKey === 'host' ? 'guest' : 'host';
  const mine: BoardView = isBot
    ? practiceView(practice, 'host')
    : // A board from an earlier round (socket news before the refetch) is not this round's.
      serverBoard && serverBoard.roundId === round?.id
      ? serverBoard
      : EMPTY_VIEW;
  const ops: BoardView = isBot ? practiceView(practice, 'guest') : EMPTY_VIEW;
  const maxWrong = isBot ? PRACTICE_MAX_WRONG : round?.maxWrong || 6;
  const opProgress = isBot
    ? {
        revealed: ops.pattern.filter(Boolean).length,
        wrong: ops.wrong,
        solved: ops.solved,
        done: ops.done,
      }
    : round?.progress?.[opKey] || { revealed: 0, wrong: 0, solved: false, done: false };
  const length = isBot ? practice.length : round?.length || 0;
  const category = isBot ? practice.category : round?.category || '';
  const difficulty = isBot ? 1 : round?.difficulty || 1;
  const wordPattern = useMemo(() => {
    const pattern = Array.isArray(mine.pattern) ? mine.pattern.slice() : [];
    while (pattern.length < length) pattern.push(null);
    return pattern.slice(0, Math.max(length, pattern.length));
  }, [mine.pattern, length]);
  const myScore = isBot ? mine.points : live.playerScore;
  const opScore = isBot ? ops.points : live.opponentScore;
  const open = phase === 'open' && !mine.done;
  const seconds = isBot
    ? Math.max(0, Math.ceil((practice.endsAt - now) / 1000))
    : live.secondsLeft;
  const reveal = phase === 'reveal' ? round : null;
  const practiceResult = isBot && practice.phase === 'finished' ? practice.result : null;
  const outcome = isBot
    ? practiceResult
      ? practiceResult.winner === 'host'
        ? 'Kazandın'
        : practiceResult.winner === 'guest'
          ? 'Bot kazandı'
          : 'Berabere'
      : null
    : engine?.result
      ? engine.result.winner === currentUser.username
        ? 'Kazandın'
        : engine.result.winner
          ? `${engine.result.winner} kazandı`
          : 'Berabere'
      : null;

  // --------------------------------------------------------------- practice
  useEffect(() => {
    if (!isBot) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [isBot]);

  useEffect(() => {
    if (!isBot || practice.phase === 'finished') return;
    setPractice((prev) => (prev.phase === 'finished' ? prev : advancePractice(prev, Date.now())));
  }, [isBot, now, practice.phase]);

  // The bot opens letters on a human-ish cadence and tries the word at the end.
  useEffect(() => {
    if (!isBot || practice.phase === 'finished' || practice.guest.done) return undefined;
    const delay = BOT_MIN_DELAY_MS + Math.random() * (BOT_MAX_DELAY_MS - BOT_MIN_DELAY_MS);
    const timer = window.setTimeout(() => {
      setPractice((prev) => {
        if (prev.phase === 'finished' || prev.guest.done) return prev;
        const at = Date.now();
        if (shouldBotSolve(prev.word, prev.guest)) return solveWord(prev, 'guest', prev.word, at).game;
        const letter = chooseBotLetter(prev.word, prev.guest);
        return letter ? guessLetter(prev, 'guest', letter, at).game : prev;
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [isBot, practice.phase, practice.guest.guessed.length, practice.guest.done]);

  // Practice end: local only, no points.
  useEffect(() => {
    if (!isBot || practice.phase !== 'finished' || practiceDoneRef.current) return undefined;
    practiceDoneRef.current = true;
    const won = practice.result?.winner === 'host';
    const stats: LiveMatchStats = {
      kind: 'hangman',
      playerScore: mine.points,
      opponentScore: ops.points,
      durationMs: Math.max(0, Date.now() - practice.startedAt),
      maxRounds: 1,
    };
    const timer = window.setTimeout(() => {
      onGameEndRef.current(won ? currentUser.username : 'BOT', 0, stats);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [currentUser.username, isBot, mine.points, ops.points, practice]);

  const done = isBot ? practice.phase === 'finished' : live.done;

  useEffect(() => {
    if (done) onMatchSettledRef.current?.();
  }, [done]);

  // ---------------------------------------------------------------- actions
  const letterState = (letter: string): 'open' | 'miss' | 'free' => {
    if (mine.guessed.includes(letter)) {
      return wordPattern.includes(letter) ? 'open' : 'miss';
    }
    return 'free';
  };

  const playLetterSound = (solved: boolean, wrongAfter: number, wrongBefore: number) => {
    if (solved) playGameSfx('success');
    else if (wrongAfter > wrongBefore) playGameSfx('fail');
  };

  const guess = useCallback(
    async (letter: string) => {
      if (!open) return;
      if (mine.guessed.includes(letter)) return;
      setLocalError(null);
      if (isBot) {
        const base = practiceRef.current;
        const result = guessLetter(base, 'host', letter, Date.now());
        if (result.error === 'ALREADY_GUESSED') {
          setLocalError('Bu harfi zaten denedin.');
          return;
        }
        playLetterSound(
          Boolean(result.game.host.solved),
          result.game.host.wrong,
          base.host.wrong
        );
        practiceRef.current = result.game;
        setPractice(result.game);
        return;
      }
      const result = await live.submitAction({ type: 'guess', letter });
      if (!result.ok && result.message) setLocalError(result.message);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, mine.guessed, isBot, practice, live.submitAction, wordPattern, mine.wrong]
  );

  const submitAttempt = async (event: React.FormEvent) => {
    event.preventDefault();
    const word = normalizeGuess(attempt);
    if (!word || !open) return;
    setAttempt('');
    setLocalError(null);
    if (isBot) {
      const result = solveWord(practiceRef.current, 'host', word, Date.now());
      practiceRef.current = result.game;
      setPractice(result.game);
      if (!result.game.host.solved) setLocalError('Kelime bu değil. İki hak gitti.');
      return;
    }
    const result = await live.submitAction({ type: 'solve', word });
    if (!result.ok && result.message) setLocalError(result.message);
  };

  // Physical keyboard: Turkish letters only, never while typing the guess.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const letter = event.key.length === 1 ? event.key.toLocaleLowerCase('tr-TR') : '';
      if (!isTurkishLetter(letter) || event.key === 'Enter') return;
      event.preventDefault();
      void guess(letter);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guess, open]);

  // One sound per closed board, ranked only (the server reports the counts).
  useEffect(() => {
    if (isBot || !engine?.revision) return;
    const key = `${engine.revision}:${mine.solved ? 'solved' : mine.done ? 'done' : 'open'}`;
    if (lastSoundRef.current === key) return;
    if (lastSoundRef.current !== null && mine.solved) playGameSfx('success');
    lastSoundRef.current = key;
  }, [engine?.revision, isBot, mine.done, mine.solved]);

  const wordVisible = Boolean(reveal?.word) || (isBot && practice.phase === 'finished');
  const word = reveal?.word || (isBot && practice.phase === 'finished' ? practice.word : null);
  const delta = reveal?.scoreDelta || null;

  // ------------------------------------------------------------------- view
  if (!isBot && !engine) {
    return (
      <section className="duo-game" aria-label={HANGMAN_GAME_TYPE} data-testid="hangman-game">
        <header className="duo-game-head mb-6">
          <div>
            <span className="duo-game-chip bg-candy-lavanta">{HANGMAN_GAME_TYPE}</span>
            <h2 className="duo-game-title">Kelime hazırlanıyor</h2>
            <p className="duo-game-sub">Sunucu kelimeyi seçiyor…</p>
          </div>
          <button type="button" onClick={onLeave} className="duo-quiet duo-focus shrink-0">
            Oyundan çık
          </button>
        </header>
        <p role="status" className="duo-game-status" aria-live="polite">
          Bağlantı kuruluyor…
        </p>
      </section>
    );
  }

  return (
    <section
      className="duo-game duo-hm"
      aria-label={HANGMAN_GAME_TYPE}
      data-testid="hangman-game"
      data-phase={phase || 'loading'}
    >
      <header className="duo-game-head mb-4">
        <div className="min-w-0">
          <span className="duo-game-chip bg-candy-lavanta">
            {isBot ? 'Antrenman' : `Tur ${(engine?.roundIndex || 1)}/${engine?.totalRounds || 3}`}
          </span>
          <span className="duo-game-chip ml-2 bg-paper-deep" data-testid="hangman-seconds">
            {seconds} sn
          </span>
          <h2 className="duo-game-title">{HANGMAN_GAME_TYPE}</h2>
          <p className="duo-game-sub truncate">
            {currentUser.username} / {opponent}
          </p>
        </div>
        <button type="button" onClick={onLeave} className="duo-quiet duo-focus shrink-0">
          Oyundan çık
        </button>
      </header>

      <div className="duo-hm-board">
        <div className="duo-hm-art">
          <Gallows wrong={mine.wrong} max={maxWrong} />
          <p className="duo-hm-meta">
            <span className="duo-hm-category">{category}</span>
            <span className="duo-hm-dots" aria-label={`zorluk ${difficulty}/3`}>
              {[1, 2, 3].map((level) => (
                <span
                  key={level}
                  className={`duo-hm-dot${level <= difficulty ? ' duo-hm-dot--on' : ''}`}
                  aria-hidden="true"
                />
              ))}
            </span>
          </p>
        </div>

        <div className="duo-hm-side">
          <div className="duo-hm-player">
            <span className="duo-hm-name">{currentUser.username}</span>
            <Lives wrong={mine.wrong} max={maxWrong} />
            <span className="duo-hm-score" data-testid="hangman-my-score">
              {myScore} puan
            </span>
          </div>
          <div className="duo-hm-player duo-hm-player--op">
            <span className="duo-hm-name">{opponent}</span>
            <Lives wrong={opProgress.wrong} max={maxWrong} />
            <span className="duo-hm-score" data-testid="hangman-op-score">
              {opScore} puan
            </span>
            <span className="duo-hm-progress">
              {opProgress.revealed}/{length} harf
            </span>
          </div>
        </div>
      </div>

      <WordTiles pattern={wordPattern} solved={mine.solved} />

      {wordVisible && (
        <p className="duo-hm-reveal" data-testid="hangman-reveal">
          Kelime: <strong>{word}</strong>
          {delta && (
            <span className="duo-hm-delta">
              {' '}
              +{delta[myKey]} / +{delta[opKey]} puan
            </span>
          )}
          {isBot && practiceResult && (
            <span className="duo-hm-delta">
              {' '}
              {practice.host.points} - {practice.guest.points}
            </span>
          )}
        </p>
      )}

      {phase === 'finished' && outcome && (
        <p className="duo-hm-outcome" role="status">
          {outcome}
        </p>
      )}

      <div className="duo-hm-keys" role="group" aria-label="Harf tahminleri">
        {KEY_ROWS.map((row, index) => (
          <div key={index} className="duo-hm-key-row">
            {row.map((letter) => {
              const state = letterState(letter);
              return (
                <button
                  key={letter}
                  type="button"
                  className={`duo-hm-key duo-focus duo-hm-key--${state}`}
                  onClick={() => void guess(letter)}
                  disabled={!open || state !== 'free' || live.pending}
                  aria-label={`${letter} harfi${state === 'open' ? ', doğru' : state === 'miss' ? ', yanlış' : ''}`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <form className="duo-hm-solve" onSubmit={submitAttempt}>
        <label className="duo-hm-solve-label" htmlFor="hm-attempt">
          Kelimenin tamamı <span>yanlışsa 2 hak gider</span>
        </label>
        <div className="duo-hm-solve-row">
          <input
            id="hm-attempt"
            ref={attemptRef}
            className="duo-hm-input"
            value={attempt}
            onChange={(event) => setAttempt(event.target.value)}
            placeholder={`${length} harf`}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            disabled={!open}
          />
          <RetroButton
            type="submit"
            variant="ink"
            className="shrink-0 whitespace-nowrap"
            disabled={!open || !attempt.trim()}
          >
            Tahmin et
          </RetroButton>
        </div>
      </form>

      {(localError || live.error) && (
        <p className="duo-bs-error" role="alert" aria-live="assertive">
          {localError || live.error}
        </p>
      )}

      {!isBot && (
        <p className="duo-hm-foot">
          Rakibin harfleri görünmez; yalnız kaç harf açtığı ve kaç hakkı kaldığı sayılır.
        </p>
      )}
    </section>
  );
};

export default HangmanGame;
