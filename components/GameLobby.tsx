import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Users, Gamepad2, Swords } from 'lucide-react';
import { GameRequest, User } from '../types';

const gameIcon = (gameType: string) => {
  if (gameType === 'Refleks Avı') return '⚡';
  if (gameType === 'Nişancı Düellosu') return '🛡️';
  if (gameType === 'Tank Düellosu') return '🎯';
  if (gameType === 'Ritim Kopyala') return '🎵';
  if (gameType === 'Retro Satranç') return '♟️';
  if (gameType === 'Çift Tek Sprint') return '🔢';
  if (gameType === 'Neon Hafıza') return '🔮';
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
  onCancelGame = () => { },
  onCreateGameClick,
  onQuickJoin = () => { },
  quickJoinDisabled = false,
  quickJoinBusy = false,
  onViewProfile
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-8 h-full" data-testid="game-lobby-container">

      {/* Action Buttons Brutalist Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.button
          onClick={onCreateGameClick}
          className="group relative bg-neon-blue font-sans font-bold uppercase tracking-widest text-cyber-dark h-24 md:h-32 border-2 border-neon-blue flex flex-col items-center justify-center gap-2 shadow-[8px_8px_0_rgba(255,0,234,0.4)] hover:shadow-none hover:translate-x-2 hover:translate-y-2 transition-all"
        >
          <Gamepad2 size={32} />
          <span className="text-lg md:text-xl">Oyun Kur</span>
        </motion.button>

        <motion.button
          onClick={onQuickJoin}
          disabled={quickJoinDisabled || quickJoinBusy}
          className="group relative bg-cyber-dark font-sans font-bold uppercase tracking-widest text-neon-pink h-24 md:h-32 border-2 border-neon-pink flex flex-col items-center justify-center gap-2 shadow-[8px_8px_0_rgba(0,243,255,0.4)] hover:shadow-none hover:translate-x-2 hover:translate-y-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="quick-join-button"
        >
          <Swords size={32} />
          <span className="text-lg md:text-xl">
            {quickJoinBusy ? 'BAĞLANILIYOR...' : 'HIZLI EŞLEŞ'}
          </span>
        </motion.button>
      </div>

      {/* Active Requests List */}
      <div className="flex-1 flex flex-col relative w-full pt-4">
        <div className="flex items-center gap-4 mb-8 border-b-2 border-cyber-border pb-2">
          <h3 className="font-display text-4xl text-ink-50 uppercase tracking-widest text-shadow-glitch">AKTİF LOBİ</h3>
          <div className="w-4 h-4 rounded-full bg-neon-green animate-pulse" />
        </div>

        <div className="relative w-full z-10 flex flex-col -space-y-4" data-testid="game-lobby-list">
          {requests.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 opacity-40 border-2 border-dashed border-cyber-border my-8"
            >
              <Gamepad2 size={48} className="mb-6 text-cyber-border" />
              <span className="text-center font-display text-3xl text-cyber-border tracking-widest uppercase">
                RADAR TEMİZ.<br />İLK SİNYALİ GÖNDER!
              </span>
            </motion.div>
          ) : (
            requests.map((req, index) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group relative bg-cyber-card backdrop-blur-md p-6 border-l-4 border-neon-blue border-r border-y border-cyber-border transition-all hover:-translate-y-4 hover:z-20 shadow-[12px_12px_0_rgba(0,0,0,0.6)] hover:shadow-[16px_16px_0_rgba(0,243,255,0.2)] md:ml-[calc(var(--index)*1.5rem)]"
                style={{ "--index": index % 3 } as React.CSSProperties}
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-neon-blue/5 skew-x-12 -translate-y-1/2 translate-x-1/4" />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => onViewProfile(req.hostName)}
                      className="w-16 h-16 bg-cyber-dark text-neon-blue font-display text-3xl border-2 border-neon-blue flex items-center justify-center hover:bg-neon-blue hover:text-cyber-dark transition-colors"
                      title="Profili Görüntüle"
                    >
                      {(req.hostName || '?').charAt(0).toUpperCase()}
                    </button>
                    <div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => onViewProfile(req.hostName || 'Unknown')}
                          className="font-display text-3xl text-ink-50 uppercase tracking-widest hover:text-neon-pink transition-colors"
                        >
                          {req.hostName || 'Unknown'}
                        </button>
                        <span className="text-xs font-sans font-bold bg-neon-pink text-cyber-dark px-2 py-1 tracking-widest">
                          Masa {req.table}
                        </span>
                      </div>
                      <div className="text-sm font-sans font-bold uppercase tracking-widest text-ink-300 mt-1 flex items-center gap-2">
                        <span>{gameIcon(req.gameType)}</span>
                        <span>{req.gameType}</span>
                      </div>
                    </div>
                  </div>

                  {req.hostName !== currentUser.username ? (
                    <button
                      onClick={() => onJoinGame(Number(req.id))}
                      className="w-full sm:w-auto px-8 py-4 bg-neon-blue text-cyber-dark font-sans font-bold uppercase tracking-widest text-lg hover:bg-transparent hover:text-neon-blue border-2 border-neon-blue transition-all"
                    >
                      SAVAŞA KATIL
                    </button>
                  ) : (
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <span className="text-neon-pink font-sans text-xs uppercase font-bold tracking-widest border border-neon-pink px-4 py-2">
                        SENİN LOBİN
                      </span>
                      <button
                        onClick={() => onCancelGame(req.id)}
                        className="px-6 py-4 text-cyber-border font-sans font-bold uppercase tracking-widest border-2 border-cyber-border hover:border-red-500 hover:text-red-500 transition-colors"
                        data-testid={`cancel-game-${req.id}`}
                      >
                        İPTAL ET
                      </button>
                    </div>
                  )}
                </div>
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
