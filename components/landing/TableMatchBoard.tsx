/**
 * The hero's live fragment: a real chess board against the café table MASA07.
 * White is the visitor; MASA07 answers with a deterministic legal reply. Nothing is sent to
 * the server and no points are won. Each reply tells the hero to bring a district into focus.
 */
import React, { useRef, useState } from 'react';
import type { Chess, PieceSymbol, Square } from 'chess.js';
import { ChessPieceIcon } from '../games/ChessPieceIcons';
import type { LandingPhoto } from './landingContent';

const INITIAL_FEN = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const OPENING = '1. e4 c5';
const NAMES: Record<PieceSymbol, string> = {
  p: 'piyon',
  n: 'at',
  b: 'fil',
  r: 'kale',
  q: 'vezir',
  k: 'şah',
};
const FILES = 'abcdefgh';

type Cell = { square: Square; piece: PieceSymbol | null; color: 'w' | 'b' };

const readPosition = (fen: string): Cell[] =>
  fen
    .split(' ')[0]
    .split('/')
    .flatMap((rank, row) => {
      const cells: Cell[] = [];
      for (const token of rank) {
        const empty = Number(token);
        if (empty) {
          for (let i = 0; i < empty; i++)
            cells.push({
              square: `${FILES[cells.length]}${8 - row}` as Square,
              piece: null,
              color: 'w',
            });
        } else
          cells.push({
            square: `${FILES[cells.length]}${8 - row}` as Square,
            piece: token.toLowerCase() as PieceSymbol,
            color: token === token.toUpperCase() ? 'w' : 'b',
          });
      }
      return cells;
    });

const formatHistory = (history: string[]) =>
  `${OPENING} ${history
    .map((san, i) => `${i % 2 === 0 ? `${Math.floor(i / 2) + 2}. ` : ''}${san}`)
    .join(' ')}`.trim();

interface TableMatchBoardProps {
  district: LandingPhoto;
  revealed: boolean;
  onReply: () => void;
  onReset: () => void;
}

export const TableMatchBoard: React.FC<TableMatchBoardProps> = ({
  district,
  revealed,
  onReply,
  onReset,
}) => {
  const gameRef = useRef<Chess | null>(null);
  const busyRef = useRef(false);
  const [position, setPosition] = useState(() => readPosition(INITIAL_FEN));
  const [selected, setSelected] = useState<Square | null>(null);
  const [activeSquare, setActiveSquare] = useState<Square>('g1');
  const [targets, setTargets] = useState<Square[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Beyaz taşlar sende. Bir taş seç, MASA07 yanıt versin.');
  const [lastMoves, setLastMoves] = useState<Array<{ from: Square; to: Square; reply: boolean }>>(
    []
  );
  const [notation, setNotation] = useState(OPENING);
  const [turn, setTurn] = useState<'you' | 'table'>('you');

  const chooseSquare = async (square: Square) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (!gameRef.current) {
        const { Chess } = await import('chess.js');
        gameRef.current = new Chess(INITIAL_FEN);
      }
      const game = gameRef.current;
      if (selected && targets.includes(square)) {
        const move = game.move({ from: selected, to: square, promotion: 'q' });
        const replies = game.moves({ verbose: true });
        const reply =
          replies.find((candidate) => candidate.piece === 'p' && candidate.to === 'd6') ||
          replies.find((candidate) => candidate.piece === 'n') ||
          replies[0];
        const response = reply ? game.move(reply) : null;
        setNotation(formatHistory(game.history()));
        setLastMoves([
          { from: move.from, to: move.to, reply: false },
          ...(response ? [{ from: response.from, to: response.to, reply: true }] : []),
        ]);
        setPosition(readPosition(game.fen()));
        setSelected(null);
        setTargets([]);
        setTurn(response ? 'table' : 'you');
        setMessage(
          game.isGameOver()
            ? 'Deneme bitti. İstersen baştan başlayabilirsin.'
            : `${move.san} oynadın.${response ? ` MASA07 ${response.san} ile yanıt verdi.` : ''} Sıra sende.`
        );
        if (response) onReply();
        return;
      }
      const piece = game.get(square);
      if (piece?.color === 'w' && !game.isGameOver()) {
        setSelected(square);
        setTurn('you');
        setTargets(game.moves({ square, verbose: true }).map((candidate) => candidate.to));
        setMessage(`${square} seçildi. İşaretli karelerden birine oyna.`);
      } else {
        setSelected(null);
        setTargets([]);
        setMessage('Beyaz taşlardan birini seç.');
      }
    } catch {
      setMessage('Tahta şu an açılamadı. Yeniden deneyebilirsin.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const reset = () => {
    if (busyRef.current) return;
    gameRef.current = null;
    setPosition(readPosition(INITIAL_FEN));
    setSelected(null);
    setTargets([]);
    setLastMoves([]);
    setNotation(OPENING);
    setTurn('you');
    setMessage('Beyaz taşlar sende. Bir taş seç, MASA07 yanıt versin.');
    onReset();
  };

  const moveFocus = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta: Record<string, number> = { ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1 };
    if (!(event.key in delta)) return;
    event.preventDefault();
    const next = index + delta[event.key];
    const sameRow = Math.floor(next / 8) === Math.floor(index / 8);
    if (next < 0 || next > 63 || ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !sameRow))
      return;
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  };

  return (
    <div className="cdl-match" data-ui aria-label="MASA07 ile deneme satranç maçı" role="region">
      <div className="cdl-match-head">
        <span className="cdl-match-game">
          Retro Satranç <span>3+2</span>
        </span>
        <span className="cdl-match-turn" data-turn={turn}>
          {turn === 'you' ? 'Sıra sende' : 'MASA07 oynadı'}
        </span>
      </div>
      <div className="cdl-match-body">
        <div
          className="cdl-board"
          role="group"
          aria-label="Satranç tahtası, beyaz sende"
          aria-describedby="cdl-board-help"
          aria-busy={busy}
        >
          {position.map(({ square, piece, color }, i) => {
            const arrival = lastMoves.find((move) => move.to === square);
            const recent = lastMoves.some((move) => move.from === square || move.to === square);
            return (
              <button
                key={square}
                type="button"
                data-testid={`preview-square-${square}`}
                className={`cdl-square${(Math.floor(i / 8) + i) % 2 ? ' is-dark' : ''}${selected === square ? ' is-selected' : ''}${recent ? ' is-recent' : ''}`}
                aria-label={`${square}${piece ? `, ${color === 'w' ? 'beyaz' : 'siyah'} ${NAMES[piece]}` : ', boş'}`}
                aria-pressed={selected === square}
                aria-disabled={busy}
                tabIndex={activeSquare === square ? 0 : -1}
                onFocus={() => setActiveSquare(square)}
                onKeyDown={(event) => moveFocus(event, i)}
                onClick={() => void chooseSquare(square)}
              >
                {i % 8 === 0 && (
                  <span className="cdl-rank" aria-hidden="true">
                    {8 - Math.floor(i / 8)}
                  </span>
                )}
                {i >= 56 && (
                  <span className="cdl-file" aria-hidden="true">
                    {FILES[i % 8]}
                  </span>
                )}
                {piece && (
                  <span
                    className={`cdl-piece${arrival ? ' is-arriving' : ''}${arrival?.reply ? ' is-reply' : ''}`}
                    style={
                      arrival
                        ? ({
                            '--move-x': `${(arrival.from.charCodeAt(0) - square.charCodeAt(0)) * 100}%`,
                            '--move-y': `${(Number(square[1]) - Number(arrival.from[1])) * 100}%`,
                          } as React.CSSProperties)
                        : undefined
                    }
                  >
                    <ChessPieceIcon type={piece} color={color} />
                  </span>
                )}
                {targets.includes(square) && <span className="cdl-move-dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="cdl-match-side">
          <div className="cdl-match-rival">
            <span>Rakip masa</span>
            <strong>MASA07</strong>
          </div>
          <p className="cdl-match-moves" aria-label="Oynanan hamleler">
            {notation}
          </p>
          <p id="cdl-board-help" className="cdl-match-status" aria-live="polite">
            {message}
          </p>
          <div className="cdl-match-place" data-revealed={revealed} aria-live="polite">
            {revealed ? (
              <>
                <strong>{district.district}</strong>
                <span>Sıradaki masa burada olabilir.</span>
                <a href={district.source} target="_blank" rel="noopener noreferrer">
                  Fotoğraf: {district.creator}, {district.licence}
                </a>
              </>
            ) : (
              <span>Bir hamle yap; MASA07’nin yanıtı bir İzmir semtini netleştirir.</span>
            )}
          </div>
          <button type="button" className="cdl-match-reset" onClick={reset} disabled={busy}>
            Baştan
          </button>
        </div>
      </div>
      <p className="cdl-match-note">Deneme tahtası. MASA07 otomatik oynar; puan kazanılmaz.</p>
    </div>
  );
};
