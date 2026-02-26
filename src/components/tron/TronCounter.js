'use client';

import { useEffect, useState, useRef } from 'react';
import styles from './TronCounter.module.css';

export default function TronCounter({ value = 0, duration = 1500, prefix = '', suffix = '', decimals = 0 }) {
    const [displayValue, setDisplayValue] = useState(0);
    const startTimeRef = useRef(null);
    const frameRef = useRef(null);

    useEffect(() => {
        const target = Number(value);
        if (isNaN(target)) return;

        const startValue = displayValue;
        startTimeRef.current = null;

        const animate = (timestamp) => {
            if (!startTimeRef.current) startTimeRef.current = timestamp;
            const elapsed = timestamp - startTimeRef.current;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out expo
            const easedProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            const current = startValue + (target - startValue) * easedProgress;

            setDisplayValue(current);

            if (progress < 1) {
                frameRef.current = requestAnimationFrame(animate);
            }
        };

        frameRef.current = requestAnimationFrame(animate);

        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [value, duration]);

    const formatted = decimals > 0
        ? displayValue.toFixed(decimals)
        : Math.round(displayValue).toLocaleString();

    return (
        <span className={styles.counter}>
            {prefix}{formatted}{suffix}
        </span>
    );
}
