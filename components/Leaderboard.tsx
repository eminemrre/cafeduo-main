import { AvatarImage } from './ui/AvatarImage';
/**
 * Leaderboard — Riso Kantin redesign (PR #25).
 *
 * Dashboard "Sıralama" tab content. Fetches /api/leaderboard with general
 * vs. department filter. Handler logic + fetch contract unchanged.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal } from 'lucide-react';
import { PAU_DEPARTMENTS } from '../constants';
import { Card, Select, Squiggle } from './ui';

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
        <span className="inline-flex h-9 w-9 items-center justify-center border-2 border-carbon bg-riso-mustard">
          <Trophy size={18} strokeWidth={2.4} className="text-carbon" />
        </span>
      );
    if (index === 1)
      return (
        <span className="inline-flex h-9 w-9 items-center justify-center border-2 border-carbon bg-paper-deep">
          <Medal size={18} strokeWidth={2.4} className="text-carbon-soft" />
        </span>
      );
    if (index === 2)
      return (
        <span className="inline-flex h-9 w-9 items-center justify-center border-2 border-carbon bg-riso-pink">
          <Medal size={18} strokeWidth={2.4} className="text-carbon" />
        </span>
      );
    return (
      <span className="inline-flex h-9 w-9 items-center justify-center font-riso-mono text-sm font-bold text-carbon-muted">
        #{index + 1}
      </span>
    );
  };

  return (
    <Card tone="paper" shadow="md" data-testid="leaderboard-card">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-riso-mono text-xs font-bold uppercase tracking-[0.18em] text-carbon-soft">
            // Sistem TR-X · Sıralama Motoru
          </p>
          <h2 className="mt-1.5 flex items-center gap-2 font-riso-display text-2xl text-carbon sm:text-3xl">
            <Trophy size={24} strokeWidth={2.4} className="text-riso-mustard-deep" />
            Liderlik Tablosu
          </h2>
          <div className="mt-1 h-2 w-32">
            <Squiggle tone="mustard" />
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex border-2 border-carbon bg-paper">
            <button
              type="button"
              onClick={() => setFilterType('general')}
              className={`riso-focus px-3 py-1.5 font-riso-body text-xs font-bold tracking-[0.14em] transition-colors ${
                filterType === 'general'
                  ? 'bg-riso-pink text-carbon'
                  : 'text-carbon hover:bg-paper-deep'
              }`}
            >
              GENEL
            </button>
            <button
              type="button"
              onClick={() => setFilterType('department')}
              className={`riso-focus border-l-2 border-carbon px-3 py-1.5 font-riso-body text-xs font-bold tracking-[0.14em] transition-colors ${
                filterType === 'department'
                  ? 'bg-riso-pink text-carbon'
                  : 'text-carbon hover:bg-paper-deep'
              }`}
            >
              BÖLÜM
            </button>
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

      <div className="mt-6 overflow-x-auto border-2 border-carbon">
        <table className="w-full text-left font-riso-body">
          <thead className="border-b-2 border-carbon bg-paper-deep">
            <tr>
              <th className="px-3 py-2.5 text-center w-16 font-riso-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-carbon-soft">
                Sıra
              </th>
              <th className="px-3 py-2.5 font-riso-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-carbon-soft">
                Kullanıcı
              </th>
              <th className="hidden px-3 py-2.5 font-riso-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-carbon-soft md:table-cell">
                Bölüm
              </th>
              <th className="px-3 py-2.5 text-right font-riso-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-carbon-soft">
                Puan
              </th>
              <th className="hidden px-3 py-2.5 text-right font-riso-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-carbon-soft sm:table-cell">
                Galibiyet
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="p-8 text-center font-riso-body text-carbon-muted animate-pulse"
                >
                  Yükleniyor...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="p-8 text-center font-riso-body text-riso-redox">
                  {error}
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center font-riso-body text-carbon-muted">
                  Henüz veri yok.
                </td>
              </tr>
            ) : (
              users.map((user, index) => (
                <tr
                  key={user.id}
                  className="border-b-2 border-paper-dim last:border-b-0 transition-colors hover:bg-paper-deep"
                >
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex justify-center">{getRankBadge(index)}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-9 w-9 items-center justify-center border-2 border-carbon bg-riso-blue font-riso-display text-xs font-bold text-paper overflow-hidden">
                        <AvatarImage
                          src={user.avatar_url}
                          initials={user.username.substring(0, 2).toUpperCase()}
                        />
                      </div>
                      <span className="font-riso-body font-bold text-carbon">{user.username}</span>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2.5 font-riso-body text-sm text-carbon-muted md:table-cell">
                    {user.department || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-riso-mono font-bold text-riso-mustard-deep">
                    {user.points.toLocaleString()}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right font-riso-mono text-sm text-carbon-soft sm:table-cell">
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
