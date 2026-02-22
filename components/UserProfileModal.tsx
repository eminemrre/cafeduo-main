import React, { useEffect, useState } from 'react';
import { X, Trophy, Gamepad2, Star, Clock, Edit2, Save, Briefcase } from 'lucide-react';
import { User } from '../types';
import { api } from '../lib/api';
import { PAU_DEPARTMENTS } from '../constants';

interface UserInventoryItem {
    id: number;
    user_id: number;
    item_id: number;
    item_title: string;
    code: string;
    is_used: boolean;
}

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    isEditable?: boolean;
    onSaveProfile?: (department: string) => Promise<void> | void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
    isOpen,
    onClose,
    user,
    isEditable = false,
    onSaveProfile,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [department, setDepartment] = useState(user?.department || '');
    const [loading, setLoading] = useState(false);
    const [inventory, setInventory] = useState<UserInventoryItem[]>([]);

    useEffect(() => {
        setDepartment(user?.department || '');
        setIsEditing(false);
        if (isOpen && user) {
            api.store.inventory().then(res => {
                if (res.success) setInventory(res.inventory);
            }).catch(err => console.error("Inventory fetch error", err));
        }
    }, [user?.id, user?.department, isOpen]);

    if (!isOpen || !user) return null;

    // Level calculation based on points (simple logic for demo)
    const level = Math.floor(user.points / 500) + 1;
    const nextLevelProgress = ((user.points % 500) / 500) * 100;

    // Mock history
    const recentHistory = [
        { result: 'WIN', game: 'Refleks Avı', points: '+50', time: '10dk önce' },
        { result: 'LOSS', game: 'Kelime Eşleştirme', points: '-20', time: '25dk önce' },
        { result: 'WIN', game: 'Refleks Avı', points: '+100', time: '1sa önce' },
    ];

    const handleSave = async () => {
        setLoading(true);
        try {
            if (onSaveProfile) {
                await onSaveProfile(department);
            } else {
                await api.users.update({ ...user, department });
            }
            setIsEditing(false);
        } catch (err) {
            alert('Güncelleme başarısız.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-[#02050f]/85 backdrop-blur-sm noise-bg" onClick={onClose}></div>

            <div className="relative w-full max-w-md bg-[#050a19] border-t-2 border-r-4 border-b-4 border-l-2 border-t-cyan-400 border-r-pink-500 border-b-pink-500 border-l-cyan-400 shadow-[10px_10px_0px_rgba(0,0,0,0.8)] sm:rounded-none overflow-hidden flex flex-col noise-bg">

                {/* Cyber ID Card Header */}
                <div className="bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 p-[2px]">
                    <div className="bg-[#050a19] p-5 flex justify-between items-start relative overflow-hidden">
                        {/* Background Lines */}
                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #00f3ff 0, #00f3ff 2px, transparent 2px, transparent 10px)' }}></div>

                        <div className="flex gap-4 relative z-10 w-full">
                            <div className="w-20 h-20 bg-black border-2 border-cyan-400 skew-x-[-5deg] overflow-hidden flex items-center justify-center shadow-[4px_4px_0_rgba(255,0,234,0.3)] shrink-0">
                                <span className="font-display text-4xl text-cyan-400 skew-x-[5deg]">{(user.username || '?').substring(0, 2).toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="font-display text-2xl text-white tracking-widest truncate uppercase glitch-text" data-text={user.username}>{user.username}</h2>
                                <span className="text-xs font-body text-pink-500 block mt-1 tracking-widest">ID: #{user.id.toString().padStart(6, '0')}</span>

                                {/* Department Section */}
                                <div className="mt-2 flex items-center gap-2">
                                    {isEditable && isEditing ? (
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={department}
                                                onChange={(e) => setDepartment(e.target.value)}
                                                className="bg-black border border-cyan-900/50 text-cyan-50 font-body text-xs px-2 py-1 outline-none w-48"
                                            >
                                                <option value="">Bölüm Seçiniz</option>
                                                {PAU_DEPARTMENTS.map(dept => (
                                                    <option key={dept} value={dept}>{dept}</option>
                                                ))}
                                            </select>
                                            <button onClick={handleSave} disabled={loading} className="text-emerald-400 hover:text-emerald-300 transition-colors">
                                                <Save size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            className={`flex items-center gap-2 ${isEditable ? 'group cursor-pointer' : ''}`}
                                            onClick={() => {
                                                if (!isEditable) return;
                                                setDepartment(user.department || '');
                                                setIsEditing(true);
                                            }}
                                        >
                                            <Briefcase size={12} className="text-cyan-600" />
                                            <span className="text-cyan-300 text-xs font-body tracking-wider">{user.department || 'Bölüm Girilmedi'}</span>
                                            {isEditable && (
                                                <Edit2 size={10} className="text-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="relative z-10 w-8 h-8 flex items-center justify-center border border-cyan-500/30 text-cyan-400 hover:text-pink-500 hover:bg-white/5 shrink-0 ml-2 transition-colors skew-x-[-10deg] group">
                            <X size={18} className="skew-x-[10deg] group-hover:skew-x-0" />
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-px bg-cyan-900/30 border-b-2 border-cyan-900/50">
                    <div className="bg-[#050a19] p-4 text-center hover:bg-white/5 transition-colors group">
                        <Trophy className="mx-auto text-yellow-500 mb-2 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)] group-hover:scale-110 transition-transform" size={20} />
                        <span className="block text-3xl font-display text-white">{user.wins}</span>
                        <span className="text-[10px] font-body text-cyan-600/80 uppercase tracking-widest">Galibiyet</span>
                    </div>
                    <div className="bg-[#050a19] p-4 text-center hover:bg-white/5 transition-colors group">
                        <Gamepad2 className="mx-auto text-cyan-400 mb-2 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] group-hover:scale-110 transition-transform" size={20} />
                        <span className="block text-3xl font-display text-white">{user.gamesPlayed}</span>
                        <span className="text-[10px] font-body text-cyan-600/80 uppercase tracking-widest">Oyun</span>
                    </div>
                    <div className="bg-[#050a19] p-4 text-center hover:bg-white/5 transition-colors group">
                        <Star className="mx-auto text-pink-500 mb-2 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)] group-hover:scale-110 transition-transform" size={20} />
                        <span className="block text-3xl font-display text-white">{user.gamesPlayed > 0 ? Math.floor((user.wins / user.gamesPlayed) * 100) : 0}%</span>
                        <span className="text-[10px] font-body text-cyan-600/80 uppercase tracking-widest">Oran</span>
                    </div>
                </div>

                {/* Level Progress */}
                <div className="p-5 border-b-2 border-cyan-900/50 bg-[#050a19] relative overflow-hidden">
                    <div className="flex justify-between text-xs font-display tracking-widest text-cyan-400 mb-2">
                        <span>LEVEL {level}</span>
                        <span className="text-pink-500">LEVEL {level + 1}</span>
                    </div>
                    <div className="h-4 bg-black border-2 border-cyan-900/50 skew-x-[-10deg] overflow-hidden relative">
                        <div className="h-full bg-gradient-to-r from-cyan-500 to-pink-500 transition-all duration-1000 relative" style={{ width: `${nextLevelProgress}%` }}>
                            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:1rem_1rem] animate-[stripes_1s_linear_infinite]"></div>
                        </div>
                    </div>
                </div>

                {/* Inventory / Equipment */}
                {inventory.length > 0 && (
                    <div className="p-5 border-b-2 border-cyan-900/50 bg-[#050a19]">
                        <h3 className="font-body text-[10px] tracking-widest text-emerald-400 mb-3 flex items-center gap-2 uppercase">
                            <Star size={12} className="text-emerald-400" />
                            LİSANSLI EKİPMANLAR // ENVANTER
                        </h3>
                        <div className="flex flex-wrap gap-2 relative z-10">
                            {inventory.map((item) => (
                                <div key={item.id} className="px-2 py-1 bg-cyan-950/40 border border-cyan-500/30 text-[10px] font-display text-cyan-300 uppercase tracking-widest flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 animate-pulse"></span>
                                    {item.item_title}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent Activity */}
                <div className="p-5 bg-black/40">
                    <h3 className="font-body text-[10px] tracking-widest text-cyan-600/80 mb-3 flex items-center gap-2 uppercase">
                        <Clock size={12} className="text-pink-500" />
                        Son Aktiviteler // Sistem Logu
                    </h3>
                    <div className="space-y-2 relative z-10">
                        {recentHistory.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 bg-[#050a19] border-l-2 border border-cyan-900/30 text-sm hover:border-cyan-400 transition-colors group" style={{ borderLeftColor: item.result === 'WIN' ? '#00f3ff' : '#ff00ea' }}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-1.5 h-1.5 animate-pulse ${item.result === 'WIN' ? 'bg-cyan-400 shadow-[0_0_5px_#00f3ff]' : 'bg-pink-500 shadow-[0_0_5px_#ff00ea]'}`}></div>
                                    <span className="text-cyan-100 font-body text-xs tracking-wider">{item.game}</span>
                                </div>
                                <div className="text-right">
                                    <span className={`block font-display tracking-widest ${item.result === 'WIN' ? 'text-cyan-400' : 'text-pink-500'}`}>{item.points}</span>
                                    <span className="text-[9px] text-cyan-600/60 font-body uppercase">{item.time}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Bar */}
                <div className="p-3 bg-cyan-400 text-center">
                    <span className="text-[10px] text-black font-body font-bold tracking-[0.2em] uppercase">CAFE DUO LİSANS İZİNLERİ // GÜNCEL</span>
                </div>

            </div>
        </div>
    );
};
