import React, { useState, useEffect } from 'react';
import { KeyRound, Navigation, Coffee, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { api } from '../lib/api';
import { User } from '../types';

interface CafeSelectionProps {
    currentUser: User;
    onCheckInSuccess: (cafeName: string, tableNumber: string, cafeId: string | number) => void;
}

export const CafeSelection: React.FC<CafeSelectionProps> = ({ currentUser, onCheckInSuccess }) => {
    const [cafes, setCafes] = useState<any[]>([]);
    const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
    const [tableNumber, setTableNumber] = useState<string>('');
    const [pin, setPin] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadCafes();
        const savedCafeId = localStorage.getItem('last_cafe_id');
        const savedTable = localStorage.getItem('last_table_number');
        if (savedCafeId) setSelectedCafeId(savedCafeId);
        if (savedTable) setTableNumber(savedTable);
    }, []);

    const loadCafes = async () => {
        try {
            const data = await api.cafes.list();
            setCafes(data);
            if (data.length > 0 && !localStorage.getItem('last_cafe_id')) {
                setSelectedCafeId(String(data[0].id));
            }
        } catch (err: any) {
            console.error("Failed to load cafes:", err);
            setError('Kafeler yüklenemedi: ' + (err.message || 'Bilinmeyen hata'));
        }
    };

    const handleCheckIn = async () => {
        if (!selectedCafeId || !tableNumber) {
            setError('Lütfen kafe ve masa numarası seçin.');
            return;
        }

        if (!pin || pin.length < 4) {
            setError('PIN kodu 4 haneli olmalıdır.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await api.cafes.checkIn({
                // userId kaldırıldı - backend token'dan alıyor
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
            setPin(''); // Clear PIN on error
        } finally {
            setLoading(false);
        }
    };

    const selectedCafe = cafes.find(c => c.id === selectedCafeId);
    const isPinValid = pin.length >= 4;

    // PIN digit display component - clickable to focus hidden input
    const PinDigitBox = ({ index }: { index: number }) => {
        const digit = pin[index];
        const isFilled = digit !== undefined;
        const isActive = index === pin.length;

        const handleClick = () => {
            const input = document.getElementById('pin-input');
            if (input) input.focus();
        };

        return (
            <div
                onClick={handleClick}
                className={`w-12 h-14 border-2 rounded-lg flex items-center justify-center text-2xl font-bold transition-all cursor-pointer
                    ${isFilled ? 'bg-green-900/30 border-green-500 text-green-400' :
                        isActive ? 'border-green-400 bg-black/40 animate-pulse' :
                            'border-gray-600 bg-black/30 text-gray-600'}`}
            >
                {isFilled ? '●' : ''}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[var(--rf-bg)] text-[var(--rf-ink)] flex items-center justify-center p-4 font-sans relative overflow-hidden">
            <div className="absolute inset-0 rf-grid opacity-[0.06] pointer-events-none" />
            <div className="max-w-md w-full bg-[linear-gradient(170deg,rgba(8,14,30,0.96),rgba(10,24,52,0.88))] border border-cyan-400/25 rounded-2xl p-8 shadow-[0_30px_70px_rgba(0,0,0,0.45)] relative overflow-hidden">

                {/* Background Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-2 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60 blur-sm"></div>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-400/35 shadow-[0_10px_25px_rgba(0,217,255,0.2)]">
                        <KeyRound size={32} className="text-cyan-300" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Kafe Giriş</h1>
                    <p className="text-[var(--rf-muted)] text-sm">Oyunlara katılmak için kafe PIN kodunu girin.</p>
                </div>

                {error && (
                    <div className="bg-red-900/20 border border-red-800 text-red-300 p-4 rounded-xl mb-6 text-sm animate-shake">
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold mb-1">Giriş Başarısız!</p>
                                <p>{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-5">
                    {/* Cafe Selection */}
                    <div>
                        <label className="block text-[var(--rf-muted)] text-sm mb-2 font-bold">Kafe Seçimi</label>
                        <div className="relative">
                            <Coffee className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <select
                                value={selectedCafeId || ''}
                                onChange={(e) => {
                                    setSelectedCafeId(e.target.value);
                                    setPin(''); // Clear PIN when cafe changes
                                    setError(null);
                                }}
                                className="w-full bg-black/40 border border-gray-600 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-cyan-400 appearance-none cursor-pointer focus:shadow-[0_0_20px_rgba(0,217,255,0.2)]"
                            >
                                {cafes.map(cafe => (
                                    <option key={cafe.id} value={cafe.id}>{cafe.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">▼</div>
                        </div>
                    </div>

                    {/* Table Number */}
                    <div>
                        <label className="block text-[var(--rf-muted)] text-sm mb-2 font-bold">Masa Numarası</label>
                        <div className="relative">
                            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                type="number"
                                placeholder={`1 - ${selectedCafe?.table_count || 20}`}
                                value={tableNumber}
                                onChange={(e) => setTableNumber(e.target.value)}
                                min="1"
                                max={selectedCafe?.table_count || 20}
                                className="w-full bg-black/40 border border-gray-600 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(0,217,255,0.2)]"
                            />
                        </div>
                    </div>

                    {/* PIN Code with Visual Boxes */}
                    <div>
                        <label className="block text-[var(--rf-muted)] text-sm mb-2 font-bold flex items-center gap-2">
                            <KeyRound size={14} />
                            Kafe PIN Kodu (4 Haneli)
                        </label>

                        {/* PIN Digit Boxes */}
                        <div className="flex gap-3 justify-center mb-3">
                            {[0, 1, 2, 3].map(i => (
                                <PinDigitBox key={i} index={i} />
                            ))}
                        </div>

                        {/* Hidden PIN Input - accessible but visually hidden */}
                        <input
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={pin}
                            onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                setPin(value);
                                if (error) setError(null);
                            }}
                            className="sr-only"
                            autoComplete="one-time-code"
                            id="pin-input"
                            aria-label="PIN kodu girişi"
                        />

                        {/* PIN Status */}
                        <div className="mt-2 flex items-center justify-center gap-2 text-sm">
                            {isPinValid ? (
                                <span className="text-green-400 flex items-center gap-1">
                                    <CheckCircle size={14} /> PIN girildi
                                </span>
                            ) : (
                                <span className="text-gray-500 flex items-center gap-1">
                                    <Info size={14} /> {4 - pin.length} hane kaldı
                                </span>
                            )}
                        </div>

                        {/* PIN Hint - KVKK compliant, no demo PIN shown */}
                            <div className="mt-3 p-3 bg-cyan-900/20 border border-cyan-700/30 rounded-lg text-center">
                            <p className="text-xs text-cyan-200">
                                PIN kodunu kafe personelinden veya masadaki etiketten öğrenin.
                            </p>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        onClick={handleCheckIn}
                        disabled={loading || !isPinValid || !tableNumber}
                        className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${loading || !isPinValid || !tableNumber
                            ? 'bg-gray-700 cursor-not-allowed opacity-50'
                            : 'bg-cyan-500 hover:bg-cyan-400 text-[#041226] shadow-lg shadow-cyan-500/30 hover:scale-[1.02] active:scale-95'
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
