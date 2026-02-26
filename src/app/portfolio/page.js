'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TronGrid from '@/components/tron/TronGrid';
import TronCard from '@/components/tron/TronCard';
import TronButton from '@/components/tron/TronButton';
import styles from './page.module.css';

export default function PortfolioPage() {
    const [loading, setLoading] = useState(true);
    const [showcases, setShowcases] = useState([]);
    const [expandedId, setExpandedId] = useState(null);
    const router = useRouter();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) router.push('/');
            else setLoading(false);
        });
    }, [router]);

    const fetchShowcases = useCallback(async () => {
        try {
            const res = await fetch('/api/portfolio');
            const data = await res.json();
            if (data.showcases) setShowcases(data.showcases);
        } catch (err) {
            console.error('Fetch error:', err);
        }
    }, []);

    useEffect(() => {
        if (!loading) fetchShowcases();
    }, [loading, fetchShowcases]);

    const handleDelete = async (id) => {
        try {
            await fetch(`/api/portfolio?id=${id}`, { method: 'DELETE' });
            setShowcases(prev => prev.filter(s => s.id !== id));
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const toggleExpand = (id) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    if (loading) {
        return (
            <div className={styles.loadingScreen}>
                <TronGrid />
                <div className="tron-loader tron-loader-large" style={{ position: 'relative', zIndex: 1 }} />
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <TronGrid />
            <div className={styles.container}>

                {/* Header */}
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.title}>PORTFOLIO</h1>
                        <span className={styles.subtitle}>{showcases.length} Website {showcases.length === 1 ? 'Plan' : 'Plans'} Saved</span>
                    </div>
                    <div className={styles.headerRight}>
                        <TronButton onClick={() => router.push('/saved')} variant="primary" size="sm">
                            + Create from Leads
                        </TronButton>
                        <TronButton onClick={() => router.push('/dashboard')} variant="secondary" size="sm">
                            ← Dashboard
                        </TronButton>
                    </div>
                </header>

                {/* Empty State */}
                {showcases.length === 0 ? (
                    <section className={styles.emptyState}>
                        <TronCard>
                            <div className={styles.emptyContent}>
                                <p className={styles.emptyIcon}>📸</p>
                                <p className={styles.emptyText}>No website plans yet.</p>
                                <p className={styles.emptySubtext}>
                                    Go to Saved Leads → click Case Study on any lead → answer 5 questions → your AI website blueprint will appear here.
                                </p>
                                <TronButton onClick={() => router.push('/saved')} size="sm">
                                    Go to Saved Leads →
                                </TronButton>
                            </div>
                        </TronCard>
                    </section>
                ) : (
                    <section className={styles.showcaseGrid}>
                        {showcases.map((showcase, i) => (
                            <div key={showcase.id} className={`${styles.showcaseCard} animate-boot-in delay-${Math.min(i + 1, 4)}`}>
                                <TronCard>
                                    <div className={styles.cardHeader}>
                                        <div className={styles.cardHeaderLeft}>
                                            <h3 className={styles.clientName}>{showcase.client_name}</h3>
                                            <span className={styles.industryTag}>{showcase.industry}</span>
                                        </div>
                                        <span className={styles.cardDate}>
                                            {new Date(showcase.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>

                                    {/* Plan Preview / Expanded */}
                                    {showcase.case_study && (
                                        <div className={styles.planSection}>
                                            <div
                                                className={`${styles.planContent} ${expandedId === showcase.id ? styles.planExpanded : ''}`}
                                            >
                                                {showcase.case_study.split('\n').map((line, j) => (
                                                    <p key={j} className={line.startsWith('#') ? styles.planHeading : ''}>
                                                        {line.replace(/^#+\s*/, '').replace(/\*\*/g, '')}
                                                    </p>
                                                ))}
                                            </div>
                                            <button
                                                className={styles.expandBtn}
                                                onClick={() => toggleExpand(showcase.id)}
                                            >
                                                {expandedId === showcase.id ? '▲ Collapse' : '▼ View Full Plan'}
                                            </button>
                                        </div>
                                    )}

                                    {/* Card Footer */}
                                    <div className={styles.cardFooter}>
                                        <button className={styles.deleteBtn} onClick={() => handleDelete(showcase.id)}>
                                            🗑 Delete
                                        </button>
                                    </div>
                                </TronCard>
                            </div>
                        ))}
                    </section>
                )}

            </div>
        </div>
    );
}
