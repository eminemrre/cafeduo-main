import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../lib/api';
import { RetroButton } from './RetroButton';
import { QrCode, CheckCircle, XCircle, Coffee, Gift, Plus, Trash2 } from 'lucide-react';

interface CafeDashboardProps {
    currentUser: User;
}

export const CafeDashboard: React.FC<CafeDashboardProps> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<'verification' | 'rewards'>('verification');

    // Verification State
    const [couponCode, setCouponCode] = useState('');
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [lastItem, setLastItem] = useState<any>(null);

    // Rewards State
    const [rewards, setRewards] = useState<any[]>([]);
    const [newReward, setNewReward] = useState({ title: '', cost: 500, description: '', icon: 'coffee' });

    useEffect(() => {
        if (activeTab === 'rewards') {
            fetchRewards();
        }
    }, [activeTab]);

    const fetchRewards = async () => {
        try {
            const data = await api.rewards.list();
            // Filter rewards for this cafe (if needed, or show all)
            // Ideally backend filters, but for now we show all or filter by cafeId if present in reward
            // Since we want cafe admins to manage THEIR rewards, we should filter.
            // But currently backend returns all active rewards. 
            // Let's just show all for now as per "general rewards + cafe specific" requirement.
            setRewards(data);
        } catch (error) {
            console.error("Failed to fetch rewards", error);
        }
    };

    const handleUseCoupon = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('idle');
        setMessage('');
        setLastItem(null);

        try {
            const response = await api.coupons.use(couponCode);
            setStatus('success');
            setMessage('Kupon başarıyla kullanıldı!');
            setLastItem(response.item);
            setCouponCode('');
        } catch (error: any) {
            setStatus('error');
            setMessage(error.response?.data?.error || 'Kupon kullanılamadı.');
        }
    };

    const handleCreateReward = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.rewards.create({
                ...newReward,
                cafeId: currentUser.cafeId
            });
            alert('Ödül başarıyla oluşturuldu!');
            setNewReward({ title: '', cost: 500, description: '', icon: 'coffee' });
            fetchRewards();
        } catch (error) {
            alert('Ödül oluşturulurken hata oluştu.');
        }
    };

    const handleDeleteReward = async (id: number) => {
        if (window.confirm('Bu ödülü silmek istediğinize emin misiniz?')) {
            try {
                await api.rewards.delete(id);
                fetchRewards();
            } catch (error) {
                alert('Silme işlemi başarısız.');
            }
        }
    };

    return (
        <div className="min-h-screen bg-[#0f141a] pt-24 px-4 pb-12">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 bg-orange-900/30 rounded-2xl border border-orange-500/30 flex items-center justify-center">
                        <Coffee size={32} className="text-orange-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">Kafe Yönetim Paneli</h1>
                        <p className="text-gray-400">Kupon doğrulama ve ödül yönetimi</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-8">
                    <button
                        onClick={() => setActiveTab('verification')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'verification'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                                : 'bg-[#1a1f2e] text-gray-400 hover:bg-[#252b3d]'
                            }`}
                    >
                        <QrCode size={20} />
                        Kupon İşlemleri
                    </button>
                    <button
                        onClick={() => setActiveTab('rewards')}
                        className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${activeTab === 'rewards'
                                ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/50'
                                : 'bg-[#1a1f2e] text-gray-400 hover:bg-[#252b3d]'
                            }`}
                    >
                        <Gift size={20} />
                        Ödül Yönetimi
                    </button>
                </div>

                {activeTab === 'verification' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Coupon Verification Form */}
                        <div className="bg-[#1a1f2e] border border-gray-800 rounded-2xl p-8 shadow-xl">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <QrCode className="text-blue-400" />
                                Kupon Kullan
                            </h2>

                            <form onSubmit={handleUseCoupon} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        Kupon Kodu
                                    </label>
                                    <input
                                        type="text"
                                        value={couponCode}
                                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                        placeholder="Kupon kodunu girin..."
                                        className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono text-lg tracking-wider"
                                    />
                                </div>

                                <RetroButton type="submit" variant="primary" className="w-full">
                                    KUPONU ONAYLA
                                </RetroButton>
                            </form>

                            {/* Status Messages */}
                            {status !== 'idle' && (
                                <div className={`mt-6 p-4 rounded-xl border flex items-center gap-3 ${status === 'success'
                                    ? 'bg-green-900/20 border-green-900/50 text-green-400'
                                    : 'bg-red-900/20 border-red-900/50 text-red-400'
                                    }`}>
                                    {status === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                                    <p className="font-medium">{message}</p>
                                </div>
                            )}
                        </div>

                        {/* Last Transaction Details */}
                        <div className="bg-[#1a1f2e] border border-gray-800 rounded-2xl p-8 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl"></div>

                            <h2 className="text-xl font-bold text-white mb-6">Son İşlem Detayı</h2>

                            {lastItem ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-black/30 rounded-xl border border-gray-800">
                                        <div className="text-sm text-gray-500 mb-1">Ürün</div>
                                        <div className="text-lg font-bold text-white">{lastItem.item_title}</div>
                                    </div>

                                    <div className="p-4 bg-black/30 rounded-xl border border-gray-800">
                                        <div className="text-sm text-gray-500 mb-1">Kupon Kodu</div>
                                        <div className="text-lg font-mono text-yellow-500 tracking-wider">{lastItem.code}</div>
                                    </div>

                                    <div className="p-4 bg-black/30 rounded-xl border border-gray-800">
                                        <div className="text-sm text-gray-500 mb-1">İşlem Zamanı</div>
                                        <div className="text-white">
                                            {new Date().toLocaleString('tr-TR')}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-500 py-12">
                                    <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
                                        <Coffee size={24} className="opacity-50" />
                                    </div>
                                    <p>Henüz işlem yapılmadı</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Add Reward Form */}
                        <div className="bg-[#1a1f2e] border border-gray-800 rounded-2xl p-6 h-fit">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <Plus className="text-orange-400" />
                                Yeni Ödül Ekle
                            </h2>
                            <form onSubmit={handleCreateReward} className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Ödül Başlığı</label>
                                    <input
                                        type="text"
                                        value={newReward.title}
                                        onChange={e => setNewReward({ ...newReward, title: e.target.value })}
                                        className="w-full bg-black/30 border border-gray-700 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Puan Bedeli</label>
                                    <input
                                        type="number"
                                        value={newReward.cost}
                                        onChange={e => setNewReward({ ...newReward, cost: parseInt(e.target.value) })}
                                        className="w-full bg-black/30 border border-gray-700 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Açıklama</label>
                                    <textarea
                                        value={newReward.description}
                                        onChange={e => setNewReward({ ...newReward, description: e.target.value })}
                                        className="w-full bg-black/30 border border-gray-700 rounded-lg p-3 text-white focus:border-orange-500 outline-none h-24 resize-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">İkon Tipi</label>
                                    <select
                                        value={newReward.icon}
                                        onChange={e => setNewReward({ ...newReward, icon: e.target.value })}
                                        className="w-full bg-black/30 border border-gray-700 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
                                    >
                                        <option value="coffee">Kahve</option>
                                        <option value="dessert">Tatlı</option>
                                        <option value="discount">İndirim</option>
                                        <option value="game">Oyun</option>
                                    </select>
                                </div>
                                <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg transition-colors">
                                    Ödülü Oluştur
                                </button>
                            </form>
                        </div>

                        {/* Rewards List */}
                        <div className="lg:col-span-2 space-y-4">
                            <h2 className="text-xl font-bold text-white mb-4">Aktif Ödüller</h2>
                            {rewards.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 bg-[#1a1f2e] rounded-2xl border border-gray-800">
                                    <Gift size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>Henüz ödül eklenmemiş.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {rewards.map((reward) => (
                                        <div key={reward.id} className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4 flex justify-between items-start group hover:border-orange-500/50 transition-colors">
                                            <div className="flex gap-4">
                                                <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400">
                                                    {reward.icon === 'coffee' && <Coffee size={24} />}
                                                    {reward.icon === 'dessert' && <Gift size={24} />}
                                                    {reward.icon === 'discount' && <span className="text-xl font-bold">%</span>}
                                                    {reward.icon === 'game' && <span className="text-xl">🎮</span>}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-white">{reward.title}</h3>
                                                    <p className="text-sm text-gray-400">{reward.description}</p>
                                                    <div className="mt-2 inline-block bg-orange-900/30 text-orange-400 text-xs px-2 py-1 rounded border border-orange-900/50">
                                                        {reward.cost} Puan
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteReward(reward.id)}
                                                className="text-gray-600 hover:text-red-500 p-2 hover:bg-red-900/20 rounded transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
