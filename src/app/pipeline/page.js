'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TronGrid from '@/components/tron/TronGrid';
import TronCard from '@/components/tron/TronCard';
import TronButton from '@/components/tron/TronButton';
import styles from './page.module.css';

function daysAgo(dateStr) {
    if (!dateStr) return Infinity;
    const d = new Date(dateStr);
    const now = new Date();
    return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = daysAgo(dateStr);
    if (d === 0) return 'Today';
    if (d === 1) return 'Yesterday';
    if (d < 7) return `${d}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getStageInfo(status) {
    switch (status) {
        case 'new': return { label: 'NEW', color: '#666', icon: '○' };
        case 'contacted': return { label: 'CONTACTED', color: '#ffb000', icon: '◐' };
        case 'interested': return { label: 'INTERESTED', color: '#00d4ff', icon: '◑' };
        case 'meeting': return { label: 'MEETING SET', color: '#c084fc', icon: '◕' };
        case 'closed': return { label: 'CLOSED ✅', color: '#00ff41', icon: '●' };
        case 'dead': return { label: 'DEAD ❌', color: '#ff3333', icon: '✕' };
        default: return { label: status?.toUpperCase() || 'UNKNOWN', color: '#666', icon: '?' };
    }
}

export default function PipelinePage() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [toast, setToast] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const router = useRouter();

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchPipeline = useCallback(async () => {
        try {
            // Fetch all leads with outreach data
            const { data: allLeads, error: leadsErr } = await supabase
                .from('leads')
                .select('*, outreach(*)')
                .not('status', 'is', null)
                .order('created_at', { ascending: false });

            if (leadsErr) throw leadsErr;

            // Process each lead with engagement data
            const processed = (allLeads || []).map(lead => {
                const outreach = lead.outreach || [];
                const sentEmails = outreach.filter(o => o.status === 'sent');
                const draftEmails = outreach.filter(o => o.status === 'draft' || o.status === 'approved');
                const repliedEmails = outreach.filter(o => o.replied_at);

                // Email timeline
                const lastEmailSent = sentEmails.length > 0
                    ? sentEmails.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0]
                    : null;
                const daysSinceEmail = lastEmailSent ? daysAgo(lastEmailSent.sent_at) : null;

                // Call timeline
                const lastCalled = lead.last_called_at ? daysAgo(lead.last_called_at) : null;
                const callOutcome = lead.call_outcome;

                // Callback tracking
                const callbackDate = lead.callback_date;
                const callbackOverdue = callbackDate && new Date(callbackDate) < new Date();

                // Engagement temperature
                let temperature = 'cold';
                if (lead.status === 'dead') temperature = 'dead';
                else if (lead.status === 'closed') temperature = 'won';
                else if (repliedEmails.length > 0 || callOutcome === 'interested') temperature = 'hot';
                else if (callOutcome === 'callback' || lead.status === 'meeting') temperature = 'warm';
                else if (daysSinceEmail !== null && daysSinceEmail <= 3) temperature = 'warm';
                else if (lastCalled !== null && lastCalled <= 2) temperature = 'warm';

                // Build activity log
                const activities = [];
                sentEmails.forEach(e => {
                    activities.push({
                        type: 'email',
                        label: e.email_type === 'followup_1' ? 'Follow-up #1' : e.email_type === 'followup_2' ? 'Breakup Email' : 'Initial Email',
                        date: e.sent_at,
                        detail: e.email_subject,
                        replied: !!e.replied_at,
                        repliedAt: e.replied_at,
                    });
                });
                if (lead.last_called_at) {
                    activities.push({
                        type: 'call',
                        label: `Call — ${callOutcome || 'Logged'}`,
                        date: lead.last_called_at,
                        detail: callOutcome ? callOutcome.replace(/_/g, ' ').toUpperCase() : null,
                    });
                }
                activities.sort((a, b) => new Date(b.date) - new Date(a.date));

                // Next action
                let nextAction = null;
                if (lead.status === 'dead' || lead.status === 'closed') {
                    nextAction = null;
                } else if (callbackOverdue) {
                    nextAction = { label: 'OVERDUE: Follow up now!', urgent: true };
                } else if (callbackDate && !callbackOverdue) {
                    nextAction = { label: `Callback ${formatDate(callbackDate)}`, urgent: false };
                } else if (sentEmails.length > 0 && repliedEmails.length === 0 && daysSinceEmail >= 3) {
                    nextAction = { label: 'No reply — follow up!', urgent: true };
                } else if (lead.status === 'new') {
                    nextAction = { label: 'Send initial outreach', urgent: false };
                }

                const isOverdue = callbackOverdue || (daysSinceEmail >= 5 && repliedEmails.length === 0 && lead.status !== 'dead' && lead.status !== 'closed');

                return {
                    ...lead,
                    emailCount: sentEmails.length,
                    draftCount: draftEmails.length,
                    replyCount: repliedEmails.length,
                    lastEmailSent,
                    daysSinceEmail,
                    lastCalled,
                    callOutcome,
                    callbackDate,
                    callbackOverdue,
                    temperature,
                    activities,
                    nextAction,
                    isOverdue,
                };
            });

            setLeads(processed);
        } catch (err) {
            console.error('Pipeline fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) router.push('/');
            else fetchPipeline();
        });
    }, [router, fetchPipeline]);

    const markDead = async (leadId, businessName) => {
        await supabase.from('leads').update({ status: 'dead' }).eq('id', leadId);
        showToast('warn', `❌ ${businessName} marked as DEAD`);
        fetchPipeline();
    };

    const reviveLead = async (leadId, businessName) => {
        await supabase.from('leads').update({ status: 'contacted' }).eq('id', leadId);
        showToast('success', `🔄 ${businessName} revived — back in the pipeline`);
        fetchPipeline();
    };

    // Filter leads
    const filtered = leads.filter(l => {
        if (activeTab === 'all') return l.status !== 'dead';
        if (activeTab === 'overdue') return l.isOverdue && l.status !== 'dead' && l.status !== 'closed';
        if (activeTab === 'hot') return l.temperature === 'hot' && l.status !== 'dead';
        if (activeTab === 'cold') return l.temperature === 'cold' && l.status !== 'dead' && l.status !== 'new';
        if (activeTab === 'won') return l.status === 'closed';
        if (activeTab === 'dead') return l.status === 'dead';
        return true;
    });

    const counts = {
        all: leads.filter(l => l.status !== 'dead').length,
        overdue: leads.filter(l => l.isOverdue && l.status !== 'dead' && l.status !== 'closed').length,
        hot: leads.filter(l => l.temperature === 'hot' && l.status !== 'dead').length,
        cold: leads.filter(l => l.temperature === 'cold' && l.status !== 'dead' && l.status !== 'new').length,
        won: leads.filter(l => l.status === 'closed').length,
        dead: leads.filter(l => l.status === 'dead').length,
    };

    const tempColor = (t) => {
        switch (t) {
            case 'hot': return '#ff3333';
            case 'warm': return '#ffb000';
            case 'cold': return '#00d4ff';
            case 'won': return '#00ff41';
            case 'dead': return '#444';
            default: return '#666';
        }
    };

    return (
        <div className={styles.page}>
            <TronGrid />
            <div className={styles.container}>
                <header className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Pipeline Tracker</h1>
                        <p className={styles.subtitle}>Every lead. Every action. Nothing slips.</p>
                    </div>
                    <div className={styles.headerActions}>
                        <TronButton onClick={() => router.push('/emails')} variant="secondary" size="sm">📧 Emails</TronButton>
                        <TronButton onClick={() => router.push('/saved')} variant="secondary" size="sm">📁 Leads</TronButton>
                        <TronButton onClick={() => router.push('/dashboard')} variant="secondary" size="sm">← Dashboard</TronButton>
                    </div>
                </header>

                {/* Stats Banner */}
                <div className={styles.statsBanner}>
                    <div className={styles.statItem}>
                        <span className={styles.statVal}>{leads.length}</span>
                        <span className={styles.statLabel}>TOTAL</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statVal} style={{ color: '#ff3333' }}>{counts.overdue}</span>
                        <span className={styles.statLabel}>OVERDUE</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statVal} style={{ color: '#ff3333' }}>{counts.hot}</span>
                        <span className={styles.statLabel}>HOT</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statVal} style={{ color: '#00ff41' }}>{counts.won}</span>
                        <span className={styles.statLabel}>WON</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statVal} style={{ color: '#444' }}>{counts.dead}</span>
                        <span className={styles.statLabel}>DEAD</span>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className={styles.filterTabs}>
                    {[
                        { key: 'all', label: 'All Active', count: counts.all },
                        { key: 'overdue', label: '⚠ Overdue', count: counts.overdue },
                        { key: 'hot', label: '🔥 Hot', count: counts.hot },
                        { key: 'cold', label: '🧊 Cold', count: counts.cold },
                        { key: 'won', label: '✅ Won', count: counts.won },
                        { key: 'dead', label: '❌ Dead', count: counts.dead },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            className={`${styles.filterTab} ${activeTab === tab.key ? styles.filterTabActive : ''} ${tab.key === 'overdue' && counts.overdue > 0 ? styles.filterTabUrgent : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                {/* Toast */}
                {toast && (
                    <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>
                        {toast.message}
                    </div>
                )}

                {/* Lead List */}
                {loading ? (
                    <TronCard className={styles.emptyState}><p>Loading pipeline...</p></TronCard>
                ) : filtered.length === 0 ? (
                    <TronCard className={styles.emptyState}>
                        <p>
                            {activeTab === 'overdue' && 'No overdue leads — you\'re on top of everything!'}
                            {activeTab === 'hot' && 'No hot leads right now. Keep grinding!'}
                            {activeTab === 'cold' && 'No cold leads — good sign!'}
                            {activeTab === 'won' && 'No closed deals yet. Let\'s change that!'}
                            {activeTab === 'dead' && 'No dead leads. Every lead is still alive!'}
                            {activeTab === 'all' && 'No leads in the pipeline. Go save some!'}
                        </p>
                    </TronCard>
                ) : (
                    <div className={styles.leadList}>
                        {filtered.map(lead => {
                            const stage = getStageInfo(lead.status);
                            const isExpanded = expandedId === lead.id;
                            return (
                                <div
                                    key={lead.id}
                                    className={`${styles.leadRow} ${lead.isOverdue ? styles.leadRowOverdue : ''} ${lead.status === 'dead' ? styles.leadRowDead : ''}`}
                                    onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                                >
                                    {/* Main Row */}
                                    <div className={styles.leadMain}>
                                        {/* Temperature Dot */}
                                        <div className={styles.tempDot} style={{ background: tempColor(lead.temperature) }} title={lead.temperature} />

                                        {/* Business Info */}
                                        <div className={styles.leadInfo}>
                                            <div className={styles.leadName}>{lead.business_name}</div>
                                            <div className={styles.leadMeta}>{lead.category} · {lead.city}</div>
                                        </div>

                                        {/* Stage Badge */}
                                        <span className={styles.stageBadge} style={{ borderColor: stage.color, color: stage.color }}>
                                            {stage.icon} {stage.label}
                                        </span>

                                        {/* Email Stats */}
                                        <div className={styles.engagementStats}>
                                            <div className={styles.engStat}>
                                                <span className={styles.engIcon}>✉️</span>
                                                <span>{lead.emailCount}</span>
                                                {lead.replyCount > 0 && <span className={styles.replyBadge}>💬{lead.replyCount}</span>}
                                            </div>
                                            <div className={styles.engStat}>
                                                <span className={styles.engIcon}>📞</span>
                                                <span>{lead.lastCalled !== null ? formatDate(lead.last_called_at) : '—'}</span>
                                            </div>
                                        </div>

                                        {/* Next Action */}
                                        <div className={styles.nextAction}>
                                            {lead.nextAction ? (
                                                <span className={lead.nextAction.urgent ? styles.nextActionUrgent : styles.nextActionNormal}>
                                                    {lead.nextAction.label}
                                                </span>
                                            ) : (
                                                <span className={styles.nextActionDone}>
                                                    {lead.status === 'closed' ? '✅ WON' : lead.status === 'dead' ? '—' : 'On track'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Expand Arrow */}
                                        <span className={styles.expandArrow}>{isExpanded ? '▼' : '▶'}</span>
                                    </div>

                                    {/* Expanded Detail */}
                                    {isExpanded && (
                                        <div className={styles.leadDetail} onClick={(e) => e.stopPropagation()}>
                                            <div className={styles.detailColumns}>
                                                {/* Activity Timeline */}
                                                <div className={styles.activityTimeline}>
                                                    <h4 className={styles.detailTitle}>Activity Timeline</h4>
                                                    {lead.activities.length === 0 ? (
                                                        <p className={styles.noActivity}>No activity yet</p>
                                                    ) : (
                                                        lead.activities.map((a, i) => (
                                                            <div key={i} className={styles.timelineItem}>
                                                                <span className={`${styles.timelineIcon} ${a.type === 'email' ? styles.timelineEmail : styles.timelineCall}`}>
                                                                    {a.type === 'email' ? '✉️' : '📞'}
                                                                </span>
                                                                <div className={styles.timelineContent}>
                                                                    <div className={styles.timelineLabel}>
                                                                        {a.label}
                                                                        {a.replied && <span className={styles.repliedTag}> 💬 REPLIED {formatDate(a.repliedAt)}</span>}
                                                                    </div>
                                                                    <div className={styles.timelineDate}>{formatDate(a.date)}</div>
                                                                    {a.detail && <div className={styles.timelineDetail}>{a.detail}</div>}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                {/* Lead Summary */}
                                                <div className={styles.leadSummary}>
                                                    <h4 className={styles.detailTitle}>Lead Intel</h4>
                                                    <div className={styles.summaryGrid}>
                                                        <div className={styles.summaryItem}>
                                                            <span className={styles.summaryLabel}>Emails Sent</span>
                                                            <span className={styles.summaryVal}>{lead.emailCount}</span>
                                                        </div>
                                                        <div className={styles.summaryItem}>
                                                            <span className={styles.summaryLabel}>Replies</span>
                                                            <span className={styles.summaryVal} style={{ color: lead.replyCount > 0 ? '#00ff41' : '#666' }}>{lead.replyCount}</span>
                                                        </div>
                                                        <div className={styles.summaryItem}>
                                                            <span className={styles.summaryLabel}>Last Call</span>
                                                            <span className={styles.summaryVal}>{lead.callOutcome ? lead.callOutcome.replace(/_/g, ' ') : '—'}</span>
                                                        </div>
                                                        <div className={styles.summaryItem}>
                                                            <span className={styles.summaryLabel}>Callback</span>
                                                            <span className={styles.summaryVal} style={{ color: lead.callbackOverdue ? '#ff3333' : '#aaa' }}>
                                                                {lead.callbackDate ? formatDate(lead.callbackDate) : '—'}
                                                            </span>
                                                        </div>
                                                        <div className={styles.summaryItem}>
                                                            <span className={styles.summaryLabel}>Score</span>
                                                            <span className={styles.summaryVal}>{lead.lead_score || '—'}</span>
                                                        </div>
                                                        <div className={styles.summaryItem}>
                                                            <span className={styles.summaryLabel}>Email</span>
                                                            <span className={styles.summaryVal} style={{ fontSize: '0.7rem' }}>{lead.email || 'None'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className={styles.detailActions}>
                                                        {lead.status !== 'dead' && lead.status !== 'closed' && (
                                                            <TronButton onClick={() => markDead(lead.id, lead.business_name)} size="sm" variant="danger">❌ Mark Dead</TronButton>
                                                        )}
                                                        {lead.status === 'dead' && (
                                                            <TronButton onClick={() => reviveLead(lead.id, lead.business_name)} size="sm" variant="primary">🔄 Revive</TronButton>
                                                        )}
                                                        <TronButton onClick={() => router.push('/saved')} size="sm" variant="secondary">📁 View in Leads</TronButton>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
