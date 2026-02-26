'use client';

import styles from './TronFunnel.module.css';

const defaultStages = [
    { label: 'New', key: 'new', color: 'var(--neon-cyan)' },
    { label: 'Contacted', key: 'contacted', color: 'var(--neon-magenta)' },
    { label: 'Responded', key: 'responded', color: 'var(--neon-amber)' },
    { label: 'Meeting', key: 'meeting', color: 'var(--neon-green)' },
    { label: 'Closed', key: 'closed', color: '#fff' },
];

export default function TronFunnel({ data = {}, stages = defaultStages }) {
    const maxValue = Math.max(1, ...Object.values(data));

    return (
        <div className={styles.funnel}>
            {stages.map((stage, i) => {
                const count = data[stage.key] || 0;
                const widthPercent = (count / maxValue) * 100;

                return (
                    <div
                        key={stage.key}
                        className={styles.stage}
                        style={{ animationDelay: `${i * 0.1}s` }}
                    >
                        <div className={styles.labelRow}>
                            <span className={styles.label}>{stage.label}</span>
                            <span className={styles.count} style={{ color: stage.color }}>
                                {count}
                            </span>
                        </div>
                        <div className={styles.barTrack}>
                            <div
                                className={styles.barFill}
                                style={{
                                    '--fill-width': `${widthPercent}%`,
                                    '--bar-color': stage.color,
                                    animationDelay: `${0.3 + i * 0.1}s`,
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
