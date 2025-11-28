import React, { useState, useEffect } from 'react';
import { Users, Trash2, Shield, Search } from 'lucide-react';
import { User } from '../types';
import { api } from '../lib/api';

interface AdminDashboardProps {
    currentUser: User;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'users' | 'games' | 'cafes'>('users');
    const [cafes, setCafes] = useState<any[]>([]);
    const [newCafeAdmin, setNewCafeAdmin] = useState({ username: '', email: '', password: '', cafeId: 1 });

    const [sortConfig, setSortConfig] = useState<{ key: keyof User; direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        fetchUsers();
        fetchCafes();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users');
            if (!res.ok) throw new Error('Failed to fetch users');

            const data = await res.json();
            if (Array.isArray(data)) {
                setUsers(data);
            } else {
                console.error('Data is not an array:', data);
                setUsers([]);
            }
        } catch (err) {
            console.error('Failed to fetch users', err);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchCafes = async () => {
        try {
            const data = await api.cafes.list();
            setCafes(data);
        } catch (error) {
            console.error("Failed to fetch cafes", error);
        }
    };

    const handleCreateCafeAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.admin.createCafeAdmin(newCafeAdmin);
            alert('Kafe Yöneticisi başarıyla oluşturuldu!');
            setNewCafeAdmin({ username: '', email: '', password: '', cafeId: 1 });
            fetchUsers(); // Refresh user list
        } catch (error) {
            alert('Hata oluştu.');
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (window.confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) {
            try {
                await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
                setUsers(users.filter(u => u.id !== id));
            } catch (err) {
                alert('Silme işlemi başarısız.');
            }
        }
    };

    const handleSort = (key: keyof User) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedUsers = React.useMemo(() => {
        let sortableUsers = [...users];
        if (sortConfig !== null) {
            sortableUsers.sort((a, b) => {
                const aValue = a[sortConfig.key] ?? '';
                const bValue = b[sortConfig.key] ?? '';

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableUsers;
    }, [users, sortConfig]);

    const filteredUsers = sortedUsers.filter(u =>
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const SortIcon = ({ column }: { column: keyof User }) => {
        if (sortConfig?.key !== column) return <span className="opacity-20 ml-1">↕</span>;
        return <span className="ml-1 text-yellow-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="min-h-screen bg-[#0f141a] pt-24 px-4 pb-12">
            <div className="max-w-6xl mx-auto">

                <div className="flex items-center gap-4 mb-8 bg-red-900/20 p-6 rounded-xl border border-red-900/50">
                    <div className="p-4 bg-red-600 rounded-lg shadow-lg shadow-red-900/50">
                        <Shield size={32} className="text-white" />
                    </div>
                    <div>
                        <h1 className="font-pixel text-3xl text-white">YÖNETİM PANELİ</h1>
                        <p className="text-red-300 font-mono text-sm">SİSTEM YÖNETİCİSİ: {currentUser.username}</p>
                    </div>
                </div>

                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                        Kullanıcılar
                    </button>
                    <button
                        onClick={() => setActiveTab('games')}
                        className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'games' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                        Oyunlar
                    </button>
                    <button
                        onClick={() => setActiveTab('cafes')}
                        className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'cafes' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                        Kafe Yönetimi
                    </button>
                </div>

                {activeTab === 'users' && (
                    <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
                        {/* Toolbar */}
                        <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center flex-wrap gap-4">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-white font-pixel">
                                    <Users size={20} className="text-blue-400" />
                                    KULLANICI LİSTESİ ({users.length})
                                </div>
                                <button
                                    onClick={fetchUsers}
                                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded transition-colors"
                                >
                                    YENİLE
                                </button>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Kullanıcı Ara..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="bg-black/40 border border-gray-600 rounded-full py-2 pl-10 pr-4 text-white text-sm outline-none focus:border-blue-500 w-64"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-400">
                                <thead className="bg-gray-900/50 font-pixel text-xs uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="p-4 cursor-pointer hover:text-white" onClick={() => handleSort('id')}>ID <SortIcon column="id" /></th>
                                        <th className="p-4 cursor-pointer hover:text-white" onClick={() => handleSort('username')}>Kullanıcı <SortIcon column="username" /></th>
                                        <th className="p-4 cursor-pointer hover:text-white" onClick={() => handleSort('email')}>E-posta <SortIcon column="email" /></th>
                                        <th className="p-4 cursor-pointer hover:text-white" onClick={() => handleSort('department')}>Bölüm <SortIcon column="department" /></th>
                                        <th className="p-4 text-center cursor-pointer hover:text-white" onClick={() => handleSort('points')}>Puan <SortIcon column="points" /></th>
                                        <th className="p-4 text-center">Rol</th>
                                        <th className="p-4 text-right">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {loading ? (
                                        <tr><td colSpan={7} className="p-8 text-center">Yükleniyor...</td></tr>
                                    ) : filteredUsers.length === 0 ? (
                                        <tr><td colSpan={7} className="p-8 text-center">Kullanıcı bulunamadı.</td></tr>
                                    ) : (
                                        filteredUsers.map(user => (
                                            <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                                <td className="p-4 font-mono text-gray-600">#{user.id}</td>
                                                <td className="p-4 font-bold text-white flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs">
                                                        {(user.username || '?').substring(0, 2).toUpperCase()}
                                                    </div>
                                                    {user.username}
                                                </td>
                                                <td className="p-4">{user.email}</td>
                                                <td className="p-4">{user.department || '-'}</td>
                                                <td className="p-4 text-center font-mono text-yellow-500">{user.points}</td>
                                                <td className="p-4 text-center">
                                                    {user.isAdmin ? (
                                                        <span className="bg-red-900/50 text-red-300 px-2 py-1 rounded text-xs border border-red-800">ADMIN</span>
                                                    ) : user.role === 'cafe_admin' ? (
                                                        <span className="bg-orange-900/50 text-orange-300 px-2 py-1 rounded text-xs border border-orange-800">CAFE ADMIN</span>
                                                    ) : (
                                                        <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded text-xs border border-blue-800">USER</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    {!user.isAdmin && (
                                                        <button
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            className="text-red-500 hover:text-red-400 p-2 hover:bg-red-900/20 rounded transition-colors"
                                                            title="Kullanıcıyı Sil"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'games' && (
                    <div className="bg-[#1a1f2e] border border-gray-800 rounded-xl p-6">
                        <p className="text-gray-400">Oyun geçmişi burada listelenecek.</p>
                    </div>
                )}

                {activeTab === 'cafes' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-[#1a1f2e] border border-gray-800 rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-4">Kafe Yöneticisi Ekle</h2>
                            <form onSubmit={handleCreateCafeAdmin} className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Kullanıcı Adı</label>
                                    <input
                                        type="text"
                                        value={newCafeAdmin.username}
                                        onChange={e => setNewCafeAdmin({ ...newCafeAdmin, username: e.target.value })}
                                        className="w-full bg-black/30 border border-gray-700 rounded-lg p-2 text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={newCafeAdmin.email}
                                        onChange={e => setNewCafeAdmin({ ...newCafeAdmin, email: e.target.value })}
                                        className="w-full bg-black/30 border border-gray-700 rounded-lg p-2 text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Şifre</label>
                                    <input
                                        type="password"
                                        value={newCafeAdmin.password}
                                        onChange={e => setNewCafeAdmin({ ...newCafeAdmin, password: e.target.value })}
                                        className="w-full bg-black/30 border border-gray-700 rounded-lg p-2 text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Kafe Seçimi</label>
                                    <select
                                        value={newCafeAdmin.cafeId}
                                        onChange={e => setNewCafeAdmin({ ...newCafeAdmin, cafeId: parseInt(e.target.value) })}
                                        className="w-full bg-black/30 border border-gray-700 rounded-lg p-2 text-white"
                                    >
                                        {cafes.map(cafe => (
                                            <option key={cafe.id} value={cafe.id}>{cafe.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors">
                                    Yönetici Oluştur
                                </button>
                            </form>
                        </div>

                        <div className="bg-[#1a1f2e] border border-gray-800 rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-4">Mevcut Kafeler</h2>
                            <ul className="space-y-2">
                                {cafes.map(cafe => (
                                    <li key={cafe.id} className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-gray-800">
                                        <span className="text-white">{cafe.name}</span>
                                        <span className="text-xs text-gray-500">ID: {cafe.id}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
