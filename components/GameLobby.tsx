import React from 'react';
import { Users, Gamepad2, Search } from 'lucide-react';
import { GameRequest, User } from '../types';

interface GameLobbyProps {
  currentUser: User;
  requests: GameRequest[];
  onJoinGame: (id: number) => void;
  onCreateGameClick: () => void;
  onViewProfile: (username: string) => void;
}

export const GameLobby: React.FC<GameLobbyProps> = ({
  currentUser,
  requests,
  onJoinGame,
  onCreateGameClick,
  onViewProfile
}) => {
  return (
    <div className="flex flex-col gap-6 h-full">

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={onCreateGameClick}
          className="group relative bg-blue-600 hover:bg-blue-500 transition-all duration-200 h-32 rounded-xl border-b-8 border-blue-800 active:border-b-0 active:translate-y-2 overflow-hidden flex flex-col items-center justify-center gap-2"
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/pixel-weave.png')] opacity-20"></div>
          <Gamepad2 size={40} className="text-white group-hover:scale-110 transition-transform" />
          <span className="font-pixel text-xl text-white z-10">OYUN KUR</span>
        </button>

        <button className="group relative bg-purple-600 hover:bg-purple-500 transition-all duration-200 h-32 rounded-xl border-b-8 border-purple-800 active:border-b-0 active:translate-y-2 overflow-hidden flex flex-col items-center justify-center gap-2">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/pixel-weave.png')] opacity-20"></div>
          <Search size={40} className="text-white group-hover:scale-110 transition-transform" />
          <span className="font-pixel text-xl text-white z-10">RAKİP ARA</span>
        </button>
      </div>

      {/* Active Requests List */}
      <div className="flex-1 bg-[#151921] border-2 border-gray-700 rounded-xl overflow-hidden flex flex-col min-h-[400px] shadow-inner">
        <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
          <h3 className="font-pixel text-white flex items-center gap-2">
            <Users size={18} className="text-green-400" />
            AKTİF İSTEKLER (LOBİ)
          </h3>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-xs text-gray-400 font-mono">LIVE SERVER</span>
          </div>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto max-h-[400px] custom-scrollbar relative">
          {/* Scanline effect for the list area */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-white/5 to-transparent opacity-5" style={{ backgroundSize: '100% 4px' }}></div>

          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 opacity-50">
              <Gamepad2 size={48} className="mb-4 text-gray-600" />
              <span className="text-center font-pixel text-gray-500">
                ŞU AN AKTİF OYUN YOK...<br />
                İLK OYUNU SEN KUR!
              </span>
            </div>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="bg-[#1f2937] hover:bg-[#2d3748] p-4 rounded-lg border border-gray-700 transition-all hover:translate-x-1 group flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
                {/* Hover highlight */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div className="flex items-center gap-4 w-full md:w-auto pl-2">
                  <button
                    onClick={() => onViewProfile(req.hostName)}
                    className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center font-pixel text-lg relative hover:bg-gray-600 hover:ring-2 ring-blue-400 transition-all cursor-pointer"
                    title="Profili Görüntüle"
                  >
                    {(req.hostName || '?').charAt(0).toUpperCase()}
                    {/* Online dot */}
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-gray-700 rounded-full"></div>
                  </button>
                  <div>
                    <div className="text-white font-bold flex items-center gap-2 font-mono">
                      <button onClick={() => onViewProfile(req.hostName || 'Unknown')} className="hover:underline hover:text-blue-300">
                        {req.hostName || 'Unknown'}
                      </button>
                      <span className="text-[10px] bg-blue-900/50 text-blue-200 px-1.5 py-0.5 rounded border border-blue-700/50">{req.table}</span>
                    </div>
                    <div className="text-sm text-gray-400 flex items-center gap-2">
                      {req.gameType === 'Taş Kağıt Makas' && <span className="text-xs">✂️</span>}
                      {req.gameType === 'Kelime Eşleştirme' && <span className="text-xs">🔤</span>}
                      {req.gameType}
                    </div>
                  </div>
                </div>

                {req.hostName !== currentUser.username ? (
                  <button
                    onClick={() => onJoinGame(req.id)}
                    className="w-full md:w-auto px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-pixel text-xs tracking-wider rounded border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all shadow-lg shadow-green-900/20"
                  >
                    KABUL ET
                  </button>
                ) : (
                  <span className="text-[10px] text-gray-500 font-pixel px-4 border border-gray-700 rounded py-1 bg-black/20">SENİN OYUNUN</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};