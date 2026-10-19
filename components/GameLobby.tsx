import React from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, Swords } from 'lucide-react';
import { GameRequest, User } from '../types';
import { gameChipFill } from '../lib/gameColors';

/** Table codes already read "MASA05"; bare numbers and labels get the word. */
const tableLabel = (table: unknown) => {
  const raw = String(table ?? '').trim();
  return /^masa/i.test(raw) ? raw.toUpperCase() : `Masa ${raw}`;
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
      {/* Primary game actions — two flat action cells */}
      <div className="duo-lobby-actions">
        <motion.button
          onClick={onCreateGameClick}
          disabled={isInGame}
          className="duo-lobby-action riso-focus bg-riso-pink text-carbon disabled:cursor-not-allowed"
        >
          <Gamepad2 size={28} strokeWidth={2.4} aria-hidden="true" />
          {isInGame ? <span>Oyundasın</span> : <span className="duo-sentence">Oyun Kur</span>}
        </motion.button>

        <motion.button
          onClick={onQuickJoin}
          disabled={quickJoinDisabled || quickJoinBusy}
          className="duo-lobby-action riso-focus bg-paper-deep text-carbon hover:bg-paper-dim disabled:cursor-not-allowed"
          data-testid="quick-join-button"
        >
          <Swords size={28} strokeWidth={2.4} aria-hidden="true" />
          <span>{quickJoinBusy ? 'Bağlanılıyor...' : 'Hızlı eşleş'}</span>
        </motion.button>
      </div>

      {/* Active Requests List */}
      <div className="flex-1 flex flex-col relative w-full">
        <h3 className="duo-lobby-heading mb-4 text-carbon">Açık oyunlar</h3>

        <div className="relative w-full z-10 flex flex-col" data-testid="game-lobby-list">
          {requests.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="duo-lobby-empty flex flex-col items-center justify-center"
            >
              <Gamepad2 size={32} className="mb-4 text-carbon" aria-hidden="true" />
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
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className="duo-lobby-row group relative p-4 sm:p-5"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
                    <div className="flex min-w-0 items-center gap-4">
                      <button
                        onClick={() => onViewProfile(hostName)}
                        className="riso-focus w-12 h-12 shrink-0 bg-carbon text-paper font-riso-display text-2xl flex items-center justify-center transition-transform hover:-translate-y-0.5"
                        title="Profili Görüntüle"
                      >
                        {hostName.charAt(0).toUpperCase()}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
                          <button
                            onClick={() => onViewProfile(hostName)}
                            className="riso-focus font-riso-body font-semibold text-lg text-carbon underline decoration-transparent decoration-[3px] underline-offset-4 transition-colors hover:decoration-carbon"
                          >
                            {hostName}
                          </button>
                          <span className="font-riso-mono text-[15px] font-semibold bg-paper text-carbon px-2 py-0.5">
                            {tableLabel(req.table)}
                          </span>
                        </div>
                        <span
                          className={`mt-2 inline-flex px-2.5 py-1 text-[15px] font-medium text-carbon ${gameChipFill(req.gameType)}`}
                        >
                          {req.gameType}
                        </span>
                      </div>
                    </div>

                    {!isOwnLobby ? (
                      <button
                        onClick={() => onJoinGame(Number(req.id))}
                        disabled={isInGame}
                        className="duo-button riso-focus w-full sm:w-auto min-h-12 px-6 bg-riso-pink text-carbon font-semibold text-[15px] transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isInGame ? 'Zaten oyundasın' : 'Oyuna katıl'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                        <span className="bg-paper px-3 py-1.5 text-[15px] font-semibold text-carbon">
                          Senin lobin
                        </span>
                        <button
                          onClick={() => onCancelGame(req.id)}
                          className="duo-quiet riso-focus"
                          data-testid={`cancel-game-${req.id}`}
                        >
                          <span className="duo-sentence">İPTAL ET</span>
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
