'use client';

import styles from './TronButton.module.css';

export default function TronButton({
    children,
    onClick,
    variant = 'primary', // 'primary' | 'secondary' | 'danger'
    size = 'md',          // 'sm' | 'md' | 'lg'
    disabled = false,
    loading = false,
    className = '',
    type = 'button',
}) {
    const classes = [
        styles.button,
        styles[variant],
        styles[size],
        loading ? styles.loading : '',
        className,
    ].filter(Boolean).join(' ');

    return (
        <button
            className={classes}
            onClick={onClick}
            disabled={disabled || loading}
            type={type}
        >
            {loading ? (
                <span className={styles.loader}>
                    <span className="tron-loader" />
                </span>
            ) : (
                children
            )}
        </button>
    );
}
