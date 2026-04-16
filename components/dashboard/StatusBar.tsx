/**
 * StatusBar Component
 * 
 * @description Kullanıcı durum bilgileri ve istatistikler
 */

import React from 'react';
import { User } from '../../types';
import { Trophy, Star, Gamepad2, Wifi, MapPin } from 'lucide-react';

interface StatusBarProps {
  user: User;
  tableCode: string;
  isMatched: boolean;
  onOpenProfile?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  user,
  tableCode,
  isMatched,
  onOpenProfile
}) => {
  return (
    <div className="rf-panel border-cyan-400/20 rounded-xl p-4 md:p-5 mb-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            className="flex items-center gap-3 min-w-0 text-left"
            onClick={onOpenProfile}
            aria-label="Profilini aç"
          >
            <div className="w-11 h-11 rounded-full bg-[#0a2d52] border border-cyan-300/35 flex items-center justify-center text-cyan-100 font-semibold text-base shadow-[0_8px_20px_rgba(0,0,0,0.28)]">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-semibold truncate">{user.username}</h3>
              <p className="text-[var(--rf-muted)] text-sm truncate">{user.department || 'Öğrenci'}</p>
            </div>
          </button>

          <div
            className={`inline-flex items-center gap-2 self-start sm:self-auto rounded-full px-3 py-1.5 border ${
              isMatched
                ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-300'
                : 'border-cyan-500/28 bg-cyan-950/25 text-[var(--rf-muted)]'
            }`}
            data-testid="table-status"
          >
            {isMatched ? <Wifi className="animate-pulse" size={16} /> : <MapPin size={16} />}
            <span className="text-xs font-medium">{isMatched ? tableCode : 'Masa bağlı değil'}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="rf-card-quiet p-2.5 sm:p-3" data-testid="user-points">
            <div className="flex items-center gap-1.5 text-amber-300 mb-1">
              <Star size={15} />
              <span className="text-[10px] uppercase tracking-[0.1em]">Puan</span>
            </div>
            <div className="text-white text-lg sm:text-xl font-semibold leading-none">{user.points}</div>
          </div>

          <div className="rf-card-quiet p-2.5 sm:p-3" data-testid="user-wins">
            <div className="flex items-center gap-1.5 text-cyan-300 mb-1">
              <Trophy size={15} />
              <span className="text-[10px] uppercase tracking-[0.1em]">Galibiyet</span>
            </div>
            <div className="text-white text-lg sm:text-xl font-semibold leading-none">{user.wins}</div>
          </div>

          <div className="rf-card-quiet p-2.5 sm:p-3" data-testid="user-games">
            <div className="flex items-center gap-1.5 text-cyan-200 mb-1">
              <Gamepad2 size={15} />
              <span className="text-[10px] uppercase tracking-[0.1em]">Oyun</span>
            </div>
            <div className="text-white text-lg sm:text-xl font-semibold leading-none">{user.gamesPlayed}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
