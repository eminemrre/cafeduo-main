import React, { useState, useEffect } from 'react';
import { Users, Trash2, Shield, Search, MapPin, Coffee, Gamepad2, Save, Navigation } from 'lucide-react';
import { User, GameRequest } from '../types';
import { api } from '../lib/api';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface AdminDashboardProps {
    currentUser: User;
}

// Map Click Handler Component
function LocationMarker({ setLocation }: { setLocation: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            setLocation(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
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
        latitude: 37.7749,
        longitude: 29.0875, // Default: Denizli
        table_count: 20,
        radius: 100
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
                    latitude: cafesData[0].latitude || 37.7749,
                    longitude: cafesData[0].longitude || 29.0875,
                    table_count: cafesData[0].table_count || 20,
                    radius: cafesData[0].radius || 100
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
                latitude: cafe.latitude || 37.7749,
                longitude: cafe.longitude || 29.0875,
                table_count: cafe.table_count || 20,
                radius: cafe.radius || 100
            });
        }
    };

    const [showAddCafeModal, setShowAddCafeModal] = useState(false);
    const [newCafeData, setNewCafeData] = useState({
        name: '',
        latitude: 37.7749,
        longitude: 29.0875,
        table_count: 20,
        radius: 100
    });

    // ... (existing loadData and other functions)

    const handleAddCafe = async () => {
        if (!newCafeData.name) {
            alert('Lütfen kafe adı girin.');
            return;
        }
        try {
            await api.admin.createCafe(newCafeData);
            alert('Yeni kafe eklendi!');
            setShowAddCafeModal(false);
            setNewCafeData({ name: '', latitude: 37.7749, longitude: 29.0875, table_count: 20, radius: 100 });
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
                            { id: 'cafes', icon: MapPin, label: 'Kafe & Konum' }
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
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CAFES TAB (LOCATION) */}
                    {activeTab === 'cafes' && (
                        <div className="flex h-[600px]">
                            {/* Sidebar */}
                            <div className="w-1/3 border-r border-gray-700/50 p-6 bg-black/20 overflow-y-auto">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl text-white font-bold flex items-center gap-2">
                                        <Coffee className="text-orange-400" /> Kafe Ayarları
                                    </h2>
                                    <button
                                        onClick={() => setShowAddCafeModal(true)}
                                        className="bg-green-600 hover:bg-green-500 text-white p-2 rounded-lg transition-colors"
                                        title="Yeni Kafe Ekle"
                                    >
                                        <div className="flex items-center gap-1 text-xs font-bold">
                                            <span>+</span> EKLE
                                        </div>
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-2">Düzenlenecek Kafe</label>
                                        <select
                                            className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                                            onChange={(e) => handleCafeSelect(e.target.value)}
                                            value={selectedCafe?.id || ''}
                                        >
                                            {cafes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>

                                    {selectedCafe && (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-gray-400 text-xs mb-1">Enlem (Lat)</label>
                                                    <input
                                                        type="number"
                                                        value={editCafeData.latitude}
                                                        onChange={e => setEditCafeData({ ...editCafeData, latitude: parseFloat(e.target.value) })}
                                                        className="w-full bg-black/40 border border-gray-600 rounded-lg p-2 text-white text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-gray-400 text-xs mb-1">Boylam (Lng)</label>
                                                    <input
                                                        type="number"
                                                        value={editCafeData.longitude}
                                                        onChange={e => setEditCafeData({ ...editCafeData, longitude: parseFloat(e.target.value) })}
                                                        className="w-full bg-black/40 border border-gray-600 rounded-lg p-2 text-white text-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-gray-400 text-sm mb-2">Toplam Masa Sayısı</label>
                                                <input
                                                    type="number"
                                                    value={editCafeData.table_count}
                                                    onChange={e => setEditCafeData({ ...editCafeData, table_count: parseInt(e.target.value) })}
                                                    className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-gray-400 text-sm mb-2">Menzil (Metre)</label>
                                                <input
                                                    type="number"
                                                    value={editCafeData.radius}
                                                    onChange={e => setEditCafeData({ ...editCafeData, radius: parseInt(e.target.value) })}
                                                    className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">Kullanıcıların giriş yapabilmesi için gereken maksimum mesafe.</p>
                                            </div>

                                            <button
                                                onClick={handleCafeUpdate}
                                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                                            >
                                                <Save size={18} /> KAYDET
                                            </button>

                                            <div className="bg-blue-900/20 border border-blue-800/50 p-4 rounded-lg">
                                                <p className="text-blue-300 text-xs flex items-start gap-2">
                                                    <Navigation size={14} className="mt-0.5" />
                                                    Haritadan bir noktaya tıklayarak koordinatları otomatik doldurabilirsiniz.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Map Area */}
                            <div className="w-2/3 relative">
                                <MapContainer
                                    center={[editCafeData.latitude, editCafeData.longitude]}
                                    zoom={15}
                                    style={{ height: '100%', width: '100%' }}
                                    key={`${selectedCafe?.id}-${activeTab}`} // Force re-render only when cafe changes
                                >
                                    <TileLayer
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    />
                                    <Marker position={[editCafeData.latitude, editCafeData.longitude]} />
                                    <LocationMarker setLocation={(lat, lng) => setEditCafeData(prev => ({ ...prev, latitude: lat, longitude: lng }))} />
                                </MapContainer>
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
                                <label className="block text-gray-400 text-sm mb-2">Kafe Adı</label>
                                <input
                                    type="text"
                                    value={newCafeData.name}
                                    onChange={e => setNewCafeData({ ...newCafeData, name: e.target.value })}
                                    className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500"
                                    placeholder="Örn: Kampüs Kafe"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-sm mb-2">Enlem</label>
                                    <input
                                        type="number"
                                        value={newCafeData.latitude}
                                        onChange={e => setNewCafeData({ ...newCafeData, latitude: parseFloat(e.target.value) })}
                                        className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-sm mb-2">Boylam</label>
                                    <input
                                        type="number"
                                        value={newCafeData.longitude}
                                        onChange={e => setNewCafeData({ ...newCafeData, longitude: parseFloat(e.target.value) })}
                                        className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-gray-400 text-sm mb-2">Masa Sayısı</label>
                                <input
                                    type="number"
                                    value={newCafeData.table_count}
                                    onChange={e => setNewCafeData({ ...newCafeData, table_count: parseInt(e.target.value) })}
                                    className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white"
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
        </div>
    );
};
