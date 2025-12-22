import React, { useState, useEffect } from 'react';
import { Users, Trash2, Shield, Search, Coffee, Gamepad2, Save } from 'lucide-react';
import { User, GameRequest } from '../types';
import { api } from '../lib/api';

interface AdminDashboardProps {
    currentUser: User;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [games, setGames] = useState<any[]>([]);
    const [cafes, setCafes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'games' | 'cafes'>('users');
    const [searchTerm, setSearchTerm] = useState('');

    // Cafe Management State
    const [selectedCafe, setSelectedCafe] = useState<any>(null);
    const [editCafeData, setEditCafeData] = useState({
        address: '',
        total_tables: 20,
        pin: '1234'
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, gamesData, cafesData] = await Promise.all([
                api.admin.getUsers(),
                api.admin.getGames(),
                api.cafes.list()
            ]);
            setUsers(usersData);
            setGames(gamesData);
            setCafes(cafesData);

            if (cafesData.length > 0 && !selectedCafe) {
                setSelectedCafe(cafesData[0]);
                setEditCafeData({
                    address: cafesData[0].address || '',
                    total_tables: cafesData[0].total_tables || 20,
                    pin: cafesData[0].pin || '1234'
                });
            }
        } catch (error) {
            console.error("Data load error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCafeUpdate = async () => {
        if (!selectedCafe) return;
        try {
            await api.admin.updateCafe(selectedCafe.id, editCafeData);
            alert('Kafe bilgileri güncellendi!');
            loadData();
        } catch (error) {
            alert('Güncelleme başarısız.');
        }
    };

    const handleCafeSelect = (cafeId: string) => {
        const cafe = cafes.find(c => c.id === parseInt(cafeId));
        if (cafe) {
            setSelectedCafe(cafe);
            setEditCafeData({
                address: cafe.address || '',
                total_tables: cafe.total_tables || 20,
                pin: cafe.pin || '1234'
            });
        }
    };

    const [showAddCafeModal, setShowAddCafeModal] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [selectedCafeForAdmin, setSelectedCafeForAdmin] = useState<string>('');

    const [newCafeData, setNewCafeData] = useState({
        name: '',
        address: '',
        total_tables: 20,
        pin: '1234'
    });

    // ... (existing loadData and other functions)

    const handleToggleRole = async (user: any) => {
        const currentRole = user.role;

        if (currentRole === 'cafe_admin') {
            // Demote from cafe_admin to user
            if (window.confirm(`${user.username} kullanıcısının kafe yöneticiliğini kaldırmak istediğinize emin misiniz?`)) {
                try {
                    await api.admin.updateUserRole(user.id, 'user', null);
                    alert('Kullanıcı rolü güncellendi!');
                    loadData();
                } catch (error) {
                    alert('Rol güncelleme başarısız.');
                }
            }
        } else {
            // Promote to cafe_admin - show modal to select cafe
            setSelectedUser(user);
            setSelectedCafeForAdmin(cafes.length > 0 ? cafes[0].id.toString() : '');
            setShowRoleModal(true);
        }
    };

    const handleConfirmCafeAdmin = async () => {
        if (!selectedUser || !selectedCafeForAdmin) {
            alert('Lütfen bir kafe seçin.');
            return;
        }

        try {
            await api.admin.updateUserRole(selectedUser.id, 'cafe_admin', parseInt(selectedCafeForAdmin));
            alert(`${selectedUser.username} artık seçilen kafenin yöneticisi!`);
            setShowRoleModal(false);
            setSelectedUser(null);
            setSelectedCafeForAdmin('');
            loadData();
        } catch (error) {
            alert('Rol güncelleme başarısız.');
        }
    };

    const handleDeleteGame = async (gameId: number) => {
        if (window.confirm('Bu oyunu silmek istediğinize emin misiniz? (Geri alınamaz)')) {
            try {
                await api.games.delete(gameId);
                alert('Oyun silindi!');
                loadData();
            } catch (error) {
                alert('Oyun silinemedi.');
            }
        }
    };

    const handleAddCafe = async () => {
        if (!newCafeData.name) {
            alert('Lütfen kafe adı girin.');
            return;
        }
        try {
            await api.admin.createCafe(newCafeData);
            alert('Yeni kafe eklendi!');
            setShowAddCafeModal(false);
            setNewCafeData({ name: '', address: '', total_tables: 20, pin: '1234' });
            loadData();
        } catch (error) {
            alert('Kafe eklenirken hata oluştu.');
        }
    };

    return (
        <div className="min-h-screen bg-[#0f141a] pt-24 px-4 pb-12 font-sans">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8 bg-gradient-to-r from-red-900/40 to-black p-6 rounded-2xl border border-red-900/30 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-600 rounded-xl shadow-lg shadow-red-600/20">
                            <Shield size={32} className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-pixel text-3xl text-white tracking-wide">YÖNETİM PANELİ</h1>
                            <p className="text-red-300/80 font-mono text-sm">SİSTEM YÖNETİCİSİ: {currentUser.username}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {[
                            { id: 'users', icon: Users, label: 'Kullanıcılar' },
                            { id: 'games', icon: Gamepad2, label: 'Oyunlar' },
                            { id: 'cafes', icon: Coffee, label: 'Kafeler' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105'
                                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'
                                    }`}
                            >
                                <tab.icon size={18} />
                                <span className="font-bold">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="bg-[#1a1f2e]/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl min-h-[600px]">

                    {/* USERS TAB */}
                    {activeTab === 'users' && (
                        <div className="p-6">
                            <div className="flex justify-between mb-6">
                                <h2 className="text-2xl text-white font-bold flex items-center gap-2">
                                    <Users className="text-blue-400" /> Kullanıcı Listesi
                                </h2>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Ara..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="bg-black/40 border border-gray-600 rounded-full py-2 pl-10 pr-6 text-white outline-none focus:border-blue-500 w-64 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-gray-700/50">
                                <table className="w-full text-left text-gray-300">
                                    <thead className="bg-black/40 text-gray-400 uppercase text-xs font-bold tracking-wider">
                                        <tr>
                                            <th className="p-4">Kullanıcı</th>
                                            <th className="p-4">Email</th>
                                            <th className="p-4">Bölüm</th>
                                            <th className="p-4 text-center">Puan</th>
                                            <th className="p-4 text-center">Rol</th>
                                            <th className="p-4 text-center">Mevcut Kafe</th>
                                            <th className="p-4 text-right">İşlemler</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700/50">
                                        {users.filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase())).map(user => (
                                            <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                                <td className="p-4 font-bold text-white">{user.username}</td>
                                                <td className="p-4 text-sm">{user.email}</td>
                                                <td className="p-4 text-sm">{user.department || '-'}</td>
                                                <td className="p-4 text-center font-mono text-yellow-500">{user.points}</td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs border ${user.isAdmin ? 'bg-red-900/30 border-red-800 text-red-300' :
                                                        user.role === 'cafe_admin' ? 'bg-orange-900/30 border-orange-800 text-orange-300' :
                                                            'bg-blue-900/30 border-blue-800 text-blue-300'
                                                        }`}>
                                                        {user.isAdmin ? 'ADMIN' : user.role === 'cafe_admin' ? 'CAFE ADMIN' : 'USER'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center text-sm text-gray-500">
                                                    {user.cafe_name || '-'}
                                                </td>
                                                <td className="p-4 text-right">
                                                    {!user.isAdmin && (
                                                        <button
                                                            onClick={() => handleToggleRole(user)}
                                                            className={`text-xs font-bold px-3 py-1 rounded transition-colors ${user.role === 'cafe_admin'
                                                                ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                                                                : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                                                                }`}
                                                        >
                                                            {user.role === 'cafe_admin' ? 'YÖNETİCİLİĞİ AL' : 'YÖNETİCİ YAP'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* GAMES TAB */}
                    {activeTab === 'games' && (
                        <div className="p-6">
                            <h2 className="text-2xl text-white font-bold mb-6 flex items-center gap-2">
                                <Gamepad2 className="text-purple-400" /> Oyun Geçmişi
                            </h2>
                            <div className="grid gap-4">
                                {games.map((game: any) => (
                                    <div key={game.id} className="bg-black/20 border border-gray-700 rounded-xl p-4 flex items-center justify-between hover:bg-black/40 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${game.game_type === 'tictactoe' ? 'bg-blue-900/20 text-blue-400' : 'bg-green-900/20 text-green-400'
                                                }`}>
                                                {game.game_type === 'tictactoe' ? '❌' : '🧠'}
                                            </div>
                                            <div>
                                                <h3 className="text-white font-bold">{game.host_name} vs {game.guest_name || 'Bekleniyor'}</h3>
                                                <p className="text-gray-400 text-xs">{new Date(game.created_at).toLocaleString()} • {game.cafe_name || 'Bilinmiyor'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${game.status === 'finished' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
                                                }`}>
                                                {game.status === 'finished' ? 'TAMAMLANDI' : 'DEVAM EDİYOR'}
                                            </span>
                                            <p className="text-gray-500 text-xs mt-1">Masa: {game.table_code}</p>
                                            <button
                                                onClick={() => handleDeleteGame(game.id)}
                                                className="mt-2 text-xs bg-red-900/30 text-red-400 px-2 py-1 rounded hover:bg-red-900/50 flex items-center gap-1 ml-auto"
                                            >
                                                <Trash2 size={12} /> SİL
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CAFES TAB (SIMPLIFIED) */}
                    {activeTab === 'cafes' && (
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl text-white font-bold flex items-center gap-2">
                                    <Coffee className="text-orange-400" /> Kafe Yönetimi
                                </h2>
                                <button
                                    onClick={() => setShowAddCafeModal(true)}
                                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <span>+</span> Yeni Kafe Ekle
                                </button>
                            </div>

                            <div className="grid gap-6">
                                {/* Cafe Selector */}
                                <div className="bg-black/20 border border-gray-700 rounded-xl p-6">
                                    <label className="block text-gray-400 text-sm mb-2">Düzenlenecek Kafe Seçin</label>
                                    <select
                                        className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                                        onChange={(e) => handleCafeSelect(e.target.value)}
                                        value={selectedCafe?.id || ''}
                                    >
                                        {cafes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>

                                {/* Edit Form */}
                                {selectedCafe && (
                                    <div className="bg-black/20 border border-gray-700 rounded-xl p-6 space-y-4">
                                        <h3 className="text-white font-bold text-lg mb-4">Kafe Bilgilerini Düzenle</h3>

                                        <div>
                                            <label className="block text-gray-400 text-sm mb-2">Kafe Adı</label>
                                            <input
                                                type="text"
                                                value={selectedCafe.name}
                                                disabled
                                                className="w-full bg-black/60 border border-gray-600 rounded-lg p-3 text-gray-500 cursor-not-allowed"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Kafe adı değiştirilemez</p>
                                        </div>

                                        <div>
                                            <label className="block text-gray-400 text-sm mb-2">Adres</label>
                                            <input
                                                type="text"
                                                value={editCafeData.address}
                                                onChange={e => setEditCafeData({ ...editCafeData, address: e.target.value })}
                                                className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                                                placeholder="Örn: Mühendislik Fakültesi, Kampüs"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-gray-400 text-sm mb-2">Toplam Masa Sayısı</label>
                                            <input
                                                type="number"
                                                value={editCafeData.total_tables}
                                                onChange={e => setEditCafeData({ ...editCafeData, total_tables: parseInt(e.target.value) })}
                                                className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                                                min="1"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-gray-400 text-sm mb-2">PIN Kodu (4 Haneli)</label>
                                            <input
                                                type="text"
                                                value={editCafeData.pin}
                                                onChange={e => setEditCafeData({ ...editCafeData, pin: e.target.value.slice(0, 4) })}
                                                className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500 font-mono text-lg"
                                                placeholder="1234"
                                                maxLength={4}
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Kullanıcılar bu PIN ile kafeye giriş yapacak</p>
                                        </div>

                                        <button
                                            onClick={handleCafeUpdate}
                                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                                        >
                                            <Save size={18} /> DEĞİŞİKLİKLERİ KAYDET
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Add Cafe Modal */}
            {showAddCafeModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1a1f2e] border border-gray-700 rounded-2xl p-8 max-w-md w-full relative">
                        <h2 className="text-2xl font-bold text-white mb-6">Yeni Kafe Ekle</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Kafe Adı *</label>
                                <input
                                    type="text"
                                    value={newCafeData.name}
                                    onChange={e => setNewCafeData({ ...newCafeData, name: e.target.value })}
                                    className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                                    placeholder="Örn: Kampüs Kafeterya"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Adres</label>
                                <input
                                    type="text"
                                    value={newCafeData.address}
                                    onChange={e => setNewCafeData({ ...newCafeData, address: e.target.value })}
                                    className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                                    placeholder="Örn: İİBF, Merkez Kampüs"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Toplam Masa Sayısı *</label>
                                <input
                                    type="number"
                                    value={newCafeData.total_tables}
                                    onChange={e => setNewCafeData({ ...newCafeData, total_tables: parseInt(e.target.value) })}
                                    className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                                    min="1"
                                />
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-2">PIN Kodu (4 Haneli) *</label>
                                <input
                                    type="text"
                                    value={newCafeData.pin}
                                    onChange={e => setNewCafeData({ ...newCafeData, pin: e.target.value.slice(0, 4) })}
                                    className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500 font-mono text-lg"
                                    placeholder="1234"
                                    maxLength={4}
                                />
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setShowAddCafeModal(false)}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleAddCafe}
                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors"
                                >
                                    Ekle
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Cafe Admin Assignment Modal */}
            {showRoleModal && selectedUser && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1a1f2e] border border-gray-700 rounded-2xl p-8 max-w-md w-full relative">
                        <h2 className="text-2xl font-bold text-white mb-2">Kafe Yöneticisi Ata</h2>
                        <p className="text-gray-400 mb-6">
                            <span className="text-white font-bold">{selectedUser.username}</span> kullanıcısını hangi kafenin yöneticisi yapmak istiyorsunuz?
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Kafe Seç *</label>
                                <select
                                    value={selectedCafeForAdmin}
                                    onChange={e => setSelectedCafeForAdmin(e.target.value)}
                                    className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                                >
                                    {cafes.map(cafe => (
                                        <option key={cafe.id} value={cafe.id}>{cafe.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Seçilen kafenin yönetim yetkisi verilecek</p>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => {
                                        setShowRoleModal(false);
                                        setSelectedUser(null);
                                    }}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleConfirmCafeAdmin}
                                    className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-colors"
                                >
                                    Yönetici Yap
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
