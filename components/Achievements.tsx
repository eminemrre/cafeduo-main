import React, { useState, useEffect } from 'react';
import { Trophy, Lock, Star, Footprints, Gamepad2, Crown, Coins } from 'lucide-react';
import { api } from '../lib/api';
import type { Achievement } from '../types';

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

    const getIcon = (iconName: string, size = 24) => {
        switch (iconName) {
            case 'footsteps': return <Footprints size={size} />;
            case 'trophy': return <Trophy size={size} />;
            case 'gamepad': return <Gamepad2 size={size} />;
            case 'crown': return <Crown size={size} />;
            case 'coins': return <Coins size={size} />;
            default: return <Star size={size} />;
        }
    };

    if (loading) {
        return (
            <div className="rf-screen-card noise-bg p-8 text-center text-[var(--rf-muted)]" aria-busy="true" aria-live="polite">
                Yükleniyor...
            </div>
        );
    }

    if (error) {
        return (
            <div className="rf-screen-card noise-bg p-8 text-center text-red-300 border border-red-400/30" role="alert" aria-live="polite">
                {error}
            </div>
        );
    }

    return (
        <div className="rf-screen-card noise-bg p-4 sm:p-5" aria-busy={loading} aria-live="polite">
            <div className="rf-terminal-strip mb-2">Sistem TR-X // Başarım Arşivi</div>
            <h3 className="font-display text-2xl sm:text-3xl uppercase tracking-[0.08em] text-white mb-5">Başarımlar</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {achievements.map((ach) => (
                    <div
                        key={ach.id}
                        className={`relative p-4 border flex items-start gap-4 transition-all ${ach.unlocked
                            ? 'rf-screen-card-muted'
                            : 'bg-[#091329]/90 border-cyan-900/40 opacity-70 grayscale'
                            }`}
                    >
                        <div className={`p-3 shrink-0 border ${ach.unlocked ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/40' : 'bg-black/40 text-cyan-900/90 border-cyan-900/30'}`}>
                            {ach.unlocked ? getIcon(ach.icon) : <Lock size={24} />}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                                <h3 className={`font-bold truncate ${ach.unlocked ? 'text-white' : 'text-[var(--rf-muted)]'}`}>
                                    {ach.title}
                                </h3>
                                <span className="text-xs font-mono text-yellow-500 flex items-center gap-1 bg-yellow-500/10 px-1.5 py-0.5 border border-yellow-500/25">
                                    +{ach.points_reward} P
                                </span>
                            </div>
                            <p className="text-xs text-[var(--rf-muted)] mt-1">{ach.description}</p>

                            {ach.unlocked && (
                                <div className="mt-2 text-[10px] text-emerald-300 font-mono">
                                    Kazanıldı: {new Date(ach.unlockedAt!).toLocaleDateString('tr-TR')}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
