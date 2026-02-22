import React, { useState, useEffect } from 'react';
import { Users, Trash2, Shield, Search, Coffee, Gamepad2, Save, UserPlus, Coins } from 'lucide-react';
import { Cafe, DeleteCafeResult, User } from '../types';
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
    latitude: '',
    longitude: '',
    radius: 150,
    secondaryLatitude: '',
    secondaryLongitude: '',
    secondaryRadius: 150,
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
        latitude: '',
        longitude: '',
        radius: 150,
        secondaryLatitude: '',
        secondaryLongitude: '',
        secondaryRadius: 150,
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

            if (cafesData.length === 0) {
                setSelectedCafe(null);
                setEditCafeData({
                    address: '',
                    total_tables: 20,
                    latitude: '',
                    longitude: '',
                    radius: 150,
                    secondaryLatitude: '',
                    secondaryLongitude: '',
                    secondaryRadius: 150,
                });
            } else {
                const selectedCafeId = selectedCafe ? Number(selectedCafe.id) : null;
                const resolvedCafe = selectedCafeId
                    ? cafesData.find((cafe) => Number(cafe.id) === selectedCafeId) || cafesData[0]
                    : cafesData[0];

                setSelectedCafe(resolvedCafe);
                setEditCafeData({
                    address: resolvedCafe.address || '',
                    total_tables: resolvedCafe.total_tables || resolvedCafe.table_count || 20,
                    latitude: resolvedCafe.latitude != null ? String(resolvedCafe.latitude) : '',
                    longitude: resolvedCafe.longitude != null ? String(resolvedCafe.longitude) : '',
                    radius: Number(resolvedCafe.radius || 150),
                    secondaryLatitude: resolvedCafe.secondary_latitude != null ? String(resolvedCafe.secondary_latitude) : '',
                    secondaryLongitude: resolvedCafe.secondary_longitude != null ? String(resolvedCafe.secondary_longitude) : '',
                    secondaryRadius: Number(resolvedCafe.secondary_radius || resolvedCafe.radius || 150),
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

        const latitude = Number(editCafeData.latitude);
        const longitude = Number(editCafeData.longitude);
        const radius = Number(editCafeData.radius);
        const hasSecondaryInput =
            Boolean(String(editCafeData.secondaryLatitude).trim())
            || Boolean(String(editCafeData.secondaryLongitude).trim());
        const secondaryLatitude = Number(editCafeData.secondaryLatitude);
        const secondaryLongitude = Number(editCafeData.secondaryLongitude);
        const secondaryRadius = Number(editCafeData.secondaryRadius);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            alert('Kafe konumu için geçerli enlem ve boylam girin.');
            return;
        }
        if (!Number.isFinite(radius) || radius < 10 || radius > 5000) {
            alert('Yarıçap 10-5000 metre arasında olmalıdır.');
            return;
        }
        if (hasSecondaryInput) {
            if (!Number.isFinite(secondaryLatitude) || !Number.isFinite(secondaryLongitude)) {
                alert('İkinci konum için enlem ve boylam birlikte girilmelidir.');
                return;
            }
            if (
                !Number.isFinite(secondaryRadius)
                || secondaryRadius < 10
                || secondaryRadius > 5000
            ) {
                alert('İkinci konum yarıçapı 10-5000 metre arasında olmalıdır.');
                return;
            }
        }

        try {
            await api.admin.updateCafe(selectedCafe.id, {
                address: editCafeData.address,
                total_tables: editCafeData.total_tables,
                latitude,
                longitude,
                radius,
                secondary_latitude: hasSecondaryInput ? secondaryLatitude : null,
                secondary_longitude: hasSecondaryInput ? secondaryLongitude : null,
                secondary_radius: hasSecondaryInput ? secondaryRadius : null,
            });
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
                latitude: cafe.latitude != null ? String(cafe.latitude) : '',
                longitude: cafe.longitude != null ? String(cafe.longitude) : '',
                radius: Number(cafe.radius || 150),
                secondaryLatitude: cafe.secondary_latitude != null ? String(cafe.secondary_latitude) : '',
                secondaryLongitude: cafe.secondary_longitude != null ? String(cafe.secondary_longitude) : '',
                secondaryRadius: Number(cafe.secondary_radius || cafe.radius || 150),
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
        const latitude = Number(newCafeData.latitude);
        const longitude = Number(newCafeData.longitude);
        const radius = Number(newCafeData.radius);
        const hasSecondaryInput =
            Boolean(String(newCafeData.secondaryLatitude).trim())
            || Boolean(String(newCafeData.secondaryLongitude).trim());
        const secondaryLatitude = Number(newCafeData.secondaryLatitude);
        const secondaryLongitude = Number(newCafeData.secondaryLongitude);
        const secondaryRadius = Number(newCafeData.secondaryRadius);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            alert('Yeni kafe için geçerli enlem ve boylam zorunludur.');
            return;
        }
        if (!Number.isFinite(radius) || radius < 10 || radius > 5000) {
            alert('Yarıçap 10-5000 metre arasında olmalıdır.');
            return;
        }
        if (hasSecondaryInput) {
            if (!Number.isFinite(secondaryLatitude) || !Number.isFinite(secondaryLongitude)) {
                alert('İkinci konum için enlem ve boylam birlikte girilmelidir.');
                return;
            }
            if (
                !Number.isFinite(secondaryRadius)
                || secondaryRadius < 10
                || secondaryRadius > 5000
            ) {
                alert('İkinci konum yarıçapı 10-5000 metre arasında olmalıdır.');
                return;
            }
        }
        try {
            await api.admin.createCafe({
                ...newCafeData,
                latitude,
                longitude,
                radius,
                secondary_latitude: hasSecondaryInput ? secondaryLatitude : null,
                secondary_longitude: hasSecondaryInput ? secondaryLongitude : null,
                secondary_radius: hasSecondaryInput ? secondaryRadius : null,
            });
            alert('Yeni kafe eklendi!');
            setShowAddCafeModal(false);
            setNewCafeData(EMPTY_CAFE_FORM);
            loadData();
        } catch (error) {
            alert('Kafe eklenirken hata oluştu.');
        }
    };

    const handleDeleteCafe = async () => {
        if (!selectedCafe) {
            alert('Silinecek bir kafe seçin.');
            return;
        }

        if (cafes.length <= 1) {
            alert('Sistemde en az bir kafe kalmalıdır.');
            return;
        }

        const confirmationMessage = `${selectedCafe.name} kafesini silmek istediğinize emin misiniz?\n\nBu işlem bağlı kullanıcıları kafeden ayırır, kafe yöneticilerini user rolüne düşürür, bağlı ödülleri siler ve açık oyunları kapatır.`;
        if (!window.confirm(confirmationMessage)) {
            return;
        }

        try {
            const result: DeleteCafeResult = await api.admin.deleteCafe(selectedCafe.id);
            const cleanup = result?.cleanup || {
                detachedUsers: 0,
                cafeAdminsDemoted: 0,
                rewardsDeleted: 0,
                gamesForceClosed: 0,
            };

            alert(
                `${selectedCafe.name} silindi.\n` +
                `${cleanup.detachedUsers} kullanıcı kafeden ayrıldı.\n` +
                `${cleanup.cafeAdminsDemoted} kafe yöneticisi user rolüne alındı.\n` +
                `${cleanup.rewardsDeleted} ödül silindi.\n` +
                `${cleanup.gamesForceClosed} açık oyun kapatıldı.`
            );

            await loadData();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Kafe silinemedi.';
            alert(message);
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
        <div className="min-h-screen rf-page-shell text-[var(--rf-ink)] pt-24 px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] font-sans relative overflow-hidden noise-bg">
            <div className="absolute inset-0 rf-grid opacity-[0.06] pointer-events-none" />
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-8 p-6 rf-screen-card">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-black border-2 border-cyan-400/60 flex items-center justify-center shadow-[4px_4px_0_rgba(255,0,234,0.3)]">
                            <Shield size={32} className="text-cyan-200" />
                        </div>
                        <div>
                            <span className="rf-terminal-strip">Terminal TR-X</span>
                            <h1 className="font-display text-5xl text-white tracking-[0.08em] mt-1 glitch-text" data-text="YÖNETİM PANELİ">
                                YÖNETİM PANELİ
                            </h1>
                            <p className="text-cyan-200/80 font-mono text-sm uppercase tracking-[0.14em] mt-1">
                                SİSTEM YÖNETİCİSİ: {currentUser.username}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {DASHBOARD_TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 md:px-6 py-3 transition-all duration-300 rf-control border-2 uppercase tracking-[0.1em] font-semibold ${activeTab === tab.id
                                    ? 'bg-cyan-400 text-[#041226] border-cyan-300 shadow-[4px_4px_0_rgba(255,0,234,0.35)]'
                                    : 'bg-black/30 text-cyan-200/70 border-cyan-500/30 hover:bg-cyan-950/35 hover:text-cyan-100 hover:border-cyan-300/60'
                                    }`}
                            >
                                <tab.icon size={18} />
                                <span className="font-bold">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="rf-screen-card min-h-[600px] overflow-hidden">

                    {/* USERS TAB */}
                    {activeTab === 'users' && (
                        <div className="p-6">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
                                <h2 className="text-2xl text-white font-bold flex items-center gap-2">
                                    <Users className="text-blue-400" /> Kullanıcı Listesi
                                </h2>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/80" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Kullanıcı adı / e-posta ara..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="py-2.5 pl-10 pr-6 text-white outline-none w-72 transition-all"
                                        />
                                    </div>
                                    <button
                                        onClick={() => setShowAddUserModal(true)}
                                        className="bg-cyan-500 hover:bg-cyan-400 text-[#041226] font-bold px-4 py-2 border-2 border-cyan-200 shadow-[4px_4px_0_rgba(255,0,234,0.3)] transition-colors flex items-center gap-2"
                                    >
                                        <UserPlus size={16} />
                                        Yeni Kullanıcı
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="rf-admin-table text-left">
                                    <thead>
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
                                    <tbody>
                                        {filteredUsers.map(user => (
                                            <tr key={user.id}>
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
                                                                    className="rf-input w-20 px-2 py-1 text-center text-sm text-white outline-none"
                                                                    aria-label={`${user.username} puan`}
                                                                />
                                                                <button
                                                                    onClick={() => handleUpdateUserPoints(user)}
                                                                    className="text-xs bg-yellow-900/30 text-yellow-300 px-2 py-1 border border-yellow-700/50 hover:bg-yellow-900/50 flex items-center gap-1"
                                                                >
                                                                    <Coins size={12} />
                                                                    Kaydet
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 text-xs border ${user.isAdmin ? 'bg-red-900/30 border-red-800 text-red-300' :
                                                        user.role === 'cafe_admin' ? 'bg-orange-900/30 border-orange-800 text-orange-300' :
                                                            'bg-blue-900/30 border-blue-800 text-blue-300'
                                                        }`}>
                                                        {user.isAdmin ? 'ADMIN' : user.role === 'cafe_admin' ? 'CAFE ADMIN' : 'USER'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center text-sm text-[var(--rf-muted)]">
                                                    {user.cafe_name || '-'}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {!user.isAdmin && (
                                                            <button
                                                                onClick={() => handleToggleRole(user)}
                                                                className={`text-xs font-bold px-3 py-1 border transition-colors ${user.role === 'cafe_admin'
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
                                                                className="text-xs font-bold px-3 py-1 border border-red-700/40 bg-red-900/30 text-red-300 hover:bg-red-900/50 flex items-center gap-1"
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
                                    <div key={game.id} className="rf-screen-card-muted p-4 flex items-center justify-between transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 border-2 flex items-center justify-center text-2xl ${game.game_type === 'tictactoe' ? 'bg-blue-900/20 border-blue-500/40 text-blue-400' : 'bg-green-900/20 border-green-500/40 text-green-400'
                                                }`}>
                                                {game.game_type === 'tictactoe' ? '❌' : '🧠'}
                                            </div>
                                            <div>
                                                <h3 className="text-white font-bold">{game.host_name} vs {game.guest_name || 'Bekleniyor'}</h3>
                                                <p className="text-[var(--rf-muted)] text-xs">{new Date(game.created_at).toLocaleString()} • {game.cafe_name || 'Bilinmiyor'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-3 py-1 text-xs font-bold border ${game.status === 'finished' ? 'bg-green-900/30 border-green-700/40 text-green-400' : 'bg-yellow-900/30 border-yellow-700/40 text-yellow-400'
                                                }`}>
                                                {game.status === 'finished' ? 'TAMAMLANDI' : 'DEVAM EDİYOR'}
                                            </span>
                                            <p className="text-[var(--rf-muted)] text-xs mt-1">Masa: {game.table_code}</p>
                                            <button
                                                onClick={() => handleDeleteGame(game.id)}
                                                className="mt-2 text-xs bg-red-900/30 border border-red-700/40 text-red-400 px-2 py-1 hover:bg-red-900/50 flex items-center gap-1 ml-auto"
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
                                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 border-2 border-green-300/40 shadow-[4px_4px_0_rgba(0,243,255,0.2)] transition-colors flex items-center gap-2"
                                >
                                    <span>+</span> Yeni Kafe Ekle
                                </button>
                            </div>

                            <div className="grid gap-6">
                                {/* Cafe Selector */}
                                <div className="rf-screen-card-muted p-6">
                                    <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Düzenlenecek Kafe Seçin</label>
                                    <select
                                        className="rf-input w-full p-3 text-white outline-none"
                                        onChange={(e) => handleCafeSelect(e.target.value)}
                                        value={selectedCafe ? String(selectedCafe.id) : ''}
                                    >
                                        {cafes.map(c => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)}
                                    </select>
                                </div>

                                {/* Edit Form */}
                                {selectedCafe && (
                                    <div className="rf-screen-card-muted p-6 space-y-4">
                                        <h3 className="text-white font-bold text-lg mb-4">Kafe Bilgilerini Düzenle</h3>

                                        <div>
                                            <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Kafe Adı</label>
                                            <input
                                                type="text"
                                                value={selectedCafe.name}
                                                disabled
                                                className="rf-input w-full bg-black/55 border border-cyan-900/45 p-3 text-[var(--rf-muted)] cursor-not-allowed"
                                            />
                                            <p className="text-xs text-[var(--rf-muted)] mt-1">Kafe adı değiştirilemez</p>
                                        </div>

                                        <div>
                                            <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Adres</label>
                                            <input
                                                type="text"
                                                value={editCafeData.address}
                                                onChange={e => setEditCafeData({ ...editCafeData, address: e.target.value })}
                                                className="rf-input w-full p-3 text-white outline-none"
                                                placeholder="Örn: Mühendislik Fakültesi, Kampüs"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Toplam Masa Sayısı</label>
                                            <input
                                                type="number"
                                                value={editCafeData.total_tables}
                                                onChange={e => setEditCafeData({ ...editCafeData, total_tables: parseInt(e.target.value) })}
                                                className="rf-input w-full p-3 text-white outline-none"
                                                min="1"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Enlem (Latitude)</label>
                                            <input
                                                type="number"
                                                step="0.000001"
                                                value={editCafeData.latitude}
                                                onChange={e => setEditCafeData({ ...editCafeData, latitude: e.target.value })}
                                                className="rf-input w-full p-3 text-white outline-none font-mono"
                                                placeholder="37.741000"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Boylam (Longitude)</label>
                                            <input
                                                type="number"
                                                step="0.000001"
                                                value={editCafeData.longitude}
                                                onChange={e => setEditCafeData({ ...editCafeData, longitude: e.target.value })}
                                                className="rf-input w-full p-3 text-white outline-none font-mono"
                                                placeholder="29.101000"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Doğrulama Yarıçapı (metre)</label>
                                            <input
                                                type="number"
                                                min="10"
                                                max="5000"
                                                value={editCafeData.radius}
                                                onChange={e => setEditCafeData({ ...editCafeData, radius: parseInt(e.target.value || '0', 10) })}
                                                className="rf-input w-full p-3 text-white outline-none"
                                                placeholder="150"
                                            />
                                            <p className="text-xs text-[var(--rf-muted)] mt-1">Kullanıcılar yalnızca bu konum yarıçapı içindeyken check-in yapabilir.</p>
                                        </div>

                                        <div className="pt-4 border-t border-cyan-500/20 space-y-4">
                                            <p className="text-sm text-cyan-300 font-semibold">İkinci Konum (Opsiyonel)</p>
                                            <div>
                                                <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Ek Enlem</label>
                                                <input
                                                    type="number"
                                                    step="0.000001"
                                                    value={editCafeData.secondaryLatitude}
                                                    onChange={e => setEditCafeData({ ...editCafeData, secondaryLatitude: e.target.value })}
                                                    className="rf-input w-full p-3 text-white outline-none font-mono"
                                                    placeholder="37.742000"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Ek Boylam</label>
                                                <input
                                                    type="number"
                                                    step="0.000001"
                                                    value={editCafeData.secondaryLongitude}
                                                    onChange={e => setEditCafeData({ ...editCafeData, secondaryLongitude: e.target.value })}
                                                    className="rf-input w-full p-3 text-white outline-none font-mono"
                                                    placeholder="29.102000"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Ek Konum Yarıçapı (metre)</label>
                                                <input
                                                    type="number"
                                                    min="10"
                                                    max="5000"
                                                    value={editCafeData.secondaryRadius}
                                                    onChange={e => setEditCafeData({ ...editCafeData, secondaryRadius: parseInt(e.target.value || '0', 10) })}
                                                    className="rf-input w-full p-3 text-white outline-none"
                                                    placeholder="150"
                                                />
                                            </div>
                                            <p className="text-xs text-[var(--rf-muted)]">
                                                Masaüstü/mobil sapmaları için ikinci bir doğrulama alanı tanımlayabilirsiniz.
                                            </p>
                                        </div>

                                        <button
                                            onClick={handleCafeUpdate}
                                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 border-2 border-blue-300/40 flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                                        >
                                            <Save size={18} /> DEĞİŞİKLİKLERİ KAYDET
                                        </button>
                                        <button
                                            onClick={handleDeleteCafe}
                                            disabled={cafes.length <= 1}
                                            data-testid="delete-cafe-button"
                                            className={`w-full font-bold py-3 border-2 flex items-center justify-center gap-2 transition-all ${cafes.length <= 1
                                                ? 'bg-red-950/40 text-red-300/60 border border-red-700/40 cursor-not-allowed'
                                                : 'bg-red-700 hover:bg-red-600 text-white shadow-lg shadow-red-700/20'
                                                }`}
                                        >
                                            <Trash2 size={18} /> KAFEYİ SİL
                                        </button>
                                        {cafes.length <= 1 && (
                                            <p className="text-xs text-red-300/80">
                                                Güvenlik kuralı: Son kafe silinemez.
                                            </p>
                                        )}
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
