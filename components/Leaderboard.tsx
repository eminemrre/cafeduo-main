import { AvatarImage } from './ui/AvatarImage';
/**
 * Leaderboard — the v2 leaderboard table.
 *
 * Dashboard "Sıralama" tab content. Fetches /api/leaderboard with general
 * vs. department filter. Handler logic + fetch contract unchanged.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal } from 'lucide-react';
import { PAU_DEPARTMENTS } from '../constants';
import { Card, Select } from './ui';

interface LeaderboardUser {
  id: number;
  username: string;
  points: number;
  wins: number;
  gamesPlayed: number;
  department: string;
  avatar_url?: string | null;
}

export const Leaderboard: React.FC = () => {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [filterType, setFilterType] = useState<'general' | 'department'>('general');
  const [selectedDepartment, setSelectedDepartment] = useState<string>(PAU_DEPARTMENTS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/leaderboard?type=${filterType}&department=${encodeURIComponent(selectedDepartment)}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Liderlik tablosu yüklenemedi.'
        );
      }
      setUsers(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error(err);
      setUsers([]);
      setError('Liderlik tablosu yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [filterType, selectedDepartment]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const getRankBadge = (index: number): React.ReactNode => {
    if (index === 0)
      return (
        <span className="inline-flex h-9 w-9 items-center justify-center bg-candy-limon">
          <Trophy size={18} strokeWidth={2.4} className="text-carbon" />
        </span>
      );
    if (index === 1)
      return (
        <span className="inline-flex h-9 w-9 items-center justify-center bg-paper-dim">
          <Medal size={18} strokeWidth={2.4} className="text-carbon-soft" />
        </span>
      );
    if (index === 2)
      return (
        <span className="inline-flex h-9 w-9 items-center justify-center bg-candy-lokum">
          <Medal size={18} strokeWidth={2.4} className="text-carbon" />
        </span>
      );
    return (
      <span className="inline-flex h-9 w-9 items-center justify-center text-sm font-semibold text-carbon-muted [font-variant-numeric:tabular-nums]">
        {index + 1}
      </span>
    );
  };

  return (
    <Card tone="paper" data-testid="leaderboard-card">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="font-candy-display text-[32px] leading-none text-carbon sm:text-[40px]">
          Liderlik Tablosu
        </h2>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-6" role="group" aria-label="Sıralama türü">
            {(
              [
                ['general', 'Genel'],
                ['department', 'Bölüm'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filterType === value}
                onClick={() => setFilterType(value)}
                className={`duo-focus min-h-11 font-candy-body text-[15px] font-semibold transition-colors ${
                  filterType === value
                    ? 'text-carbon shadow-[inset_0_-3px_0_#17140f]'
                    : 'text-carbon-muted hover:text-carbon'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filterType === 'department' && (
            <div className="min-w-[14rem]">
              <Select
                aria-label="Bölüm seç"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                options={PAU_DEPARTMENTS.map((dept) => ({ value: dept, label: dept }))}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left font-candy-body">
          <thead className="bg-paper-deep">
            <tr>
              <th className="px-3 py-2.5 text-center w-16 text-[13px] font-semibold text-carbon-soft">
                Sıra
              </th>
              <th className="px-3 py-2.5 text-[13px] font-semibold text-carbon-soft">
                Kullanıcı
              </th>
              <th className="hidden px-3 py-2.5 text-[13px] font-semibold text-carbon-soft md:table-cell">
                Bölüm
              </th>
              <th className="px-3 py-2.5 text-right text-[13px] font-semibold text-carbon-soft">
                Puan
              </th>
              <th className="hidden px-3 py-2.5 text-right text-[13px] font-semibold text-carbon-soft sm:table-cell">
                Galibiyet
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="p-8 text-center font-candy-body text-carbon-muted"
                >
                  Yükleniyor...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="p-8 text-center font-candy-body text-candy-danger">
                  {error}
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center font-candy-body text-carbon-muted">
                  Henüz veri yok.
                </td>
              </tr>
            ) : (
              users.map((user, index) => (
                <tr
                  key={user.id}
                  className="border-b border-paper-dim last:border-b-0 transition-colors hover:bg-paper-deep"
                >
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex justify-center">{getRankBadge(index)}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center bg-candy-gok text-[13px] font-semibold text-carbon overflow-hidden">
                        <AvatarImage
                          src={user.avatar_url}
                          initials={user.username.substring(0, 2).toUpperCase()}
                        />
                      </div>
                      <span className="min-w-0 truncate font-candy-body font-semibold text-carbon">{user.username}</span>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2.5 font-candy-body text-sm text-carbon-muted md:table-cell">
                    {user.department || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-carbon [font-variant-numeric:tabular-nums]">
                    {user.points.toLocaleString()}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right text-sm text-carbon-soft [font-variant-numeric:tabular-nums] sm:table-cell">
                    {user.wins}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
