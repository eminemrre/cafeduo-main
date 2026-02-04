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
}

export const StatusBar: React.FC<StatusBarProps> = ({
  user,
  tableCode,
  isMatched
}) => {
  return (
    <div className="bg-gradient-to-r from-[#1a1f2e] to-[#151921] border border-gray-800 rounded-xl p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Kullanıcı Bilgileri */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-white font-bold">{user.username}</h3>
            <p className="text-gray-400 text-sm">{user.department || 'Öğrenci'}</p>
          </div>
        </div>

        {/* İstatistikler */}
        <div className="flex items-center gap-6">
          {/* Puan */}
          <div className="flex items-center gap-2 bg-yellow-500/10 px-4 py-2 rounded-lg" data-testid="user-points">
            <Star className="text-yellow-500" size={20} />
            <div>
              <span className="text-yellow-500 font-bold text-lg">{user.points}</span>
              <span className="text-gray-500 text-xs block">Puan</span>
            </div>
          </div>

          {/* Galibiyet */}
          <div className="flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-lg" data-testid="user-wins">
            <Trophy className="text-blue-500" size={20} />
            <div>
              <span className="text-blue-500 font-bold text-lg">{user.wins}</span>
              <span className="text-gray-500 text-xs block">Galibiyet</span>
            </div>
          </div>

          {/* Oynanan Oyun */}
          <div className="flex items-center gap-2 bg-purple-500/10 px-4 py-2 rounded-lg" data-testid="user-games">
            <Gamepad2 className="text-purple-500" size={20} />
            <div>
              <span className="text-purple-500 font-bold text-lg">{user.gamesPlayed}</span>
              <span className="text-gray-500 text-xs block">Oyun</span>
            </div>
          </div>
        </div>

        {/* Masa Durumu */}
        <div className="flex items-center gap-2" data-testid="table-status">
          {isMatched ? (
            <>
              <Wifi className="text-green-500 animate-pulse" size={18} />
              <span className="text-green-400 text-sm font-medium">
                {tableCode}
              </span>
            </>
          ) : (
            <>
              <MapPin className="text-gray-500" size={18} />
              <span className="text-gray-500 text-sm">
                Masa bağlı değil
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
