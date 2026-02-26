'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TronGrid from '@/components/tron/TronGrid';
import TronCard from '@/components/tron/TronCard';
import TronButton from '@/components/tron/TronButton';
import TronMetric from '@/components/tron/TronMetric';
import TronFunnel from '@/components/tron/TronFunnel';
import TronTerminal from '@/components/tron/TronTerminal';
import styles from './page.module.css';

export default function DashboardPage() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState('');
    const [metrics, setMetrics] = useState({
        totalLeads: 0, leadsThisWeek: 0, emailsSent: 0,
        emailsThisWeek: 0, responseRate: 0, meetingsBooked: 0, clientsClosed: 0,
        drafts: 0, approved: 0,
    });
    const [pipeline, setPipeline] = useState({ new: 0, contacted: 0, responded: 0, meeting: 0, closed: 0 });
    const [activity, setActivity] = useState([]);
    const [intelligence, setIntelligence] = useState({ topPicks: [], easyWins: [], hotLeads: [] });
    const [callTracking, setCallTracking] = useState({ totalCalls: 0, callsThisWeek: 0, callInterestRate: 0, outcomes: {}, industryStats: [], recentCalls: [] });
    const [callbacks, setCallbacks] = useState({ dueToday: [], overdue: [], upcoming: [] });
    const [tooltip, setTooltip] = useState(null);
    const [prospectSheet, setProspectSheet] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState(null);
    const [showAccountMenu, setShowAccountMenu] = useState(false);
    const [team, setTeam] = useState({ leaderboard: [], totalClaimed: 0, totalUnclaimed: 0 });
    const notifiedRef = useRef(false);
    const router = useRouter();

    // Auth check
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) { router.push('/'); }
            else { setSession(session); setLoading(false); }
        });
    }, [router]);

    // Live clock
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch live stats
    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            if (data.metrics) setMetrics(data.metrics);
            if (data.pipeline) setPipeline(data.pipeline);
            if (data.activity) setActivity(data.activity);
            if (data.intelligence) setIntelligence(data.intelligence);
            if (data.callTracking) setCallTracking(data.callTracking);
            if (data.callbacks) setCallbacks(data.callbacks);
            if (data.team) setTeam(data.team);
        } catch (err) {
            console.error('Stats fetch error:', err);
        }
    }, []);

    useEffect(() => {
        if (!loading) {
            fetchStats();
            // Refresh every 30 seconds
            const interval = setInterval(fetchStats, 30000);
            return () => clearInterval(interval);
        }
    }, [loading, fetchStats]);

    // Browser notifications for callbacks
    useEffect(() => {
        if (notifiedRef.current) return;
        const total = callbacks.overdue.length + callbacks.dueToday.length;
        if (total === 0) return;

        notifiedRef.current = true;

        if ('Notification' in window) {
            const showNotification = () => {
                const overdueCount = callbacks.overdue.length;
                const todayCount = callbacks.dueToday.length;
                let body = '';
                if (overdueCount > 0) body += `⚠️ ${overdueCount} overdue! `;
                if (todayCount > 0) body += `📞 ${todayCount} due today: ${callbacks.dueToday.map(c => c.business_name).join(', ')}`;
                new Notification('ACAM — Callback Reminders', { body, icon: '/favicon.ico' });
            };

            if (Notification.permission === 'granted') {
                showNotification();
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(p => {
                    if (p === 'granted') showNotification();
                });
            }
        }
    }, [callbacks]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    if (loading) {
        return (
            <div className={styles.loadingScreen}>
                <TronGrid />
                <div className="tron-loader tron-loader-large" style={{ position: 'relative', zIndex: 1 }} />
            </div>
        );
    }

    // Default activity if nothing has happened yet
    const displayActivity = activity.length > 0 ? activity : [
        { id: 1, time: currentTime || '00:00:00', message: 'ACAM initialized. All systems online.', type: 'success' },
        { id: 2, time: currentTime || '00:00:00', message: 'Awaiting first scan command...', type: '' },
    ];

    return (
        <div className={styles.page}>
            <TronGrid />
            <div className={styles.container}>

                {/* Header */}
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        <h1 className={styles.logo}>ACAM</h1>
                        <div className={styles.systemStatus}>
                            <span className={styles.statusDot} />
                            <span>ALL SYSTEMS ONLINE</span>
                        </div>
                    </div>
                    <div className={styles.headerCenter}>
                        <span className={styles.greeting}>
                            {(() => {
                                const email = session?.user?.email?.toLowerCase() || '';
                                const greetings = email.includes('amiri') || email.includes('caelborne')
                                    ? ["What's good Amiri 💰", "Let's get this bread Amiri 🍞", "Boss mode activated 👑", "Amiri in the building 🏗️", "Time to eat Amiri 🔥"]
                                    : email.includes('toby')
                                        ? ["Yo Toby, let's get it 🔥", "Toby's in the cut 🗡️", "Big Tobes reporting in 💪", "Toby locked and loaded 🎯", "West Orange's finest 🏆"]
                                        : email.includes('yaz')
                                            ? ["Ya Yaz, bismillah let's work 🤲", "Yaz coming in hot 🔥", "The machine awaits you Yaz ⚡", "Yaz on a mission 🚀", "Let's secure the bag Yaz 💼"]
                                            : ["Welcome back 👋", "Let's work 🔥", "Systems ready 🟢", "Time to grind ⚡", "Let's go 🚀"];
                                return greetings[Math.floor(Math.random() * greetings.length)];
                            })()}
                        </span>
                    </div>
                    <div className={styles.headerRight}>
                        <div className={styles.clock}>{currentTime}</div>
                        <div className={styles.accountWrapper}>
                            <button className={styles.accountBtn} onClick={() => setShowAccountMenu(!showAccountMenu)}>
                                <span className={styles.accountAvatar}>
                                    {(() => {
                                        const e = session?.user?.email?.toLowerCase() || '';
                                        if (e.includes('amiri') || e.includes('caelborne')) return '[★]';
                                        if (e.includes('toby')) return '[▸]';
                                        if (e.includes('yaz')) return '[◈]';
                                        return '[·]';
                                    })()}
                                </span>
                                <span className={styles.accountLabel}>My Account</span>
                            </button>
                            {showAccountMenu && (
                                <>
                                    <div className={styles.accountBackdrop} onClick={() => setShowAccountMenu(false)} />
                                    <div className={styles.accountDropdown}>
                                        <div className={styles.accountDropdownUser}>
                                            {session?.user?.email}
                                        </div>
                                        <button className={styles.accountDropdownItem} onClick={() => { router.push('/stats'); setShowAccountMenu(false); }}>
                                            :: stats & leaderboard
                                        </button>
                                        <button className={styles.accountDropdownItem} onClick={() => { router.push('/saved'); setShowAccountMenu(false); }}>
                                            :: my leads
                                        </button>
                                        <button className={styles.accountDropdownItem} onClick={() => { router.push('/map'); setShowAccountMenu(false); }}>
                                            :: world domination
                                        </button>
                                        <div className={styles.accountDropdownDivider} />
                                        <button className={`${styles.accountDropdownItem} ${styles.accountLogout}`} onClick={handleLogout}>
                                            [x] logout
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Metrics Strip */}
                <section className={`${styles.metricsStrip} animate-boot-in delay-1`}>
                    <TronCard>
                        <div className={styles.metricsGrid}>
                            <TronMetric label="Total Leads" value={metrics.totalLeads} icon="[>_]" />
                            <TronMetric label="This Week" value={metrics.leadsThisWeek} icon="[::]" />
                            <TronMetric label="Emails Sent" value={metrics.emailsSent} icon="[@]" />
                            <TronMetric label="Response Rate" value={metrics.responseRate} suffix="%" icon="[▲]" />
                            <TronMetric label="Meetings" value={metrics.meetingsBooked} icon="[//]" />
                            <TronMetric label="Closed" value={metrics.clientsClosed} icon="[★]" />
                        </div>
                    </TronCard>
                </section>

                {/* Quick Actions — Terminal Command Bar */}
                <section className={`${styles.quickActions} animate-boot-in delay-2`}>
                    {[
                        { icon: '>_', label: 'RUN SCRAPER', desc: 'scan new leads', path: '/leads', delay: '0.05s' },
                        { icon: '/db', label: 'SAVED LEADS', desc: 'view pipeline', path: '/saved', delay: '0.10s' },
                        { icon: '@', label: 'EMAIL QUEUE', desc: 'drafts & sends', path: '/emails', delay: '0.15s' },
                        { icon: '☎', label: 'COLD CALLS', desc: 'dial prospects', path: '/saved?mode=calls', delay: '0.20s' },
                        { icon: '//', label: 'CALENDAR', desc: 'schedule & track', path: '/calendar', delay: '0.25s' },
                        { icon: '◈', label: 'PORTFOLIO', desc: 'case studies', path: '/portfolio', delay: '0.30s' },
                        { icon: '⚔', label: 'STATS', desc: 'player rankings', path: '/stats', delay: '0.35s' },
                    ].map((action) => (
                        <button
                            key={action.path}
                            className={styles.actionTile}
                            onClick={() => router.push(action.path)}
                            style={{ animationDelay: action.delay }}
                        >
                            <span className={styles.actionTileIcon}>{action.icon}</span>
                            <span className={styles.actionTileLabel}>{action.label}</span>
                            <span className={styles.actionTileDesc}>{action.desc}</span>
                            <span className={styles.actionTileCaret}>›</span>
                        </button>
                    ))}
                </section>

                {/* Email Queue Summary (when there are pending emails) */}
                {(metrics.drafts > 0 || metrics.approved > 0) && (
                    <section className="animate-boot-in delay-2">
                        <TronCard className={styles.queueAlert}>
                            <div className={styles.queueAlertContent}>
                                <span className={styles.queueAlertIcon}>[@@]</span>
                                <div>
                                    <strong>Email Queue:</strong>{' '}
                                    {metrics.drafts > 0 && <span>{metrics.drafts} draft{metrics.drafts !== 1 ? 's' : ''} awaiting review</span>}
                                    {metrics.drafts > 0 && metrics.approved > 0 && ' · '}
                                    {metrics.approved > 0 && <span className={styles.approvedCount}>{metrics.approved} approved &amp; ready to send</span>}
                                </div>
                                <TronButton onClick={() => router.push('/emails')} size="sm" variant="primary">
                                    Open Queue →
                                </TronButton>
                            </div>
                        </TronCard>
                    </section>
                )}

                {/* Callback Reminders Alert */}
                {(callbacks.overdue.length > 0 || callbacks.dueToday.length > 0) && (
                    <section className="animate-boot-in delay-2">
                        <TronCard className={callbacks.overdue.length > 0 ? styles.callbackAlertOverdue : styles.callbackAlertToday}>
                            <div className={styles.callbackAlertContent}>
                                <span className={styles.callbackAlertIcon}>{callbacks.overdue.length > 0 ? '[!!]' : '[//]'}</span>
                                <div>
                                    {callbacks.overdue.length > 0 && (
                                        <span className={styles.callbackAlertRed}>
                                            {callbacks.overdue.length} overdue callback{callbacks.overdue.length > 1 ? 's' : ''}!
                                        </span>
                                    )}
                                    {callbacks.overdue.length > 0 && callbacks.dueToday.length > 0 && ' · '}
                                    {callbacks.dueToday.length > 0 && (
                                        <span>
                                            {callbacks.dueToday.length} due today:{' '}
                                            <strong>{callbacks.dueToday.map(c => c.business_name).join(', ')}</strong>
                                        </span>
                                    )}
                                </div>
                                <TronButton onClick={() => router.push('/saved?mode=calls')} size="sm" variant="primary">
                                    Open Dialer →
                                </TronButton>
                            </div>
                        </TronCard>
                    </section>
                )}

                {/* Team Leaderboard */}
                <section className={`${styles.teamSection} animate-boot-in delay-2`}>
                    <TronCard>
                        <h3 className={styles.sectionTitle}>
                            <span className={styles.sectionIcon}>[★]</span> Team Leaderboard
                        </h3>
                        <p className={styles.widgetSubtitle}>
                            {team.totalClaimed} claimed · {team.totalUnclaimed} unclaimed
                        </p>
                        {team.leaderboard.length === 0 ? (
                            <p className={styles.emptyWidget}>No leads claimed yet. Go claim some leads!</p>
                        ) : (
                            <div className={styles.leaderboardList}>
                                {team.leaderboard.map((member, i) => {
                                    const totalAll = team.totalClaimed || 1;
                                    const pct = Math.round((member.total / totalAll) * 100);
                                    const medal = i === 0 ? '#01' : i === 1 ? '#02' : i === 2 ? '#03' : '';
                                    const barColor = i === 0 ? '#00ff41' : i === 1 ? '#00d4ff' : '#ffb000';
                                    return (
                                        <div key={member.name} className={styles.leaderboardRow}>
                                            <div className={styles.leaderboardRank}>
                                                <span className={styles.leaderboardMedal}>{medal || `#${i + 1}`}</span>
                                            </div>
                                            <div className={styles.leaderboardInfo}>
                                                <div className={styles.leaderboardName}>{member.name}</div>
                                                <div className={styles.leaderboardBar}>
                                                    <div className={styles.leaderboardBarFill} style={{ width: `${pct}%`, background: barColor }} />
                                                </div>
                                                <div className={styles.leaderboardStats}>
                                                    <span>{member.total} leads</span>
                                                    {member.contacted > 0 && <span>· {member.contacted} contacted</span>}
                                                    {member.meeting > 0 && <span>· {member.meeting} meetings</span>}
                                                    {member.closed > 0 && <span>· {member.closed} closed</span>}
                                                </div>
                                            </div>
                                            <div className={styles.leaderboardCount}>{pct}%</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </TronCard>
                </section>

                {/* Main Content Grid */}
                <div className={styles.mainGrid}>
                    {/* Pipeline Funnel */}
                    <section className="animate-boot-in delay-2">
                        <TronCard>
                            <h3 className={styles.sectionTitle}>Pipeline Overview</h3>
                            <TronFunnel data={pipeline} />
                        </TronCard>
                    </section>

                    {/* Activity Feed */}
                    <section className="animate-boot-in delay-3">
                        <TronTerminal entries={displayActivity} title="ACTIVITY FEED" />
                    </section>
                </div>

                {/* Intelligence Widgets */}
                <div className={styles.intelligenceGrid}>
                    {/* Today's Top Picks */}
                    <section className="animate-boot-in delay-3">
                        <TronCard>
                            <h3 className={styles.sectionTitle}>
                                <span className={styles.sectionIcon}>[◎]</span> Today&apos;s Top Picks
                                <button className={styles.tooltipBtn} onClick={() => setTooltip(tooltip === 'top' ? null : 'top')}>?</button>
                            </h3>
                            {tooltip === 'top' && <p className={styles.tooltipText}>ACAM automatically scans random US cities every morning at 6 AM and surfaces the highest-scoring leads it finds. These are brand new prospects you&apos;ve never seen.</p>}
                            <p className={styles.widgetSubtitle}>Highest-scoring leads waiting for outreach</p>
                            {intelligence.topPicks.length === 0 ? (
                                <p className={styles.emptyWidget}>No untouched leads. Go run the scraper!</p>
                            ) : (
                                <div className={styles.leadWidgetList}>
                                    {intelligence.topPicks.map((lead, i) => (
                                        <div key={lead.id} className={styles.widgetLead} onClick={() => setProspectSheet({ lead, source: 'topPicks' })}>
                                            <span className={styles.widgetRank}>#{i + 1}</span>
                                            <div className={styles.widgetLeadInfo}>
                                                <strong>{lead.business_name}</strong>
                                                <span className={styles.widgetLeadMeta}>
                                                    {lead.category} · {lead.city}{lead.google_rating ? ` · ★${lead.google_rating}` : ''}
                                                </span>
                                            </div>
                                            <span className={styles.widgetScore} style={{ color: lead.lead_score >= 80 ? '#ff3333' : lead.lead_score >= 60 ? '#ffb000' : '#00ff41' }}>
                                                {lead.lead_score}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </TronCard>
                    </section>

                    {/* Easy Wins */}
                    <section className="animate-boot-in delay-3">
                        <TronCard>
                            <h3 className={styles.sectionTitle}>
                                <span className={styles.sectionIcon}>[$]</span> Easy Wins
                                <button className={styles.tooltipBtn} onClick={() => setTooltip(tooltip === 'easy' ? null : 'easy')}>?</button>
                            </h3>
                            {tooltip === 'easy' && <p className={styles.tooltipText}>These businesses have strong Google reviews but NO website at all. They&apos;re the easiest pitch because they already have social proof — they just need an online presence.</p>}
                            <p className={styles.widgetSubtitle}>No website + great reviews = easiest pitch</p>
                            {intelligence.easyWins.length === 0 ? (
                                <p className={styles.emptyWidget}>No easy wins found yet.</p>
                            ) : (
                                <div className={styles.leadWidgetList}>
                                    {intelligence.easyWins.map((lead, i) => (
                                        <div key={lead.id} className={styles.widgetLead} onClick={() => setProspectSheet({ lead, source: 'easyWins' })}>
                                            <span className={styles.widgetRank}>#{i + 1}</span>
                                            <div className={styles.widgetLeadInfo}>
                                                <strong>{lead.business_name}</strong>
                                                <span className={styles.widgetLeadMeta}>
                                                    {lead.category} · {lead.city} · {lead.review_count} reviews · <span className={styles.noSiteTag}>NO SITE</span>
                                                </span>
                                            </div>
                                            <span className={styles.widgetScore} style={{ color: '#00ff41' }}>
                                                ★{lead.google_rating || '?'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </TronCard>
                    </section>

                    {/* Hot Leads */}
                    <section className="animate-boot-in delay-4">
                        <TronCard>
                            <h3 className={styles.sectionTitle}>
                                <span className={styles.sectionIcon}>[!]</span> Hot Leads
                                <button className={styles.tooltipBtn} onClick={() => setTooltip(tooltip === 'hot' ? null : 'hot')}>?</button>
                            </h3>
                            {tooltip === 'hot' && <p className={styles.tooltipText}>These are leads you&apos;ve personally called through the Dialer Terminal and marked as &quot;Interested&quot;. Follow up with these ASAP to close the deal.</p>}
                            <p className={styles.widgetSubtitle}>Called and marked as interested</p>
                            {intelligence.hotLeads.length === 0 ? (
                                <p className={styles.emptyWidget}>No hot leads yet. Start dialing!</p>
                            ) : (
                                <div className={styles.leadWidgetList}>
                                    {intelligence.hotLeads.map((lead, i) => (
                                        <div key={lead.id} className={styles.widgetLead} onClick={() => setProspectSheet({ lead, source: 'hotLeads' })}>
                                            <span className={styles.hotDot} />
                                            <div className={styles.widgetLeadInfo}>
                                                <strong>{lead.business_name}</strong>
                                                <span className={styles.widgetLeadMeta}>
                                                    {lead.category} · {lead.city} · Called {new Date(lead.last_called_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <span className={styles.interestedTag}>INTERESTED</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </TronCard>
                    </section>
                </div>

                {/* Call Tracking Dashboard */}
                <section className={`${styles.callTrackingSection} animate-boot-in delay-4`}>
                    <TronCard>
                        <h3 className={styles.sectionTitle}>
                            <span className={styles.sectionIcon}>[☎]</span> Call Tracking
                        </h3>

                        {/* Call Stats Row */}
                        <div className={styles.callStatsRow}>
                            <div className={styles.callStat}>
                                <span className={styles.callStatValue}>{callTracking.totalCalls}</span>
                                <span className={styles.callStatLabel}>Total Calls</span>
                            </div>
                            <div className={styles.callStat}>
                                <span className={styles.callStatValue}>{callTracking.callsThisWeek}</span>
                                <span className={styles.callStatLabel}>This Week</span>
                            </div>
                            <div className={styles.callStat}>
                                <span className={styles.callStatValue} style={{ color: callTracking.callInterestRate >= 30 ? '#00ff41' : '#ffb000' }}>{callTracking.callInterestRate}%</span>
                                <span className={styles.callStatLabel}>Interest Rate</span>
                            </div>
                            <div className={styles.callStat}>
                                <span className={styles.callStatValue}>{callTracking.outcomes?.call_back || 0}</span>
                                <span className={styles.callStatLabel}>Callbacks</span>
                            </div>
                        </div>

                        {callTracking.totalCalls > 0 ? (
                            <div className={styles.callTrackingGrid}>
                                {/* Outcome Breakdown */}
                                <div className={styles.callTrackingCol}>
                                    <p className={styles.callTrackingLabel}>OUTCOME BREAKDOWN</p>
                                    <div className={styles.outcomeBreakdown}>
                                        {[{ key: 'interested', label: 'Interested', color: '#00ff41' },
                                        { key: 'call_back', label: 'Call Back', color: '#ffb000' },
                                        { key: 'voicemail', label: 'Voicemail', color: '#666' },
                                        { key: 'not_interested', label: 'Not Interested', color: '#ff3333' }]
                                            .map(item => (
                                                <div key={item.key} className={styles.outcomeRow}>
                                                    <span className={styles.outcomeRowLabel}>{item.label}</span>
                                                    <div className={styles.outcomeBarTrack}>
                                                        <div
                                                            className={styles.outcomeBarFill}
                                                            style={{
                                                                width: `${callTracking.totalCalls > 0 ? ((callTracking.outcomes?.[item.key] || 0) / callTracking.totalCalls) * 100 : 0}%`,
                                                                background: item.color,
                                                                boxShadow: `0 0 4px ${item.color}`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span className={styles.outcomeRowCount}>{callTracking.outcomes?.[item.key] || 0}</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>

                                {/* Industry Breakdown */}
                                <div className={styles.callTrackingCol}>
                                    <p className={styles.callTrackingLabel}>BY INDUSTRY</p>
                                    {callTracking.industryStats.length > 0 ? (
                                        <div className={styles.industryBreakdown}>
                                            {callTracking.industryStats.map((ind) => (
                                                <div key={ind.name} className={styles.industryRow}>
                                                    <span className={styles.industryName}>{ind.name}</span>
                                                    <span className={styles.industryCalls}>{ind.total} call{ind.total !== 1 ? 's' : ''}</span>
                                                    <span className={styles.industryRate} style={{ color: ind.rate >= 40 ? '#00ff41' : ind.rate >= 20 ? '#ffb000' : '#ff3333' }}>
                                                        {ind.rate}% hit
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className={styles.emptyWidget}>No industry data yet</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className={styles.emptyWidget}>No calls logged yet. Open a lead &apos;s dialer and start calling!</p>
                        )}
                    </TronCard>
                </section>


                {/* World Domination Banner */}
                <section
                    className={`${styles.dominationBanner} animate-boot-in delay-5`}
                    onClick={() => router.push('/map')}
                    role="button"
                    tabIndex={0}
                >
                    <div className={styles.dominationBannerGlow} />
                    <div className={styles.dominationBannerContent}>
                        <div className={styles.dominationBannerIcon}>[◉]</div>
                        <div className={styles.dominationBannerText}>
                            <h3>WORLD DOMINATION</h3>
                            <p>700+ cities · Heat signatures · Conquer territory</p>
                        </div>
                        <div className={styles.dominationBannerArrow}>▶</div>
                    </div>
                </section>

            </div>

            {/* Prospect Detail Sheet */}
            {prospectSheet && (() => {
                const { lead, source } = prospectSheet;
                const isFromDailyPicks = source === 'topPicks' || source === 'easyWins';

                const handleSaveToLeads = async () => {
                    setSaving(true);
                    setSaveResult(null);
                    try {
                        const { data, error } = await supabase.from('leads').insert({
                            business_name: lead.business_name,
                            category: lead.category,
                            city: lead.city,
                            state: lead.state,
                            phone: lead.phone || null,
                            google_rating: lead.google_rating,
                            review_count: lead.review_count || 0,
                            has_website: lead.has_website || false,
                            website_url: lead.website_url || null,
                            google_maps_url: lead.google_maps_url || null,
                            lead_score: lead.lead_score || 0,
                            status: 'new',
                            address: lead.address || null,
                        }).select().single();
                        if (error) throw error;
                        setSaveResult({ type: 'success', message: 'Saved to leads!', leadId: data.id });
                    } catch (err) {
                        setSaveResult({ type: 'error', message: err.message });
                    } finally {
                        setSaving(false);
                    }
                };

                return (
                    <div className={styles.sheetOverlay} onClick={() => { setProspectSheet(null); setSaveResult(null); }}>
                        <div className={styles.sheetPanel} onClick={e => e.stopPropagation()}>
                            <button className={styles.sheetClose} onClick={() => { setProspectSheet(null); setSaveResult(null); }}>✕</button>

                            <div className={styles.sheetHeader}>
                                <h2 className={styles.sheetName}>{lead.business_name}</h2>
                                <span className={styles.sheetMeta}>{lead.category} · {lead.city}{lead.state ? `, ${lead.state}` : ''}</span>
                            </div>

                            <div className={styles.sheetStatsRow}>
                                {lead.google_rating && (
                                    <div className={styles.sheetStat}>
                                        <span className={styles.sheetStatVal}>⭐ {lead.google_rating}</span>
                                        <span className={styles.sheetStatLabel}>Rating</span>
                                    </div>
                                )}
                                {lead.review_count > 0 && (
                                    <div className={styles.sheetStat}>
                                        <span className={styles.sheetStatVal}>{lead.review_count}</span>
                                        <span className={styles.sheetStatLabel}>Reviews</span>
                                    </div>
                                )}
                                {lead.lead_score > 0 && (
                                    <div className={styles.sheetStat}>
                                        <span className={styles.sheetStatVal} style={{ color: lead.lead_score >= 80 ? '#ff3333' : lead.lead_score >= 60 ? '#ffb000' : '#00ff41' }}>{lead.lead_score}</span>
                                        <span className={styles.sheetStatLabel}>Score</span>
                                    </div>
                                )}
                                <div className={styles.sheetStat}>
                                    <span className={styles.sheetStatVal} style={{ color: lead.has_website ? '#00ff41' : '#ff3333' }}>{lead.has_website ? 'YES' : 'NO'}</span>
                                    <span className={styles.sheetStatLabel}>Website</span>
                                </div>
                            </div>

                            {lead.phone && (
                                <div className={styles.sheetPhoneRow}>
                                    <span className={styles.sheetPhoneIcon}>📞</span>
                                    <span className={styles.sheetPhoneNum}>{lead.phone}</span>
                                </div>
                            )}

                            <div className={styles.sheetActions}>
                                {isFromDailyPicks && !saveResult?.leadId && (
                                    <button className={styles.sheetActionPrimary} onClick={handleSaveToLeads} disabled={saving}>
                                        {saving ? '⏳ Saving...' : '💾 Save to Leads'}
                                    </button>
                                )}

                                {(saveResult?.leadId || source === 'hotLeads') && (
                                    <button className={styles.sheetActionPrimary} onClick={() => router.push('/saved?mode=calls')}>
                                        📞 Open Call Script
                                    </button>
                                )}

                                {saveResult?.leadId && (
                                    <button className={styles.sheetActionSecondary} onClick={() => router.push('/saved')}>
                                        📁 View in Saved Leads
                                    </button>
                                )}

                                {source === 'hotLeads' && (
                                    <button className={styles.sheetActionSecondary} onClick={() => router.push('/saved')}>
                                        📁 View in Saved Leads
                                    </button>
                                )}

                                {lead.google_maps_url && (
                                    <a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer" className={styles.sheetActionSecondary}>
                                        📍 Open in Google Maps
                                    </a>
                                )}
                            </div>

                            {saveResult && (
                                <div className={`${styles.sheetResult} ${styles[saveResult.type]}`}>
                                    {saveResult.type === 'success' ? '✅' : '⚠️'} {saveResult.message}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
