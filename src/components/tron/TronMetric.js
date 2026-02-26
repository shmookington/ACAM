'use client';

import styles from './TronMetric.module.css';
import TronCounter from './TronCounter';

export default function TronMetric({ label, value, prefix = '', suffix = '', icon = null, trend = null }) {
    return (
        <div className={styles.metric}>
            {icon && <div className={styles.icon}>{icon}</div>}
            <div className={styles.value}>
                <TronCounter value={value} prefix={prefix} suffix={suffix} />
            </div>
            <div className={styles.label}>{label}</div>
            {trend !== null && (
                <div className={`${styles.trend} ${trend >= 0 ? styles.trendUp : styles.trendDown}`}>
                    {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
                </div>
            )}
        </div>
    );
}
