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
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[24rem] rf-screen-card noise-bg p-5 z-50 animate-slide-up">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
                    <Cookie size={24} />
                </div>
                <div className="flex-1">
                    <div className="rf-terminal-strip mb-2">Sistem Uyarısı</div>
                    <h3 className="text-white font-bold mb-2 uppercase tracking-[0.08em]">Çerez Politikası</h3>
                    <p className="text-[var(--rf-muted)] text-sm mb-4">
                        Size daha iyi bir deneyim sunmak ve konum doğrulaması yapabilmek için çerezleri kullanıyoruz.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={handleAccept}
                            className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-[#041226] py-2 text-sm font-bold transition-colors uppercase tracking-[0.08em]"
                        >
                            Kabul Et
                        </button>
                        <button
                            onClick={() => setIsVisible(false)}
                            className="p-2 hover:bg-white/10 text-[var(--rf-muted)] transition-colors border border-cyan-500/20"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
