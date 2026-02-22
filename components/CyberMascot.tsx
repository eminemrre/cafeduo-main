import React, { useEffect, useState, useRef } from 'react';
import { motion, useSpring } from 'framer-motion';

export type MascotMood = 'neutral' | 'happy' | 'angry' | 'typing';

interface CyberMascotProps {
    mood: MascotMood;
    className?: string;
}

export const CyberMascot: React.FC<CyberMascotProps> = ({ mood, className = '' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    // Smooth springs for eye movement
    const eyeX = useSpring(0, { stiffness: 200, damping: 20 });
    const eyeY = useSpring(0, { stiffness: 200, damping: 20 });
    const headRotate = useSpring(0, { stiffness: 150, damping: 15 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const { clientX, clientY } = e;
            const { innerWidth, innerHeight } = window;

            // Calculate normalized position -1 to 1
            const nx = (clientX / innerWidth) * 2 - 1;
            const ny = (clientY / innerHeight) * 2 - 1;

            setMousePosition({ x: nx, y: ny });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useEffect(() => {
        // Update spring targets based on mouse position
        let targetEyeX = mousePosition.x * 6; // max eye travel 6px
        let targetEyeY = mousePosition.y * 4; // max eye travel 4px
        let targetRotate = mousePosition.x * -10; // max head rotate 10deg

        if (mood === 'angry') {
            targetEyeX += (Math.random() - 0.5) * 2; // subtle shaking
            targetEyeY += (Math.random() - 0.5) * 2;
        } else if (mood === 'happy') {
            targetEyeY = -4; // Look up/smile
        }

        eyeX.set(targetEyeX);
        eyeY.set(targetEyeY);
        headRotate.set(targetRotate);
    }, [mousePosition, mood, eyeX, eyeY, headRotate]);

    // Colors based on mood
    const getColors = () => {
        switch (mood) {
            case 'happy': return { eye: '#4ade80', glow: 'rgba(74, 222, 128, 0.4)' }; // neon-green
            case 'angry': return { eye: '#f43f5e', glow: 'rgba(244, 63, 94, 0.5)' }; // neon-pink
            case 'typing': return { eye: '#eab308', glow: 'rgba(234, 179, 8, 0.4)' }; // yellow
            default: return { eye: '#00f3ff', glow: 'rgba(0, 243, 255, 0.4)' }; // neon-blue
        }
    };

    const colors = getColors();

    return (
        <div ref={containerRef} className={`relative z-50 pointer-events-none w-24 h-24 ${className}`}>
            <motion.div style={{ rotateZ: headRotate, transformOrigin: 'bottom center' }} className="relative w-full h-full">
                {/* Antenna */}
                <motion.div
                    animate={mood === 'happy' ? { y: [0, -5, 0] } : {}}
                    transition={{ repeat: Infinity, duration: 0.5 }}
                    className="absolute left-1/2 -top-6 w-1 h-6 bg-cyber-border -translate-x-1/2"
                >
                    <div className="absolute -top-2 -left-1 w-3 h-3 rounded-full bg-cyber-dark border border-cyber-border z-10" />
                    <motion.div
                        animate={mood === 'typing' ? { opacity: [0.2, 1, 0.2] } : { opacity: 0.8 }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="absolute -top-1.5 -left-0.5 w-2 h-2 rounded-full z-20"
                        style={{ backgroundColor: colors.eye, boxShadow: `0 0 10px ${colors.glow}` }}
                    />
                </motion.div>

                {/* Head Base */}
                <div className="absolute inset-0 bg-[#0a1834] clip-path-slant border-[3px] border-cyber-border border-b-0 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden">

                    {/* Visor */}
                    <div className="w-[85%] h-10 mt-2 bg-[#020813] border-y-2 border-x-4 border-cyber-dark relative overflow-hidden flex items-center justify-center">

                        {/* Scanline inside visor */}
                        <motion.div
                            animate={{ x: ['-100%', '100%'] }}
                            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                            className="absolute top-0 bottom-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                        />

                        {/* Eyes */}
                        <motion.div
                            className="flex justify-between w-full px-2 relative z-10"
                            style={{ x: eyeX, y: eyeY }}
                        >
                            {/* Left Eye */}
                            <motion.div
                                animate={mood === 'happy' ? { scaleY: [1, 0.1, 1], transition: { repeat: Infinity, duration: 2, repeatDelay: 1 } } : {}}
                                className={`h-4 w-5 transition-colors duration-300`}
                                style={{
                                    backgroundColor: colors.eye,
                                    boxShadow: `0 0 15px ${colors.glow}`,
                                    clipPath: mood === 'angry' ? 'polygon(0 30%, 100% 0, 100% 100%, 0 100%)' : 'none'
                                }}
                            />

                            {/* Right Eye */}
                            <motion.div
                                animate={mood === 'happy' ? { scaleY: [1, 0.1, 1], transition: { repeat: Infinity, duration: 2, repeatDelay: 1 } } : {}}
                                className={`h-4 w-5 transition-colors duration-300`}
                                style={{
                                    backgroundColor: colors.eye,
                                    boxShadow: `0 0 15px ${colors.glow}`,
                                    clipPath: mood === 'angry' ? 'polygon(0 0, 100% 30%, 100% 100%, 0 100%)' : 'none'
                                }}
                            />
                        </motion.div>
                    </div>

                    {/* Jaw lines / details */}
                    <div className="absolute bottom-2 left-2 flex gap-1">
                        <div className="w-1 h-3 bg-cyber-border/50" />
                        <div className="w-1 h-3 bg-cyber-border/50" />
                        <div className="w-1 h-3 bg-cyber-border/50" />
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
