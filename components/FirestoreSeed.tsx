import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';

export const FirestoreSeed: React.FC = () => {
    const [status, setStatus] = useState<string[]>([]);
    const [isSeeding, setIsSeeding] = useState(false);
    const [isDone, setIsDone] = useState(false);

    const addLog = (msg: string) => {
        setStatus(prev => [...prev, msg]);
    };

    const seedDatabase = async () => {
        setIsSeeding(true);
        setStatus([]);

        try {
            // 1. SEED CAFES
            addLog('📍 Kafeler oluşturuluyor...');
            const cafes = [
                { id: 'iibf-kantin', name: 'İİBF Kantini', daily_pin: '1234', table_count: 20 },
                { id: 'muhendislik-kantin', name: 'Mühendislik Kantini', daily_pin: '5678', table_count: 15 },
                { id: 'merkez-kantin', name: 'Merkez Kantin', daily_pin: '9999', table_count: 30 },
            ];

            for (const cafe of cafes) {
                await setDoc(doc(db, 'cafes', cafe.id), {
                    name: cafe.name,
                    daily_pin: cafe.daily_pin,
                    table_count: cafe.table_count,
                    createdAt: new Date()
                });
                addLog(`  ✅ ${cafe.name} oluşturuldu`);
            }

            // 2. SEED REWARDS
            addLog('🎁 Ödüller oluşturuluyor...');
            const rewards = [
                { id: 'reward-coffee', title: 'Bedava Kahve', cost: 100, type: 'coffee', icon: '☕' },
                { id: 'reward-discount', title: '%20 İndirim', cost: 50, type: 'discount', icon: '🏷️' },
                { id: 'reward-dessert', title: 'Bedava Tatlı', cost: 150, type: 'dessert', icon: '🍰' },
                { id: 'reward-sandwich', title: 'Bedava Sandviç', cost: 200, type: 'food', icon: '🥪' },
            ];

            for (const reward of rewards) {
                await setDoc(doc(db, 'rewards', reward.id), {
                    title: reward.title,
                    cost: reward.cost,
                    type: reward.type,
                    icon: reward.icon,
                    createdAt: new Date()
                });
                addLog(`  ✅ ${reward.title} oluşturuldu`);
            }

            addLog('');
            addLog('✨ VERİ EKLEME TAMAMLANDI!');
            addLog('');
            addLog('Test PIN kodları:');
            addLog('  İİBF Kantini: 1234');
            addLog('  Mühendislik Kantini: 5678');
            addLog('  Merkez Kantin: 9999');

            setIsDone(true);
        } catch (error: any) {
            addLog(`❌ HATA: ${error.message}`);
            console.error(error);
        } finally {
            setIsSeeding(false);
        }
    };

    const checkData = async () => {
        setStatus([]);
        addLog('🔍 Mevcut veriler kontrol ediliyor...');

        try {
            const cafesSnap = await getDocs(collection(db, 'cafes'));
            addLog(`📍 Kafeler: ${cafesSnap.size} adet`);
            cafesSnap.docs.forEach(doc => {
                addLog(`   - ${doc.data().name} (PIN: ${doc.data().daily_pin})`);
            });

            const rewardsSnap = await getDocs(collection(db, 'rewards'));
            addLog(`🎁 Ödüller: ${rewardsSnap.size} adet`);
            rewardsSnap.docs.forEach(doc => {
                addLog(`   - ${doc.data().title} (${doc.data().cost} puan)`);
            });
        } catch (error: any) {
            addLog(`❌ HATA: ${error.message}`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold mb-8 text-center">🔥 Firestore Veri Yönetimi</h1>

                <div className="flex gap-4 mb-8 justify-center">
                    <button
                        onClick={seedDatabase}
                        disabled={isSeeding || isDone}
                        className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 px-6 py-3 rounded-lg font-bold transition-colors"
                    >
                        {isSeeding ? '⏳ Ekleniyor...' : isDone ? '✅ Tamamlandı' : '🚀 Verileri Ekle'}
                    </button>

                    <button
                        onClick={checkData}
                        disabled={isSeeding}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 px-6 py-3 rounded-lg font-bold transition-colors"
                    >
                        🔍 Kontrol Et
                    </button>
                </div>

                <div className="bg-black/50 rounded-xl p-6 font-mono text-sm min-h-[300px] border border-gray-700">
                    {status.length === 0 ? (
                        <p className="text-gray-500">Butona tıklayarak başla...</p>
                    ) : (
                        status.map((line, i) => (
                            <div key={i} className={line.includes('❌') ? 'text-red-400' : line.includes('✅') ? 'text-green-400' : 'text-gray-300'}>
                                {line}
                            </div>
                        ))
                    )}
                </div>

                {isDone && (
                    <div className="mt-8 text-center">
                        <a href="/" className="bg-purple-600 hover:bg-purple-500 px-8 py-3 rounded-lg font-bold inline-block">
                            🏠 Ana Sayfaya Dön
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
};
