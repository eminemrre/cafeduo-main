import React, { useRef, useState } from 'react';
import type { Chess, PieceSymbol, Square } from 'chess.js';
import { ChessPieceIcon } from './games/ChessPieceIcons';

const INITIAL_FEN = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const NAMES: Record<PieceSymbol, string> = {
  p: 'piyon',
  n: 'at',
  b: 'fil',
  r: 'kale',
  q: 'vezir',
  k: 'şah',
};
const readPosition = (fen: string) =>
  fen
    .split(' ')[0]
    .split('/')
    .flatMap((rank, row) => {
      const pieces: Array<{ square: Square; piece: PieceSymbol | null; color: 'w' | 'b' }> = [];
      for (const token of rank) {
        const count = Number(token);
        if (count) {
          for (let i = 0; i < count; i++)
            pieces.push({
              square: `${'abcdefgh'[pieces.length]}${8 - row}` as Square,
              piece: null,
              color: 'w',
            });
        } else
          pieces.push({
            square: `${'abcdefgh'[pieces.length]}${8 - row}` as Square,
            piece: token.toLowerCase() as PieceSymbol,
            color: token === token.toUpperCase() ? 'w' : 'b',
          });
      }
      return pieces;
    });

export const ClubBoardPreview: React.FC = () => {
  const gameRef = useRef<Chess | null>(null);
  const busyRef = useRef(false);
  const [position, setPosition] = useState(() => readPosition(INITIAL_FEN));
  const [selected, setSelected] = useState<Square | null>(null);
  const [activeSquare, setActiveSquare] = useState<Square>('g1');
  const [targets, setTargets] = useState<Square[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Beyaz taşlar sende. Bir taş seç.');
  const [notation, setNotation] = useState('1. e4 c5');

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
        // A deterministic legal reply, not a rated opponent or server match.
        const replies = game.moves({ verbose: true });
        const reply =
          replies.find((candidate) => candidate.piece === 'p' && candidate.to === 'd6') ||
          replies.find((candidate) => candidate.piece === 'n') ||
          replies[0];
        const response = reply ? game.move(reply) : null;
        const history = game.history();
        setNotation(
          `1. e4 c5 ${history.map((san, i) => `${i % 2 === 0 ? `${Math.floor(i / 2) + 2}. ` : ''}${san}`).join(' ')}`
        );
        setPosition(readPosition(game.fen()));
        setSelected(null);
        setTargets([]);
        setMessage(
          game.isGameOver()
            ? 'Deneme bitti. İstersen baştan başlayabilirsin.'
            : `${move.san} oynadın.${response ? ` Siyahın yanıtı ${response.san}.` : ''} Sıra sende.`
        );
        return;
      }
      const piece = game.get(square);
      if (piece?.color === 'w' && !game.isGameOver()) {
        setSelected(square);
        setTargets(game.moves({ square, verbose: true }).map((move) => move.to));
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
    setNotation('1. e4 c5');
    setMessage('Beyaz taşlar sende. Bir taş seç.');
  };

  return (
    <div className="club-board-preview" aria-label="Satranç deneme tahtası">
      <div className="club-board-label">
        <span>Tahtayı dene</span>
        <span>Retro Satranç</span>
      </div>
      <div
        className="club-board"
        role="group"
        aria-label="Satranç tahtası"
        aria-describedby="club-board-help"
        aria-busy={busy}
      >
        {position.map(({ square, piece, color }, i) => (
          <button
            key={square}
            type="button"
            data-testid={`preview-square-${square}`}
            className={`club-square ${(Math.floor(i / 8) + i) % 2 ? 'club-square-dark' : ''} ${selected === square ? 'club-square-selected' : ''}`}
            aria-label={`${square}${piece ? `, ${color === 'w' ? 'beyaz' : 'siyah'} ${NAMES[piece]}` : ', boş'}`}
            aria-pressed={selected === square}
            tabIndex={activeSquare === square ? 0 : -1}
            onFocus={() => setActiveSquare(square)}
            onKeyDown={(event) => {
              const delta: Record<string, number> = {
                ArrowUp: -8,
                ArrowDown: 8,
                ArrowLeft: -1,
                ArrowRight: 1,
              };
              if (!(event.key in delta)) return;
              event.preventDefault();
              const next = i + delta[event.key];
              if (
                next < 0 ||
                next > 63 ||
                ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
                  Math.floor(next / 8) !== Math.floor(i / 8))
              )
                return;
              const buttons =
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button');
              buttons?.[next]?.focus();
            }}
            aria-disabled={busy}
            onClick={() => void chooseSquare(square)}
          >
            {i % 8 === 0 && (
              <span className="club-rank" aria-hidden="true">
                {8 - Math.floor(i / 8)}
              </span>
            )}
            {i >= 56 && (
              <span className="club-file" aria-hidden="true">
                {'abcdefgh'[i % 8]}
              </span>
            )}
            {piece && <ChessPieceIcon type={piece} color={color} />}
            {targets.includes(square) && <span className="club-move-dot" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className="club-board-under">
        <span className="club-notation" aria-label="Oynanan hamleler">
          {notation}
        </span>
        <button type="button" className="riso-focus" onClick={reset} disabled={busy}>
          Baştan
        </button>
      </div>
      <p id="club-board-help" className="club-board-help" aria-live="polite">
        {message}
      </p>
      <p className="club-board-note">Deneme tahtasıdır. Siyah otomatik oynar; puan kazanılmaz.</p>
    </div>
  );
};
