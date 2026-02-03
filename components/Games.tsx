import React from 'react';
import { GameCardProps } from '../types';
import { Scissors, Scroll, Circle, Zap, Trophy, Play, Star, Shapes, Sword, Shield } from 'lucide-react';

  const GameCard: React.FC<GameCardProps> = ({ title, content, disabled }) => {
    return (
    <div className={`relative group h-full transition-all duration-500 ${disabled ? 'opacity-75 grayscale' : 'hover:-translate-y-2'}`}>

      {/* Glow Effect */}
      <div className={`absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-500 ${disabled ? 'hidden' : ''}`}></div>

      <div className="relative h-full bg-[#151921] rounded-2xl border border-gray-800 overflow-hidden flex flex-col shadow-[0_18px_40px_rgba(0,0,0,0.35)]">

        {/* Card Image Area */}
        <div className="h-64 relative overflow-hidden bg-gray-900 flex items-center justify-center group">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>

          {content}

          {/* Play Button - Bottom Right Corner */}
          {!disabled && (
            <div className="absolute bottom-4 right-4 z-20">
              <div className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-[0_10px_25px_rgba(255,255,255,0.25)] transform translate-y-20 group-hover:translate-y-0 transition-all duration-300 hover:scale-110 cursor-pointer">
                <Play size={24} fill="currentColor" className="ml-1" />
              </div>
            </div>
          )}
        </div>

        {/* Card Content */}
        <div className="p-6 flex flex-col flex-grow relative">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-2xl font-bold text-white font-pixel tracking-wide">{title}</h3>
            {!disabled && <Trophy className="text-yellow-500" size={24} />}
          </div>

          <p className="text-gray-400 text-sm mb-6 flex-grow">
            {title === 'TAS KAGIT MAKAS' ? 'Klasik oyunun modern hali. Rakibini yen, puanları topla.' :
              title === 'SEKIL ESLESTIRME' ? 'Hafızanı test et, şekilleri eşleştir ve kazan.' :
                'Çok yakında yeni oyunlarla karşınızdayız.'}
          </p>

          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <span className={`w-2 h-2 rounded-full ${disabled ? 'bg-gray-600' : 'bg-green-500 animate-pulse'}`}></span>
            {disabled ? 'YAKINDA' : 'ONLINE'}
          </div>
        </div>
      </div>
    </div>
  );
};

export const Games: React.FC = () => {
  return (
    <section id="games" className="py-24 bg-[#0f141a] relative overflow-hidden">

      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Section Header */}
        <div className="text-center mb-20">
          <span className="text-blue-400 font-medium tracking-widest uppercase text-sm mb-2 block">Oyun Alanı</span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            FAVORİ OYUNUNU <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">SEÇ</span>
          </h2>
          <p className="text-gray-400 mb-6">
            Arenaya çık, stratejini konuştur! Hamlelerini doğru seç, rakibinin enerjisini bitir ve zafer senin olsun.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">

          {/* Card 1: Rock Paper Scissors */}
          <GameCard
            title="TAS KAGIT MAKAS"
            content={
              <div className="relative w-full h-full flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-purple-500/20"></div>
                <div className="flex gap-4 relative z-10 transform group-hover:scale-110 transition-transform duration-500">
                  <div className="w-16 h-16 bg-gray-800 rounded-2xl border border-gray-700 flex items-center justify-center shadow-xl rotate-[-10deg]">
                    <Circle size={32} className="text-pink-500" />
                  </div>
                  <div className="w-16 h-16 bg-gray-800 rounded-2xl border border-gray-700 flex items-center justify-center shadow-xl rotate-[5deg] mt-4">
                    <Scroll size={32} className="text-blue-500" />
                  </div>
                  <div className="w-16 h-16 bg-gray-800 rounded-2xl border border-gray-700 flex items-center justify-center shadow-xl rotate-[20deg]">
                    <Scissors size={32} className="text-yellow-500" />
                  </div>
                </div>
              </div>
            }
          />

          {/* Card 2: Shape Matching */}
          <GameCard
            title="SEKIL ESLESTIRME"
            content={
              <div className="relative w-full h-full flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-green-500/20"></div>
                <div className="grid grid-cols-2 gap-3 relative z-10 transform group-hover:rotate-3 transition-transform duration-500">
                  <div className="w-14 h-14 bg-gray-800 rounded-xl border border-gray-700 flex items-center justify-center shadow-lg">
                    <Shapes size={28} className="text-green-400" />
                  </div>
                  <div className="w-14 h-14 bg-blue-600 rounded-xl border border-blue-400 flex items-center justify-center shadow-lg animate-pulse">
                    <Zap size={28} className="text-white" />
                  </div>
                  <div className="w-14 h-14 bg-blue-600 rounded-xl border border-blue-400 flex items-center justify-center shadow-lg">
                    <Zap size={28} className="text-white" />
                  </div>
                  <div className="w-14 h-14 bg-gray-800 rounded-xl border border-gray-700 flex items-center justify-center shadow-lg">
                    <Star size={28} className="text-yellow-400" />
                  </div>
                </div>
              </div>
            }
          />

          {/* Card 3: Arena Duel */}
          <GameCard
            title="ARENA DUELLOSU"
            content={
              <div className="relative w-full h-full flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-red-900/40 to-orange-900/40"></div>
                <div className="flex gap-2 relative z-10 transform group-hover:scale-110 transition-transform duration-500">
                  <div className="w-20 h-20 bg-gray-900 rounded-full border-2 border-red-600 flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                    <Sword size={40} className="text-red-500" />
                  </div>
                  <div className="absolute -right-4 -bottom-2 w-12 h-12 bg-gray-800 rounded-full border-2 border-orange-500 flex items-center justify-center shadow-lg">
                    <Shield size={24} className="text-orange-400" />
                  </div>
                </div>
              </div>
            }
          />

          {/* Card 4: Placeholder */}
          <GameCard
            title="YAKINDA"
            disabled
            content={
              <div className="flex items-center justify-center w-full h-full bg-gray-900">
                <span className="text-gray-700 font-pixel text-4xl opacity-20">?</span>
              </div>
            }
          />

        </div>
      </div>
    </section>
  );
};
