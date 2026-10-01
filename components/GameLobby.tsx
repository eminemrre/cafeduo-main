import React from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, Swords } from 'lucide-react';
import { GameRequest, User } from '../types';

const gameIcon = (gameType: string) => {
  if (gameType === 'Retro Satranç') return '♟️';
  if (gameType === 'Bilgi Yarışı') return '🧠';
  if (gameType === 'Nişancı Düellosu' || gameType === 'Nişancı Düellosu') return '🎯';
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
  activeGameId?: string | number | null;
}

const normalizeNameKey = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const GameLobbyComponent: React.FC<GameLobbyProps> = ({
  currentUser,
  requests,
  onJoinGame,
  onCancelGame = () => {},
  onCreateGameClick,
  onQuickJoin = () => {},
  quickJoinDisabled = false,
  quickJoinBusy = false,
  onViewProfile,
  activeGameId = null,
}) => {
  const isInGame = Boolean(activeGameId);
  return (
    <div className="flex flex-col gap-8 h-full" data-testid="game-lobby-container">
      {/* Primary game actions */}
      <div className="duo-lobby-actions">
        <motion.button
          onClick={onCreateGameClick}
          disabled={isInGame}
          className="duo-lobby-action riso-focus bg-riso-pink text-carbon transition-all disabled:cursor-not-allowed"
        >
          <Gamepad2 size={32} strokeWidth={2.4} />
          <span className="text-inherit">{isInGame ? 'OYUNDASIN' : 'Oyun Kur'}</span>
        </motion.button>

        <motion.button
          onClick={onQuickJoin}
          disabled={quickJoinDisabled || quickJoinBusy}
          className="duo-lobby-action riso-focus bg-riso-blue text-paper transition-all disabled:cursor-not-allowed"
          data-testid="quick-join-button"
        >
          <Swords size={32} strokeWidth={2.4} />
          <span className="text-inherit">{quickJoinBusy ? 'Bağlanılıyor...' : 'Hızlı eşleş'}</span>
        </motion.button>
      </div>

      {/* Active Requests List */}
      <div className="flex-1 flex flex-col relative w-full pt-4">
        <div className="flex items-center gap-3 mb-5 border-b border-carbon/20 pb-3">
          <h3 className="duo-lobby-heading text-carbon">Açık oyunlar</h3>
          <div className="w-2 h-2 rounded-full bg-riso-spring" />
        </div>

        <div className="relative w-full z-10 flex flex-col" data-testid="game-lobby-list">
          {requests.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="duo-lobby-empty flex flex-col items-center justify-center border border-dashed"
            >
              <Gamepad2 size={32} className="mb-4 text-riso-blue" aria-hidden="true" />
              <h4>İlk oyunu sen başlat.</h4>
              <p>
                Henüz açık bir oyun yok. Oyun kur, kafendeki oyunculara meydan oku ve birlikte oyna.
              </p>
            </motion.div>
          ) : (
            requests.map((req, index) => {
              const hostName = String(req.hostName || 'Unknown');
              const isOwnLobby =
                normalizeNameKey(req.hostName) === normalizeNameKey(currentUser.username);
              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, scale: 0.95, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="duo-lobby-row group relative bg-paper p-5 border border-carbon/20 transition-all"
                >
                  {/* decorative riso confetti corner */}
                  <div
                    aria-hidden="true"
                    className="absolute top-2 right-2 h-2 w-8 bg-riso-mustard rotate-[-6deg] hidden sm:block"
                  />

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => onViewProfile(hostName)}
                        className="rounded-xl riso-focus w-12 h-12 sm:w-14 sm:h-14 bg-riso-blue text-paper font-riso-display text-xl sm:text-2xl border-2 border-carbon flex items-center justify-center hover:bg-riso-blue-deep transition-colors"
                        title="Profili Görüntüle"
                      >
                        {hostName.charAt(0).toUpperCase()}
                      </button>
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <button
                            onClick={() => onViewProfile(hostName)}
                            className="riso-focus font-riso-body font-semibold text-lg text-carbon hover:text-riso-pink-deep transition-colors"
                          >
                            {hostName}
                          </button>
                          <span className="font-riso-mono text-[0.7rem] font-bold bg-riso-pink text-carbon border-2 border-carbon px-2 py-0.5 tracking-wider">
                            Masa {req.table}
                          </span>
                        </div>
                        <div className="font-riso-body text-sm font-bold uppercase tracking-wider text-carbon-soft mt-1 flex items-center gap-2">
                          <span>{gameIcon(req.gameType)}</span>
                          <span>{req.gameType}</span>
                        </div>
                      </div>
                    </div>

                    {!isOwnLobby ? (
                      <button
                        onClick={() => onJoinGame(Number(req.id))}
                        disabled={isInGame}
                        className="duo-button riso-focus w-full sm:w-auto px-6 py-3 bg-riso-pink text-carbon font-semibold text-sm border border-carbon transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isInGame ? 'ZATEN OYUNDASIN' : 'Oyuna katıl'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <span className="font-riso-mono text-[0.7rem] uppercase font-bold tracking-wider border-2 border-carbon bg-riso-pink/15 text-riso-pink-deep px-3 py-1.5">
                          SENİN LOBİN
                        </span>
                        <button
                          onClick={() => onCancelGame(req.id)}
                          className="riso-focus px-4 py-2 font-riso-body font-bold uppercase tracking-wider text-carbon border-2 border-carbon bg-paper hover:bg-riso-redox hover:text-paper transition-colors"
                          data-testid={`cancel-game-${req.id}`}
                        >
                          İPTAL ET
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export const GameLobby = React.memo(GameLobbyComponent);

export default GameLobby;
