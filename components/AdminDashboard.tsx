/**
 * AdminDashboard — Café Concierge edition
 *
 * Presentational rewrite of the previous cyber-retro admin panel. Handler
 * signatures, state shape, and API calls are unchanged so existing tests stay
 * green. Only the visual layer + native <select> replacements differ.
 */
import React, { useEffect, useState } from 'react';
import {
  Users,
  Coffee,
  Gamepad2,
  Search,
  UserPlus,
  Plus,
  Trash2,
  Save,
  Coins,
  ShieldCheck,
} from 'lucide-react';
import { Cafe, DeleteCafeResult, User } from '../types';
import { api } from '../lib/api';
import { AddUserModal } from './admin/AddUserModal';
import { AddCafeModal } from './admin/AddCafeModal';
import { AssignCafeAdminModal } from './admin/AssignCafeAdminModal';
import { MapLocationPicker } from './shared/MapLocationPicker';
import { Button } from './admin/ui/Button';
import { Input } from './admin/ui/Input';
import { Card } from './admin/ui/Card';
import { Badge } from './admin/ui/Badge';
import { Table, THead, TH, TBody, TD } from './admin/ui/Table';
import { TabBar, type TabItem } from './admin/ui/TabBar';
import {
  AdminCafeEditData,
  AdminCafeFormData,
  AdminGameRow,
  AdminUserFormData,
  AdminUserRow,
} from './admin/types';
import { useConfirm } from './ui/ConfirmDialog';
import { useToast } from '../contexts/ToastContext';

interface AdminDashboardProps {
  currentUser: User;
}

type TabId = 'users' | 'games' | 'cafes';

const TABS: ReadonlyArray<TabItem<TabId>> = [
  { id: 'users', label: 'Kullanıcılar', icon: <Users size={16} /> },
  { id: 'games', label: 'Oyunlar', icon: <Gamepad2 size={16} /> },
  { id: 'cafes', label: 'Kafeler', icon: <Coffee size={16} /> },
];

const EMPTY_USER_FORM: AdminUserFormData = {
  username: '',
  email: '',
  password: '',
  department: '',
  role: 'user',
  cafe_id: '',
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

const formatGameDate = (raw: string): string => {
  try {
    return new Date(raw).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return raw;
  }
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
  const { confirm, confirmDialog } = useConfirm();
  const toast = useToast();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [games, setGames] = useState<AdminGameRow[]>([]);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('users');
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
    dailyGameLimit: 10,
    dailyRewardWheel: [
      { points: 10, weight: 40 },
      { points: 25, weight: 30 },
      { points: 50, weight: 18 },
      { points: 100, weight: 10 },
      { points: 250, weight: 2 },
    ],
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, gamesData, cafesData] = await Promise.all([
        api.admin.getUsers(),
        api.admin.getGames(),
        api.cafes.list(),
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
          dailyGameLimit: 10,
          dailyRewardWheel: [
            { points: 10, weight: 40 },
            { points: 25, weight: 30 },
            { points: 50, weight: 18 },
            { points: 100, weight: 10 },
            { points: 250, weight: 2 },
          ],
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
          secondaryLatitude:
            resolvedCafe.secondary_latitude != null ? String(resolvedCafe.secondary_latitude) : '',
          secondaryLongitude:
            resolvedCafe.secondary_longitude != null
              ? String(resolvedCafe.secondary_longitude)
              : '',
          secondaryRadius: Number(resolvedCafe.secondary_radius || resolvedCafe.radius || 150),
          dailyGameLimit: Number(resolvedCafe.daily_game_limit ?? 10),
          dailyRewardWheel:
            Array.isArray(resolvedCafe.daily_reward_wheel) && resolvedCafe.daily_reward_wheel.length
              ? resolvedCafe.daily_reward_wheel
              : [
                  { points: 10, weight: 40 },
                  { points: 25, weight: 30 },
                  { points: 50, weight: 18 },
                  { points: 100, weight: 10 },
                  { points: 250, weight: 2 },
                ],
        });
      }
    } catch (error) {
      console.error('Data load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error.trim()) return error.trim();
    return fallback;
  };

  const handleCafeUpdate = async () => {
    if (!selectedCafe) return;

    const latitudeRaw = String(editCafeData.latitude || '').trim();
    const longitudeRaw = String(editCafeData.longitude || '').trim();
    const hasPrimaryLocation = Boolean(latitudeRaw) || Boolean(longitudeRaw);
    const latitude = Number(latitudeRaw);
    const longitude = Number(longitudeRaw);
    const radius = Number(editCafeData.radius);
    const hasSecondaryInput =
      Boolean(String(editCafeData.secondaryLatitude).trim()) ||
      Boolean(String(editCafeData.secondaryLongitude).trim());
    const secondaryLatitude = Number(editCafeData.secondaryLatitude);
    const secondaryLongitude = Number(editCafeData.secondaryLongitude);
    const secondaryRadius = Number(editCafeData.secondaryRadius);
    if (hasPrimaryLocation && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
      toast.warning('Kafe konumu için geçerli enlem ve boylam girin.');
      return;
    }
    if (!Number.isFinite(radius) || radius < 10 || radius > 5000) {
      toast.warning('Yarıçap 10-5000 metre arasında olmalıdır.');
      return;
    }
    if (hasSecondaryInput) {
      if (!Number.isFinite(secondaryLatitude) || !Number.isFinite(secondaryLongitude)) {
        toast.warning('İkinci konum için enlem ve boylam birlikte girilmelidir.');
        return;
      }
      if (!Number.isFinite(secondaryRadius) || secondaryRadius < 10 || secondaryRadius > 5000) {
        toast.warning('İkinci konum yarıçapı 10-5000 metre arasında olmalıdır.');
        return;
      }
    }

    try {
      await api.admin.updateCafe(selectedCafe.id, {
        address: editCafeData.address,
        total_tables: editCafeData.total_tables,
        latitude: hasPrimaryLocation ? latitude : null,
        longitude: hasPrimaryLocation ? longitude : null,
        radius,
        secondary_latitude: hasSecondaryInput ? secondaryLatitude : null,
        secondary_longitude: hasSecondaryInput ? secondaryLongitude : null,
        secondary_radius: hasSecondaryInput ? secondaryRadius : null,
        dailyGameLimit: editCafeData.dailyGameLimit,
        // dailyRewardWheel removed in PR #37 — wheel is now global, see
        // backend DAILY_WHEEL_SLICES constant.
      });
      toast.success('Kafe bilgileri güncellendi!');
      loadData();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Güncelleme başarısız.'));
    }
  };

  const handleCafeSelect = (cafeId: string) => {
    const cafe = cafes.find((c) => Number(c.id) === Number(cafeId));
    if (cafe) {
      setSelectedCafe(cafe);
      setEditCafeData({
        address: cafe.address || '',
        total_tables: cafe.total_tables || cafe.table_count || 20,
        latitude: cafe.latitude != null ? String(cafe.latitude) : '',
        longitude: cafe.longitude != null ? String(cafe.longitude) : '',
        radius: Number(cafe.radius || 150),
        secondaryLatitude: cafe.secondary_latitude != null ? String(cafe.secondary_latitude) : '',
        secondaryLongitude:
          cafe.secondary_longitude != null ? String(cafe.secondary_longitude) : '',
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

  const handleToggleRole = async (user: AdminUserRow) => {
    const currentRole = user.role;

    if (currentRole === 'cafe_admin') {
      const ok = await confirm({
        message: `${user.username} kullanıcısının kafe yöneticiliğini kaldırmak istediğinize emin misiniz?`,
        danger: true,
      });
      if (ok) {
        try {
          await api.admin.updateUserRole(user.id, 'user', null);
          toast.success('Kullanıcı rolü güncellendi!');
          loadData();
        } catch (error) {
          toast.error(extractErrorMessage(error, 'Rol güncelleme başarısız.'));
        }
      }
    } else {
      setSelectedUser(user);
      setSelectedCafeForAdmin(cafes.length > 0 ? cafes[0].id.toString() : '');
      setShowRoleModal(true);
    }
  };

  const handleConfirmCafeAdmin = async () => {
    if (!selectedUser || !selectedCafeForAdmin) {
      toast.warning('Lütfen bir kafe seçin.');
      return;
    }

    try {
      await api.admin.updateUserRole(selectedUser.id, 'cafe_admin', parseInt(selectedCafeForAdmin));
      toast.success(`${selectedUser.username} artık seçilen kafenin yöneticisi!`);
      setShowRoleModal(false);
      setSelectedUser(null);
      setSelectedCafeForAdmin('');
      loadData();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Rol güncelleme başarısız.'));
    }
  };

  const handlePointDraftChange = (userId: string | number, value: string) => {
    const sanitized = value.replace(/[^\d]/g, '');
    setUserPointDrafts((prev) => ({
      ...prev,
      [String(userId)]: sanitized,
    }));
  };

  const handleUpdateUserPoints = async (user: User) => {
    const draftValue = userPointDrafts[String(user.id)] ?? String(user.points ?? 0);
    const numericPoints = Number(draftValue);

    if (!Number.isFinite(numericPoints) || numericPoints < 0) {
      toast.warning('Puan 0 veya daha büyük olmalıdır.');
      return;
    }

    try {
      await api.admin.updateUserPoints(user.id, numericPoints);
      toast.success(`${user.username} için puan güncellendi.`);
      loadData();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Puan güncellenemedi.'));
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (Number(user.id) === Number(currentUser.id)) {
      toast.warning('Kendi hesabını bu panelden silemezsin.');
      return;
    }

    const ok = await confirm({
      message: `${user.username} kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      danger: true,
    });
    if (!ok) return;

    try {
      await api.admin.deleteUser(user.id);
      toast.success('Kullanıcı silindi.');
      loadData();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Kullanıcı silinemedi.'));
    }
  };

  const handleAddUser = async () => {
    if (!newUserData.username || !newUserData.email || !newUserData.password) {
      toast.warning('Kullanıcı adı, e-posta ve şifre zorunludur.');
      return;
    }
    if (newUserData.role === 'cafe_admin' && !newUserData.cafe_id) {
      toast.warning('Kafe yöneticisi için kafe seçimi zorunludur.');
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
        cafe_id: newUserData.role === 'cafe_admin' ? Number(newUserData.cafe_id) : null,
      });

      toast.success('Yeni kullanıcı oluşturuldu.');
      setShowAddUserModal(false);
      setNewUserData(EMPTY_USER_FORM);
      loadData();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Kullanıcı oluşturulamadı.'));
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleDeleteGame = async (gameId: number) => {
    const ok = await confirm({
      message: 'Bu oyunu silmek istediğinize emin misiniz? (Geri alınamaz)',
      danger: true,
    });
    if (ok) {
      try {
        await api.games.delete(gameId);
        toast.success('Oyun silindi!');
        loadData();
      } catch (error) {
        toast.error(extractErrorMessage(error, 'Oyun silinemedi.'));
      }
    }
  };

  const handleAddCafe = async () => {
    if (!newCafeData.name) {
      toast.warning('Lütfen kafe adı girin.');
      return;
    }
    const latitudeRaw = String(newCafeData.latitude || '').trim();
    const longitudeRaw = String(newCafeData.longitude || '').trim();
    const hasPrimaryLocation = Boolean(latitudeRaw) || Boolean(longitudeRaw);
    const latitude = Number(latitudeRaw);
    const longitude = Number(longitudeRaw);
    const radius = Number(newCafeData.radius);
    const hasSecondaryInput =
      Boolean(String(newCafeData.secondaryLatitude).trim()) ||
      Boolean(String(newCafeData.secondaryLongitude).trim());
    const secondaryLatitude = Number(newCafeData.secondaryLatitude);
    const secondaryLongitude = Number(newCafeData.secondaryLongitude);
    const secondaryRadius = Number(newCafeData.secondaryRadius);
    if (hasPrimaryLocation && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
      toast.warning('Yeni kafe için geçerli enlem ve boylam zorunludur.');
      return;
    }
    if (!Number.isFinite(radius) || radius < 10 || radius > 5000) {
      toast.warning('Yarıçap 10-5000 metre arasında olmalıdır.');
      return;
    }
    if (hasSecondaryInput) {
      if (!Number.isFinite(secondaryLatitude) || !Number.isFinite(secondaryLongitude)) {
        toast.warning('İkinci konum için enlem ve boylam birlikte girilmelidir.');
        return;
      }
      if (!Number.isFinite(secondaryRadius) || secondaryRadius < 10 || secondaryRadius > 5000) {
        toast.warning('İkinci konum yarıçapı 10-5000 metre arasında olmalıdır.');
        return;
      }
    }
    try {
      await api.admin.createCafe({
        ...newCafeData,
        latitude: hasPrimaryLocation ? latitude : null,
        longitude: hasPrimaryLocation ? longitude : null,
        radius,
        secondary_latitude: hasSecondaryInput ? secondaryLatitude : null,
        secondary_longitude: hasSecondaryInput ? secondaryLongitude : null,
        secondary_radius: hasSecondaryInput ? secondaryRadius : null,
      });
      toast.success('Yeni kafe eklendi!');
      setShowAddCafeModal(false);
      setNewCafeData(EMPTY_CAFE_FORM);
      loadData();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Kafe eklenirken hata oluştu.'));
    }
  };

  const handleDeleteCafe = async () => {
    if (!selectedCafe) {
      toast.warning('Silinecek bir kafe seçin.');
      return;
    }

    if (cafes.length <= 1) {
      toast.warning('Sistemde en az bir kafe kalmalıdır.');
      return;
    }

    const ok = await confirm({
      message: `${selectedCafe.name} kafesini silmek istediğinize emin misiniz?\n\nBu işlem bağlı kullanıcıları kafeden ayırır, kafe yöneticilerini user rolüne düşürür, bağlı ödülleri siler ve açık oyunları kapatır.`,
      danger: true,
    });
    if (!ok) return;

    try {
      const result: DeleteCafeResult = await api.admin.deleteCafe(selectedCafe.id);
      const cleanup = result?.cleanup || {
        detachedUsers: 0,
        cafeAdminsDemoted: 0,
        rewardsDeleted: 0,
        gamesForceClosed: 0,
      };

      toast.success(
        `${selectedCafe.name} silindi. ` +
          `${cleanup.detachedUsers} kullanıcı kafeden ayrıldı, ` +
          `${cleanup.cafeAdminsDemoted} kafe yöneticisi user rolüne alındı, ` +
          `${cleanup.rewardsDeleted} ödül silindi, ` +
          `${cleanup.gamesForceClosed} açık oyun kapatıldı.`
      );

      await loadData();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Kafe silinemedi.'));
    }
  };

  const filteredUsers = users.filter((user) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return user.username.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
  });

  const roleTone = (user: AdminUserRow): 'danger' | 'warning' | 'neutral' =>
    user.isAdmin ? 'danger' : user.role === 'cafe_admin' ? 'warning' : 'neutral';
  const roleLabel = (user: AdminUserRow): string =>
    user.isAdmin ? 'Admin' : user.role === 'cafe_admin' ? 'Cafe Admin' : 'User';

  return (
    <div className="riso-kantin min-h-screen pt-24 pb-[calc(8rem+env(safe-area-inset-bottom))] px-4">
      <div className="max-w-[1280px] mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-riso-pink-deep font-semibold mb-2 flex items-center gap-2">
              <ShieldCheck size={14} />
              <span>CafeDuo · Yönetim</span>
            </p>
            <h1 className="font-riso-display text-[2.25rem] sm:text-[2.5rem] font-semibold text-carbon tracking-[-0.02em] leading-none">
              Concierge
            </h1>
            <p className="text-[0.9375rem] text-carbon-muted mt-2">
              <span className="font-medium text-carbon-soft">{currentUser.username}</span> —
              kullanıcı, oyun ve kafe operasyonlarını yönet.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="primary">{cafes.length} kafe</Badge>
            <Badge tone="neutral">{users.length} kullanıcı</Badge>
          </div>
        </header>

        <TabBar tabs={TABS} value={activeTab} onChange={(next) => setActiveTab(next)} />

        {loading ? (
          <p className="mt-10 text-center text-carbon-muted">Yükleniyor…</p>
        ) : (
          <main className="mt-8">
            {/* USERS TAB */}
            {activeTab === 'users' && (
              <section className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="relative w-full sm:max-w-sm">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-carbon-muted pointer-events-none"
                      size={16}
                    />
                    <Input
                      className="pl-9"
                      placeholder="Kullanıcı adı veya e-posta ara…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      aria-label="Kullanıcı ara"
                    />
                  </div>
                  <Button
                    leftIcon={<UserPlus size={16} />}
                    onClick={() => setShowAddUserModal(true)}
                  >
                    Yeni Kullanıcı
                  </Button>
                </div>

                <Table>
                  <THead>
                    <TH>Kullanıcı</TH>
                    <TH>E-posta</TH>
                    <TH>Bölüm</TH>
                    <TH className="text-center">Puan</TH>
                    <TH className="text-center">Rol</TH>
                    <TH>Kafe</TH>
                    <TH className="text-right">İşlemler</TH>
                  </THead>
                  <TBody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <TD className="font-medium">{user.username}</TD>
                        <TD className="text-carbon-soft">{user.email}</TD>
                        <TD className="text-carbon-muted">{user.department || '—'}</TD>
                        <TD className="text-center">
                          <div className="flex flex-col items-center gap-2">
                            <span className="cc-mono text-[0.9375rem] text-riso-pink-deep font-semibold">
                              {user.points}
                            </span>
                            {!user.isAdmin && (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  aria-label={`${user.username} puan`}
                                  value={
                                    userPointDrafts[String(user.id)] ?? String(user.points ?? 0)
                                  }
                                  onChange={(e) => handlePointDraftChange(user.id, e.target.value)}
                                  className="w-16 px-2 py-1 rounded-md bg-paper border border-carbon-muted text-center text-[0.8125rem] cc-mono focus:outline-none focus:ring-4 focus:ring-riso-pink/30 focus:border-riso-pink"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  leftIcon={<Coins size={12} />}
                                  onClick={() => handleUpdateUserPoints(user)}
                                  className="px-2 py-1"
                                >
                                  Kaydet
                                </Button>
                              </div>
                            )}
                          </div>
                        </TD>
                        <TD className="text-center">
                          <Badge tone={roleTone(user)}>{roleLabel(user)}</Badge>
                        </TD>
                        <TD className="text-carbon-muted">{user.cafe_name || '—'}</TD>
                        <TD className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!user.isAdmin && (
                              <>
                                <Button
                                  size="sm"
                                  variant={user.role === 'cafe_admin' ? 'ghost' : 'secondary'}
                                  onClick={() => handleToggleRole(user)}
                                >
                                  {user.role === 'cafe_admin' ? 'Yetkiyi Al' : 'Yönetici Yap'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  leftIcon={<Trash2 size={14} />}
                                  onClick={() => handleDeleteUser(user)}
                                >
                                  Sil
                                </Button>
                              </>
                            )}
                          </div>
                        </TD>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              </section>
            )}

            {/* GAMES TAB */}
            {activeTab === 'games' && (
              <section className="flex flex-col gap-3">
                {games.length === 0 ? (
                  <Card className="p-8 text-center text-carbon-muted">
                    <Gamepad2 size={32} className="mx-auto mb-3 text-carbon-muted" />
                    <p>Henüz oyun kaydı yok.</p>
                  </Card>
                ) : (
                  games.map((game) => (
                    <Card key={game.id} className="px-5 py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="shrink-0 w-10 h-10 rounded-lg bg-paper-deep border border-carbon flex items-center justify-center text-[1.125rem]">
                            {game.game_type === 'tictactoe'
                              ? '◯'
                              : game.game_type === 'Bilgi Yarışı'
                                ? '?'
                                : game.game_type === 'Retro Satranç'
                                  ? '♞'
                                  : '◉'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-carbon truncate">
                              {game.host_name} <span className="text-carbon-muted mx-1">×</span>{' '}
                              {game.guest_name || 'Bekleniyor'}
                            </p>
                            <p className="text-[0.8125rem] text-carbon-muted">
                              {formatGameDate(game.created_at)} · {game.cafe_name || 'Bilinmiyor'} ·
                              Masa {game.table_code}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge tone={game.status === 'finished' ? 'success' : 'warning'}>
                            {game.status === 'finished' ? 'Tamamlandı' : 'Devam ediyor'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="danger"
                            leftIcon={<Trash2 size={14} />}
                            onClick={() => handleDeleteGame(game.id)}
                          >
                            Sil
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </section>
            )}

            {/* CAFES TAB */}
            {activeTab === 'cafes' && (
              <section className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
                {/* Cafe list */}
                <Card className="p-6 h-fit">
                  <p className="text-xs uppercase tracking-[0.1em] font-semibold text-carbon-muted mb-4">
                    Kafeler
                  </p>
                  {cafes.length === 0 ? (
                    <p className="text-[0.875rem] text-carbon-muted mb-4">Henüz kafe yok.</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {cafes.map((c) => {
                        const active = Number(selectedCafe?.id) === Number(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleCafeSelect(String(c.id))}
                            className={
                              'text-left px-3 py-2.5 rounded-lg transition-colors ' +
                              (active
                                ? 'bg-riso-mustard/20 text-riso-pink-deep font-semibold'
                                : 'hover:bg-paper-deep text-carbon')
                            }
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-5 pt-5 border-t border-carbon">
                    <Button
                      leftIcon={<Plus size={16} />}
                      variant="secondary"
                      onClick={() => setShowAddCafeModal(true)}
                      className="w-full"
                    >
                      Yeni Kafe
                    </Button>
                  </div>
                </Card>

                {/* Detail card */}
                {selectedCafe ? (
                  <Card className="p-8">
                    <header className="flex items-start justify-between gap-4 mb-6">
                      <div>
                        <p className="text-xs uppercase tracking-[0.1em] text-riso-pink-deep font-semibold mb-1">
                          Konum Detayları
                        </p>
                        <h2 className="font-riso-display text-[1.5rem] text-carbon font-semibold tracking-[-0.01em]">
                          {selectedCafe.name}
                        </h2>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <Button
                          variant="danger"
                          size="sm"
                          leftIcon={<Trash2 size={14} />}
                          onClick={handleDeleteCafe}
                          disabled={cafes.length <= 1}
                          data-testid="delete-cafe-button"
                        >
                          Kafeyi Sil
                        </Button>
                        {cafes.length <= 1 && (
                          <p className="text-[0.75rem] text-carbon-muted max-w-[180px] text-right">
                            Güvenlik kuralı: Son kafe silinemez.
                          </p>
                        )}
                      </div>
                    </header>

                    <div className="flex flex-col gap-5">
                      <Input
                        label="Adres"
                        value={editCafeData.address}
                        onChange={(e) =>
                          setEditCafeData({ ...editCafeData, address: e.target.value })
                        }
                        placeholder="Örn: Mühendislik Fakültesi, Kampüs"
                      />
                      <Input
                        label="Toplam Masa"
                        type="number"
                        min={1}
                        value={editCafeData.total_tables}
                        onChange={(e) =>
                          setEditCafeData({
                            ...editCafeData,
                            total_tables: Number.parseInt(e.target.value || '0', 10),
                          })
                        }
                      />

                      <div className="border-2 border-carbon bg-paper p-1 riso-shadow-sm">
                        <p className="bg-riso-blue text-carbon px-3 py-2 font-riso-display text-xs sm:text-sm uppercase tracking-[0.12em] font-bold mb-1">
                          Haritadan Konum Seç
                        </p>
                        <MapLocationPicker
                          primaryLatitude={editCafeData.latitude}
                          primaryLongitude={editCafeData.longitude}
                          primaryRadius={Number(editCafeData.radius) || 150}
                          secondaryLatitude={editCafeData.secondaryLatitude}
                          secondaryLongitude={editCafeData.secondaryLongitude}
                          secondaryRadius={Number(editCafeData.secondaryRadius) || 150}
                          onPrimaryLatitudeChange={(value) =>
                            setEditCafeData((current) => ({ ...current, latitude: value }))
                          }
                          onPrimaryLongitudeChange={(value) =>
                            setEditCafeData((current) => ({ ...current, longitude: value }))
                          }
                          onPrimaryCoordinatesChange={(latitude, longitude) =>
                            setEditCafeData((current) => ({ ...current, latitude, longitude }))
                          }
                          onPrimaryRadiusChange={(value) =>
                            setEditCafeData((current) => ({
                              ...current,
                              radius: Number.parseInt(value || '0', 10),
                            }))
                          }
                          onSecondaryLatitudeChange={(value) =>
                            setEditCafeData((current) => ({ ...current, secondaryLatitude: value }))
                          }
                          onSecondaryLongitudeChange={(value) =>
                            setEditCafeData((current) => ({
                              ...current,
                              secondaryLongitude: value,
                            }))
                          }
                          onSecondaryCoordinatesChange={(latitude, longitude) =>
                            setEditCafeData((current) => ({
                              ...current,
                              secondaryLatitude: latitude,
                              secondaryLongitude: longitude,
                            }))
                          }
                          onSecondaryRadiusChange={(value) =>
                            setEditCafeData((current) => ({
                              ...current,
                              secondaryRadius: Number.parseInt(value || '0', 10),
                            }))
                          }
                        />
                      </div>

                      <Card variant="muted" className="p-5">
                        <p className="text-xs uppercase tracking-[0.1em] font-semibold text-riso-pink-deep mb-3">
                          Birincil Konum
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input
                            label="Enlem"
                            type="number"
                            step="0.000001"
                            value={editCafeData.latitude}
                            onChange={(e) =>
                              setEditCafeData({ ...editCafeData, latitude: e.target.value })
                            }
                            className="cc-mono"
                          />
                          <Input
                            label="Boylam"
                            type="number"
                            step="0.000001"
                            value={editCafeData.longitude}
                            onChange={(e) =>
                              setEditCafeData({
                                ...editCafeData,
                                longitude: e.target.value,
                              })
                            }
                            className="cc-mono"
                          />
                        </div>
                        <div className="mt-4">
                          <Input
                            label="Doğrulama Yarıçapı (metre)"
                            type="number"
                            min={10}
                            max={5000}
                            value={editCafeData.radius}
                            onChange={(e) =>
                              setEditCafeData({
                                ...editCafeData,
                                radius: Number.parseInt(e.target.value || '0', 10),
                              })
                            }
                            helper="Kullanıcılar yalnızca bu çember içinde check-in yapabilir."
                          />
                        </div>
                      </Card>

                      <Card variant="muted" className="p-5">
                        <p className="text-xs uppercase tracking-[0.1em] font-semibold text-carbon-muted mb-3">
                          İkincil Konum · Opsiyonel
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input
                            label="Ek Enlem"
                            type="number"
                            step="0.000001"
                            value={editCafeData.secondaryLatitude}
                            onChange={(e) =>
                              setEditCafeData({
                                ...editCafeData,
                                secondaryLatitude: e.target.value,
                              })
                            }
                            className="cc-mono"
                          />
                          <Input
                            label="Ek Boylam"
                            type="number"
                            step="0.000001"
                            value={editCafeData.secondaryLongitude}
                            onChange={(e) =>
                              setEditCafeData({
                                ...editCafeData,
                                secondaryLongitude: e.target.value,
                              })
                            }
                            className="cc-mono"
                          />
                        </div>
                        <div className="mt-4">
                          <Input
                            label="Ek Konum Yarıçapı (metre)"
                            type="number"
                            min={10}
                            max={5000}
                            value={editCafeData.secondaryRadius}
                            onChange={(e) =>
                              setEditCafeData({
                                ...editCafeData,
                                secondaryRadius: Number.parseInt(e.target.value || '0', 10),
                              })
                            }
                          />
                        </div>
                      </Card>

                      {/* PR #36 — per-cafe rules (wheel editor removed in PR #37 —
                          wheel is now global/sabit, see commerceHandlers.js
                          DAILY_WHEEL_SLICES). Daily game limit stays
                          configurable per cafe. */}
                      <Card variant="muted" className="p-5">
                        <p className="text-xs uppercase tracking-[0.1em] font-semibold text-riso-blue mb-3">
                          Bu Kafenin Kuralları
                        </p>
                        <Input
                          label="Günlük Oyun Limiti (kullanıcı başına)"
                          type="number"
                          min={1}
                          max={200}
                          value={editCafeData.dailyGameLimit ?? 10}
                          onChange={(e) =>
                            setEditCafeData({
                              ...editCafeData,
                              dailyGameLimit: Number.parseInt(e.target.value || '0', 10),
                            })
                          }
                          helper="Her kullanıcı bu kafede günde bu kadar oyun kurabilir. Süper-adminler hariç."
                        />
                      </Card>

                      <div className="flex justify-end pt-2">
                        <Button leftIcon={<Save size={16} />} onClick={handleCafeUpdate}>
                          Değişiklikleri Kaydet
                        </Button>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <Card className="p-12 flex flex-col items-center justify-center text-center text-carbon-muted">
                    <Coffee size={36} className="mb-3 text-carbon-muted" />
                    <p>Düzenlemek için soldan bir kafe seç ya da yeni bir kafe oluştur.</p>
                  </Card>
                )}
              </section>
            )}
          </main>
        )}
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

      {confirmDialog}
    </div>
  );
};
