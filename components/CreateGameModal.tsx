/**
 * CreateGameModal — "Yeni oyun kur", in the v2 language (DESIGN.md).
 *
 * Three game cards, each filled with its game's colour when picked (Retro
 * Satranç gök, Bilgi Yarışı limon, Nişancı Düellosu lokum), the stake as a
 * range plus an underlined number input, preset chips, the optional chess
 * tempo and a slip-style summary that closes on an ink bar. Text content and
 * data-testid attributes are preserved so CreateGameModal.test.tsx passes:
 *   - "YENİ OYUN KUR", "KAPAT", "LOBİYE GÖNDER" (shown in sentence case via CSS)
 *   - "Mevcut Puanınız:" + the wallet balance
 *   - exact game descriptions for the 3 cards
 *   - "Min" / "100" / "250" / "Max" preset labels
 *   - "Oyun:" / "Katılım Puanı:" / "Kalan:" summary labels
 *   - data-testid: create-game-modal, game-type-{chess,knowledge,aim},
 *     game-points-input, create-game-submit
 */
import React, { useState, useEffect, useId } from 'react';
import { DialogLayer } from './ui/DialogLayer';
import { X, AlertTriangle, Check } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import type { Tournament } from '../types';

interface CreateGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    gameType: string,
    points: number,
    options?: {
      chessClock?: { baseSeconds: number; incrementSeconds: number; label: string };
      tournamentId?: number | null;
    }
  ) => Promise<void> | void;
  maxPoints: number;
  activeTournament?: Tournament | null;
}

interface GameDef {
  id: 'chess' | 'knowledge' | 'aim';
  name: string;
  category: string;
  description: string;
  minPoints: number;
  /** The game's colour from DESIGN.md: gök, limon or lokum. */
  tone: 'gok' | 'limon' | 'lokum';
}

// PR #36 — stake bounds rewritten: minimum dropped (0-point matches OK for
// fun), shared max cap of 150 across all game types. Backend mirrors this
// in gameValidators.js and createGameHandler.js.
const STAKE_MAX = 150;

const GAME_TYPES: GameDef[] = [
  {
    id: 'chess',
    name: 'Retro Satranç',
    category: 'Strateji',
    description: 'Klasik 2 oyunculu satranç. Gerçek zamanlı ve hamle doğrulamalı.',
    minPoints: 0,
    tone: 'gok',
  },
  {
    id: 'knowledge',
    name: 'Bilgi Yarışı',
    category: 'Bilgi',
    description: 'Kısa bilgi sorularında doğru cevabı en hızlı ver',
    minPoints: 0,
    tone: 'limon',
  },
  {
    id: 'aim',
    name: 'Nişancı Düellosu',
    category: 'Refleks',
    description: 'Nişangahı merkeze kilitle, tur tur isabet topla.',
    minPoints: 0,
    tone: 'lokum',
  },
];

const CHESS_TEMPO_OPTIONS = [
  { id: 'bullet_1_1', label: '1+1 Bullet', baseSeconds: 60, incrementSeconds: 1 },
  { id: 'blitz_3_2', label: '3+2 Blitz', baseSeconds: 180, incrementSeconds: 2 },
  { id: 'rapid_5_3', label: '5+3 Rapid', baseSeconds: 300, incrementSeconds: 3 },
  { id: 'rapid_10_5', label: '10+5 Rapid', baseSeconds: 600, incrementSeconds: 5 },
] as const;

interface ValidationError {
  gameType?: string;
  points?: string;
}

const TONE_FILL: Record<GameDef['tone'], string> = {
  gok: 'bg-riso-blue',
  limon: 'bg-riso-mustard',
  lokum: 'bg-riso-pink',
};

export const CreateGameModal: React.FC<CreateGameModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  maxPoints: maxPointsProp,
  activeTournament = null,
}) => {
  // Cap the user-visible max at STAKE_MAX (150). Even if the user has a
  // bigger wallet, a single match's stake is bounded — keeps loss exposure
  // sane and matches the backend validator.
  const maxPoints = Math.min(maxPointsProp ?? 0, STAKE_MAX);
  const [gameType, setGameType] = useState('Nişancı Düellosu');
  const [points, setPoints] = useState(0);
  const [chessTempoId, setChessTempoId] =
    useState<(typeof CHESS_TEMPO_OPTIONS)[number]['id']>('blitz_3_2');
  const [errors, setErrors] = useState<ValidationError>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const gameTypeLabelId = useId();

  const toast = useToast();
  const [joinTournament, setJoinTournament] = useState(false);
  React.useEffect(() => {
    if (!isOpen) setJoinTournament(false);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setGameType('Nişancı Düellosu');
      setPoints(0);
      setChessTempoId('blitz_3_2');
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
      setSubmitError(null);
    }
  }, [isOpen]);

  const selectedGame = GAME_TYPES.find((g) => g.name === gameType);
  const minPoints = selectedGame?.minPoints || 0;

  const validate = (): boolean => {
    const newErrors: ValidationError = {};
    if (!gameType) newErrors.gameType = 'Oyun türü seçmelisiniz';
    if (points < minPoints) newErrors.points = `${gameType} için minimum ${minPoints} puan gerekli`;
    if (points > maxPoints) newErrors.points = `Maksimum ${maxPoints} puan kullanabilirsiniz`;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePointsChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    setPoints(numValue);
    if (touched.points) {
      const newErrors: ValidationError = { ...errors };
      if (numValue < minPoints)
        newErrors.points = `${gameType} için minimum ${minPoints} puan gerekli`;
      else if (numValue > maxPoints)
        newErrors.points = `Maksimum ${maxPoints} puan kullanabilirsiniz`;
      else delete newErrors.points;
      setErrors(newErrors);
    }
  };

  const handleGameTypeChange = (newGameType: string) => {
    setGameType(newGameType);
    const game = GAME_TYPES.find((g) => g.name === newGameType);
    const newMinPoints = game?.minPoints || 0;
    if (points < newMinPoints) {
      setPoints(newMinPoints);
      toast.warning(`${newGameType} için minimum ${newMinPoints} puan ayarlandı`);
    }
    if (errors.gameType) {
      setErrors((prev) => ({ ...prev, gameType: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ gameType: true, points: true });
    if (!validate()) {
      setSubmitError('Lütfen form hatalarını düzeltin.');
      toast.error('Lütfen form hatalarını düzeltin');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const selectedTempo =
        CHESS_TEMPO_OPTIONS.find((tempo) => tempo.id === chessTempoId) || CHESS_TEMPO_OPTIONS[1];
      const baseOptions: {
        chessClock?: { baseSeconds: number; incrementSeconds: number; label: string };
        tournamentId?: number | null;
      } = {};
      if (gameType === 'Retro Satranç') {
        baseOptions.chessClock = {
          baseSeconds: selectedTempo.baseSeconds,
          incrementSeconds: selectedTempo.incrementSeconds,
          label: selectedTempo.label,
        };
      }
      if (joinTournament && activeTournament?.id) {
        baseOptions.tournamentId = activeTournament.id;
      }
      const options = Object.keys(baseOptions).length > 0 ? baseOptions : undefined;
      await Promise.resolve(onSubmit(gameType, points, options));
      toast.success(`${gameType} oyunu oluşturuldu!`);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error && err.message ? err.message : 'Oyun oluşturulamadı';
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const presetPoints = [
    { label: 'Min', value: minPoints },
    { label: '100', value: 100 },
    { label: '250', value: 250 },
    { label: 'Max', value: maxPoints },
  ].filter((p) => p.value >= minPoints && p.value <= maxPoints);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const selectedTempoLabel = (
    CHESS_TEMPO_OPTIONS.find((tempo) => tempo.id === chessTempoId) || CHESS_TEMPO_OPTIONS[1]
  ).label;
  const remaining = maxPointsProp - points;

  return (
    <DialogLayer open={isOpen} onClose={onClose} label="Yeni oyun kur">
      <div className="riso-kantin fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6">
        {/* Backdrop — covers whole viewport, click closes */}
        <div className="absolute inset-0 bg-carbon/60" onClick={onClose} aria-hidden="true" />

        <div
          className="duo-float relative flex flex-col w-full max-w-2xl bg-paper text-carbon max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)]"
          data-testid="create-game-modal"
        >
          {/* Sticky header */}
          <div className="shrink-0 flex items-center justify-between gap-4 px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
            <h3 className="font-riso-display text-[28px] leading-none sm:text-[40px]">
              <span className="duo-sentence">YENİ OYUN KUR</span>
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Oyun kurma penceresini kapat"
              className="riso-focus inline-flex h-11 w-11 items-center justify-center bg-paper-deep text-carbon transition-colors hover:bg-paper-dim"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>

          {/* Scrollable body — flex-1 + overflow-y-auto so mouse wheel reaches here */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-5 sm:px-6 space-y-6">
            {/* Points info — show the user's true wallet balance, not the
              per-match stake cap. Form validation uses the capped value
              (`maxPoints`) but the display shows what they actually have. */}
            <div className="flex items-center justify-between bg-riso-spring px-4 py-2.5">
              <span className="font-riso-body text-[15px] font-medium">Mevcut Puanınız:</span>
              <span className="font-riso-mono text-2xl font-bold leading-none">
                {maxPointsProp}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Game type */}
              <div>
                <p id={gameTypeLabelId} className="mb-2 text-[15px] font-semibold">
                  Oyun türü seç
                </p>
                <div
                  role="group"
                  aria-labelledby={gameTypeLabelId}
                  className="grid grid-cols-3 gap-2"
                >
                  {GAME_TYPES.map((game) => {
                    const active = gameType === game.name;
                    return (
                      <button
                        key={game.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => handleGameTypeChange(game.name)}
                        data-testid={`game-type-${game.id}`}
                        className={`riso-focus relative w-full p-2.5 sm:p-3 text-left text-carbon transition-colors ${
                          active ? TONE_FILL[game.tone] : 'bg-paper-deep hover:bg-paper-dim'
                        }`}
                      >
                        <div className="flex h-full flex-col">
                          <div className="mb-2 flex items-start justify-between gap-1">
                            <span
                              className={`inline-flex px-1.5 py-0.5 text-xs font-medium sm:text-[15px] ${
                                active ? 'bg-paper' : TONE_FILL[game.tone]
                              }`}
                            >
                              {game.category}
                            </span>
                            {active && <Check size={18} strokeWidth={2.6} aria-hidden="true" />}
                          </div>

                          <div className="mb-1 font-riso-body text-sm font-bold leading-tight sm:text-base">
                            {game.name}
                          </div>

                          <div
                            className={`hidden sm:block flex-1 text-[15px] leading-snug ${
                              active ? 'text-carbon' : 'text-carbon-muted'
                            }`}
                          >
                            {game.description}
                          </div>

                          {game.minPoints > 0 && (
                            <div className="hidden sm:block mt-auto pt-2 text-[15px] font-semibold">
                              <span className="duo-sentence">MIN {game.minPoints} PUAN</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {errors.gameType && (
                  <p className="mt-2 font-riso-body text-sm text-riso-redox flex items-center gap-1.5">
                    <AlertTriangle size={14} strokeWidth={2.5} /> {errors.gameType}
                  </p>
                )}
              </div>

              {/* Points slider */}
              <div>
                <label className="mb-2 flex justify-between gap-3 text-[15px] font-semibold">
                  <span>Puan yatırımı</span>
                  <span className="font-riso-mono">{`${points} / ${maxPoints}`}</span>
                </label>

                <input
                  type="range"
                  aria-label="Katılım puanı"
                  min={minPoints}
                  max={maxPoints}
                  value={points}
                  onChange={(e) => handlePointsChange(e.target.value)}
                  className="mb-3 h-2 w-full cursor-pointer accent-riso-pink"
                />

                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    aria-label="Katılım puanı (sayı)"
                    value={points}
                    onChange={(e) => handlePointsChange(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, points: true }))}
                    min={minPoints}
                    max={maxPoints}
                    data-testid="game-points-input"
                    style={{ colorScheme: 'light' }}
                    className={`riso-focus min-h-[52px] flex-1 border-0 border-b-[3px] bg-paper-deep px-3.5 font-riso-mono text-xl font-bold text-carbon text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                      errors.points && touched.points ? 'border-riso-redox' : 'border-carbon'
                    }`}
                  />
                  <span className="text-[15px] font-medium text-carbon-muted">puan</span>
                </div>

                {/* Preset buttons */}
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {presetPoints.map((preset) => {
                    const active = points === preset.value;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => handlePointsChange(preset.value.toString())}
                        className={`riso-focus min-h-11 px-2 font-riso-body text-[15px] font-semibold text-carbon transition-colors ${
                          active ? 'bg-riso-pink' : 'bg-paper-deep hover:bg-paper-dim'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {errors.points && touched.points && (
                  <p className="mt-2 font-riso-body text-sm text-riso-redox flex items-center gap-1.5">
                    <AlertTriangle size={14} strokeWidth={2.5} /> {errors.points}
                  </p>
                )}
              </div>

              {/* Chess tempo (conditional) */}
              {gameType === 'Retro Satranç' && (
                <div>
                  <p className="mb-2 text-[15px] font-semibold">Satranç temposu</p>
                  <div className="grid grid-cols-2 gap-2">
                    {CHESS_TEMPO_OPTIONS.map((tempo) => {
                      const active = chessTempoId === tempo.id;
                      return (
                        <button
                          key={tempo.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setChessTempoId(tempo.id)}
                          className={`riso-focus min-h-11 px-3 font-riso-body text-[15px] font-semibold text-carbon transition-colors ${
                            active ? 'bg-riso-blue' : 'bg-paper-deep hover:bg-paper-dim'
                          }`}
                        >
                          {tempo.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary — the order slip: dotted leaders, closing on an ink bar. */}
              <div className="font-riso-body text-[15px]">
                <div className="duo-leader-row">
                  <span className="text-carbon-muted">Oyun:</span>
                  <span className="duo-leader-dots" aria-hidden="true" />
                  <span className="duo-leader-value">{gameType}</span>
                </div>
                <div className="duo-leader-row">
                  <span className="text-carbon-muted">Katılım Puanı:</span>
                  <span className="duo-leader-dots" aria-hidden="true" />
                  <span className="duo-leader-value">{`${points} Puan`}</span>
                </div>
                {gameType === 'Retro Satranç' && (
                  <div className="duo-leader-row">
                    <span className="text-carbon-muted">Tempo:</span>
                    <span className="duo-leader-dots" aria-hidden="true" />
                    <span className="duo-leader-value">{selectedTempoLabel}</span>
                  </div>
                )}
                <div
                  className={`mt-3 flex min-h-11 items-center justify-between gap-3 px-3.5 text-paper ${
                    remaining >= 0 ? 'bg-carbon' : 'bg-riso-redox'
                  }`}
                >
                  <span>Kalan:</span>
                  <span className="font-riso-mono font-bold">{remaining} Puan</span>
                </div>
              </div>
              {activeTournament && (
                <label
                  className="riso-focus flex cursor-pointer items-center justify-between gap-3 bg-paper-deep p-3 transition-colors hover:bg-paper-dim"
                  data-testid="create-game-tournament-toggle"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">Bu turnuvaya katıl</p>
                    <p className="truncate text-[15px] text-carbon-muted">
                      {activeTournament.name}
                      {activeTournament.game_type
                        ? ` · ${activeTournament.game_type}`
                        : ' · Tüm oyunlar'}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={joinTournament}
                    onChange={(e) => setJoinTournament(e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-riso-pink"
                    aria-label="Turnuvaya katıl"
                  />
                </label>
              )}
            </form>
          </div>

          {/* Sticky footer — a tear line above the two actions */}
          <div className="duo-tear shrink-0 grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[0.38fr_1fr] sm:px-6">
            {submitError && (
              <p role="alert" className="col-span-full text-sm text-riso-redox">
                {submitError}
              </p>
            )}
            <button type="button" onClick={onClose} className="duo-quiet riso-focus min-h-12">
              <span className="duo-sentence">KAPAT</span>
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              onClick={handleSubmit}
              data-testid="create-game-submit"
              className="duo-button riso-focus min-h-12 w-full bg-riso-pink px-5 font-riso-body text-base font-semibold text-carbon transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin border-2 border-carbon/30 border-t-carbon" />
                  Oluşturuluyor...
                </span>
              ) : (
                <span className="duo-sentence">LOBİYE GÖNDER</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </DialogLayer>
  );
};
