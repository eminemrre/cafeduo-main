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
            <div className="p-8 text-center text-gray-500" aria-busy="true" aria-live="polite">
                Yükleniyor...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-300 rf-panel border border-red-400/30 rounded-xl" role="alert" aria-live="polite">
                {error}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy={loading} aria-live="polite">
            {achievements.map((ach) => (
                <div
                    key={ach.id}
                    className={`relative p-4 rounded-lg border flex items-start gap-4 transition-all ${ach.unlocked
                        ? 'bg-gray-800/50 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                        : 'bg-gray-900/50 border-gray-800 opacity-60 grayscale'
                        }`}
                >
                    <div className={`p-3 rounded-lg shrink-0 ${ach.unlocked ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-800 text-gray-600'}`}>
                        {ach.unlocked ? getIcon(ach.icon) : <Lock size={24} />}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <h3 className={`font-bold truncate ${ach.unlocked ? 'text-white' : 'text-gray-400'}`}>
                                {ach.title}
                            </h3>
                            <span className="text-xs font-mono text-yellow-500 flex items-center gap-1 bg-yellow-500/10 px-1.5 py-0.5 rounded">
                                +{ach.points_reward} P
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{ach.description}</p>

                        {ach.unlocked && (
                            <div className="mt-2 text-[10px] text-green-400 font-mono">
                                Kazanıldı: {new Date(ach.unlockedAt!).toLocaleDateString('tr-TR')}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
