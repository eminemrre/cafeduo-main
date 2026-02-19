import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Check, Trophy } from 'lucide-react';
import { RetroButton } from './RetroButton';
import { useToast } from '../contexts/ToastContext';

interface CreateGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    gameType: string,
    points: number,
    options?: { chessClock?: { baseSeconds: number; incrementSeconds: number; label: string } }
  ) => Promise<void> | void;
  maxPoints: number;
}

const GAME_TYPES = [
  { id: 'reflex', name: 'Refleks Avı', category: 'Refleks', description: 'Işık yandığında en hızlı tıkla', minPoints: 0 },
  { id: 'war', name: 'Nişancı Düellosu', category: 'Savaş', description: 'Nişan hattında merkezi vur, tur tur isabet topla', minPoints: 40 },
  { id: 'tank', name: 'Tank Düellosu', category: 'Savaş', description: 'Açı ve güç ayarla, rakip tankı vur. İlk 3 isabet alan kazanır.', minPoints: 40 },
  { id: 'chess', name: 'Retro Satranç', category: 'Strateji', description: 'Klasik 2 oyunculu satranç. Gerçek zamanlı ve hamle doğrulamalı.', minPoints: 90 },
  { id: 'knowledge', name: 'Bilgi Yarışı', category: 'Bilgi', description: 'Kısa bilgi sorularında doğru cevabı en hızlı ver', minPoints: 120 },
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

export const CreateGameModal: React.FC<CreateGameModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  maxPoints
}) => {
  const [gameType, setGameType] = useState('Refleks Avı');
  const [points, setPoints] = useState(0);
  const [chessTempoId, setChessTempoId] = useState<(typeof CHESS_TEMPO_OPTIONS)[number]['id']>('blitz_3_2');
  const [errors, setErrors] = useState<ValidationError>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toast = useToast();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setGameType('Refleks Avı');
      setPoints(0);
      setChessTempoId('blitz_3_2');
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const selectedGame = GAME_TYPES.find(g => g.name === gameType);
  const minPoints = selectedGame?.minPoints || 0;

  const validate = (): boolean => {
    const newErrors: ValidationError = {};

    if (!gameType) {
      newErrors.gameType = 'Oyun türü seçmelisiniz';
    }

    if (points < minPoints) {
      newErrors.points = `${gameType} için minimum ${minPoints} puan gerekli`;
    }

    if (points > maxPoints) {
      newErrors.points = `Maksimum ${maxPoints} puan kullanabilirsiniz`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePointsChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    setPoints(numValue);

    // Real-time validation
    if (touched.points) {
      const newErrors: ValidationError = { ...errors };
      if (numValue < minPoints) {
        newErrors.points = `${gameType} için minimum ${minPoints} puan gerekli`;
      } else if (numValue > maxPoints) {
        newErrors.points = `Maksimum ${maxPoints} puan kullanabilirsiniz`;
      } else {
        delete newErrors.points;
      }
      setErrors(newErrors);
    }
  };

  const handleGameTypeChange = (newGameType: string) => {
    setGameType(newGameType);
    const game = GAME_TYPES.find(g => g.name === newGameType);
    const newMinPoints = game?.minPoints || 0;

    // Auto-adjust points if below minimum
    if (points < newMinPoints) {
      setPoints(newMinPoints);
      toast.warning(`${newGameType} için minimum ${newMinPoints} puan ayarlandı`);
    }

    // Clear game type error
    if (errors.gameType) {
      setErrors(prev => ({ ...prev, gameType: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setTouched({ gameType: true, points: true });

    if (!validate()) {
      toast.error('Lütfen form hatalarını düzeltin');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedTempo = CHESS_TEMPO_OPTIONS.find((tempo) => tempo.id === chessTempoId) || CHESS_TEMPO_OPTIONS[1];
      const options =
        gameType === 'Retro Satranç'
          ? {
            chessClock: {
              baseSeconds: selectedTempo.baseSeconds,
              incrementSeconds: selectedTempo.incrementSeconds,
              label: selectedTempo.label,
            },
          }
          : undefined;
      await Promise.resolve(onSubmit(gameType, points, options));
      toast.success(`${gameType} oyunu oluşturuldu!`);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error && err.message ? err.message : 'Oyun oluşturulamadı';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const presetPoints = [
    { label: 'Min', value: minPoints },
    { label: '100', value: 100 },
    { label: '250', value: 250 },
    { label: 'Max', value: maxPoints }
  ].filter(p => p.value >= minPoints && p.value <= maxPoints);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center px-3 sm:px-4 py-3 sm:py-6 overflow-y-auto">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* Modal Content */}
      <div
        className="relative bg-[linear-gradient(170deg,rgba(6,13,29,0.98),rgba(8,24,51,0.9))] border-2 border-cyan-400/35 rounded-2xl p-4 sm:p-6 w-full max-w-md shadow-[0_0_50px_rgba(10,215,255,0.2)] transform transition-all scale-100 opacity-100 max-h-[calc(100vh-1.5rem)] sm:max-h-[min(860px,calc(100vh-3rem))] overflow-y-auto rf-modal-scroll"
        data-testid="create-game-modal"
      >

        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b border-cyan-400/20 pb-4">
          <h3 className="font-pixel text-xl text-white tracking-wider">YENİ OYUN KUR</h3>
          <button onClick={onClose} className="text-red-300 hover:text-red-200 transition-colors p-1 hover:bg-red-500/10 rounded">
            <X size={24} />
          </button>
        </div>

        {/* Points Info */}
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded p-3 mb-6 flex items-center justify-between">
          <span className="text-cyan-300 text-sm">Mevcut Puanınız:</span>
          <span className="text-white font-bold text-lg flex items-center gap-1">
            <Trophy size={16} className="text-amber-300" />
            {maxPoints}
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Game Type Selection */}
          <div>
            <label className="block text-cyan-300 font-pixel text-xs mb-3 tracking-widest">OYUN TÜRÜ SEÇ</label>
            <div className="space-y-2">
              {GAME_TYPES.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => handleGameTypeChange(game.name)}
                  data-testid={`game-type-${game.id}`}
                  className={`w-full p-3 border-2 rounded transition-all text-left ${gameType === game.name
                    ? 'border-cyan-500 bg-cyan-500/16'
                    : 'border-cyan-400/20 hover:border-cyan-400/35 bg-black/30'
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-white font-retro text-base sm:text-lg leading-tight">{game.name}</div>
                      <div className="text-cyan-300 text-[10px] font-pixel tracking-[0.12em] uppercase">{game.category}</div>
                      <div className="text-[var(--rf-muted)] text-xs leading-snug">{game.description}</div>
                    </div>
                    {game.minPoints > 0 ? (
                      <div className="text-amber-300 text-xs font-pixel shrink-0 text-right leading-tight min-w-[68px]">
                        Min {game.minPoints} Puan
                      </div>
                    ) : null}
                    {gameType === game.name ? (
                      <Check size={20} className="text-cyan-300" />
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
            {errors.gameType && (
              <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                <AlertTriangle size={12} /> {errors.gameType}
              </p>
            )}
          </div>

          {/* Points Input */}
          <div>
            <label className="block text-cyan-300 font-pixel text-xs mb-3 tracking-widest">KATILIM PUANI</label>
            <div className="relative">
              <input
                type="number"
                value={points}
                onChange={(e) => handlePointsChange(e.target.value)}
                onBlur={() => setTouched(prev => ({ ...prev, points: true }))}
                min={minPoints}
                max={maxPoints}
                data-testid="game-points-input"
                className={`w-full bg-black border-2 ${errors.points && touched.points ? 'border-red-500' : 'border-cyan-400/25'} text-white p-3 pr-20 font-retro text-xl sm:text-2xl text-center focus:border-cyan-300 outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--rf-muted)] text-sm">Puan</span>
            </div>

            {/* Preset Buttons */}
            <div className="flex gap-2 mt-2">
              {presetPoints.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePointsChange(preset.value.toString())}
                  className={`flex-1 min-h-[40px] py-1 px-2 text-xs border-2 rounded-md transition-colors ${points === preset.value
                    ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                    : 'border-cyan-400/20 hover:border-cyan-400/35 text-[var(--rf-muted)]'
                    }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {errors.points && touched.points && (
              <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                <AlertTriangle size={12} /> {errors.points}
              </p>
            )}
          </div>

          {gameType === 'Retro Satranç' && (
            <div>
              <label className="block text-cyan-300 font-pixel text-xs mb-3 tracking-widest">SATRANÇ TEMPOSU</label>
              <div className="grid grid-cols-2 gap-2">
                {CHESS_TEMPO_OPTIONS.map((tempo) => (
                  <button
                    key={tempo.id}
                    type="button"
                    onClick={() => setChessTempoId(tempo.id)}
                    className={`px-3 py-2 rounded border text-xs font-pixel transition-colors ${chessTempoId === tempo.id
                      ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                      : 'border-cyan-400/20 bg-black/30 text-[var(--rf-muted)] hover:border-cyan-400/40'
                      }`}
                  >
                    {tempo.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-[#0a1732]/80 rounded p-3 border border-cyan-400/20">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--rf-muted)]">Oyun:</span>
              <span className="text-white">{gameType}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-[var(--rf-muted)]">Katılım Puanı:</span>
              <span className="text-amber-300">{points} Puan</span>
            </div>
            {gameType === 'Retro Satranç' && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-[var(--rf-muted)]">Tempo:</span>
                <span className="text-cyan-200">
                  {(CHESS_TEMPO_OPTIONS.find((tempo) => tempo.id === chessTempoId) || CHESS_TEMPO_OPTIONS[1]).label}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm mt-1 pt-1 border-t border-cyan-400/20">
              <span className="text-[var(--rf-muted)]">Kalan:</span>
              <span className={`${maxPoints - points < 0 ? 'text-red-400' : 'text-green-400'}`}>
                {maxPoints - points} Puan
              </span>
            </div>
          </div>

          <RetroButton
            type="submit"
            disabled={isSubmitting}
            data-testid="create-game-submit"
            className="w-full shadow-blue-900/20 border-blue-400 hover:border-blue-300 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Oluşturuluyor...
              </span>
            ) : (
              'LOBİYE GÖNDER'
            )}
          </RetroButton>
        </form>
      </div>
    </div>
  );
};
