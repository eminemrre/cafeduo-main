/**
 * Achievements — the v2 achievements list.
 *
 * Dashboard "Başarımlar" tab content. Fetches user achievements via the
 * api.achievements.list contract (unchanged). Unlocked items get a
 * mustard halo + display icon; locked items go paper-deep + grayscale.
 */
import React, { useState, useEffect } from 'react';
import { Trophy, Lock, Star, Footprints, Gamepad2, Crown, Coins } from 'lucide-react';
import { api } from '../lib/api';
import type { Achievement } from '../types';
import { Card } from './ui';

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
      <Card tone="paper">
        <p
          aria-busy="true"
          aria-live="polite"
          className="p-4 text-center font-candy-body text-carbon-muted"
        >
          Yükleniyor...
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card tone="paper">
        <p
          role="alert"
          aria-live="polite"
          className="bg-candy-danger/10 p-4 text-center font-candy-body text-carbon"
        >
          {error}
        </p>
      </Card>
    );
  }

  return (
    <Card tone="paper" data-testid="achievements-card">
      <h2 className="mb-5 font-candy-display text-[32px] leading-none text-carbon sm:text-[40px]">
        Başarımlar
      </h2>

      {achievements.length === 0 ? (
        <p className="bg-paper-deep p-6 text-center font-candy-body text-carbon-soft">
          Henüz başarım yok. İlk oyununu kur ve kazanmaya başla!
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {achievements.map((ach) => (
            <article
              key={ach.id}
              className="relative flex items-start gap-3 bg-paper-deep p-4"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center ${
                  ach.unlocked ? 'bg-candy-fistik text-carbon' : 'bg-paper-dim text-carbon-muted'
                }`}
              >
                {ach.unlocked ? getIcon(ach.icon) : <Lock size={22} strokeWidth={2.4} />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className="font-candy-body text-[15px] font-semibold text-carbon truncate"
                  >
                    {ach.title}
                  </h3>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 px-2 py-0.5 text-[13px] font-semibold [font-variant-numeric:tabular-nums] ${
                      ach.unlocked ? 'bg-candy-fistik text-carbon' : 'bg-paper text-carbon-soft'
                    }`}
                  >
                    +{ach.points_reward} P
                  </span>
                </div>
                <p className="mt-1 font-candy-body text-[13px] leading-5 text-carbon-soft">
                  {ach.description}
                </p>

                {ach.unlocked && (
                  <p className="mt-2 text-[13px] font-semibold text-[#177A41]">
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
