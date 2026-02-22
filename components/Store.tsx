import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Zap, Award, Check, Image, Star } from 'lucide-react';
import { api } from '../lib/api';
import type { User } from '../types';

interface StoreItem {
    id: number;
    title: string;
    code: string;
    price: number;
    type: 'rank' | 'frame' | 'title' | 'animation';
    description: string;
}

interface UserInventoryItem {
    id: number;
    user_id: number;
    item_id: number;
    item_title: string;
    code: string;
    is_used: boolean;
}

interface StoreProps {
    user: User | null;
    setUser: React.Dispatch<React.SetStateAction<User | null>>;
    onShowToast?: {
        success?: (message: string) => void;
        error?: (message: string) => void;
        warning?: (message: string) => void;
    };
}

export const Store: React.FC<StoreProps> = ({ user, setUser, onShowToast }) => {
    const [items, setItems] = useState<StoreItem[]>([]);
    const [inventory, setInventory] = useState<UserInventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [buyingId, setBuyingId] = useState<number | null>(null);

    useEffect(() => {
        fetchStoreData();
    }, []);

    const fetchStoreData = async () => {
        try {
            setLoading(true);
            // Backend'den item ve envanter çek
            const [itemsRes, invRes] = await Promise.all([
                api.store.items(),
                user ? api.store.inventory() : Promise.resolve({ success: true, inventory: [] as UserInventoryItem[] })
            ]);

            if (itemsRes.success) setItems(itemsRes.items);
            if (invRes.success) setInventory(invRes.inventory);
        } catch (error) {
            console.error('Store verisi çekilemedi:', error);
            onShowToast?.error('Mağaza yüklenemedi. Lütfen tekrar deneyin.');
        } finally {
            setLoading(false);
        }
    };

    const handleBuy = async (item: StoreItem) => {
        if (!user) {
            onShowToast?.error('Satın alım için giriş yapmalısınız.');
            return;
        }

        if (user.points < item.price) {
            onShowToast?.warning('Yetersiz Cyber-Creds (Puan)');
            return;
        }

        try {
            setBuyingId(item.id);
            const data = await api.store.buy(item.id);

            if (data.success) {
                onShowToast?.success(`${item.title} başarıyla satın alındı!`);
                // update user points locally
                setUser(prev => (prev ? { ...prev, points: data.remainingPoints } : prev));
                // add to local inventory
                setInventory(prev => [data.inventoryItem, ...prev]);
            } else {
                onShowToast?.error(data.message || 'Satın alım başarısız');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Bir hata oluştu';
            onShowToast?.error(message);
        } finally {
            setBuyingId(null);
        }
    };

    const hasItem = (code: string) => {
        return inventory.some(item => item.code === code);
    };

    const getIconForType = (type: string) => {
        switch (type) {
            case 'rank': return <Award className="text-cyan-400" />;
            case 'frame': return <Image className="text-pink-500" />;
            case 'title': return <Star className="text-yellow-400" />;
            case 'animation': return <Zap className="text-emerald-400" />;
            default: return <ShoppingCart className="text-[var(--rf-muted)]" />;
        }
    };

    if (loading) {
        return (
            <div className="w-full h-64 flex flex-col items-center justify-center relative noise-bg">
                <div className="w-16 h-16 border-4 border-cyan-900 border-t-cyan-400 rounded-full animate-spin"></div>
                <p className="mt-4 font-body text-cyan-400 tracking-widest animate-pulse">MARKET_AĞI_TARANIYOR...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-12 relative noise-bg min-h-screen">

            {/* Cüzdan / Header Bölgesi */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 border-b-2 border-cyan-900/50 pb-6">
                <div>
                    <motion.h1
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="text-5xl md:text-7xl font-display text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 uppercase tracking-tighter mix-blend-screen skew-x-[-5deg]"
                    >
                        Siber Pazar
                    </motion.h1>
                    <p className="font-body text-cyan-600 tracking-widest mt-2">Holografik Eşya Pazarı // Lisanslı Ekipmanlar</p>
                </div>

                {user && (
                    <motion.div
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="mt-6 md:mt-0 bg-[#050a19] p-4 border-2 border-cyan-500/30 flex items-center gap-4 skew-x-[-10deg] shadow-[4px_4px_0_rgba(0,243,255,0.2)]"
                    >
                        <div className="text-right flex flex-col justify-center">
                            <span className="text-[10px] font-body text-cyan-600 uppercase tracking-widest block skew-x-[10deg]">Aktif Bakiye</span>
                            <span className="font-display text-3xl text-cyan-400 block skew-x-[10deg]">{user.points} <span className="text-sm text-pink-500">CP</span></span>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Grid Listesi */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {items.map((item, index) => {
                    const owned = hasItem(item.code);
                    const afford = user ? user.points >= item.price : false;

                    return (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`relative bg-[#050a19] border-t-2 border-l-2 border-r-4 border-b-4 p-6 flex flex-col justify-between group overflow-hidden ${owned ? 'border-emerald-500 shadow-[6px_6px_0_rgba(16,185,129,0.2)]'
                                    : afford ? 'border-cyan-400 shadow-[6px_6px_0_rgba(0,243,255,0.2)] hover:border-pink-500 hover:shadow-[8px_8px_0_rgba(255,0,234,0.3)]'
                                        : 'border-cyan-900/45 shadow-[6px_6px_0_rgba(6,28,48,0.5)] opacity-80 cursor-not-allowed'
                                } transition-all duration-300`}
                        >
                            {/* Background Scanline Arka Plan Efekti */}
                            <div className="absolute inset-0 pointer-events-none opacity-[0.03] group-hover:opacity-10 transition-opacity bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#00f3ff_2px,#00f3ff_4px)]" />

                            <div>
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div className="w-12 h-12 bg-black border border-cyan-900/50 flex items-center justify-center skew-x-[-10deg]">
                                        <div className="skew-x-[10deg]">
                                            {getIconForType(item.type)}
                                        </div>
                                    </div>
                                    <span className={`font-display text-xl tracking-widest ${owned ? 'text-emerald-400' : afford ? 'text-pink-500' : 'text-[var(--rf-muted)]'}`}>
                                        {item.price} CP
                                    </span>
                                </div>

                                <h3 className="text-2xl font-display text-white mb-2 tracking-wide relative z-10 uppercase">{item.title}</h3>
                                <p className="text-sm font-body text-cyan-800/80 mb-6 relative z-10">{item.description}</p>
                            </div>

                            <div className="relative z-10 mt-auto">
                                <button
                                    onClick={() => handleBuy(item)}
                                    disabled={owned || !afford || buyingId === item.id}
                                    className={`w-full py-3 font-display text-lg tracking-widest uppercase transition-all flex items-center justify-center gap-2 skew-x-[-5deg] ${owned ? 'bg-emerald-950/30 text-emerald-500 border-2 border-emerald-900/50 cursor-not-allowed'
                                            : afford ? 'bg-cyan-950/30 text-cyan-400 border-2 border-cyan-500/50 hover:bg-pink-950/30 hover:text-pink-400 hover:border-pink-500'
                                                : 'bg-cyan-950/40 text-cyan-900/90 border-2 border-cyan-900/45 cursor-not-allowed'
                                        }`}
                                >
                                    <span className="skew-x-[5deg] flex items-center gap-2">
                                        {buyingId === item.id ? (
                                            <span className="animate-pulse">İşleniyor...</span>
                                        ) : owned ? (
                                            <>
                                                <Check size={18} /> SATIN ALINDI
                                            </>
                                        ) : afford ? (
                                            'SATIN AL'
                                        ) : (
                                            'YETERSİZ BAKİYE'
                                        )}
                                    </span>
                                </button>
                            </div>

                            {/* Köşe Süsleri */}
                            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-500/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-500/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </motion.div>
                    );
                })}
            </div>

        </div>
    );
};
