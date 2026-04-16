import React, { useState, useEffect } from 'react';
import { Trophy, Medal } from 'lucide-react';
import { PAU_DEPARTMENTS } from '../constants';
import { api } from '../lib/api';

interface LeaderboardUser {
    id: number;
    username: string;
    points: number;
    wins: number;
    gamesPlayed: number;
    department: string;
}

export const Leaderboard: React.FC = () => {
    const [users, setUsers] = useState<LeaderboardUser[]>([]);
    const [filterType, setFilterType] = useState<'general' | 'department'>('general');
    const [selectedDepartment, setSelectedDepartment] = useState<string>(PAU_DEPARTMENTS[0]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchLeaderboard();
    }, [filterType, selectedDepartment]);

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/leaderboard?type=${filterType}&department=${encodeURIComponent(selectedDepartment)}`);
            const data = await res.json();
            if (!res.ok) {
                throw new Error(typeof data?.error === 'string' ? data.error : 'Liderlik tablosu yüklenemedi.');
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
    };

    const getRankIcon = (index: number) => {
        if (index === 0) return <Trophy className="text-yellow-400" size={24} />;
        if (index === 1) return <Medal className="text-cyan-100" size={24} />;
        if (index === 2) return <Medal className="text-amber-600" size={24} />;
        return <span className="font-pixel text-[var(--rf-muted)] text-lg">#{index + 1}</span>;
    };

    return (
        <div className="rf-screen-card noise-bg overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-cyan-400/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="rf-terminal-strip mb-2">Sistem TR-X // Sıralama Motoru</div>
                    <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-[0.08em] text-white flex items-center gap-2">
                        <Trophy size={24} className="text-amber-300" />
                        LİDERLİK TABLOSU
                    </h2>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="flex bg-[#09162f]/90 border border-cyan-400/25 p-1">
                        <button
                            onClick={() => setFilterType('general')}
                            className={`px-3 py-1 text-xs font-bold tracking-[0.16em] transition-colors ${filterType === 'general' ? 'bg-cyan-400 text-[#061025]' : 'text-[var(--rf-muted)] hover:text-white'}`}
                        >
                            GENEL
                        </button>
                        <button
                            onClick={() => setFilterType('department')}
                            className={`px-3 py-1 text-xs font-bold tracking-[0.16em] transition-colors ${filterType === 'department' ? 'bg-cyan-400 text-[#061025]' : 'text-[var(--rf-muted)] hover:text-white'}`}
                        >
                            BÖLÜM
                        </button>
                    </div>

                    {filterType === 'department' && (
                        <select
                            value={selectedDepartment}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                            className="rf-input rf-control text-xs min-h-[36px] px-2 py-1 w-full md:w-auto"
                        >
                            {PAU_DEPARTMENTS.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="rf-admin-table text-left">
                    <thead className="text-xs uppercase font-mono">
                        <tr>
                            <th className="text-center w-16">Sıra</th>
                            <th>Kullanıcı</th>
                            <th className="hidden md:table-cell">Bölüm</th>
                            <th className="text-right">Puan</th>
                            <th className="text-right hidden sm:table-cell">Galibiyet</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-[var(--rf-muted)] animate-pulse">
                                    Yükleniyor...
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-red-300">
                                    {error}
                                </td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-[var(--rf-muted)]">
                                    Henüz veri yok.
                                </td>
                            </tr>
                        ) : (
                            users.map((user, index) => (
                                <tr key={user.id} className="group">
                                    <td className="text-center font-bold">
                                        <div className="flex justify-center">{getRankIcon(index)}</div>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-[#0a1732] border border-cyan-300/30 flex items-center justify-center font-pixel text-xs text-cyan-100">
                                                {user.username.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="font-bold text-white group-hover:text-cyan-300 transition-colors">{user.username}</span>
                                        </div>
                                    </td>
                                    <td className="text-sm text-[var(--rf-muted)] hidden md:table-cell">
                                        {user.department || '-'}
                                    </td>
                                    <td className="text-right font-mono text-yellow-500 font-bold">
                                        {user.points.toLocaleString()}
                                    </td>
                                    <td className="text-right text-[var(--rf-muted)] text-sm hidden sm:table-cell">
                                        {user.wins}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
