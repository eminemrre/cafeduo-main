import React, { useState, useEffect } from 'react';

interface ABTestProps {
    testName: string;
    variantA: React.ReactNode;
    variantB: React.ReactNode;
}

export const ABTest: React.FC<ABTestProps> = ({ testName, variantA, variantB }) => {
    const [variant, setVariant] = useState<'A' | 'B' | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') {
            setVariant('A');
            return;
        }

        try {
            const storedVariant = window.localStorage.getItem(`ab_test_${testName}`);
            if (storedVariant === 'A' || storedVariant === 'B') {
                setVariant(storedVariant);
                return;
            }

            const newVariant = Math.random() > 0.5 ? 'A' : 'B';
            window.localStorage.setItem(`ab_test_${testName}`, newVariant);
            setVariant(newVariant);

            if (process.env.NODE_ENV === 'development') {
                console.log(`📊 A/B Test Exposure: ${testName} -> Variant ${newVariant}`);
            }
        } catch {
            // Fallback to deterministic default when storage is unavailable.
            setVariant('A');
        }
    }, [testName]);

    if (variant === null) return null;
    return <>{variant === 'A' ? variantA : variantB}</>;
};
