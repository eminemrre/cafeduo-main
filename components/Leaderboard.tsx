import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Users, Filter } from 'lucide-react';
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
        if (index === 1) return <Medal className="text-gray-300" size={24} />;
        if (index === 2) return <Medal className="text-amber-600" size={24} />;
        return <span className="font-pixel text-gray-500 text-lg">#{index + 1}</span>;
    };

    return (
        <div className="bg-[#151921] border border-gray-800 rounded-lg overflow-hidden shadow-xl">
            <div className="p-4 bg-gray-900 border-b border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="font-pixel text-xl text-yellow-500 flex items-center gap-2">
                    <Trophy size={24} />
                    LİDERLİK TABLOSU
                </h2>

                <div className="flex items-center gap-2">
                    <div className="flex bg-gray-800 rounded p-1">
                        <button
                            onClick={() => setFilterType('general')}
                            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${filterType === 'general' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                            GENEL
                        </button>
                        <button
                            onClick={() => setFilterType('department')}
                            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${filterType === 'department' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
                        >
                            BÖLÜM
                        </button>
                    </div>

                    {filterType === 'department' && (
                        <select
                            value={selectedDepartment}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                            className="bg-gray-800 text-white text-xs px-2 py-1.5 rounded border border-gray-700 outline-none"
                        >
                            {PAU_DEPARTMENTS.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-800/50 text-xs text-gray-400 uppercase font-mono">
                        <tr>
                            <th className="p-4 text-center w-16">Sıra</th>
                            <th className="p-4">Kullanıcı</th>
                            <th className="p-4 hidden md:table-cell">Bölüm</th>
                            <th className="p-4 text-right">Puan</th>
                            <th className="p-4 text-right hidden sm:table-cell">Galibiyet</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-500 animate-pulse">
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
                                <td colSpan={5} className="p-8 text-center text-gray-500">
                                    Henüz veri yok.
                                </td>
                            </tr>
                        ) : (
                            users.map((user, index) => (
                                <tr key={user.id} className="hover:bg-gray-800/30 transition-colors group">
                                    <td className="p-4 text-center font-bold">
                                        <div className="flex justify-center">{getRankIcon(index)}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center font-pixel text-xs text-gray-300">
                                                {user.username.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="font-bold text-white group-hover:text-yellow-400 transition-colors">{user.username}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-400 hidden md:table-cell">
                                        {user.department || '-'}
                                    </td>
                                    <td className="p-4 text-right font-mono text-yellow-500 font-bold">
                                        {user.points.toLocaleString()}
                                    </td>
                                    <td className="p-4 text-right text-gray-400 text-sm hidden sm:table-cell">
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
