import React, { useState, useEffect } from 'react';
import { Users, Trash2, Shield, Search, Coffee, Gamepad2, Save, UserPlus, Coins } from 'lucide-react';
import { Cafe, User } from '../types';
import { api } from '../lib/api';
import { AddUserModal } from './admin/AddUserModal';
import { AddCafeModal } from './admin/AddCafeModal';
import { AssignCafeAdminModal } from './admin/AssignCafeAdminModal';
import {
    AdminCafeEditData,
    AdminCafeFormData,
    AdminGameRow,
    AdminUserFormData,
    AdminUserRow,
} from './admin/types';

interface AdminDashboardProps {
    currentUser: User;
}

const DASHBOARD_TABS: Array<{ id: 'users' | 'games' | 'cafes'; icon: typeof Users; label: string }> = [
    { id: 'users', icon: Users, label: 'Kullanıcılar' },
    { id: 'games', icon: Gamepad2, label: 'Oyunlar' },
    { id: 'cafes', icon: Coffee, label: 'Kafeler' },
];

const EMPTY_USER_FORM: AdminUserFormData = {
    username: '',
    email: '',
    password: '',
    department: '',
    role: 'user',
    cafe_id: ''
};

const EMPTY_CAFE_FORM: AdminCafeFormData = {
    name: '',
    address: '',
    total_tables: 20,
    pin: '1234'
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
    const [users, setUsers] = useState<AdminUserRow[]>([]);
    const [games, setGames] = useState<AdminGameRow[]>([]);
    const [cafes, setCafes] = useState<Cafe[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'games' | 'cafes'>('users');
    const [searchTerm, setSearchTerm] = useState('');
    const [userPointDrafts, setUserPointDrafts] = useState<Record<string, string>>({});
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [isSubmittingUser, setIsSubmittingUser] = useState(false);

    // Cafe Management State
    const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
    const [editCafeData, setEditCafeData] = useState<AdminCafeEditData>({
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
            setUsers(usersData as AdminUserRow[]);
            setGames(gamesData);
            setCafes(cafesData as Cafe[]);
            setUserPointDrafts(
                usersData.reduce((acc: Record<string, string>, user: User) => {
                    acc[String(user.id)] = String(user.points ?? 0);
                    return acc;
                }, {})
            );

            if (cafesData.length > 0 && !selectedCafe) {
                setSelectedCafe(cafesData[0]);
                setEditCafeData({
                    address: cafesData[0].address || '',
                    total_tables: cafesData[0].total_tables || cafesData[0].table_count || 20,
                    pin: cafesData[0].pin || cafesData[0].daily_pin || '1234'
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
        const cafe = cafes.find(c => Number(c.id) === Number(cafeId));
        if (cafe) {
            setSelectedCafe(cafe);
            setEditCafeData({
                address: cafe.address || '',
                total_tables: cafe.total_tables || cafe.table_count || 20,
                pin: cafe.pin || cafe.daily_pin || '1234'
            });
        }
    };

    const [showAddCafeModal, setShowAddCafeModal] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
    const [selectedCafeForAdmin, setSelectedCafeForAdmin] = useState<string>('');
    const [newUserData, setNewUserData] = useState<AdminUserFormData>(EMPTY_USER_FORM);

    const [newCafeData, setNewCafeData] = useState<AdminCafeFormData>(EMPTY_CAFE_FORM);

    // ... (existing loadData and other functions)

    const handleToggleRole = async (user: AdminUserRow) => {
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

    const handlePointDraftChange = (userId: string | number, value: string) => {
        const sanitized = value.replace(/[^\d]/g, '');
        setUserPointDrafts((prev) => ({
            ...prev,
            [String(userId)]: sanitized
        }));
    };

    const handleUpdateUserPoints = async (user: User) => {
        const draftValue = userPointDrafts[String(user.id)] ?? String(user.points ?? 0);
        const numericPoints = Number(draftValue);

        if (!Number.isFinite(numericPoints) || numericPoints < 0) {
            alert('Puan 0 veya daha büyük olmalıdır.');
            return;
        }

        try {
            await api.admin.updateUserPoints(user.id, numericPoints);
            alert(`${user.username} için puan güncellendi.`);
            loadData();
        } catch (error) {
            alert('Puan güncellenemedi.');
        }
    };

    const handleDeleteUser = async (user: User) => {
        if (Number(user.id) === Number(currentUser.id)) {
            alert('Kendi hesabını bu panelden silemezsin.');
            return;
        }

        if (!window.confirm(`${user.username} kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
            return;
        }

        try {
            await api.admin.deleteUser(user.id);
            alert('Kullanıcı silindi.');
            loadData();
        } catch (error) {
            alert('Kullanıcı silinemedi.');
        }
    };

    const handleAddUser = async () => {
        if (!newUserData.username || !newUserData.email || !newUserData.password) {
            alert('Kullanıcı adı, e-posta ve şifre zorunludur.');
            return;
        }
        if (newUserData.role === 'cafe_admin' && !newUserData.cafe_id) {
            alert('Kafe yöneticisi için kafe seçimi zorunludur.');
            return;
        }

        setIsSubmittingUser(true);
        try {
            await api.admin.createUser({
                username: newUserData.username.trim(),
                email: newUserData.email.trim(),
                password: newUserData.password,
                department: newUserData.department.trim(),
                role: newUserData.role,
                cafe_id: newUserData.role === 'cafe_admin' ? Number(newUserData.cafe_id) : null
            });

            alert('Yeni kullanıcı oluşturuldu.');
            setShowAddUserModal(false);
            setNewUserData(EMPTY_USER_FORM);
            loadData();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Kullanıcı oluşturulamadı.';
            alert(message);
        } finally {
            setIsSubmittingUser(false);
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
            setNewCafeData(EMPTY_CAFE_FORM);
            loadData();
        } catch (error) {
            alert('Kafe eklenirken hata oluştu.');
        }
    };

    const filteredUsers = users.filter((user) => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return true;
        return (
            user.username.toLowerCase().includes(term) ||
            user.email.toLowerCase().includes(term)
        );
    });

    return (
        <div className="min-h-screen bg-[var(--rf-bg)] text-[var(--rf-ink)] pt-24 px-4 pb-12 font-sans relative overflow-hidden">
            <div className="absolute inset-0 rf-grid opacity-[0.06] pointer-events-none" />
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8 bg-gradient-to-r from-[#0a1834]/90 to-[#060d20]/85 p-6 rounded-2xl border border-cyan-400/25 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-cyan-500/20 rounded-xl shadow-lg shadow-cyan-500/20 border border-cyan-300/35">
                            <Shield size={32} className="text-cyan-200" />
                        </div>
                        <div>
                            <h1 className="font-pixel text-3xl text-white tracking-wide">YÖNETİM PANELİ</h1>
                            <p className="text-cyan-200/80 font-mono text-sm">SİSTEM YÖNETİCİSİ: {currentUser.username}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {DASHBOARD_TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${activeTab === tab.id
                                    ? 'bg-cyan-500 text-[#041226] shadow-lg shadow-cyan-500/30 scale-105'
                                    : 'bg-[#0a1630]/70 text-gray-400 hover:bg-[#102447] hover:text-white'
                                    }`}
                            >
                                <tab.icon size={18} />
                                <span className="font-bold">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="bg-[linear-gradient(170deg,rgba(8,14,30,0.94),rgba(10,24,52,0.88))] backdrop-blur-xl border border-cyan-400/20 rounded-2xl overflow-hidden shadow-2xl min-h-[600px]">

                    {/* USERS TAB */}
                    {activeTab === 'users' && (
                        <div className="p-6">
                            <div className="flex justify-between mb-6">
                                <h2 className="text-2xl text-white font-bold flex items-center gap-2">
                                    <Users className="text-blue-400" /> Kullanıcı Listesi
                                </h2>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Kullanıcı adı / e-posta ara..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="bg-black/40 border border-gray-600 rounded-full py-2 pl-10 pr-6 text-white outline-none focus:border-blue-500 w-72 transition-all"
                                        />
                                    </div>
                                    <button
                                        onClick={() => setShowAddUserModal(true)}
                                        className="bg-cyan-500 hover:bg-cyan-400 text-[#041226] font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <UserPlus size={16} />
                                        Yeni Kullanıcı
                                    </button>
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
                                        {filteredUsers.map(user => (
                                            <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                                <td className="p-4 font-bold text-white">{user.username}</td>
                                                <td className="p-4 text-sm">{user.email}</td>
                                                <td className="p-4 text-sm">{user.department || '-'}</td>
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="font-mono text-yellow-400">{user.points}</div>
                                                        {!user.isAdmin && (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    value={userPointDrafts[String(user.id)] ?? String(user.points ?? 0)}
                                                                    onChange={(e) => handlePointDraftChange(user.id, e.target.value)}
                                                                    className="w-20 bg-black/45 border border-gray-600 rounded px-2 py-1 text-center text-sm text-white outline-none focus:border-cyan-400"
                                                                    aria-label={`${user.username} puan`}
                                                                />
                                                                <button
                                                                    onClick={() => handleUpdateUserPoints(user)}
                                                                    className="text-xs bg-yellow-900/30 text-yellow-300 px-2 py-1 rounded hover:bg-yellow-900/50 flex items-center gap-1"
                                                                >
                                                                    <Coins size={12} />
                                                                    Kaydet
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
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
                                                    <div className="flex items-center justify-end gap-2">
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
                                                        {!user.isAdmin && (
                                                            <button
                                                                onClick={() => handleDeleteUser(user)}
                                                                className="text-xs font-bold px-3 py-1 rounded bg-red-900/30 text-red-300 hover:bg-red-900/50 flex items-center gap-1"
                                                            >
                                                                <Trash2 size={12} />
                                                                KULLANICIYI SİL
                                                            </button>
                                                        )}
                                                    </div>
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
                                {games.map((game) => (
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
                                        value={selectedCafe ? String(selectedCafe.id) : ''}
                                    >
                                        {cafes.map(c => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)}
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

            <AddUserModal
                isOpen={showAddUserModal}
                cafes={cafes}
                isSubmitting={isSubmittingUser}
                formData={newUserData}
                onFormChange={setNewUserData}
                onClose={() => {
                    setShowAddUserModal(false);
                    setNewUserData(EMPTY_USER_FORM);
                }}
                onSubmit={handleAddUser}
            />

            <AddCafeModal
                isOpen={showAddCafeModal}
                formData={newCafeData}
                onFormChange={setNewCafeData}
                onClose={() => {
                    setShowAddCafeModal(false);
                    setNewCafeData(EMPTY_CAFE_FORM);
                }}
                onSubmit={handleAddCafe}
            />

            <AssignCafeAdminModal
                isOpen={showRoleModal}
                cafes={cafes}
                selectedUser={selectedUser}
                selectedCafeId={selectedCafeForAdmin}
                onCafeChange={setSelectedCafeForAdmin}
                onClose={() => {
                    setShowRoleModal(false);
                    setSelectedUser(null);
                }}
                onConfirm={handleConfirmCafeAdmin}
            />
        </div>
    );
};
