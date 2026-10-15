/**
 * CreateGameModal — Riso Kantin redesign (PR #27).
 *
 * "Yeni Oyun Kur" modal. Three game cards (Retro Satranç / Bilgi Yarışı /
 * Nişancı Düellosu) with spot-coloured chips, an inked range slider for
 * the stake, preset buttons, optional chess tempo grid, and a summary
 * panel. All text content + data-testid attributes are preserved exactly
 * so CreateGameModal.test.tsx passes without edits:
 *   - "YENİ OYUN KUR" header literal
 *   - "Mevcut Puanınız:" + max points number
 *   - exact game descriptions for the 3 cards
 *   - "Min" / "100" / "250" / "Max" preset labels
 *   - "Oyun:" / "Katılım Puanı:" / "Kalan:" summary labels
 *   - "MIN N PUAN" minPoints labels
 *   - data-testid: create-game-modal, game-type-{chess,knowledge,aim},
 *     game-points-input, create-game-submit
 */
import React, { useState, useEffect, useId } from 'react';
import { DialogLayer } from './ui/DialogLayer';
import { X, AlertTriangle, Check, Trophy } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { Button } from './ui';
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
  tone: 'mustard' | 'blue' | 'pink';
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
    tone: 'mustard',
  },
  {
    id: 'knowledge',
    name: 'Bilgi Yarışı',
    category: 'Bilgi',
    description: 'Kısa bilgi sorularında doğru cevabı en hızlı ver',
    minPoints: 0,
    tone: 'blue',
  },
  {
    id: 'aim',
    name: 'Nişancı Düellosu',
    category: 'Refleks',
    description: 'Nişangahı merkeze kilitle, tur tur isabet topla.',
    minPoints: 0,
    tone: 'pink',
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

const TONE_BG: Record<GameDef['tone'], string> = {
  mustard: 'bg-riso-mustard text-carbon',
  blue: 'bg-riso-blue text-paper',
  pink: 'bg-riso-pink text-carbon',
};

const TONE_ACTIVE_BG: Record<GameDef['tone'], string> = {
  mustard: 'bg-riso-mustard',
  blue: 'bg-riso-blue/15',
  pink: 'bg-riso-pink',
};

const TONE_ACTIVE_TEXT: Record<GameDef['tone'], string> = {
  mustard: 'text-carbon',
  blue: 'text-carbon',
  pink: 'text-carbon',
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

  return (
    <DialogLayer open={isOpen} onClose={onClose} label="Yeni oyun kur">
      <div className="riso-kantin fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6">
        {/* Backdrop — covers whole viewport, click closes */}
        <div className="absolute inset-0 bg-carbon/80" onClick={onClose} aria-hidden="true" />

        <div
          className="relative flex flex-col w-full max-w-2xl bg-paper border-2 border-carbon riso-shadow-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)]"
          data-testid="create-game-modal"
        >
          {/* Sticky header */}
          <div className="shrink-0 flex items-center justify-between border-b-2 border-carbon bg-paper-deep px-4 py-3">
            <h3 className="font-riso-display text-lg sm:text-xl text-carbon">YENİ OYUN KUR</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Oyun kurma penceresini kapat"
              className="riso-focus inline-flex h-11 w-11 items-center justify-center border-2 border-carbon bg-paper text-carbon transition-colors hover:bg-riso-redox hover:text-paper"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          {/* Scrollable body — flex-1 + overflow-y-auto so mouse wheel reaches here */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5 space-y-4 sm:space-y-5">
            {/* Points info — show the user's true wallet balance, not the
              per-match stake cap. Form validation uses the capped value
              (`maxPoints`) but the display shows what they actually have. */}
            <div className="flex items-center justify-between border-2 border-carbon bg-riso-mustard px-3 py-2">
              <span className="font-riso-body text-sm font-semibold text-carbon">
                Mevcut Puanınız:
              </span>
              <span className="font-riso-display text-lg sm:text-xl text-carbon flex items-center gap-1.5">
                <Trophy size={16} strokeWidth={2.5} />
                {maxPointsProp}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Game type */}
              <div>
                <p
                  id={gameTypeLabelId}
                  className="block font-riso-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-carbon-soft mb-2"
                >
                  OYUN TÜRÜ SEÇ
                </p>
                <div
                  role="group"
                  aria-labelledby={gameTypeLabelId}
                  className="grid grid-cols-3 gap-2 sm:gap-3"
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
                        className={`riso-focus relative w-full p-2 sm:p-3 text-left border-2 transition-all ${
                          active
                            ? `border-carbon ${TONE_ACTIVE_BG[game.tone]} ${TONE_ACTIVE_TEXT[game.tone]} riso-shadow-sm`
                            : 'border-carbon bg-paper text-carbon hover:bg-paper-deep'
                        }`}
                      >
                        <div className="flex h-full flex-col">
                          <div className="mb-2 flex items-start justify-between">
                            <span
                              className={`inline-flex border-2 border-carbon px-1.5 py-0.5 font-riso-mono text-[0.55rem] sm:text-[0.65rem] font-bold uppercase tracking-[0.1em] sm:tracking-[0.12em] ${TONE_BG[game.tone]}`}
                            >
                              {game.category}
                            </span>
                            {active && (
                              <Check size={18} strokeWidth={2.6} className="text-carbon" />
                            )}
                          </div>

                          <div className="font-riso-display text-xs sm:text-lg leading-tight mb-1 sm:mb-1.5">
                            {game.name}
                          </div>

                          <div className="hidden sm:block font-riso-body text-xs leading-snug flex-1 mb-2 text-carbon-soft">
                            {game.description}
                          </div>

                          {game.minPoints > 0 && (
                            <div className="hidden sm:block font-riso-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] mt-auto pt-2 border-t-2 border-carbon">
                              MIN {game.minPoints} PUAN
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {errors.gameType && (
                  <p className="mt-2 font-riso-body text-xs text-riso-redox flex items-center gap-1.5">
                    <AlertTriangle size={12} strokeWidth={2.5} /> {errors.gameType}
                  </p>
                )}
              </div>

              {/* Points slider */}
              <div>
                <label className="flex justify-between font-riso-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] mb-2">
                  <span className="text-carbon-soft">ENERJİ (PUAN) YATIRIMI</span>
                  <span className="text-riso-pink-deep">{`${points} / ${maxPoints}`}</span>
                </label>

                <div className="border-2 border-carbon bg-paper-deep p-2.5 sm:p-3">
                  <input
                    type="range"
                    aria-label="Katılım puanı"
                    min={minPoints}
                    max={maxPoints}
                    value={points}
                    onChange={(e) => handlePointsChange(e.target.value)}
                    className="w-full h-2 bg-paper-dim cursor-pointer accent-riso-pink mb-3"
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
                      style={{ backgroundColor: '#FBF7EE', color: '#141413', colorScheme: 'light' }}
                      className={`riso-focus flex-1 border-2 p-2 font-riso-display text-lg text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                        errors.points && touched.points ? 'border-riso-redox' : 'border-carbon'
                      }`}
                    />
                    <div className="font-riso-mono text-xs font-bold uppercase tracking-wider text-carbon-soft">
                      PUAN
                    </div>
                  </div>
                </div>

                {/* Preset buttons */}
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {presetPoints.map((preset) => {
                    const active = points === preset.value;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handlePointsChange(preset.value.toString())}
                        className={`riso-focus py-2 px-2 font-riso-body text-sm font-bold border-2 border-carbon transition-colors ${
                          active
                            ? 'bg-riso-pink text-carbon riso-shadow-sm'
                            : 'bg-paper text-carbon hover:bg-paper-deep'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {errors.points && touched.points && (
                  <p className="mt-2 font-riso-body text-xs text-riso-redox flex items-center gap-1.5">
                    <AlertTriangle size={12} strokeWidth={2.5} /> {errors.points}
                  </p>
                )}
              </div>

              {/* Chess tempo (conditional) */}
              {gameType === 'Retro Satranç' && (
                <div>
                  <label className="block font-riso-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-carbon-soft mb-2">
                    SATRANÇ TEMPOSU
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CHESS_TEMPO_OPTIONS.map((tempo) => {
                      const active = chessTempoId === tempo.id;
                      return (
                        <button
                          key={tempo.id}
                          type="button"
                          onClick={() => setChessTempoId(tempo.id)}
                          className={`riso-focus px-3 py-2 font-riso-body text-sm font-bold border-2 border-carbon transition-colors ${
                            active
                              ? 'bg-riso-mustard text-carbon riso-shadow-sm'
                              : 'bg-paper text-carbon hover:bg-paper-deep'
                          }`}
                        >
                          {tempo.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="border-2 border-carbon bg-paper-deep p-3 space-y-1.5 font-riso-body text-sm">
                <div className="flex justify-between">
                  <span className="text-carbon-soft">Oyun:</span>
                  <span className="font-semibold text-carbon">{gameType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-carbon-soft">Katılım Puanı:</span>
                  <span className="font-riso-mono font-bold text-riso-pink-deep">
                    {`${points} Puan`}
                  </span>
                </div>
                {gameType === 'Retro Satranç' && (
                  <div className="flex justify-between">
                    <span className="text-carbon-soft">Tempo:</span>
                    <span className="font-semibold text-carbon">
                      {
                        (
                          CHESS_TEMPO_OPTIONS.find((tempo) => tempo.id === chessTempoId) ||
                          CHESS_TEMPO_OPTIONS[1]
                        ).label
                      }
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-1.5 border-t-2 border-carbon-muted">
                  <span className="text-carbon-soft">Kalan:</span>
                  <span
                    className={`font-riso-mono font-bold ${
                      maxPointsProp - points >= 0 ? 'text-riso-spring' : 'text-riso-redox'
                    }`}
                  >
                    {maxPointsProp - points} Puan
                  </span>
                </div>
              </div>
              {activeTournament && (
                <label
                  className="riso-focus flex items-center justify-between gap-2.5 sm:gap-3 border-2 border-carbon bg-riso-mustard/40 p-2.5 sm:p-3 cursor-pointer hover:bg-riso-mustard/60 transition-colors"
                  data-testid="create-game-tournament-toggle"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Trophy size={18} className="text-carbon shrink-0" strokeWidth={2.4} />
                    <div className="min-w-0">
                      <p className="font-riso-display text-sm uppercase tracking-wider text-carbon">
                        Bu turnuvaya katıl
                      </p>
                      <p className="font-riso-mono text-[0.65rem] text-carbon-muted truncate">
                        {activeTournament.name}
                        {activeTournament.game_type
                          ? ` · ${activeTournament.game_type}`
                          : ' · Tüm oyunlar'}
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={joinTournament}
                    onChange={(e) => setJoinTournament(e.target.checked)}
                    className="h-5 w-5 accent-riso-pink-deep"
                    aria-label="Turnuvaya katıl"
                  />
                </label>
              )}
            </form>
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 grid grid-cols-1 gap-2 border-t-2 border-carbon bg-paper-deep px-4 py-3 sm:grid-cols-[0.38fr_1fr]">
            {submitError && (
              <p role="alert" className="col-span-full text-sm text-riso-redox">
                {submitError}
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="riso-focus min-h-12 border-2 border-carbon bg-paper px-4 font-riso-body text-sm font-bold uppercase tracking-wider text-carbon transition-colors hover:bg-paper-dim"
            >
              KAPAT
            </button>
            <Button
              type="submit"
              tone="pink"
              size="lg"
              block
              disabled={isSubmitting}
              onClick={handleSubmit}
              data-testid="create-game-submit"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin border-2 border-carbon/30 border-t-carbon rounded-full" />
                  Oluşturuluyor...
                </span>
              ) : (
                'LOBİYE GÖNDER'
              )}
            </Button>
          </div>
        </div>
      </div>
    </DialogLayer>
  );
};
