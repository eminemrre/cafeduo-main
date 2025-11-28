import React, { useState } from 'react';
import { X, Trophy, Gamepad2, Star, Clock, Edit2, Save, Briefcase } from 'lucide-react';
import { User } from '../types';
import { api } from '../lib/api';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, user }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [department, setDepartment] = useState(user?.department || '');
    const [loading, setLoading] = useState(false);

    if (!isOpen || !user) return null;

    // Level calculation based on points (simple logic for demo)
    const level = Math.floor(user.points / 500) + 1;
    const nextLevelProgress = ((user.points % 500) / 500) * 100;

    // Mock history
    const recentHistory = [
        { result: 'WIN', game: 'Taş Kağıt Makas', points: '+50', time: '10dk önce' },
        { result: 'LOSS', game: 'Kelime Eşleştirme', points: '-20', time: '25dk önce' },
        { result: 'WIN', game: 'Taş Kağıt Makas', points: '+100', time: '1sa önce' },
    ];

    const handleSave = async () => {
        setLoading(true);
        try {
            await api.users.update({ ...user, department });
            setIsEditing(false);
            // Note: In a real app, we should update the parent state or refetch user
            user.department = department;
        } catch (err) {
            alert('Güncelleme başarısız.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>

            <div className="relative w-full max-w-md bg-[#151921] border-y-4 border-y-yellow-500 border-x-2 border-x-gray-800 shadow-2xl overflow-hidden">

                {/* Retro ID Card Header */}
                <div className="bg-yellow-500 p-1">
                    <div className="bg-[#151921] p-4 flex justify-between items-start relative overflow-hidden">
                        {/* Background Lines */}
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #ecc94b 0, #ecc94b 10px, transparent 10px, transparent 20px)' }}></div>

                        <div className="flex gap-4 relative z-10 w-full">
                            <div className="w-20 h-20 bg-gray-800 border-2 border-yellow-500 rounded overflow-hidden flex items-center justify-center shadow-lg shrink-0">
                                <span className="font-pixel text-4xl text-white">{(user.username || '?').substring(0, 2).toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="font-pixel text-2xl text-white tracking-wide truncate">{user.username}</h2>
                                <span className="text-xs font-mono text-yellow-500 block mt-1">ID: #{user.id.toString().padStart(6, '0')}</span>

                                {/* Department Section */}
                                <div className="mt-2 flex items-center gap-2">
                                    {isEditing ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={department}
                                                onChange={(e) => setDepartment(e.target.value)}
                                                placeholder="Bölüm Giriniz"
                                                className="bg-black/50 border border-gray-600 text-white text-xs px-2 py-1 rounded outline-none w-32"
                                            />
                                            <button onClick={handleSave} disabled={loading} className="text-green-400 hover:text-green-300">
                                                <Save size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setDepartment(user.department || ''); setIsEditing(true); }}>
                                            <Briefcase size={12} className="text-gray-500" />
                                            <span className="text-gray-400 text-xs font-mono">{user.department || 'Bölüm Girilmedi'}</span>
                                            <Edit2 size={10} className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="relative z-10 text-gray-500 hover:text-white shrink-0 ml-2">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-px bg-gray-800 border-b border-gray-800">
                    <div className="bg-[#1a1f2e] p-4 text-center">
                        <Trophy className="mx-auto text-yellow-500 mb-1" size={20} />
                        <span className="block text-2xl font-retro text-white">{user.wins}</span>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Galibiyet</span>
                    </div>
                    <div className="bg-[#1a1f2e] p-4 text-center">
                        <Gamepad2 className="mx-auto text-blue-500 mb-1" size={20} />
                        <span className="block text-2xl font-retro text-white">{user.gamesPlayed}</span>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Oyun</span>
                    </div>
                    <div className="bg-[#1a1f2e] p-4 text-center">
                        <Star className="mx-auto text-purple-500 mb-1" size={20} />
                        <span className="block text-2xl font-retro text-white">{Math.floor((user.wins / (user.gamesPlayed || 1)) * 100)}%</span>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Oran</span>
                    </div>
                </div>

                {/* Level Progress */}
                <div className="p-4 border-b border-gray-800 bg-[#151921]">
                    <div className="flex justify-between text-xs font-pixel text-gray-400 mb-2">
                        <span>LEVEL {level}</span>
                        <span>LEVEL {level + 1}</span>
                    </div>
                    <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                        <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-1000" style={{ width: `${nextLevelProgress}%` }}></div>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="p-4 bg-[#151921]">
                    <h3 className="font-pixel text-xs text-gray-400 mb-3 flex items-center gap-2">
                        <Clock size={12} />
                        SON AKTİVİTELER
                    </h3>
                    <div className="space-y-2">
                        {recentHistory.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-gray-900/50 border border-gray-800 text-sm">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${item.result === 'WIN' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <span className="text-gray-300">{item.game}</span>
                                </div>
                                <div className="text-right">
                                    <span className={`block font-mono ${item.result === 'WIN' ? 'text-green-400' : 'text-red-400'}`}>{item.points}</span>
                                    <span className="text-[10px] text-gray-600">{item.time}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-[#1a1f2e] text-center">
                    <span className="text-[10px] text-gray-600 font-pixel">CAFE DUO PLAYER CARD SYSTEM v1.0</span>
                </div>

            </div>
        </div>
    );
};