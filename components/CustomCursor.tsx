import React, { useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

export const CustomCursor: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    const cursorX = useMotionValue(-100);
    const cursorY = useMotionValue(-100);

    const springConfig = { damping: 25, stiffness: 700, mass: 0.5 };
    const cursorXSpring = useSpring(cursorX, springConfig);
    const cursorYSpring = useSpring(cursorY, springConfig);

    useEffect(() => {
        // Only show on non-touch devices
        if (window.matchMedia('(pointer: coarse)').matches) return;

        setIsVisible(true);

        const moveCursor = (e: MouseEvent) => {
            cursorX.set(e.clientX - 16);
            cursorY.set(e.clientY - 16);
        };

        window.addEventListener('mousemove', moveCursor);
        return () => {
            window.removeEventListener('mousemove', moveCursor);
        };
    }, [cursorX, cursorY]);

    if (!isVisible) return null;

    return (
        <>
            <motion.div
                className="fixed top-0 left-0 w-8 h-8 pointer-events-none z-[200]"
                style={{
                    x: cursorXSpring,
                    y: cursorYSpring,
                    filter: 'drop-shadow(0 0 3px rgba(0, 243, 255, 0.9)) drop-shadow(0 0 6px rgba(255, 0, 234, 0.6))',
                }}
            >
                <div className="relative w-full h-full flex items-center justify-center">
                    {/* Hacker Crosshair Pattern */}
                    <div className="absolute w-full h-[2px] bg-neon-pink" />
                    <div className="absolute h-full w-[2px] bg-neon-pink" />
                    <div className="absolute w-2 h-2 border border-neon-blue bg-transparent" />
                </div>
            </motion.div>
        </>
    );
};
