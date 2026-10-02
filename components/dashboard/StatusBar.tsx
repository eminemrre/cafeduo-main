import React from 'react';
import { AvatarImage } from '../ui/AvatarImage';
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
  onOpenProfile,
}) => (
  <div className="duo-status">
    <div>
      <button
        type="button"
        className="duo-status-profile riso-focus"
        onClick={onOpenProfile}
        aria-label="Profilini aç"
      >
        <div className="duo-status-avatar">
          <AvatarImage
            src={user.avatar_url}
            initials={user.username.charAt(0).toUpperCase()}
            loading="eager"
          />
        </div>
        <div className="min-w-0">
          <h3 className="truncate">{user.username}</h3>
          <p className="truncate">{user.department || 'Öğrenci'}</p>
        </div>
      </button>
      <div className="duo-table-status" data-testid="table-status">
        {isMatched ? <Wifi size={13} /> : <MapPin size={13} />}
        <span>{isMatched ? tableCode : 'Masa bağlı değil'}</span>
      </div>
    </div>
    <div className="duo-status-stats">
      <div data-testid="user-points">
        <span>
          <Star size={13} /> Puan
        </span>
        <strong>{user.points}</strong>
      </div>
      <div data-testid="user-wins">
        <span>
          <Trophy size={13} /> Galibiyet
        </span>
        <strong>{user.wins}</strong>
      </div>
      <div data-testid="user-games">
        <span>
          <Gamepad2 size={13} /> Oyun
        </span>
        <strong>{user.gamesPlayed}</strong>
      </div>
    </div>
  </div>
);

export default StatusBar;
