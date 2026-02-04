import React from 'react';
import { motion } from 'framer-motion';
import { Users, Gamepad2, Search, Swords } from 'lucide-react';
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
    <div className="flex flex-col gap-4 md:gap-6 h-full">

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <motion.button
          onClick={onCreateGameClick}
          className="group relative bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 transition-all duration-200 h-24 md:h-32 rounded-xl border-b-4 md:border-b-8 border-blue-800 active:border-b-0 active:translate-y-1 md:active:translate-y-2 overflow-hidden flex flex-col items-center justify-center gap-1.5 md:gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/pixel-weave.png')] opacity-20"></div>
          <motion.div
            animate={{ rotate: [0, -10, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2, repeatDelay: 3 }}
          >
            <Gamepad2 size={28} className="md:w-10 md:h-10 text-white" />
          </motion.div>
          <span className="font-pixel text-sm md:text-xl text-white z-10">OYUN KUR</span>
        </motion.button>

        <motion.button 
          className="group relative bg-gradient-to-b from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 transition-all duration-200 h-24 md:h-32 rounded-xl border-b-4 md:border-b-8 border-purple-800 active:border-b-0 active:translate-y-1 md:active:translate-y-2 overflow-hidden flex flex-col items-center justify-center gap-1.5 md:gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/pixel-weave.png')] opacity-20"></div>
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2, repeatDelay: 2 }}
          >
            <Swords size={28} className="md:w-10 md:h-10 text-white" />
          </motion.div>
          <span className="font-pixel text-sm md:text-xl text-white z-10">RAKİP ARA</span>
        </motion.button>
      </div>

      {/* Active Requests List */}
      <div className="flex-1 bg-[#151921] border-2 border-gray-700 rounded-xl overflow-hidden flex flex-col min-h-[300px] md:min-h-[400px] shadow-inner">
        <div className="p-3 md:p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
          <h3 className="font-pixel text-white text-sm md:text-base flex items-center gap-2">
            <Users size={16} className="md:w-[18px] md:h-[18px] text-green-400" />
            <span className="hidden sm:inline">AKTİF İSTEKLER (LOBİ)</span>
            <span className="sm:hidden">LOBİ</span>
          </h3>
          <div className="flex items-center gap-2">
            <motion.span 
              className="w-2 h-2 bg-green-500 rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
            <span className="text-xs text-gray-400 font-mono hidden sm:inline">LIVE</span>
          </div>
        </div>

        <div className="p-3 md:p-4 space-y-2 md:space-y-3 overflow-y-auto max-h-[300px] md:max-h-[400px] custom-scrollbar relative">
          {/* Scanline effect */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-white/5 to-transparent opacity-5" style={{ backgroundSize: '100% 4px' }}></div>

          {requests.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-8 md:py-12 opacity-50"
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <Gamepad2 size={36} className="md:w-12 md:h-12 mb-4 text-gray-600" />
              </motion.div>
              <span className="text-center font-pixel text-gray-500 text-xs md:text-sm">
                ŞU AN AKTİF OYUN YOK...<br />
                İLK OYUNU SEN KUR!
              </span>
            </motion.div>
          ) : (
            requests.map((req, index) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ x: 4 }}
                className="bg-[#1f2937] hover:bg-[#2d3748] p-3 md:p-4 rounded-lg border border-gray-700 transition-colors group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative overflow-hidden"
              >
                {/* Hover highlight */}
                <motion.div 
                  className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                />

                <div className="flex items-center gap-3 w-full sm:w-auto pl-2">
                  <motion.button
                    onClick={() => onViewProfile(req.hostName)}
                    className="w-9 h-9 md:w-10 md:h-10 bg-gray-700 rounded flex items-center justify-center font-pixel text-base md:text-lg relative hover:bg-gray-600 transition-colors cursor-pointer flex-shrink-0"
                    title="Profili Görüntüle"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {(req.hostName || '?').charAt(0).toUpperCase()}
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-gray-700 rounded-full"></div>
                  </motion.button>
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-bold flex items-center gap-2 font-mono text-sm md:text-base truncate">
                      <button 
                        onClick={() => onViewProfile(req.hostName || 'Unknown')} 
                        className="hover:underline hover:text-blue-300 truncate"
                      >
                        {req.hostName || 'Unknown'}
                      </button>
                      <span className="text-[10px] bg-blue-900/50 text-blue-200 px-1.5 py-0.5 rounded border border-blue-700/50 flex-shrink-0">
                        {req.table}
                      </span>
                    </div>
                    <div className="text-xs md:text-sm text-gray-400 flex items-center gap-2">
                      {req.gameType === 'Taş Kağıt Makas' && <span>✂️</span>}
                      {req.gameType === 'Arena Savaşı' && <span>⚔️</span>}
                      {req.gameType === 'Zindan Savaşı' && <span>🏰</span>}
                      <span className="truncate">{req.gameType}</span>
                    </div>
                  </div>
                </div>

                {req.hostName !== currentUser.username ? (
                  <motion.button
                    onClick={() => onJoinGame(req.id)}
                    className="w-full sm:w-auto px-4 md:px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-pixel text-xs tracking-wider rounded border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all shadow-lg shadow-green-900/20 flex-shrink-0"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    KATIL
                  </motion.button>
                ) : (
                  <span className="text-gray-500 font-pixel text-xs px-4 py-2 border border-gray-700 rounded flex-shrink-0">
                    SENİN OYUNUN
                  </span>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default GameLobby;
