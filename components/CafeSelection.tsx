import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Coffee, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { User } from '../types';

interface CafeSelectionProps {
    currentUser: User;
    onCheckInSuccess: (cafeName: string) => void;
}

export const CafeSelection: React.FC<CafeSelectionProps> = ({ currentUser, onCheckInSuccess }) => {
    const [cafes, setCafes] = useState<any[]>([]);
    const [selectedCafeId, setSelectedCafeId] = useState<number | null>(null);
    const [tableNumber, setTableNumber] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'found' | 'denied'>('idle');

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
            // Only set default if no saved cafe
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

        setLoading(true);
        setError(null);
        setLocationStatus('locating');

        if (!navigator.geolocation) {
            setError('Tarayıcınız konum servisini desteklemiyor.');
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                setLocationStatus('found');
                try {
                    const res = await api.cafes.checkIn({
                        userId: currentUser.id,
                        cafeId: selectedCafeId,
                        tableNumber: parseInt(tableNumber),
                        userLat: position.coords.latitude,
                        userLon: position.coords.longitude
                    });

                    onCheckInSuccess(res.cafeName);
                    localStorage.setItem('last_cafe_id', selectedCafeId.toString());
                    localStorage.setItem('last_table_number', tableNumber);
                } catch (err: any) {
                    setError(err.message || 'Check-in başarısız.');
                } finally {
                    setLoading(false);
                }
            },
            (err) => {
                console.error(err);
                setLocationStatus('denied');
                setError('Konum izni verilmedi. Giriş yapmak için konumunuzu paylaşmalısınız.');
                setLoading(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const selectedCafe = cafes.find(c => c.id === selectedCafeId);

    return (
        <div className="min-h-screen bg-[#0f141a] flex items-center justify-center p-4 font-sans">
            <div className="max-w-md w-full bg-[#1a1f2e] border border-gray-700 rounded-2xl p-8 shadow-2xl relative overflow-hidden">

                {/* Background Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-2 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50 blur-sm"></div>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                        <MapPin size={32} className="text-blue-400 animate-bounce" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Konum Doğrulama</h1>
                    <p className="text-gray-400 text-sm">Oyunlara katılmak için lütfen bulunduğunuz kafeyi ve masayı seçin.</p>
                </div>

                {error && (
                    <div className="bg-red-900/20 border border-red-800 text-red-300 p-4 rounded-xl mb-6 flex items-start gap-3 text-sm">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                        {error}
                    </div>
                )}

                <div className="space-y-6">
                    <div>
                        <label className="block text-gray-400 text-sm mb-2 font-bold">Kafe Seçimi</label>
                        <div className="relative">
                            <Coffee className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <select
                                value={selectedCafeId || ''}
                                onChange={(e) => setSelectedCafeId(parseInt(e.target.value))}
                                className="w-full bg-black/40 border border-gray-600 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-blue-500 appearance-none"
                            >
                                {cafes.map(cafe => (
                                    <option key={cafe.id} value={cafe.id}>{cafe.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

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
                                className="w-full bg-black/40 border border-gray-600 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleCheckIn}
                        disabled={loading}
                        className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${loading
                            ? 'bg-gray-700 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 hover:scale-[1.02]'
                            }`}
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                {locationStatus === 'locating' ? 'Konum Alınıyor...' : 'Doğrulanıyor...'}
                            </>
                        ) : (
                            <>
                                <MapPin size={20} />
                                GİRİŞ YAP & OYNA
                            </>
                        )}
                    </button>

                    <p className="text-center text-xs text-gray-600">
                        *Konum servislerinin açık olduğundan emin olun.
                    </p>
                </div>
            </div>
        </div>
    );
};
