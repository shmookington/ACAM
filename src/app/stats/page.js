'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TronGrid from '@/components/tron/TronGrid';
import TronCard from '@/components/tron/TronCard';
import TronButton from '@/components/tron/TronButton';
import styles from './page.module.css';

export default function StatsPage() {
    const [players, setPlayers] = useState({});
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activePlayer, setActivePlayer] = useState(null);
    const [userEmail, setUserEmail] = useState('');
    const router = useRouter();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) router.push('/');
            else {
                setUserEmail(session.user.email);
                // Auto-select current user
                const e = session.user.email.toLowerCase();
                if (e.includes('amiri') || e.includes('caelborne')) setActivePlayer('Amiri');
                else if (e.includes('toby')) setActivePlayer('Toby');
                else if (e.includes('yaz')) setActivePlayer('Yaz');
                else setActivePlayer('Amiri');
            }
        });
    }, [router]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/player-stats');
                const data = await res.json();
                if (data.players) setPlayers(data.players);
                if (data.leaderboard) setLeaderboard(data.leaderboard);
            } catch (err) {
                console.error('Stats fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const player = activePlayer ? players[activePlayer] : null;

    return (
        <div className={styles.page}>
            <TronGrid />
            <div className={styles.container}>
                <header className={styles.header}>
                    <div>
                        <h1 className={styles.title}>⚔️ Player Stats</h1>
                        <p className={styles.subtitle}>Personal records · Leaderboard · XP Rankings</p>
                    </div>
                    <TronButton onClick={() => router.push('/dashboard')} variant="secondary" size="sm">
                        ← Dashboard
                    </TronButton>
                </header>

                {loading ? (
                    <div className={styles.loadingState}>Loading stats...</div>
                ) : (
                    <>
                        {/* Player Selector */}
                        <div className={styles.playerSelector}>
                            {['Amiri', 'Toby', 'Yaz'].map(name => {
                                const p = players[name];
                                if (!p) return null;
                                return (
                                    <button
                                        key={name}
                                        className={`${styles.playerTab} ${activePlayer === name ? styles.playerTabActive : ''}`}
                                        style={{
                                            borderColor: activePlayer === name ? p.color : 'transparent',
                                            color: activePlayer === name ? p.color : 'var(--text-dim)',
                                        }}
                                        onClick={() => setActivePlayer(name)}
                                    >
                                        <span className={styles.playerTabAvatar}>{p.avatar}</span>
                                        <span className={styles.playerTabName}>{name}</span>
                                        <span className={styles.playerTabLevel}>LVL {p.level}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Player Profile Card */}
                        {player && (
                            <div className={styles.profileSection}>
                                <TronCard>
                                    <div className={styles.profileHeader} style={{ borderColor: player.color }}>
                                        <div className={styles.profileAvatar} style={{ borderColor: player.color }}>
                                            {player.avatar}
                                        </div>
                                        <div className={styles.profileInfo}>
                                            <h2 className={styles.profileName} style={{ color: player.color }}>{player.name}</h2>
                                            <div className={styles.profileLevel}>
                                                <span className={styles.levelBadge} style={{ borderColor: player.color, color: player.color }}>LEVEL {player.level}</span>
                                                <span className={styles.xpText}>{player.xp} XP</span>
                                            </div>
                                            <div className={styles.xpBar}>
                                                <div
                                                    className={styles.xpBarFill}
                                                    style={{
                                                        width: `${((500 - player.xpToNext) / 500) * 100}%`,
                                                        background: player.color,
                                                    }}
                                                />
                                            </div>
                                            <span className={styles.xpToNext}>{player.xpToNext} XP to next level</span>
                                        </div>
                                        {player.currentStreak > 0 && (
                                            <div className={styles.streakBadge}>
                                                <span className={styles.streakFire}>🔥</span>
                                                <span className={styles.streakCount}>{player.currentStreak}</span>
                                                <span className={styles.streakLabel}>day streak</span>
                                            </div>
                                        )}
                                    </div>
                                </TronCard>
                            </div>
                        )}

                        {/* Stats Grid */}
                        {player && (
                            <div className={styles.statsGrid}>
                                {/* All-Time Stats */}
                                <TronCard>
                                    <h3 className={styles.sectionTitle}>
                                        <span className={styles.sectionIcon}>📊</span> All-Time Stats
                                    </h3>
                                    <div className={styles.statsList}>
                                        <div className={styles.statRow}>
                                            <span className={styles.statLabel}>Leads Claimed</span>
                                            <span className={styles.statValue} style={{ color: player.color }}>{player.totalClaimed}</span>
                                        </div>
                                        <div className={styles.statRow}>
                                            <span className={styles.statLabel}>Calls Made</span>
                                            <span className={styles.statValue} style={{ color: player.color }}>{player.totalCalls}</span>
                                        </div>
                                        <div className={styles.statRow}>
                                            <span className={styles.statLabel}>Interested Leads</span>
                                            <span className={styles.statValue} style={{ color: '#00ff41' }}>{player.totalInterested}</span>
                                        </div>
                                        <div className={styles.statRow}>
                                            <span className={styles.statLabel}>Contacted</span>
                                            <span className={styles.statValue}>{player.totalContacted}</span>
                                        </div>
                                        <div className={styles.statRow}>
                                            <span className={styles.statLabel}>Meetings Set</span>
                                            <span className={styles.statValue} style={{ color: '#ffb000' }}>{player.totalMeetings}</span>
                                        </div>
                                        <div className={styles.statRow}>
                                            <span className={styles.statLabel}>Deals Closed</span>
                                            <span className={styles.statValue} style={{ color: '#ffd700' }}>{player.totalClosed}</span>
                                        </div>
                                        <div className={styles.statRow}>
                                            <span className={styles.statLabel}>Avg Lead Score</span>
                                            <span className={styles.statValue}>{player.avgLeadScore}</span>
                                        </div>
                                        <div className={styles.statRow}>
                                            <span className={styles.statLabel}>No-Website Finds</span>
                                            <span className={styles.statValue} style={{ color: '#ff3333' }}>{player.noWebsiteCount}</span>
                                        </div>
                                    </div>
                                </TronCard>

                                {/* This Week */}
                                <TronCard>
                                    <h3 className={styles.sectionTitle}>
                                        <span className={styles.sectionIcon}>📅</span> This Week
                                    </h3>
                                    <div className={styles.weekGrid}>
                                        <div className={styles.weekStat}>
                                            <span className={styles.weekVal} style={{ color: player.color }}>{player.claimedThisWeek}</span>
                                            <span className={styles.weekLabel}>Claimed</span>
                                        </div>
                                        <div className={styles.weekStat}>
                                            <span className={styles.weekVal}>{player.callsThisWeek}</span>
                                            <span className={styles.weekLabel}>Calls</span>
                                        </div>
                                        <div className={styles.weekStat}>
                                            <span className={styles.weekVal} style={{ color: '#00ff41' }}>{player.interestedThisWeek}</span>
                                            <span className={styles.weekLabel}>Interested</span>
                                        </div>
                                        <div className={styles.weekStat}>
                                            <span className={styles.weekVal}>{player.claimedToday}</span>
                                            <span className={styles.weekLabel}>Today</span>
                                        </div>
                                    </div>
                                </TronCard>

                                {/* Personal Records */}
                                <TronCard>
                                    <h3 className={styles.sectionTitle}>
                                        <span className={styles.sectionIcon}>🏆</span> Personal Records
                                    </h3>
                                    <div className={styles.recordsList}>
                                        <div className={styles.recordRow}>
                                            <div className={styles.recordInfo}>
                                                <span className={styles.recordIcon}>📈</span>
                                                <span className={styles.recordLabel}>Most Leads in a Day</span>
                                            </div>
                                            <div className={styles.recordValue}>
                                                <span className={styles.recordNum} style={{ color: player.color }}>{player.bestDayClaimed.count}</span>
                                                {player.bestDayClaimed.date && <span className={styles.recordDate}>{new Date(player.bestDayClaimed.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                                            </div>
                                        </div>
                                        <div className={styles.recordRow}>
                                            <div className={styles.recordInfo}>
                                                <span className={styles.recordIcon}>📞</span>
                                                <span className={styles.recordLabel}>Most Calls in a Day</span>
                                            </div>
                                            <div className={styles.recordValue}>
                                                <span className={styles.recordNum} style={{ color: player.color }}>{player.bestDayCalls.count}</span>
                                                {player.bestDayCalls.date && <span className={styles.recordDate}>{new Date(player.bestDayCalls.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                                            </div>
                                        </div>
                                        <div className={styles.recordRow}>
                                            <div className={styles.recordInfo}>
                                                <span className={styles.recordIcon}>🎯</span>
                                                <span className={styles.recordLabel}>Most Interested in a Day</span>
                                            </div>
                                            <div className={styles.recordValue}>
                                                <span className={styles.recordNum} style={{ color: '#00ff41' }}>{player.bestDayInterested.count}</span>
                                                {player.bestDayInterested.date && <span className={styles.recordDate}>{new Date(player.bestDayInterested.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                                            </div>
                                        </div>
                                        <div className={styles.recordRow}>
                                            <div className={styles.recordInfo}>
                                                <span className={styles.recordIcon}>🔥</span>
                                                <span className={styles.recordLabel}>Best Streak</span>
                                            </div>
                                            <div className={styles.recordValue}>
                                                <span className={styles.recordNum} style={{ color: '#ff8c00' }}>{player.bestStreak}</span>
                                                <span className={styles.recordDate}>days</span>
                                            </div>
                                        </div>
                                        <div className={styles.recordRow}>
                                            <div className={styles.recordInfo}>
                                                <span className={styles.recordIcon}>📊</span>
                                                <span className={styles.recordLabel}>Interest Rate</span>
                                            </div>
                                            <div className={styles.recordValue}>
                                                <span className={styles.recordNum} style={{ color: player.interestRate >= 30 ? '#00ff41' : '#ffb000' }}>{player.interestRate}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </TronCard>

                                {/* Top Industries */}
                                <TronCard>
                                    <h3 className={styles.sectionTitle}>
                                        <span className={styles.sectionIcon}>🏢</span> Top Industries
                                    </h3>
                                    {player.topCategories.length === 0 ? (
                                        <p className={styles.emptyNote}>No categories tracked yet</p>
                                    ) : (
                                        <div className={styles.categoryList}>
                                            {player.topCategories.map((cat, i) => (
                                                <div key={cat.category} className={styles.categoryRow}>
                                                    <span className={styles.categoryRank}>#{i + 1}</span>
                                                    <span className={styles.categoryName}>{cat.category}</span>
                                                    <span className={styles.categoryCount} style={{ color: player.color }}>{cat.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TronCard>
                            </div>
                        )}

                        {/* Leaderboard */}
                        <section className={styles.leaderboardSection}>
                            <h2 className={styles.leaderboardTitle}>
                                <span>🏆</span> TEAM LEADERBOARD
                            </h2>
                            <div className={styles.leaderboardGrid}>
                                {leaderboard.map((p, i) => (
                                    <div key={p.name} className={styles.leaderboardCard} style={{ borderColor: i === 0 ? '#ffd700' : p.color }}>
                                        <div className={styles.lbRank}>
                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                                        </div>
                                        <div className={styles.lbAvatar} style={{ borderColor: p.color }}>{p.avatar}</div>
                                        <h3 className={styles.lbName} style={{ color: p.color }}>{p.name}</h3>
                                        <div className={styles.lbLevel}>LVL {p.level} · {p.xp} XP</div>
                                        <div className={styles.lbStats}>
                                            <div className={styles.lbStatItem}>
                                                <span className={styles.lbStatVal}>{p.totalClaimed}</span>
                                                <span className={styles.lbStatLabel}>Leads</span>
                                            </div>
                                            <div className={styles.lbStatItem}>
                                                <span className={styles.lbStatVal}>{p.totalCalls}</span>
                                                <span className={styles.lbStatLabel}>Calls</span>
                                            </div>
                                            <div className={styles.lbStatItem}>
                                                <span className={styles.lbStatVal}>{p.totalInterested}</span>
                                                <span className={styles.lbStatLabel}>Interest</span>
                                            </div>
                                            <div className={styles.lbStatItem}>
                                                <span className={styles.lbStatVal}>{p.interestRate}%</span>
                                                <span className={styles.lbStatLabel}>Rate</span>
                                            </div>
                                        </div>
                                        <div className={styles.lbXpBar}>
                                            <div className={styles.lbXpFill} style={{ width: `${((500 - p.xpToNext) / 500) * 100}%`, background: p.color }} />
                                        </div>
                                        <div className={styles.lbFooter}>
                                            {p.currentStreak > 0 && <span className={styles.lbStreak}>🔥 {p.currentStreak}d streak</span>}
                                            <span className={styles.lbWeek}>+{p.claimedThisWeek} this week</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
