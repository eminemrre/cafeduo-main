/**
 * Achievements — Riso Kantin redesign (PR #25).
 *
 * Dashboard "Başarımlar" tab content. Fetches user achievements via the
 * api.achievements.list contract (unchanged). Unlocked items get a
 * mustard halo + display icon; locked items go paper-deep + grayscale.
 */
import React, { useState, useEffect } from 'react';
import { Trophy, Lock, Star, Footprints, Gamepad2, Crown, Coins } from 'lucide-react';
import { api } from '../lib/api';
import type { Achievement } from '../types';
import { Card, } from './ui';

interface AchievementsProps {
  userId: string | number;
}

export const Achievements: React.FC<AchievementsProps> = ({ userId }) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        const data = await api.achievements.list(userId);
        setAchievements(Array.isArray(data) ? data : []);
        setError(null);
      } catch (err: unknown) {
        console.error(err);
        setAchievements([]);
        setError('Başarımlar yüklenemedi.');
      } finally {
        setLoading(false);
      }
    };
    fetchAchievements();
  }, [userId]);

  const getIcon = (iconName: string, size = 22): React.ReactNode => {
    switch (iconName) {
      case 'footsteps':
        return <Footprints size={size} strokeWidth={2.4} />;
      case 'trophy':
        return <Trophy size={size} strokeWidth={2.4} />;
      case 'gamepad':
        return <Gamepad2 size={size} strokeWidth={2.4} />;
      case 'crown':
        return <Crown size={size} strokeWidth={2.4} />;
      case 'coins':
        return <Coins size={size} strokeWidth={2.4} />;
      default:
        return <Star size={size} strokeWidth={2.4} />;
    }
  };

  if (loading) {
    return (
      <Card tone="paper" shadow="md">
        <p
          aria-busy="true"
          aria-live="polite"
          className="p-4 text-center font-riso-body text-carbon-muted animate-pulse"
        >
          Yükleniyor...
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card tone="paper" shadow="md">
        <p
          role="alert"
          aria-live="polite"
          className="border-2 border-riso-redox p-4 text-center font-riso-body text-riso-redox"
        >
          {error}
        </p>
      </Card>
    );
  }

  return (
    <Card tone="paper" shadow="md" data-testid="achievements-card">
      <div className="mb-5">
        <p className="font-riso-mono text-xs font-bold uppercase tracking-[0.18em] text-carbon-soft">
          // Sistem TR-X · Başarım Arşivi
        </p>
        <h2 className="mt-1.5 font-riso-display text-2xl text-carbon sm:text-3xl">Başarımlar</h2>
        <div className="mt-1 h-2 w-28">
        </div>
      </div>

      {achievements.length === 0 ? (
        <p className="border-2 border-dashed border-carbon-muted bg-paper-deep p-6 text-center font-riso-body text-carbon-muted">
          Henüz başarım yok. İlk oyununu kur ve kazanmaya başla!
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {achievements.map((ach) => (
            <article
              key={ach.id}
              className={`relative flex items-start gap-3 border-2 border-carbon p-4 transition-colors ${
                ach.unlocked ? 'bg-paper' : 'bg-paper-deep opacity-60'
              }`}
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center border-2 border-carbon ${
                  ach.unlocked ? 'bg-riso-mustard text-carbon' : 'bg-paper-dim text-carbon-muted'
                }`}
              >
                {ach.unlocked ? getIcon(ach.icon) : <Lock size={22} strokeWidth={2.4} />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className={`font-riso-display text-base truncate ${
                      ach.unlocked ? 'text-carbon' : 'text-carbon-muted'
                    }`}
                  >
                    {ach.title}
                  </h3>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 border-2 border-carbon px-1.5 py-0.5 font-riso-mono text-xs font-bold ${
                      ach.unlocked ? 'bg-riso-mustard text-carbon' : 'bg-paper text-carbon-muted'
                    }`}
                  >
                    +{ach.points_reward} P
                  </span>
                </div>
                <p className="mt-1 font-riso-body text-xs leading-5 text-carbon-soft">
                  {ach.description}
                </p>

                {ach.unlocked && (
                  <p className="mt-2 font-riso-mono text-xs uppercase tracking-wider text-riso-spring">
                    Kazanıldı: {new Date(ach.unlockedAt!).toLocaleDateString('tr-TR')}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
};
