'use client';

import styles from './TronTerminal.module.css';

export default function TronTerminal({ entries = [], title = 'SYSTEM LOG', maxEntries = 20 }) {
    const visibleEntries = entries.slice(-maxEntries);

    return (
        <div className={styles.terminal}>
            <div className={styles.header}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.title}>{title}</span>
            </div>
            <div className={styles.body}>
                {visibleEntries.length === 0 ? (
                    <div className={styles.empty}>
                        <span className={styles.cursor}>_</span> Awaiting data...
                    </div>
                ) : (
                    visibleEntries.map((entry, i) => (
                        <div
                            key={entry.id || i}
                            className={styles.entry}
                            style={{ animationDelay: `${i * 0.05}s` }}
                        >
                            <span className={styles.timestamp}>
                                {entry.time || new Date().toLocaleTimeString()}
                            </span>
                            <span className={styles.separator}>│</span>
                            <span className={`${styles.message} ${entry.type === 'success' ? styles.success : ''} ${entry.type === 'warning' ? styles.warning : ''} ${entry.type === 'error' ? styles.error : ''}`}>
                                {entry.message}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
