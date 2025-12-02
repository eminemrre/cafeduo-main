import React, { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';

export const CookieConsent: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('cookie_consent');
        if (!consent) {
            setIsVisible(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('cookie_consent', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-[#1a1f2e] border border-gray-700 p-6 rounded-2xl shadow-2xl z-50 animate-slide-up">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-900/30 rounded-xl text-blue-400">
                    <Cookie size={24} />
                </div>
                <div className="flex-1">
                    <h3 className="text-white font-bold mb-2">Çerez Politikası</h3>
                    <p className="text-gray-400 text-sm mb-4">
                        Size daha iyi bir deneyim sunmak ve konum doğrulaması yapabilmek için çerezleri kullanıyoruz.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={handleAccept}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-bold transition-colors"
                        >
                            Kabul Et
                        </button>
                        <button
                            onClick={() => setIsVisible(false)}
                            className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
