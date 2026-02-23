import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, useSpring } from 'framer-motion';

export type MascotMood = 'neutral' | 'happy' | 'angry' | 'typing';

interface CyberMascotProps {
    mood: MascotMood;
    className?: string;
}

export const CyberMascot: React.FC<CyberMascotProps> = ({ mood, className = '' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const moodResetTimerRef = useRef<number | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [temporaryMood, setTemporaryMood] = useState<MascotMood | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isPressed, setIsPressed] = useState(false);
    const [pulseSeed, setPulseSeed] = useState(0);

    const activeMood = temporaryMood || mood;
    const statusText = useMemo(() => {
        switch (activeMood) {
            case 'happy':
                return 'Moral: Yüksek';
            case 'typing':
                return 'Moral: Aktif';
            case 'angry':
                return 'Moral: Kritik';
            default:
                return 'Moral: Stabil';
        }
    }, [activeMood]);

    // Smooth springs for eye movement
    const eyeX = useSpring(0, { stiffness: 200, damping: 20 });
    const eyeY = useSpring(0, { stiffness: 200, damping: 20 });
    const headRotate = useSpring(0, { stiffness: 150, damping: 15 });

    const applyMoodBoost = (nextMood: MascotMood, duration = 950) => {
        setTemporaryMood(nextMood);
        setPulseSeed((prev) => prev + 1);
        if (moodResetTimerRef.current) {
            window.clearTimeout(moodResetTimerRef.current);
        }
        moodResetTimerRef.current = window.setTimeout(() => {
            setTemporaryMood(null);
            moodResetTimerRef.current = null;
        }, duration);
    };

    const resolveLocalPointer = (clientX: number, clientY: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const nx = Math.max(-1, Math.min(1, (clientX - cx) / (rect.width / 2)));
        const ny = Math.max(-1, Math.min(1, (clientY - cy) / (rect.height / 2)));
        return { x: nx, y: ny };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isHovered) return;
            const { clientX, clientY } = e;
            const { innerWidth, innerHeight } = window;

            // Calculate normalized position -1 to 1
            const nx = (clientX / innerWidth) * 2 - 1;
            const ny = (clientY / innerHeight) * 2 - 1;

            setMousePosition({ x: nx, y: ny });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [isHovered]);

    useEffect(() => {
        return () => {
            if (moodResetTimerRef.current) {
                window.clearTimeout(moodResetTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        // Update spring targets based on mouse position
        const hoverBoost = isHovered ? 1.35 : 1;
        let targetEyeX = mousePosition.x * 6 * hoverBoost; // max eye travel 6px
        let targetEyeY = mousePosition.y * 4 * hoverBoost; // max eye travel 4px
        let targetRotate = mousePosition.x * -10 * hoverBoost; // max head rotate 10deg

        if (activeMood === 'angry') {
            targetEyeX += (Math.random() - 0.5) * 2; // subtle shaking
            targetEyeY += (Math.random() - 0.5) * 2;
        } else if (activeMood === 'happy') {
            targetEyeY = -4; // Look up/smile
        } else if (activeMood === 'typing') {
            targetEyeY = Math.min(targetEyeY, -1);
        }

        eyeX.set(targetEyeX);
        eyeY.set(targetEyeY);
        headRotate.set(targetRotate);
    }, [activeMood, eyeX, eyeY, headRotate, isHovered, mousePosition]);

    // Colors based on mood
    const getColors = () => {
        switch (activeMood) {
            case 'happy': return { eye: '#4ade80', glow: 'rgba(74, 222, 128, 0.4)' }; // neon-green
            case 'angry': return { eye: '#f43f5e', glow: 'rgba(244, 63, 94, 0.5)' }; // neon-pink
            case 'typing': return { eye: '#eab308', glow: 'rgba(234, 179, 8, 0.4)' }; // yellow
            default: return { eye: '#00f3ff', glow: 'rgba(0, 243, 255, 0.4)' }; // neon-blue
        }
    };

    const colors = getColors();

    return (
        <div
            ref={containerRef}
            className={`relative z-50 w-24 h-24 pointer-events-auto select-none ${className}`}
            role="button"
            tabIndex={0}
            aria-label="Cyber maskot"
            onPointerEnter={() => {
                setIsHovered(true);
                applyMoodBoost('happy', 1200);
            }}
            onPointerMove={(e) => {
                const local = resolveLocalPointer(e.clientX, e.clientY);
                if (local) {
                    setMousePosition(local);
                }
            }}
            onPointerLeave={() => {
                setIsHovered(false);
                setIsPressed(false);
                setTemporaryMood(null);
            }}
            onPointerDown={() => setIsPressed(true)}
            onPointerUp={() => setIsPressed(false)}
            onClick={() => applyMoodBoost(activeMood === 'angry' ? 'happy' : 'typing')}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    applyMoodBoost('typing');
                }
            }}
        >
            <motion.div
                style={{ rotateZ: headRotate, transformOrigin: 'bottom center' }}
                className="relative w-full h-full"
                animate={{ scale: isPressed ? 0.94 : 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            >

                <motion.div
                    className="absolute -inset-2 border border-cyan-300/35 pointer-events-none"
                    animate={isHovered ? { opacity: [0.25, 0.75, 0.25], scale: [0.98, 1.06, 0.98] } : { opacity: 0 }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                />

                <motion.div
                    key={pulseSeed}
                    className="absolute -inset-3 border border-fuchsia-400/45 pointer-events-none"
                    initial={{ opacity: 0.9, scale: 0.7 }}
                    animate={{ opacity: 0, scale: 1.28 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                />

                {/* Antenna */}
                <motion.div
                    animate={activeMood === 'happy' ? { y: [0, -5, 0] } : {}}
                    transition={{ repeat: Infinity, duration: 0.5 }}
                    className="absolute left-1/2 -top-6 w-1 h-6 bg-cyber-border -translate-x-1/2"
                >
                    <div className="absolute -top-2 -left-1 w-3 h-3 rounded-full bg-cyber-dark border border-cyber-border z-10" />
                    <motion.div
                        animate={activeMood === 'typing' ? { opacity: [0.2, 1, 0.2] } : { opacity: 0.8 }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="absolute -top-1.5 -left-0.5 w-2 h-2 rounded-full z-20"
                        style={{ backgroundColor: colors.eye, boxShadow: `0 0 10px ${colors.glow}` }}
                    />
                </motion.div>

                {/* Head Base */}
                <div className="absolute inset-0 bg-[#0a1834] clip-path-slant border-[3px] border-cyber-border border-b-0 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] flex flex-col items-center overflow-hidden">

                    {/* Head top screws */}
                    <div className="w-full flex justify-between px-3 pt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyber-dark border border-cyber-border/50" />
                        <div className="w-1.5 h-1.5 rounded-full bg-cyber-dark border border-cyber-border/50" />
                    </div>

                    {/* Visor */}
                    <div className="w-[85%] h-10 mt-2 bg-[#020813] border-y-2 border-x-4 border-cyber-dark relative overflow-hidden flex items-center justify-center shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]">

                        {/* Scanline inside visor */}
                        <motion.div
                            animate={{ x: ['-100%', '100%'] }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                            className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg]"
                        />

                        {/* Eyes */}
                        <motion.div
                            className="flex justify-between w-full px-2 relative z-10"
                            style={{ x: eyeX, y: eyeY }}
                        >
                            {/* Left Eye */}
                            <motion.div
                                animate={activeMood === 'happy' ? { scaleY: [1, 0.1, 1], transition: { repeat: Infinity, duration: 2, repeatDelay: 1 } } : {}}
                                className={`h-4 w-5 transition-colors duration-300`}
                                style={{
                                    backgroundColor: colors.eye,
                                    boxShadow: `0 0 15px ${colors.glow}`,
                                    clipPath: activeMood === 'angry' ? 'polygon(0 30%, 100% 0, 100% 100%, 0 100%)' : 'none'
                                }}
                            />

                            {/* Right Eye */}
                            <motion.div
                                animate={activeMood === 'happy' ? { scaleY: [1, 0.1, 1], transition: { repeat: Infinity, duration: 2, repeatDelay: 1 } } : {}}
                                className={`h-4 w-5 transition-colors duration-300`}
                                style={{
                                    backgroundColor: colors.eye,
                                    boxShadow: `0 0 15px ${colors.glow}`,
                                    clipPath: activeMood === 'angry' ? 'polygon(0 0, 100% 30%, 100% 100%, 0 100%)' : 'none'
                                }}
                            />
                        </motion.div>
                    </div>

                    {/* Mouth / Equalizer */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 h-3 items-end overflow-hidden justify-center w-8">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <motion.div
                                key={i}
                                animate={
                                    activeMood === 'typing' || activeMood === 'angry'
                                        ? { height: ['20%', '100%', '40%', '90%', '20%'] }
                                        : { height: '20%' }
                                }
                                transition={{ repeat: Infinity, duration: 0.3 + (i * 0.1), ease: "easeInOut" }}
                                className="w-1.5 transition-colors duration-300 rounded-t-[1px]"
                                style={{ backgroundColor: colors.eye }}
                            />
                        ))}
                    </div>

                    {/* Ambient scanning laser across entire face */}
                    <motion.div
                        animate={{ y: ['0%', '200%'] }}
                        transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                        className="absolute top-0 left-0 w-full h-[2px] bg-cyan-400/20 shadow-[0_0_10px_rgba(34,211,238,0.3)] pointer-events-none"
                    />

                    {/* Jaw details details */}
                    <div className="absolute bottom-2 left-2 flex gap-1 flex-col">
                        <div className="w-3 h-0.5 bg-cyber-border/40 skew-x-12" />
                        <div className="w-2 h-0.5 bg-cyber-border/40 skew-x-12" />
                    </div>
                    <div className="absolute bottom-2 right-2 flex gap-1 flex-col items-end">
                        <div className="w-3 h-0.5 bg-cyber-border/40 -skew-x-12" />
                        <div className="w-2 h-0.5 bg-cyber-border/40 -skew-x-12" />
                    </div>
                </div>
            </motion.div>
            <motion.div
                className="absolute left-1/2 -bottom-7 -translate-x-1/2 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-200 bg-[#061126]/85 border border-cyan-400/30 whitespace-nowrap pointer-events-none"
                initial={{ opacity: 0, y: 4 }}
                animate={isHovered ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
            >
                {statusText}
            </motion.div>
        </div>
    );
};
