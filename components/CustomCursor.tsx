import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

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

        const root = document.documentElement;

        const moveCursor = (e: MouseEvent) => {
            cursorX.set(e.clientX - 16);
            cursorY.set(e.clientY - 16);
            root.style.setProperty('--cursor-x', `${e.clientX}px`);
            root.style.setProperty('--cursor-y', `${e.clientY}px`);
        };

        window.addEventListener('mousemove', moveCursor);
        return () => {
            window.removeEventListener('mousemove', moveCursor);
            root.style.removeProperty('--cursor-x');
            root.style.removeProperty('--cursor-y');
        };
    }, [cursorX, cursorY]);

    if (!isVisible) return null;

    return (
        <>
            <motion.div
                className="fixed top-0 left-0 w-8 h-8 pointer-events-none z-[200] mix-blend-screen"
                style={{
                    x: cursorXSpring,
                    y: cursorYSpring,
                    filter: 'drop-shadow(0 0 4px rgba(0, 243, 255, 0.95)) drop-shadow(0 0 10px rgba(255, 0, 234, 0.72))',
                }}
            >
                <div className="relative w-full h-full flex items-center justify-center">
                    <div className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-[#ff00ea]" />
                    <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-[#00f3ff]" />
                    <div className="absolute h-3 w-3 border-2 border-[#f8fbff] bg-[#050a19]" />
                    <div className="absolute -right-1 -top-1 h-2 w-2 bg-[#ffea00]" />
                </div>
            </motion.div>
        </>
    );
};
