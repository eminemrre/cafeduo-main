import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Users, Gamepad2, Swords } from 'lucide-react';
import { GameRequest, User } from '../types';

const gameIcon = (gameType: string) => {
  if (gameType === 'Refleks Avı') return '⚡';
  if (gameType === 'Tank Düellosu') return '🛡️';
  if (gameType === 'Ritim Kopyala') return '🛡️';
  if (gameType === 'Retro Satranç') return '♟️';
  if (gameType === 'Çift Tek Sprint') return '🔢';
  if (gameType === 'Bilgi Yarışı') return '🧠';
  return '🎮';
};

interface GameLobbyProps {
  currentUser: User;
  requests: GameRequest[];
  onJoinGame: (id: number) => void;
  onCancelGame?: (id: number | string) => void;
  onCreateGameClick: () => void;
  onQuickJoin?: () => void;
  quickJoinDisabled?: boolean;
  quickJoinBusy?: boolean;
  onViewProfile: (username: string) => void;
}

const GameLobbyComponent: React.FC<GameLobbyProps> = ({
  currentUser,
  requests,
  onJoinGame,
  onCancelGame = () => {},
  onCreateGameClick,
  onQuickJoin = () => {},
  quickJoinDisabled = false,
  quickJoinBusy = false,
  onViewProfile
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-4 md:gap-6 h-full" data-testid="game-lobby-container">

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <motion.button
          onClick={onCreateGameClick}
          className="group relative bg-[#0e3159] hover:bg-[#15487f] transition-all duration-200 h-24 md:h-32 rounded-xl border border-cyan-300/35 active:translate-y-[1px] overflow-hidden flex flex-col items-center justify-center gap-1.5 md:gap-2"
          whileHover={reduceMotion ? {} : { scale: 1.02 }}
          whileTap={reduceMotion ? {} : { scale: 0.98 }}
        >
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,rgba(186,230,253,0.18)_1px,transparent_0)] [background-size:11px_11px]" />
          <motion.div
            animate={reduceMotion ? undefined : { rotate: [0, -10, 10, 0] }}
            transition={reduceMotion ? undefined : { repeat: Infinity, duration: 2, repeatDelay: 3 }}
          >
            <Gamepad2 size={28} className="md:w-10 md:h-10 text-white" />
          </motion.div>
          <span className="font-pixel text-sm md:text-xl text-white z-10">OYUN KUR</span>
        </motion.button>

        <motion.button
          onClick={onQuickJoin}
          disabled={quickJoinDisabled || quickJoinBusy}
          className="group relative bg-[#1e2534] hover:bg-[#2a3448] transition-all duration-200 h-24 md:h-32 rounded-xl border border-slate-400/25 active:translate-y-[1px] overflow-hidden flex flex-col items-center justify-center gap-1.5 md:gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          whileHover={reduceMotion || quickJoinDisabled || quickJoinBusy ? {} : { scale: 1.02 }}
          whileTap={reduceMotion || quickJoinDisabled || quickJoinBusy ? {} : { scale: 0.98 }}
          data-testid="quick-join-button"
        >
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.24)_1px,transparent_0)] [background-size:11px_11px]" />
          <motion.div
            animate={reduceMotion ? undefined : { scale: [1, 1.1, 1] }}
            transition={reduceMotion ? undefined : { repeat: Infinity, duration: 2, repeatDelay: 2 }}
          >
            <Swords size={28} className="md:w-10 md:h-10 text-white" />
          </motion.div>
          <span className="font-pixel text-sm md:text-xl text-white z-10">
            {quickJoinBusy ? 'EŞLEŞİYOR...' : 'RAKİP ARA'}
          </span>
        </motion.button>
      </div>

      {/* Active Requests List */}
      <div className="flex-1 rf-panel border-cyan-400/20 rounded-xl overflow-hidden flex flex-col min-h-[300px] md:min-h-[400px] shadow-inner">
        <div className="p-3 md:p-4 bg-[#0a1732]/85 border-b border-cyan-400/20 flex justify-between items-center">
          <h3 className="font-pixel text-white text-sm md:text-base flex items-center gap-2">
            <Users size={16} className="md:w-[18px] md:h-[18px] text-green-400" />
            <span className="hidden sm:inline">AKTİF İSTEKLER (LOBİ)</span>
            <span className="sm:hidden">LOBİ</span>
          </h3>
          <div className="flex items-center gap-2">
            <motion.span 
              className="w-2 h-2 bg-green-500 rounded-full"
              animate={reduceMotion ? undefined : { scale: [1, 1.2, 1] }}
              transition={reduceMotion ? undefined : { repeat: Infinity, duration: 1.5 }}
            />
            <span className="text-xs text-gray-400 font-mono hidden sm:inline">LIVE</span>
          </div>
        </div>

        <div className="p-3 md:p-4 space-y-2 md:space-y-3 overflow-y-auto max-h-[300px] md:max-h-[400px] custom-scrollbar relative" data-testid="game-lobby-list">
          {/* Scanline effect */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-white/5 to-transparent opacity-5" style={{ backgroundSize: '100% 4px' }}></div>

          {requests.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-8 md:py-12 opacity-50"
            >
              <motion.div
                animate={reduceMotion ? undefined : { y: [0, -5, 0] }}
                transition={reduceMotion ? undefined : { repeat: Infinity, duration: 2 }}
              >
                <Gamepad2 size={36} className="md:w-12 md:h-12 mb-4 text-slate-500" />
              </motion.div>
              <span className="text-center font-pixel text-[var(--rf-muted)] text-xs md:text-sm">
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
                whileHover={reduceMotion ? {} : { x: 4 }}
                className="bg-[#0c1b38]/78 hover:bg-[#12274e]/82 p-3 md:p-4 rounded-lg border border-cyan-400/16 transition-colors group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative overflow-hidden"
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
                    className="w-9 h-9 md:w-10 md:h-10 bg-[#0a1732] rounded flex items-center justify-center font-pixel text-base md:text-lg relative hover:bg-[#102447] transition-colors cursor-pointer flex-shrink-0 border border-cyan-400/20"
                    title="Profili Görüntüle"
                    whileHover={reduceMotion ? {} : { scale: 1.1 }}
                    whileTap={reduceMotion ? {} : { scale: 0.95 }}
                  >
                    {(req.hostName || '?').charAt(0).toUpperCase()}
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-gray-700 rounded-full"></div>
                  </motion.button>
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-bold flex items-center gap-2 font-mono text-sm md:text-base min-w-0">
                      <button 
                        onClick={() => onViewProfile(req.hostName || 'Unknown')} 
                        className="hover:underline hover:text-blue-300 truncate max-w-[11rem] sm:max-w-none"
                      >
                        {req.hostName || 'Unknown'}
                      </button>
                      <span className="text-[10px] bg-blue-900/50 text-blue-200 px-1.5 py-0.5 rounded border border-blue-700/50 flex-shrink-0">
                        {req.table}
                      </span>
                    </div>
                    <div className="text-xs md:text-sm text-[var(--rf-muted)] flex items-center gap-2 min-w-0">
                      <span>{gameIcon(req.gameType)}</span>
                      <span className="truncate">{req.gameType}</span>
                    </div>
                  </div>
                </div>

                {req.hostName !== currentUser.username ? (
                  <motion.button
                    onClick={() => onJoinGame(Number(req.id))}
                    className="w-full sm:w-auto px-4 md:px-6 py-2 bg-[#17663d] hover:bg-[#219354] text-white font-pixel text-xs tracking-wider rounded border border-emerald-300/35 active:translate-y-[1px] transition-all shadow-lg shadow-emerald-900/20 flex-shrink-0"
                    whileHover={reduceMotion ? {} : { scale: 1.05 }}
                    whileTap={reduceMotion ? {} : { scale: 0.95 }}
                  >
                    KATIL
                  </motion.button>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                    <span className="text-[var(--rf-muted)] font-pixel text-xs px-3 py-2 border border-cyan-400/18 rounded flex-shrink-0">
                      SENİN OYUNUN
                    </span>
                    {String(req.status || '').toLowerCase() === 'waiting' && (
                      <button
                        onClick={() => onCancelGame(req.id)}
                        className="px-3 py-2 text-xs border border-rose-400/35 text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded transition-colors"
                        data-testid={`cancel-game-${req.id}`}
                      >
                        İPTAL ET
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const GameLobby = React.memo(GameLobbyComponent);

export default GameLobby;
