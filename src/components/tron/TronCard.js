'use client';

import styles from './TronCard.module.css';

export default function TronCard({ children, className = '', glow = true, animate = true }) {
    const classes = [
        styles.card,
        glow ? styles.glow : '',
        animate ? 'animate-boot-in' : '',
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={classes}>
            {children}
        </div>
    );
}
