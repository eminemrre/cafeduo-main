import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CyberGlitchScreenProps {
    isWinner: boolean;
    earnedPoints: number;
    onComplete: () => void;
}

export const CyberGlitchScreen: React.FC<CyberGlitchScreenProps> = ({ isWinner, earnedPoints, onComplete }) => {
    const [show, setShow] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShow(false);
            setTimeout(onComplete, 600); // fade out duration
        }, 3500); // show duration
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                    animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
                    exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-cyber-dark/80 noise-bg"
                >
                    {/* Brutalist Border Frame */}
                    <div className={`absolute inset-4 border-4 pointer-events-none mix-blend-overlay ${isWinner ? 'border-neon-green' : 'border-neon-pink'}`} />

                    {/* Glitch Container */}
                    <div className="relative text-center">
                        {isWinner ? (
                            <motion.div
                                initial={{ scale: 0.8, y: 50, skewX: 10 }}
                                animate={{ scale: 1, y: 0, skewX: 0 }}
                                transition={{ type: 'spring', damping: 12 }}
                                className="relative"
                            >
                                <h1 className="font-display text-[6rem] md:text-[10rem] text-neon-green uppercase tracking-tighter text-shadow-glitch mix-blend-screen leading-none">
                                    ZAFER
                                </h1>
                                <p className="mt-4 font-sans text-2xl font-bold text-white bg-neon-green/20 border border-neon-green py-2 px-6 inline-block">
                                    +{earnedPoints} PUAN KAZANILDI
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ scale: 1.2, y: -50, skewX: -10 }}
                                animate={{ scale: 1, y: 0, skewX: 0 }}
                                transition={{ type: 'spring', damping: 10 }}
                                className="relative"
                            >
                                <h1 className="font-display text-[5rem] md:text-[8rem] text-neon-pink uppercase tracking-tighter text-shadow-glitch mix-blend-screen leading-none">
                                    MAĞLUBİYET
                                </h1>
                                <p className="mt-4 font-sans text-xl font-bold text-ink-300 border-b-2 border-neon-pink pb-1 uppercase tracking-widest inline-block">
                                    SİSTEM DIŞI KALDIN
                                </p>
                            </motion.div>
                        )}

                        {/* Scanline Effect */}
                        <motion.div
                            className={`absolute -inset-20 opacity-20 pointer-events-none ${isWinner ? 'bg-neon-green' : 'bg-neon-pink'}`}
                            animate={{ y: ['-100%', '100%'] }}
                            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                            style={{ height: '2px', boxShadow: `0 0 20px 4px ${isWinner ? '#4ade80' : '#f43f5e'}` }}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
