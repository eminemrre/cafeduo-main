import React, { useState, useEffect } from 'react';
import { KeyRound, Navigation, Coffee, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { User } from '../types';

interface CafeSelectionProps {
    currentUser: User;
    onCheckInSuccess: (cafeName: string, tableNumber: string, cafeId: number) => void;
}

export const CafeSelection: React.FC<CafeSelectionProps> = ({ currentUser, onCheckInSuccess }) => {
    const [cafes, setCafes] = useState<any[]>([]);
    const [selectedCafeId, setSelectedCafeId] = useState<number | null>(null);
    const [tableNumber, setTableNumber] = useState<string>('');
    const [pin, setPin] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadCafes();
        const savedCafeId = localStorage.getItem('last_cafe_id');
        const savedTable = localStorage.getItem('last_table_number');
        if (savedCafeId) setSelectedCafeId(parseInt(savedCafeId));
        if (savedTable) setTableNumber(savedTable);
    }, []);

    const loadCafes = async () => {
        try {
            const data = await api.cafes.list();
            setCafes(data);
            if (data.length > 0 && !localStorage.getItem('last_cafe_id')) {
                setSelectedCafeId(data[0].id);
            }
        } catch (err) {
            console.error("Failed to load cafes");
        }
    };

    const handleCheckIn = async () => {
        if (!selectedCafeId || !tableNumber) {
            setError('Lütfen kafe ve masa numarası seçin.');
            return;
        }

        if (!pin || pin.length < 4) {
            setError('Lütfen 4-6 haneli PIN kodunu girin.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await api.cafes.checkIn({
                userId: currentUser.id,
                cafeId: selectedCafeId,
                tableNumber: parseInt(tableNumber),
                pin: pin
            });

            onCheckInSuccess(res.cafeName, res.table, selectedCafeId);
            localStorage.setItem('last_cafe_id', selectedCafeId.toString());
            localStorage.setItem('last_table_number', tableNumber);
        } catch (err: any) {
            let msg = err.message || 'Check-in başarısız.';
            if (msg === 'Failed to fetch' || msg === 'Load failed') {
                msg = 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.';
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const selectedCafe = cafes.find(c => c.id === selectedCafeId);

    return (
        <div className="min-h-screen bg-[#0f141a] flex items-center justify-center p-4 font-sans">
            <div className="max-w-md w-full bg-[#1a1f2e] border border-gray-700 rounded-2xl p-8 shadow-2xl relative overflow-hidden">

                {/* Background Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-2 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50 blur-sm"></div>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
                        <KeyRound size={32} className="text-green-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Kafe Giriş</h1>
                    <p className="text-gray-400 text-sm">Oyunlara katılmak için kafe PIN kodunu girin.</p>
                </div>

                {error && (
                    <div className="bg-red-900/20 border border-red-800 text-red-300 p-4 rounded-xl mb-6 text-sm">
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                <div className="space-y-5">
                    {/* Cafe Selection */}
                    <div>
                        <label className="block text-gray-400 text-sm mb-2 font-bold">Kafe Seçimi</label>
                        <div className="relative">
                            <Coffee className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <select
                                value={selectedCafeId || ''}
                                onChange={(e) => setSelectedCafeId(parseInt(e.target.value))}
                                className="w-full bg-black/40 border border-gray-600 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-green-500 appearance-none"
                            >
                                {cafes.map(cafe => (
                                    <option key={cafe.id} value={cafe.id}>{cafe.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Table Number */}
                    <div>
                        <label className="block text-gray-400 text-sm mb-2 font-bold">Masa Numarası</label>
                        <div className="relative">
                            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                type="number"
                                placeholder={`1 - ${selectedCafe?.table_count || 20}`}
                                value={tableNumber}
                                onChange={(e) => setTableNumber(e.target.value)}
                                min="1"
                                max={selectedCafe?.table_count || 20}
                                className="w-full bg-black/40 border border-gray-600 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-green-500"
                            />
                        </div>
                    </div>

                    {/* PIN Code */}
                    <div>
                        <label className="block text-gray-400 text-sm mb-2 font-bold">Kafe PIN Kodu</label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                type="text"
                                placeholder="Kafe personelinden isteyin"
                                value={pin}
                                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                maxLength={6}
                                className="w-full bg-black/40 border border-gray-600 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-green-500 text-center tracking-widest text-xl font-mono"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1 text-center">
                            PIN kodunu kafe personelinden veya masadaki etiketten öğrenebilirsiniz.
                        </p>
                    </div>

                    {/* Submit Button */}
                    <button
                        onClick={handleCheckIn}
                        disabled={loading || !pin || !tableNumber}
                        className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${loading || !pin || !tableNumber
                                ? 'bg-gray-700 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-600/30 hover:scale-[1.02]'
                            }`}
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Doğrulanıyor...
                            </>
                        ) : (
                            <>
                                <KeyRound size={20} />
                                GİRİŞ YAP & OYNA
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
