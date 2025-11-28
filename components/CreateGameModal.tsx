import React, { useState } from 'react';
import { X } from 'lucide-react';
import { RetroButton } from './RetroButton';

interface CreateGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (gameType: string, points: number) => void;
  maxPoints: number;
}

export const CreateGameModal: React.FC<CreateGameModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  maxPoints
}) => {
  const [gameType, setGameType] = useState('Taş Kağıt Makas');


  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(gameType, 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* Modal Content - Removed 'animate-bounce-x' for stability */}
      <div className="relative bg-[#1a1f2e] border-4 border-blue-500 p-6 w-full max-w-md shadow-[0_0_50px_rgba(59,130,246,0.3)] transform transition-all scale-100 opacity-100">

        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b-2 border-gray-700 pb-4">
          <h3 className="font-pixel text-xl text-white tracking-wider">YENİ OYUN KUR</h3>
          <button onClick={onClose} className="text-red-500 hover:text-red-400 transition-colors p-1 hover:bg-red-500/10 rounded">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-blue-400 font-pixel text-xs mb-2 tracking-widest">OYUN TÜRÜ SEÇ</label>
            <div className="relative group">
              <select
                value={gameType}
                onChange={(e) => setGameType(e.target.value)}
                className="w-full bg-black border-2 border-gray-600 text-white p-3 font-retro text-xl focus:border-blue-500 outline-none appearance-none cursor-pointer hover:border-gray-500 transition-colors"
              >
                <option>Taş Kağıt Makas</option>
                <option>Kelime Eşleştirme</option>
                <option>Arena Düellosu</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 group-hover:text-blue-400 transition-colors">
                ▼
              </div>
            </div>
          </div>

          <RetroButton type="submit" className="w-full mt-4 shadow-blue-900/20 border-blue-400 hover:border-blue-300">
            LOBİYE GÖNDER
          </RetroButton>
        </form>
      </div>
    </div>
  );
};