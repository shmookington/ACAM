'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TronGrid from '@/components/tron/TronGrid';
import TronCard from '@/components/tron/TronCard';
import TronButton from '@/components/tron/TronButton';
import { rescoreLead } from '@/lib/scoring';
import styles from './page.module.css';

function getScoreColor(score) {
    if (score >= 80) return '#00ff41';
    if (score >= 60) return '#ffb000';
    if (score >= 40) return '#ff8c00';
    return '#ff3333';
}

export default function SavedLeadsPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-black)' }} />}>
            <SavedLeadsInner />
        </Suspense>
    );
}

function SavedLeadsInner() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [genResult, setGenResult] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [proposalData, setProposalData] = useState(null);
    const [proposalLoading, setProposalLoading] = useState(null);
    const [auditData, setAuditData] = useState(null);
    const [auditLoading, setAuditLoading] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [websiteFilter, setWebsiteFilter] = useState('all');
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [tagFilter, setTagFilter] = useState('all');
    const [noteEditId, setNoteEditId] = useState(null);
    const [noteEditValue, setNoteEditValue] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [teamFilter, setTeamFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [quickLogId, setQuickLogId] = useState(null);

    // Get current user session
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.email) setUserEmail(session.user.email);
        });
    }, []);

    // Resolve email to display name
    const getUserName = (email) => {
        if (!email) return null;
        const e = email.toLowerCase();
        if (e.includes('amiri') || e.includes('caelborne')) return 'Amiri';
        if (e.includes('toby')) return 'Toby';
        if (e.includes('yaz')) return 'Yaz';
        return email.split('@')[0];
    };

    const getTeamColor = (email) => {
        if (!email) return '#666';
        const e = email.toLowerCase();
        if (e.includes('amiri') || e.includes('caelborne')) return '#00d4ff';
        if (e.includes('toby')) return '#ff8c00';
        if (e.includes('yaz')) return '#c084fc';
        return '#888';
    };

    // Claim/unclaim a lead
    const handleClaim = async (leadId, shouldClaim) => {
        const email = shouldClaim ? userEmail : null;
        try {
            const res = await fetch('/api/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId, email }),
            });
            if (res.ok) {
                setLeads(prev => prev.map(l => l.id === leadId ? { ...l, claimed_by: email } : l));
            }
        } catch (err) {
            console.error('Claim error:', err);
        }
    };

    // Auto-claim a lead (called when taking action)
    const autoClaim = async (leadId) => {
        if (!userEmail) return;
        const lead = leads.find(l => l.id === leadId);
        if (lead && !lead.claimed_by) {
            handleClaim(leadId, true);
        }
    };

    const PRESET_TAGS = [
        { key: 'hot', label: '🔥 Hot', color: '#ff3333' },
        { key: 'follow_up', label: '⏳ Follow Up', color: '#ffb000' },
        { key: 'cold', label: '❄️ Cold', color: '#666' },
        { key: 'priority', label: '⭐ Priority', color: '#ffd700' },
        { key: 'easy_win', label: '💰 Easy Win', color: '#00ff41' },
    ];

    const [dialerLead, setDialerLead] = useState(null);
    const [generatingScript, setGeneratingScript] = useState(false);
    const [scriptError, setScriptError] = useState(null);
    const [scriptLoadingPhase, setScriptLoadingPhase] = useState(0);
    const [callbackPicker, setCallbackPicker] = useState(null); // null | { leadId, date }

    // Case Study State
    const [caseStudyLead, setCaseStudyLead] = useState(null);
    const [csStep, setCsStep] = useState('loading'); // loading | questions | generating | plan | saved
    const [csQuestions, setCsQuestions] = useState([]);
    const [csAnswers, setCsAnswers] = useState([]);
    const [csCurrentQ, setCsCurrentQ] = useState(0);
    const [csPlan, setCsPlan] = useState('');
    const [csLoadingPhase, setCsLoadingPhase] = useState(0);

    const router = useRouter();
    const searchParams = useSearchParams();
    const callMode = searchParams.get('mode') === 'calls';

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) router.push('/');
        });
    }, [router]);

    // Cycling loading messages for the AI generation steps
    const loadingMessages = [
        { icon: '🔍', text: 'Analyzing industry patterns...' },
        { icon: '🎨', text: 'Stage 1: Mapping ideation framework...' },
        { icon: '📦', text: 'Stage 2: Curating asset recommendations...' },
        { icon: '📐', text: 'Stage 3: Structuring page layout...' },
        { icon: '⚡', text: 'Stage 4: Planning code architecture...' },
        { icon: '🔧', text: 'Stage 5: Defining integration points...' },
        { icon: '✨', text: 'Stage 6: Compiling launch checklist...' },
        { icon: '📋', text: 'Assembling your blueprint...' },
    ];

    const questionLoadingMessages = [
        { icon: '🔍', text: `Scanning ${caseStudyLead?.category || 'the'} industry...` },
        { icon: '🧠', text: 'Analyzing competitive landscape...' },
        { icon: '📊', text: 'Identifying key decision points...' },
        { icon: '✨', text: 'Crafting smart questions...' },
    ];

    const scriptLoadingMessages = [
        { icon: '📞', text: 'Reading business intel...' },
        { icon: '🔍', text: 'Analyzing their competition...' },
        { icon: '🎯', text: 'Crafting the perfect opener...' },
        { icon: '🗣️', text: 'Building value propositions...' },
        { icon: '🛡️', text: 'Fine-tuning objection rebuttals...' },
        { icon: '✨', text: 'Polishing the close...' },
    ];

    useEffect(() => {
        if (csStep === 'generating' || csStep === 'loading') {
            setCsLoadingPhase(0);
            const msgs = csStep === 'generating' ? loadingMessages : questionLoadingMessages;
            const interval = setInterval(() => {
                setCsLoadingPhase(prev => (prev + 1) % msgs.length);
            }, csStep === 'generating' ? 3000 : 2000);
            return () => clearInterval(interval);
        }
    }, [csStep]);

    useEffect(() => {
        if (generatingScript) {
            setScriptLoadingPhase(0);
            const interval = setInterval(() => {
                setScriptLoadingPhase(prev => (prev + 1) % scriptLoadingMessages.length);
            }, 2500);
            return () => clearInterval(interval);
        }
    }, [generatingScript]);

    const fetchLeads = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.set('search', searchQuery);
            const res = await fetch(`/api/leads?${params.toString()}`);
            const data = await res.json();
            setLeads(data.leads || []);
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    }, [searchQuery]);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    // Toggle selection
    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Select all visible
    const selectAll = () => {
        const filtered = getFilteredLeads();
        if (selectedIds.size === filtered.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map(l => l.id)));
        }
    };

    // Generate emails for selected leads
    const handleGenerateEmails = async () => {
        if (selectedIds.size === 0) return;
        setGenerating(true);
        setGenResult(null);

        try {
            const res = await fetch('/api/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadIds: Array.from(selectedIds) }),
            });

            const data = await res.json();

            if (!res.ok) {
                setGenResult({ type: 'error', message: data.error });
            } else {
                setGenResult({
                    type: 'success',
                    message: `${data.emails.length} emails generated — view them in the Email Queue`,
                });
                setSelectedIds(new Set());
                fetchLeads(); // Refresh to show updated statuses
            }
        } catch (err) {
            setGenResult({ type: 'error', message: err.message });
        } finally {
            setGenerating(false);
        }
    };

    // Generate email for a single lead (from card button)
    const handleGenerateSingleEmail = async (leadId) => {
        setGenerating(true);
        setGenResult(null);
        try {
            const res = await fetch('/api/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadIds: [leadId] }),
            });
            const data = await res.json();
            if (!res.ok) {
                setGenResult({ type: 'error', message: data.error });
            } else {
                setGenResult({ type: 'success', message: `Email drafted — check the Email Queue` });
                fetchLeads();
            }
        } catch (err) {
            setGenResult({ type: 'error', message: err.message });
        } finally {
            setGenerating(false);
        }
    };

    // Open Dialer Modal & Generate Script
    const handleOpenDialer = async (lead) => {
        setDialerLead(lead);
        setScriptError(null);
        if (!lead.phone_script) {
            setGeneratingScript(true);
            try {
                const res = await fetch('/api/scripts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ leadId: lead.id }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                // Update local list instantly
                lead.phone_script = data.phone_script;
                setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, phone_script: data.phone_script } : l));
            } catch (err) {
                setScriptError(err.message);
            } finally {
                setGeneratingScript(false);
            }
        }
    };

    // Log call outcome
    const handleCallOutcome = async (outcome) => {
        if (!dialerLead) return;
        try {
            const now = new Date().toISOString();
            await supabase.from('leads').update({
                call_outcome: outcome,
                last_called_at: now,
                status: 'contacted',
            }).eq('id', dialerLead.id);

            // Log to intelligence
            await supabase.from('intelligence_log').insert({
                action_type: 'call_outcome',
                industry: dialerLead.category?.toLowerCase()?.trim() || null,
                lead_id: dialerLead.id,
                outcome: outcome,
                metadata: {
                    business_name: dialerLead.business_name,
                    city: dialerLead.city,
                    has_website: dialerLead.has_website,
                    google_rating: dialerLead.google_rating,
                },
            });

            setLeads(prev => prev.map(l => l.id === dialerLead.id ?
                { ...l, call_outcome: outcome, last_called_at: now, status: 'contacted' } : l
            ));

            setDialerLead(null);
        } catch (err) {
            console.error('Outcome error:', err);
        }
    };

    // Handle Call Back — show date picker instead of closing
    const handleCallBackClick = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setCallbackPicker({ leadId: dialerLead.id, date: tomorrow.toISOString().split('T')[0] });
    };

    // Save callback date and log the outcome
    const handleCallbackSave = async () => {
        if (!callbackPicker || !dialerLead) return;
        try {
            const now = new Date().toISOString();
            await supabase.from('leads').update({
                call_outcome: 'call_back',
                last_called_at: now,
                status: 'contacted',
                callback_date: callbackPicker.date,
            }).eq('id', dialerLead.id);

            // Log to intelligence
            await supabase.from('intelligence_log').insert({
                action_type: 'call_outcome',
                industry: dialerLead.category?.toLowerCase()?.trim() || null,
                lead_id: dialerLead.id,
                outcome: 'call_back',
                metadata: {
                    business_name: dialerLead.business_name,
                    callback_date: callbackPicker.date,
                },
            });

            setLeads(prev => prev.map(l => l.id === dialerLead.id ?
                { ...l, call_outcome: 'call_back', last_called_at: now, status: 'contacted', callback_date: callbackPicker.date } : l
            ));

            setCallbackPicker(null);
            setDialerLead(null);
        } catch (err) {
            console.error('Callback save error:', err);
        }
    };

    // Advance lead status in pipeline
    const handleStatusUpdate = async (leadId, newStatus) => {
        try {
            await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
        } catch (err) {
            console.error('Status update error:', err);
        }
    };

    // Quick inline call log — records call immediately
    const handleQuickLog = async (lead, outcome) => {
        try {
            const now = new Date().toISOString();
            await supabase.from('leads').update({
                call_outcome: outcome,
                last_called_at: now,
                status: 'contacted',
            }).eq('id', lead.id);

            await supabase.from('intelligence_log').insert({
                action_type: 'call_outcome',
                industry: lead.category?.toLowerCase()?.trim() || null,
                lead_id: lead.id,
                outcome: outcome,
                metadata: { business_name: lead.business_name, quick_log: true },
            });

            setLeads(prev => prev.map(l => l.id === lead.id ?
                { ...l, call_outcome: outcome, last_called_at: now, status: 'contacted' } : l
            ));
            setQuickLogId(null);
        } catch (err) {
            console.error('Quick log error:', err);
        }
    };

    // Transition from dialer to quiz
    const handleDialerToQuiz = () => {
        const lead = dialerLead;
        setDialerLead(null);
        handleOpenCaseStudy(lead);
    };

    // Delete confirmation
    const requestDelete = (id, name) => {
        setDeleteConfirm({ type: 'single', id, name });
    };

    const requestBulkDelete = () => {
        if (selectedIds.size === 0) return;
        setDeleteConfirm({ type: 'bulk', ids: Array.from(selectedIds) });
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        try {
            if (deleteConfirm.type === 'single') {
                await supabase.from('leads').delete().eq('id', deleteConfirm.id);
                setLeads(prev => prev.filter(l => l.id !== deleteConfirm.id));
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    next.delete(deleteConfirm.id);
                    return next;
                });
            } else if (deleteConfirm.type === 'bulk') {
                await supabase.from('leads').delete().in('id', deleteConfirm.ids);
                setLeads(prev => prev.filter(l => !deleteConfirm.ids.includes(l.id)));
                setSelectedIds(new Set());
            }
        } catch (err) {
            console.error('Delete error:', err);
        } finally {
            setDeleteConfirm(null);
        }
    };

    // Save a note for a lead
    const handleSaveNote = async (leadId) => {
        try {
            await supabase.from('leads').update({ notes: noteEditValue }).eq('id', leadId);
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes: noteEditValue } : l));
            setNoteEditId(null);
            setNoteEditValue('');
        } catch (err) {
            console.error('Note save error:', err);
        }
    };

    // Toggle a tag on a lead
    const handleToggleTag = async (leadId, tagKey) => {
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;
        const currentTags = lead.tags || [];
        const newTags = currentTags.includes(tagKey)
            ? currentTags.filter(t => t !== tagKey)
            : [...currentTags, tagKey];
        try {
            await supabase.from('leads').update({ tags: newTags }).eq('id', leadId);
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, tags: newTags } : l));
        } catch (err) {
            console.error('Tag toggle error:', err);
        }
    };

    // Open Case Study Modal — immediately fetch smart questions
    const handleOpenCaseStudy = async (lead) => {
        setCaseStudyLead(lead);
        setCsStep('loading');
        setCsQuestions([]);
        setCsAnswers([]);
        setCsCurrentQ(0);
        setCsPlan('');
        try {
            const res = await fetch('/api/portfolio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'questions',
                    business_name: lead.business_name,
                    category: lead.category,
                    city: lead.city,
                    google_rating: lead.google_rating,
                    review_count: lead.review_count,
                    has_website: lead.has_website,
                    website_url: lead.website_url,
                }),
            });
            const data = await res.json();
            if (data.questions) {
                setCsQuestions(data.questions);
                setCsStep('questions');
            }
        } catch (err) {
            console.error('Questions error:', err);
        }
    };

    // Handle answer selection
    const handleCsAnswer = async (answer) => {
        const newAnswers = [...csAnswers, { question: csQuestions[csCurrentQ].question, answer }];
        setCsAnswers(newAnswers);

        if (csCurrentQ < csQuestions.length - 1) {
            setCsCurrentQ(csCurrentQ + 1);
        } else {
            // All questions answered — generate the plan
            setCsStep('generating');
            try {
                const res = await fetch('/api/portfolio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'generate',
                        business_name: caseStudyLead.business_name,
                        category: caseStudyLead.category,
                        city: caseStudyLead.city,
                        google_rating: caseStudyLead.google_rating,
                        review_count: caseStudyLead.review_count,
                        has_website: caseStudyLead.has_website,
                        website_url: caseStudyLead.website_url,
                        answers: newAnswers,
                    }),
                });
                const data = await res.json();
                if (data.case_study) {
                    setCsPlan(data.case_study);
                    setCsStep('plan');
                }
            } catch (err) {
                console.error('Plan generation error:', err);
            }
        }
    };

    // Save plan to portfolio
    const handleSavePlan = async () => {
        if (!caseStudyLead || !csPlan) return;
        setCsStep('saving');
        try {
            const res = await fetch('/api/portfolio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save',
                    client_name: caseStudyLead.business_name,
                    industry: caseStudyLead.category,
                    case_study: csPlan,
                    answers_json: JSON.stringify(csAnswers),
                }),
            });
            const data = await res.json();
            if (data.showcase) {
                setCsStep('saved');
            }
        } catch (err) {
            console.error('Save error:', err);
        }
    };

    const getFilteredLeads = () => {
        return leads.filter(l => {
            if (websiteFilter === 'none' && l.has_website) return false;
            if (websiteFilter === 'has' && !l.has_website) return false;
            if (tagFilter !== 'all') {
                const tags = l.tags || [];
                if (!tags.includes(tagFilter)) return false;
            }
            if (teamFilter !== 'all') {
                const claimedName = getUserName(l.claimed_by);
                if (teamFilter === 'mine') {
                    if (getUserName(userEmail) !== claimedName) return false;
                } else {
                    if (claimedName !== teamFilter) return false;
                }
            }
            return true;
        });
    };

    const sortedAndFiltered = getFilteredLeads().sort((a, b) => {
        switch (sortBy) {
            case 'newest': return new Date(b.scraped_at || 0) - new Date(a.scraped_at || 0);
            case 'oldest': return new Date(a.scraped_at || 0) - new Date(b.scraped_at || 0);
            case 'az': return (a.business_name || '').localeCompare(b.business_name || '');
            case 'za': return (b.business_name || '').localeCompare(a.business_name || '');
            case 'category': return (a.category || '').localeCompare(b.category || '');
            case 'score': return (b.lead_score || 0) - (a.lead_score || 0);
            default: return 0;
        }
    });
    const filteredLeads = sortedAndFiltered;

    return (
        <div className={styles.page}>
            <TronGrid />
            <div className={styles.container}>
                <header className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Saved Leads</h1>
                        <p className={styles.subtitle}>Your curated prospect list</p>
                    </div>
                    <div className={styles.headerActions}>
                        <TronButton onClick={() => router.push('/emails')} variant="primary" size="sm">
                            📧 Email Queue
                        </TronButton>
                        <TronButton onClick={() => router.push('/leads')} variant="secondary" size="sm">
                            🔍 Scanner
                        </TronButton>
                        <TronButton onClick={() => router.push('/dashboard')} variant="secondary" size="sm">
                            ← Dashboard
                        </TronButton>
                    </div>
                </header>

                {/* Action Bar */}
                <div className={styles.actionBar}>
                    <div className={styles.filterGroup}>
                        <div className={styles.statusTabs}>
                            <button
                                className={`${styles.statusTab} ${websiteFilter === 'all' ? styles.active : ''}`}
                                onClick={() => setWebsiteFilter('all')}
                            >
                                ALL ({leads.length})
                            </button>
                            <button
                                className={`${styles.statusTab} ${styles.hotTab} ${websiteFilter === 'none' ? styles.activeHot : ''}`}
                                onClick={() => setWebsiteFilter('none')}
                            >
                                NO WEBSITE ({leads.filter(l => !l.has_website).length})
                            </button>
                            <button
                                className={`${styles.statusTab} ${websiteFilter === 'has' ? styles.active : ''}`}
                                onClick={() => setWebsiteFilter('has')}
                            >
                                HAS WEBSITE ({leads.filter(l => l.has_website).length})
                            </button>
                        </div>
                    </div>

                    <div className={styles.searchField}>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search saved leads..."
                        />
                    </div>

                    <div className={styles.selectionActions}>
                        <TronButton onClick={selectAll} size="sm" variant="secondary">
                            {selectedIds.size === filteredLeads.length && filteredLeads.length > 0 ? 'Deselect All' : `Select All (${filteredLeads.length})`}
                        </TronButton>
                        {selectedIds.size > 0 && (
                            <TronButton
                                onClick={handleGenerateEmails}
                                loading={generating}
                                size="sm"
                                variant="primary"
                            >
                                ✉️ Generate {selectedIds.size} Email{selectedIds.size > 1 ? 's' : ''}
                            </TronButton>
                        )}
                        {selectedIds.size > 0 && (
                            <button className={styles.bulkDeleteBtn} onClick={requestBulkDelete}>
                                🗑 Delete {selectedIds.size} Lead{selectedIds.size > 1 ? 's' : ''}
                            </button>
                        )}
                    </div>
                </div>

                {/* Tag Filter */}
                <div className={styles.tagFilterRow}>
                    <span className={styles.tagFilterLabel}>Filter:</span>
                    <button className={`${styles.tagFilterBtn} ${tagFilter === 'all' ? styles.tagFilterActive : ''}`} onClick={() => setTagFilter('all')}>All</button>
                    {PRESET_TAGS.map(tag => (
                        <button
                            key={tag.key}
                            className={`${styles.tagFilterBtn} ${tagFilter === tag.key ? styles.tagFilterActive : ''}`}
                            style={tagFilter === tag.key ? { borderColor: tag.color, color: tag.color } : {}}
                            onClick={() => setTagFilter(tagFilter === tag.key ? 'all' : tag.key)}
                        >
                            {tag.label}
                        </button>
                    ))}
                </div>
                {/* Team Filter */}
                <div className={styles.tagFilterRow}>
                    <span className={styles.tagFilterLabel}>Team:</span>
                    {(() => {
                        const counts = { all: leads.length, mine: 0, Amiri: 0, Toby: 0, Yaz: 0 };
                        leads.forEach(l => {
                            const name = getUserName(l.claimed_by);
                            if (name && counts[name] !== undefined) counts[name]++;
                            if (name === getUserName(userEmail)) counts.mine++;
                        });
                        return [
                            { key: 'all', label: 'All', color: null },
                            { key: 'mine', label: '👤 Mine', color: null },
                            { key: 'Amiri', label: 'Amiri', color: '#00d4ff' },
                            { key: 'Toby', label: 'Toby', color: '#ff8c00' },
                            { key: 'Yaz', label: 'Yaz', color: '#c084fc' },
                        ].map(opt => (
                            <button
                                key={opt.key}
                                className={`${styles.tagFilterBtn} ${teamFilter === opt.key ? styles.tagFilterActive : ''}`}
                                style={teamFilter === opt.key && opt.color ? { borderColor: opt.color, color: opt.color } : {}}
                                onClick={() => setTeamFilter(teamFilter === opt.key ? 'all' : opt.key)}
                            >
                                {opt.label} ({counts[opt.key] || 0})
                            </button>
                        ));
                    })()}
                </div>

                {/* Sort */}
                <div className={styles.tagFilterRow}>
                    <span className={styles.tagFilterLabel}>Sort:</span>
                    <select
                        className={styles.sortSelect}
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="az">A → Z</option>
                        <option value="za">Z → A</option>
                        <option value="category">Business Type</option>
                        <option value="score">Lead Score</option>
                    </select>
                </div>

                {genResult && (
                    <div className={`${styles.genResult} ${styles[genResult.type]}`}>
                        {genResult.type === 'success' ? '✅' : '⚠️'} {genResult.message}
                    </div>
                )}

                {/* Inline Generating State */}
                {generating && (
                    <div className={styles.inlineGeneratingBar}>
                        <div className={styles.inlineProgressContainer}>
                            <div className={styles.inlineProgressFill} />
                        </div>
                        <div className={styles.inlineGeneratingText}>
                            <span className={styles.pulsingDot}></span>
                            Engaging AI Sequence — Crafting {selectedIds.size} personalized email{selectedIds.size > 1 ? 's' : ''}...
                        </div>
                    </div>
                )}

                {/* Leads List */}
                <div className={styles.leadsList}>
                    {loading ? (
                        <TronCard className={styles.emptyState}><p>Loading saved leads...</p></TronCard>
                    ) : filteredLeads.length === 0 ? (
                        <TronCard className={styles.emptyState}>
                            <p>No saved leads yet. Go to the Scanner to find and save prospects.</p>
                        </TronCard>
                    ) : (
                        filteredLeads.map((lead) => (
                            <TronCard
                                key={lead.id}
                                className={`${styles.leadCard} ${selectedIds.has(lead.id) ? styles.selected : ''}`}
                                animate={false}
                            >
                                <div className={styles.leadRow}>
                                    <label className={styles.checkbox}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(lead.id)}
                                            onChange={() => toggleSelect(lead.id)}
                                        />
                                        <span className={styles.checkmark} />
                                    </label>

                                    <div className={styles.leadContent}>
                                        <div className={styles.leadHeader}>
                                            <div>
                                                <h3 className={styles.leadName}>{lead.business_name}</h3>
                                                <span className={styles.leadMeta}>
                                                    {lead.category} · {lead.city}{lead.state ? `, ${lead.state}` : ''}
                                                    {lead.google_rating ? ` · ⭐${lead.google_rating}` : ''}
                                                    {lead.phone ? ` · ${lead.phone}` : ''}
                                                </span>
                                            </div>
                                            <div className={styles.leadRight}>
                                                <span
                                                    className={styles.scoreBadge}
                                                    style={{ color: getScoreColor(lead.lead_score), borderColor: getScoreColor(lead.lead_score) }}
                                                >
                                                    {lead.lead_score}
                                                </span>
                                                {lead.call_outcome && (
                                                    <button
                                                        className={styles[`outcome_${lead.call_outcome}`] || styles.outcomeBadge}
                                                        title="Click to clear"
                                                        onClick={async () => {
                                                            await supabase.from('leads').update({ call_outcome: null }).eq('id', lead.id);
                                                            setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, call_outcome: null } : l));
                                                        }}
                                                    >
                                                        {lead.call_outcome === 'interested' && '👍 INTERESTED'}
                                                        {lead.call_outcome === 'not_interested' && '👎 NOT INTERESTED'}
                                                        {lead.call_outcome === 'call_back' && '📞 CALL BACK'}
                                                        {lead.call_outcome === 'no_answer' && '📵 NO ANSWER'}
                                                        {lead.call_outcome === 'wrong_number' && '❌ WRONG #'}
                                                        {' ✕'}
                                                    </button>
                                                )}
                                                <span className={lead.has_website ? styles.hasWebsite : styles.noWebsite}>
                                                    {lead.has_website ? 'HAS SITE' : 'NO SITE'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Tags Row */}
                                        <div className={styles.tagRow}>
                                            <div className={styles.tagList}>
                                                {(lead.tags || []).map(tagKey => {
                                                    const tag = PRESET_TAGS.find(t => t.key === tagKey);
                                                    return tag ? (
                                                        <span
                                                            key={tagKey}
                                                            className={styles.tag}
                                                            style={{ borderColor: tag.color, color: tag.color }}
                                                            onClick={() => handleToggleTag(lead.id, tagKey)}
                                                            title="Click to remove"
                                                        >
                                                            {tag.label} ×
                                                        </span>
                                                    ) : null;
                                                })}
                                                {PRESET_TAGS.filter(t => !(lead.tags || []).includes(t.key)).map(tag => (
                                                    <button
                                                        key={tag.key}
                                                        className={styles.tagAddBtn}
                                                        onClick={() => handleToggleTag(lead.id, tag.key)}
                                                        title={`Add ${tag.label}`}
                                                    >
                                                        {tag.label.split(' ')[0]}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        {noteEditId === lead.id ? (
                                            <div className={styles.noteEditor}>
                                                <textarea
                                                    className={styles.noteInput}
                                                    value={noteEditValue}
                                                    onChange={(e) => setNoteEditValue(e.target.value)}
                                                    placeholder="Add a note about this lead..."
                                                    rows={2}
                                                    autoFocus
                                                />
                                                <div className={styles.noteActions}>
                                                    <button className={styles.noteSaveBtn} onClick={() => handleSaveNote(lead.id)}>Save</button>
                                                    <button className={styles.noteCancelBtn} onClick={() => setNoteEditId(null)}>Cancel</button>
                                                </div>
                                            </div>
                                        ) : lead.notes ? (
                                            <div className={styles.noteDisplay} onClick={() => { setNoteEditId(lead.id); setNoteEditValue(lead.notes || ''); }}>
                                                <span className={styles.noteIcon}>📝</span> {lead.notes}
                                            </div>
                                        ) : (
                                            <button className={styles.addNoteBtn} onClick={() => { setNoteEditId(lead.id); setNoteEditValue(''); }}>
                                                + Add Note
                                            </button>
                                        )}

                                        <div className={styles.leadFooter}>
                                            <div className={styles.leadLinks}>
                                                {lead.google_maps_url && (
                                                    <a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer">Maps</a>
                                                )}
                                                {lead.website_url && (
                                                    <a href={lead.website_url} target="_blank" rel="noopener noreferrer">Website</a>
                                                )}
                                                <button
                                                    className={`${styles.dialBtn} ${quickLogId === lead.id ? styles.dialBtnActive : ''}`}
                                                    onClick={() => setQuickLogId(quickLogId === lead.id ? null : lead.id)}
                                                >
                                                    📞 LOG CALL
                                                </button>
                                                <button className={styles.scriptBtn} onClick={() => handleOpenDialer(lead)}>
                                                    📋 SCRIPT
                                                </button>
                                                <button className={styles.caseStudyBtn} onClick={() => handleOpenCaseStudy(lead)}>
                                                    📸 Case Study
                                                </button>
                                                <button className={styles.emailBtn} onClick={() => handleGenerateSingleEmail(lead.id)} disabled={generating}>
                                                    ✉️ Email
                                                </button>
                                                <button
                                                    className={styles.proposalBtn}
                                                    onClick={async () => {
                                                        const LOADING_MSGS = [
                                                            // PHASE 1: RECON
                                                            { text: '═══════════════════════════════════════════', delay: 0, phase: 0, progress: 0 },
                                                            { text: 'INITIALIZING CAELBORNE PROPOSAL ENGINE v2.1', delay: 200, phase: 0, progress: 2 },
                                                            { text: '═══════════════════════════════════════════', delay: 400, phase: 0, progress: 3 },
                                                            { text: '', delay: 600, phase: 0, progress: 5 },
                                                            { text: `▸ TARGET ACQUIRED: ${lead.business_name.toUpperCase()}`, delay: 800, phase: 1, progress: 8 },
                                                            { text: `▸ SECTOR: ${(lead.category || 'Local Business').toUpperCase()}`, delay: 1100, phase: 1, progress: 10 },
                                                            { text: `▸ LOCATION: ${(lead.city || 'Unknown').toUpperCase()}${lead.state ? `, ${lead.state.toUpperCase()}` : ''}`, delay: 1400, phase: 1, progress: 12 },
                                                            { text: `▸ RATING: ${lead.google_rating || 'N/A'}★ (${lead.review_count || 0} reviews)`, delay: 1700, phase: 1, progress: 15 },
                                                            { text: `▸ WEBSITE: ${lead.has_website ? 'EXISTS — UPGRADE OPPORTUNITY' : 'NONE — HIGH PRIORITY'}`, delay: 2000, phase: 1, progress: 18 },
                                                            { text: '', delay: 2200, phase: 1, progress: 20 },
                                                            // PHASE 2: ANALYSIS
                                                            { text: '[PHASE 2] MARKET ANALYSIS', delay: 2500, phase: 2, progress: 22 },
                                                            { text: '  Scanning local competitor web presence...', delay: 3000, phase: 2, progress: 28 },
                                                            { text: '  Evaluating regional market rates...', delay: 4000, phase: 2, progress: 35 },
                                                            { text: '  Analyzing business revenue indicators...', delay: 5000, phase: 2, progress: 40 },
                                                            { text: '  Classifying pricing tier...', delay: 6000, phase: 2, progress: 45 },
                                                            { text: '', delay: 6500, phase: 2, progress: 48 },
                                                            // PHASE 3: STRATEGY
                                                            { text: '[PHASE 3] STRATEGY GENERATION', delay: 7000, phase: 3, progress: 50 },
                                                            { text: '  AI drafting executive summary...', delay: 7500, phase: 3, progress: 55 },
                                                            { text: '  Identifying pain points specific to industry...', delay: 8500, phase: 3, progress: 60 },
                                                            { text: '  Crafting tailored solution strategy...', delay: 9500, phase: 3, progress: 65 },
                                                            { text: '  Building custom pricing tiers...', delay: 10500, phase: 3, progress: 72 },
                                                            { text: '  Generating feature recommendations...', delay: 11500, phase: 3, progress: 78 },
                                                            { text: '', delay: 12000, phase: 3, progress: 80 },
                                                            // PHASE 4: ASSEMBLY
                                                            { text: '[PHASE 4] DOCUMENT ASSEMBLY', delay: 12500, phase: 4, progress: 82 },
                                                            { text: '  Rendering cover page...', delay: 13000, phase: 4, progress: 85 },
                                                            { text: '  Laying out pricing grid...', delay: 14000, phase: 4, progress: 90 },
                                                            { text: '  Encoding PDF document...', delay: 15000, phase: 4, progress: 95 },
                                                            { text: '  Finalizing proposal package...', delay: 16000, phase: 4, progress: 98 },
                                                        ];
                                                        setProposalLoading({ leadName: lead.business_name, leadCategory: lead.category || 'Local Business', logs: [], phase: 0, progress: 0 });
                                                        const timers = LOADING_MSGS.map(msg =>
                                                            setTimeout(() => {
                                                                setProposalLoading(prev => prev ? {
                                                                    ...prev,
                                                                    phase: msg.phase,
                                                                    progress: msg.progress,
                                                                    logs: [...prev.logs, { text: msg.text, time: new Date().toLocaleTimeString('en-US', { hour12: false }) }]
                                                                } : prev);
                                                            }, msg.delay)
                                                        );
                                                        try {
                                                            const res = await fetch('/api/proposal', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ leadId: lead.id }),
                                                            });
                                                            timers.forEach(t => clearTimeout(t));
                                                            if (!res.ok) {
                                                                const err = await res.json();
                                                                setProposalLoading(null);
                                                                setGenResult({ type: 'error', message: err.error || 'Proposal failed' });
                                                                return;
                                                            }
                                                            const data = await res.json();
                                                            setProposalLoading(null);
                                                            setProposalData(data);
                                                        } catch (err) {
                                                            timers.forEach(t => clearTimeout(t));
                                                            setProposalLoading(null);
                                                            setGenResult({ type: 'error', message: err.message });
                                                        }
                                                    }}
                                                    disabled={!!proposalLoading}
                                                >
                                                    📄 Proposal
                                                </button>
                                                {lead.website_url && (
                                                    <button
                                                        className={styles.auditBtn}
                                                        onClick={async () => {
                                                            const AUDIT_MSGS = [
                                                                { text: 'INITIALIZING WEBSITE AUDIT ENGINE...', delay: 0, progress: 0 },
                                                                { text: `TARGET: ${lead.website_url}`, delay: 500, progress: 2 },
                                                                { text: '', delay: 800, progress: 3 },
                                                                { text: '═══ PHASE 1: MOBILE ANALYSIS ═══', delay: 1200, progress: 5 },
                                                                { text: '  Resolving DNS...', delay: 2000, progress: 7 },
                                                                { text: '  Establishing TLS handshake...', delay: 3000, progress: 9 },
                                                                { text: '  Loading page resources...', delay: 4000, progress: 12 },
                                                                { text: '  Parsing DOM structure...', delay: 5500, progress: 15 },
                                                                { text: '  Measuring First Contentful Paint (FCP)...', delay: 7000, progress: 18 },
                                                                { text: '  Measuring Largest Contentful Paint (LCP)...', delay: 8500, progress: 21 },
                                                                { text: '  Calculating Total Blocking Time (TBT)...', delay: 10000, progress: 24 },
                                                                { text: '  Measuring Cumulative Layout Shift (CLS)...', delay: 11500, progress: 27 },
                                                                { text: '  Checking mobile viewport configuration...', delay: 13000, progress: 30 },
                                                                { text: '  Testing tap target sizing...', delay: 14000, progress: 33 },
                                                                { text: '  Scanning for render-blocking resources...', delay: 15500, progress: 36 },
                                                                { text: '  Analyzing image optimization...', delay: 17000, progress: 39 },
                                                                { text: '  Checking text compression (GZIP/Brotli)...', delay: 18500, progress: 42 },
                                                                { text: '  MOBILE AUDIT COMPLETE ✓', delay: 20000, progress: 45 },
                                                                { text: '', delay: 21000, progress: 47 },
                                                                { text: '═══ PHASE 2: DESKTOP ANALYSIS ═══', delay: 22000, progress: 48 },
                                                                { text: '  Loading desktop viewport...', delay: 23500, progress: 52 },
                                                                { text: '  Measuring performance metrics...', delay: 25000, progress: 56 },
                                                                { text: '  Testing JavaScript execution...', delay: 27000, progress: 60 },
                                                                { text: '  Checking server response time (TTFB)...', delay: 29000, progress: 64 },
                                                                { text: '  Analyzing CSS efficiency...', delay: 31000, progress: 68 },
                                                                { text: '  Scanning meta tags & SEO compliance...', delay: 33000, progress: 72 },
                                                                { text: '  Testing accessibility (WCAG 2.1)...', delay: 35000, progress: 76 },
                                                                { text: '  Checking HTTPS security headers...', delay: 37000, progress: 80 },
                                                                { text: '  DESKTOP AUDIT COMPLETE ✓', delay: 39000, progress: 84 },
                                                                { text: '', delay: 40000, progress: 86 },
                                                                { text: '═══ PHASE 3: COMPILING REPORT ═══', delay: 41000, progress: 88 },
                                                                { text: '  Generating score breakdown...', delay: 43000, progress: 90 },
                                                                { text: '  Identifying improvement opportunities...', delay: 45000, progress: 92 },
                                                                { text: '  Building pitch recommendations...', delay: 47000, progress: 94 },
                                                                { text: '  Finalizing audit report...', delay: 50000, progress: 95 },
                                                            ];
                                                            setAuditLoading({ leadName: lead.business_name, url: lead.website_url, logs: [], progress: 0 });
                                                            const timers = AUDIT_MSGS.map(msg =>
                                                                setTimeout(() => {
                                                                    setAuditLoading(prev => prev ? {
                                                                        ...prev,
                                                                        progress: msg.progress,
                                                                        logs: [...prev.logs, { text: msg.text, time: new Date().toLocaleTimeString('en-US', { hour12: false }) }]
                                                                    } : prev);
                                                                }, msg.delay)
                                                            );
                                                            try {
                                                                const res = await fetch('/api/audit', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ leadId: lead.id, url: lead.website_url, businessName: lead.business_name, category: lead.category }),
                                                                });
                                                                timers.forEach(t => clearTimeout(t));
                                                                if (!res.ok) {
                                                                    const err = await res.json();
                                                                    setAuditLoading(null);
                                                                    setGenResult({ type: 'error', message: err.error || 'Audit failed' });
                                                                    return;
                                                                }
                                                                const data = await res.json();
                                                                setAuditLoading(null);
                                                                setAuditData({ ...data, leadName: lead.business_name });
                                                            } catch (err) {
                                                                timers.forEach(t => clearTimeout(t));
                                                                setAuditLoading(null);
                                                                setGenResult({ type: 'error', message: err.message });
                                                            }
                                                        }}
                                                        disabled={!!auditLoading}
                                                    >
                                                        🔍 Audit
                                                    </button>
                                                )}
                                                {lead.claimed_by && (
                                                    <span className={styles.claimBtn} style={{
                                                        background: `${getTeamColor(lead.claimed_by)}15`,
                                                        borderColor: `${getTeamColor(lead.claimed_by)}50`,
                                                        color: getTeamColor(lead.claimed_by),
                                                        cursor: 'default',
                                                    }}>
                                                        {getUserName(lead.claimed_by)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className={styles.leadStatus}>
                                                <span className={`badge badge-${lead.status === 'saved' ? 'cyan' : lead.status === 'contacted' ? 'amber' : lead.status === 'meeting' ? 'green' : lead.status === 'closed' ? 'green' : 'cyan'}`}>
                                                    {lead.status?.toUpperCase()}
                                                </span>
                                                {/* Pipeline advancement buttons */}
                                                {lead.status === 'contacted' && lead.call_outcome === 'interested' && (
                                                    <button className={styles.pipelineBtn} onClick={() => handleStatusUpdate(lead.id, 'meeting')}>
                                                        ▸ SET MEETING
                                                    </button>
                                                )}
                                                {lead.status === 'meeting' && (
                                                    <button className={styles.pipelineBtnClose} onClick={() => handleStatusUpdate(lead.id, 'closed')}>
                                                        ★ CLOSE DEAL
                                                    </button>
                                                )}
                                                {lead.status === 'closed' && (
                                                    <span className={styles.closedBadge}>✓ CLOSED</span>
                                                )}
                                                {lead.callback_date && (() => {
                                                    const today = new Date().toISOString().split('T')[0];
                                                    const isOverdue = lead.callback_date < today;
                                                    const isToday = lead.callback_date === today;
                                                    return (
                                                        <span className={`${styles.callbackBadge} ${isOverdue ? styles.callbackOverdue : isToday ? styles.callbackToday : ''}`}>
                                                            📅 {isOverdue ? 'OVERDUE' : isToday ? 'CALL TODAY' : new Date(lead.callback_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    );
                                                })()}
                                                <button className={styles.deleteBtn} onClick={() => requestDelete(lead.id, lead.business_name)}>✕</button>
                                            </div>
                                        </div>

                                        {/* Inline Quick Call Logger */}
                                        {quickLogId === lead.id && (
                                            <div className={styles.quickLogPanel}>
                                                <span className={styles.quickLogLabel}>LOG OUTCOME:</span>
                                                <div className={styles.quickLogBtns}>
                                                    <button className={styles.qlInterested} onClick={() => handleQuickLog(lead, 'interested')}>👍 INTERESTED</button>
                                                    <button className={styles.qlNotInterested} onClick={() => handleQuickLog(lead, 'not_interested')}>👎 NOT INT.</button>
                                                    <button className={styles.qlNoAnswer} onClick={() => handleQuickLog(lead, 'no_answer')}>📵 NO ANS.</button>
                                                    <button className={styles.qlCallBack} onClick={() => handleQuickLog(lead, 'call_back')}>📞 CALL BACK</button>
                                                    <button className={styles.qlWrong} onClick={() => handleQuickLog(lead, 'wrong_number')}>❌ WRONG #</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TronCard>
                        ))
                    )}
                </div>

                {/* Dialer Modal */}
                {dialerLead && (
                    <div className={styles.dialerOverlay}>
                        <div className={styles.dialerModal}>
                            <button className={styles.closeDialer} onClick={() => setDialerLead(null)}>✕</button>

                            <div className={styles.dialerHeader}>
                                <h2 className={styles.dialerTitle}>DIALING: {dialerLead.business_name}</h2>
                                <div className={styles.phoneNumber}>{dialerLead.phone || 'NO PHONE PROVIDED'}</div>
                                <div className={styles.dialerMeta}>
                                    {dialerLead.category} · {dialerLead.city} · Score: {dialerLead.lead_score}
                                </div>
                            </div>

                            <div className={styles.scriptBox}>
                                {generatingScript ? (
                                    <div className={styles.csLoadingScreen}>
                                        <div className={styles.csLoadingIcon}>{scriptLoadingMessages[scriptLoadingPhase % scriptLoadingMessages.length].icon}</div>
                                        <p className={styles.csLoadingText}>{scriptLoadingMessages[scriptLoadingPhase % scriptLoadingMessages.length].text}</p>
                                        <div className={styles.csLoadingStages}>
                                            {scriptLoadingMessages.map((msg, i) => (
                                                <div key={i} className={`${styles.csLoadingStage} ${i <= scriptLoadingPhase ? styles.csLoadingStageDone : ''}`}>
                                                    <span className={styles.csLoadingStageIcon}>{i <= scriptLoadingPhase ? '✓' : '○'}</span>
                                                    <span className={styles.csLoadingStageText}>{msg.text.replace('...', '')}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className={styles.csLoadingBar}>
                                            <div className={styles.csLoadingBarFill} style={{ animationDuration: `${scriptLoadingMessages.length * 2.5}s` }} />
                                        </div>
                                    </div>
                                ) : scriptError ? (
                                    <div className={styles.scriptError}>⚠️ {scriptError}</div>
                                ) : (
                                    <div className={styles.scriptContent}>
                                        {dialerLead.phone_script?.split('\n').map((line, i) => (
                                            <p key={i}>{line.replace(/\*\*/g, '')}</p>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className={styles.outcomeBar}>
                                <span className={styles.outcomeLabel}>LOG OUTCOME:</span>
                                <div className={styles.outcomeButtons}>
                                    <button onClick={() => handleCallOutcome('interested')} className={`${styles.outBtn} ${styles.outSuccess}`}>Interested</button>
                                    <button onClick={handleCallBackClick} className={`${styles.outBtn} ${styles.outWarn}`}>Call Back</button>
                                    <button onClick={() => handleCallOutcome('voicemail')} className={`${styles.outBtn} ${styles.outNeutral}`}>Voicemail</button>
                                    <button onClick={() => handleCallOutcome('not_interested')} className={`${styles.outBtn} ${styles.outFail}`}>Not Interested</button>
                                </div>
                            </div>

                            {/* Callback Date Picker */}
                            {callbackPicker && (
                                <div className={styles.callbackPicker}>
                                    <span className={styles.callbackLabel}>📅 When should you call back?</span>
                                    <div className={styles.callbackQuickBtns}>
                                        {[
                                            { label: 'Tomorrow', days: 1 },
                                            { label: 'In 2 Days', days: 2 },
                                            { label: 'Next Week', days: 7 },
                                        ].map(opt => {
                                            const d = new Date();
                                            d.setDate(d.getDate() + opt.days);
                                            const val = d.toISOString().split('T')[0];
                                            return (
                                                <button
                                                    key={opt.days}
                                                    className={`${styles.callbackQuickBtn} ${callbackPicker.date === val ? styles.callbackQuickActive : ''}`}
                                                    onClick={() => setCallbackPicker(prev => ({ ...prev, date: val }))}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <input
                                        type="date"
                                        className={styles.callbackDateInput}
                                        value={callbackPicker.date}
                                        onChange={(e) => setCallbackPicker(prev => ({ ...prev, date: e.target.value }))}
                                    />
                                    <div className={styles.callbackActions}>
                                        <button className={`${styles.outBtn} ${styles.outWarn}`} onClick={handleCallbackSave}>
                                            ✅ Set Reminder
                                        </button>
                                        <button className={`${styles.outBtn} ${styles.outNeutral}`} onClick={() => setCallbackPicker(null)}>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className={styles.quizLaunchBar}>
                                <button className={styles.quizLaunchBtn} onClick={handleDialerToQuiz}>
                                    📸 Start Website Quiz — Build a plan live on the call
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Case Study Modal — Multi-Step AI Planner */}
                {caseStudyLead && (
                    <div className={styles.dialerOverlay}>
                        <div className={styles.dialerModal}>
                            <button className={styles.closeDialer} onClick={() => setCaseStudyLead(null)}>✕</button>

                            <div className={styles.dialerHeader}>
                                <h2 className={styles.dialerTitle}>📸 WEBSITE PLANNER: {caseStudyLead.business_name}</h2>
                                <div className={styles.dialerMeta}>
                                    {caseStudyLead.category} · {caseStudyLead.city} · ⭐{caseStudyLead.google_rating || 'N/A'}
                                </div>
                                {csStep === 'questions' && (
                                    <div className={styles.csProgress}>
                                        {csQuestions.map((_, i) => (
                                            <span key={i} className={`${styles.csProgressDot} ${i < csCurrentQ ? styles.csProgressDone : i === csCurrentQ ? styles.csProgressActive : ''}`} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className={styles.scriptBox}>
                                {csStep === 'loading' && (
                                    <div className={styles.csLoadingScreen}>
                                        <div className={styles.csLoadingIcon}>{questionLoadingMessages[csLoadingPhase % questionLoadingMessages.length].icon}</div>
                                        <p className={styles.csLoadingText}>{questionLoadingMessages[csLoadingPhase % questionLoadingMessages.length].text}</p>
                                        <div className={styles.csLoadingBar}>
                                            <div className={styles.csLoadingBarFill} />
                                        </div>
                                    </div>
                                )}

                                {csStep === 'questions' && csQuestions[csCurrentQ] && (
                                    <div className={styles.csQuestionBlock}>
                                        {csQuestions[csCurrentQ].stage && (
                                            <p className={styles.csStageLabel}>{csQuestions[csCurrentQ].stage}</p>
                                        )}
                                        <p className={styles.csQuestionText}>{csQuestions[csCurrentQ].question}</p>
                                        <div className={styles.csOptionsGrid}>
                                            {csQuestions[csCurrentQ].options.map((opt, i) => (
                                                <button
                                                    key={i}
                                                    className={styles.csOption}
                                                    onClick={() => handleCsAnswer(opt)}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                        <p className={styles.csQuestionCount}>Q{csCurrentQ + 1} of {csQuestions.length}</p>
                                    </div>
                                )}

                                {csStep === 'generating' && (
                                    <div className={styles.csLoadingScreen}>
                                        <div className={styles.csLoadingIcon}>{loadingMessages[csLoadingPhase % loadingMessages.length].icon}</div>
                                        <p className={styles.csLoadingText}>{loadingMessages[csLoadingPhase % loadingMessages.length].text}</p>
                                        <div className={styles.csLoadingStages}>
                                            {loadingMessages.map((msg, i) => (
                                                <div key={i} className={`${styles.csLoadingStage} ${i <= csLoadingPhase ? styles.csLoadingStageDone : ''}`}>
                                                    <span className={styles.csLoadingStageIcon}>{i <= csLoadingPhase ? '✓' : '○'}</span>
                                                    <span className={styles.csLoadingStageText}>{msg.text.replace('...', '')}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className={styles.csLoadingBar}>
                                            <div className={styles.csLoadingBarFill} style={{ animationDuration: `${loadingMessages.length * 3}s` }} />
                                        </div>
                                    </div>
                                )}

                                {csStep === 'saving' && (
                                    <div className={styles.scriptLoading}>
                                        <span className={styles.pulsingDot}></span> Saving to portfolio...
                                    </div>
                                )}

                                {csStep === 'plan' && (
                                    <div className={styles.scriptContent}>
                                        {csPlan.split('\n').map((line, i) => (
                                            <p key={i}>{line.replace(/\*\*/g, '')}</p>
                                        ))}
                                    </div>
                                )}

                                {csStep === 'saved' && (
                                    <div className={styles.scriptContent} style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                                        <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>✅ Website plan saved to Portfolio!</p>
                                        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1rem' }}>View it anytime on the Portfolio page.</p>
                                        <TronButton onClick={() => setCaseStudyLead(null)} size="sm">Close</TronButton>
                                    </div>
                                )}
                            </div>

                            {csStep === 'plan' && (
                                <div className={styles.outcomeBar}>
                                    <div className={styles.outcomeButtons}>
                                        <button onClick={handleSavePlan} className={`${styles.outBtn} ${styles.outSuccess}`}>💾 Save to Portfolio</button>
                                        <button onClick={() => setCaseStudyLead(null)} className={`${styles.outBtn} ${styles.outNeutral}`}>Close</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {deleteConfirm && (
                    <div className={styles.dialerOverlay}>
                        <div className={styles.confirmModal}>
                            <p className={styles.confirmIcon}>⚠️</p>
                            <p className={styles.confirmText}>
                                {deleteConfirm.type === 'single'
                                    ? `Are you sure you want to delete ${deleteConfirm.name} from your list of leads?`
                                    : `Are you sure you want to delete ${deleteConfirm.ids.length} lead${deleteConfirm.ids.length > 1 ? 's' : ''} from your list?`}
                            </p>
                            <p className={styles.confirmSubtext}>This action cannot be undone.</p>
                            <div className={styles.confirmActions}>
                                <button className={`${styles.outBtn} ${styles.outFail}`} onClick={confirmDelete}>
                                    🗑 Yes, Delete
                                </button>
                                <button className={`${styles.outBtn} ${styles.outNeutral}`} onClick={() => setDeleteConfirm(null)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Proposal Loading Overlay */}
                {proposalLoading && (
                    <div className={styles.proposalOverlay}>
                        <div className={styles.proposalLoadingBox}>
                            <div className={styles.proposalLoadingHeader}>
                                <span className={styles.proposalLoadingDot} />
                                <span>CAELBORNE PROPOSAL ENGINE</span>
                                <span className={styles.proposalVersion}>v2.1</span>
                            </div>

                            {/* Phase Indicator */}
                            <div className={styles.phaseBar}>
                                {['RECON', 'ANALYSIS', 'STRATEGY', 'ASSEMBLY'].map((name, i) => (
                                    <div key={i} className={`${styles.phaseStep} ${proposalLoading.phase >= i + 1 ? styles.phaseActive : ''} ${proposalLoading.phase === i + 1 ? styles.phaseCurrent : ''}`}>
                                        <span className={styles.phaseNum}>{i + 1}</span>
                                        <span className={styles.phaseName}>{name}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Terminal */}
                            <div className={styles.proposalLoadingTerminal}>
                                <div className={styles.scanlineEffect} />
                                {proposalLoading.logs.map((log, i) => (
                                    <div key={i} className={`${styles.proposalLogLine} ${log.text.startsWith('[PHASE') ? styles.proposalLogPhase : ''} ${log.text.startsWith('═') ? styles.proposalLogSep : ''}`}>
                                        {log.text ? (
                                            <><span className={styles.proposalLogTime}>[{log.time}]</span> {log.text}</>
                                        ) : ''}
                                    </div>
                                ))}
                                <span className={styles.proposalCursor}>█</span>
                            </div>

                            {/* Progress Bar */}
                            <div className={styles.proposalProgressWrap}>
                                <div className={styles.proposalProgressTrack}>
                                    <div className={styles.proposalProgressFill} style={{ width: `${proposalLoading.progress || 0}%` }} />
                                </div>
                                <span className={styles.proposalProgressPct}>{proposalLoading.progress || 0}%</span>
                            </div>

                            <p className={styles.proposalLoadingSub}>
                                Generating proposal for <strong>{proposalLoading.leadName}</strong>
                                <span className={styles.proposalLoadingCategory}> · {proposalLoading.leadCategory}</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* Proposal Preview Modal */}
                {proposalData && (
                    <div className={styles.proposalOverlay}>
                        <div className={styles.proposalPreview}>
                            <div className={styles.proposalPreviewHeader}>
                                <h2>📄 Proposal Preview</h2>
                                <div className={styles.proposalPreviewActions}>
                                    <button className={styles.proposalDownloadBtn} onClick={() => {
                                        const bytes = Uint8Array.from(atob(proposalData.pdfBase64), c => c.charCodeAt(0));
                                        const blob = new Blob([bytes], { type: 'application/pdf' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = proposalData.filename;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    }}>⬇ Download PDF</button>
                                    <button className={styles.proposalCloseBtn} onClick={() => setProposalData(null)}>✕ Close</button>
                                </div>
                            </div>

                            <div className={styles.proposalPreviewBody}>
                                {/* Cover Section */}
                                <div className={styles.ppSection}>
                                    <div className={styles.ppBrand}>CAELBORNE DIGITAL</div>
                                    <h1 className={styles.ppTitle}>Website Proposal</h1>
                                    <p className={styles.ppHeadline}>{proposalData.content.headline}</p>
                                    <div className={styles.ppMeta}>
                                        <span>Prepared for <strong>{proposalData.lead.business_name}</strong></span>
                                        <span>{proposalData.lead.city}{proposalData.lead.state ? `, ${proposalData.lead.state}` : ''}</span>
                                        <span>{proposalData.lead.category || 'Local Business'}</span>
                                        {proposalData.lead.google_rating && <span>{proposalData.lead.google_rating}★ ({proposalData.lead.review_count} reviews)</span>}
                                    </div>
                                </div>

                                {/* Executive Summary */}
                                <div className={styles.ppSection}>
                                    <h2 className={styles.ppSectionTitle}>Executive Summary</h2>
                                    <p className={styles.ppText}>{proposalData.content.executive_summary}</p>
                                </div>

                                {/* Pain Points */}
                                <div className={styles.ppSection}>
                                    <h3 className={styles.ppSubTitle}>The Challenge</h3>
                                    {proposalData.content.pain_points.map((p, i) => (
                                        <div key={i} className={styles.ppPainPoint}>
                                            <span className={styles.ppNumber}>{i + 1}</span>
                                            <p>{p}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Solution */}
                                <div className={styles.ppSection}>
                                    <h3 className={styles.ppSubTitle}>Our Solution</h3>
                                    <p className={styles.ppText}>{proposalData.content.solution_overview}</p>
                                </div>

                                {/* Pricing Tiers */}
                                <div className={styles.ppSection}>
                                    <h2 className={styles.ppSectionTitle}>Investment Options</h2>
                                    <p className={styles.ppRationale}>{proposalData.content.pricing_rationale}</p>
                                    <div className={styles.ppTierGrid}>
                                        {[
                                            { name: proposalData.content.pricing.starter_name, price: proposalData.content.pricing.starter_price, tag: proposalData.content.pricing.starter_tagline, features: proposalData.content.features_starter, rec: false },
                                            { name: proposalData.content.pricing.pro_name, price: proposalData.content.pricing.pro_price, tag: proposalData.content.pricing.pro_tagline, features: proposalData.content.features_pro, rec: true },
                                            { name: proposalData.content.pricing.premium_name, price: proposalData.content.pricing.premium_price, tag: proposalData.content.pricing.premium_tagline, features: proposalData.content.features_premium, rec: false },
                                        ].map((tier, i) => (
                                            <div key={i} className={`${styles.ppTierCard} ${tier.rec ? styles.ppTierRec : ''}`}>
                                                {tier.rec && <div className={styles.ppRecBadge}>★ RECOMMENDED</div>}
                                                <h4 className={styles.ppTierName}>{tier.name}</h4>
                                                <div className={styles.ppTierPrice}>{tier.price}</div>
                                                <div className={styles.ppTierTag}>{tier.tag}</div>
                                                <div className={styles.ppTierDivider} />
                                                {tier.features.map((f, fi) => (
                                                    <div key={fi} className={styles.ppTierFeat}>
                                                        <span className={styles.ppCheck}>✓</span> {f}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Why Us */}
                                <div className={styles.ppSection}>
                                    <h2 className={styles.ppSectionTitle}>Why Caelborne Digital?</h2>
                                    {proposalData.content.why_us.map((r, i) => (
                                        <div key={i} className={styles.ppPainPoint}>
                                            <span className={styles.ppNumber}>{i + 1}</span>
                                            <p>{r}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* CTA */}
                                <div className={styles.ppCta}>
                                    <h3>Let's Get Started</h3>
                                    <p>{proposalData.content.cta}</p>
                                    <div className={styles.ppContact}>
                                        <strong>Amiri Tate</strong> · Founder, Caelborne Digital · amiri@caelborne.io
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Audit Loading Overlay */}
                {auditLoading && (
                    <div className={styles.proposalOverlay}>
                        <div className={styles.proposalLoadingBox}>
                            <div className={styles.proposalLoadingHeader}>
                                <span className={styles.proposalLoadingDot} />
                                <span>WEBSITE AUDIT ENGINE</span>
                            </div>
                            <div className={styles.proposalLoadingTerminal}>
                                <div className={styles.scanlineEffect} />
                                {auditLoading.logs.map((log, i) => (
                                    <div key={i} className={`${styles.proposalLogLine} ${log.text.startsWith('RUNNING') || log.text.startsWith('COMPILING') || log.text.startsWith('INITIALIZING') ? styles.proposalLogPhase : ''}`}>
                                        {log.text ? (
                                            <><span className={styles.proposalLogTime}>[{log.time}]</span> {log.text}</>
                                        ) : ''}
                                    </div>
                                ))}
                                <span className={styles.proposalCursor}>{'\u2588'}</span>
                            </div>
                            <div className={styles.proposalProgressWrap}>
                                <div className={styles.proposalProgressTrack}>
                                    <div className={styles.proposalProgressFill} style={{ width: `${auditLoading.progress || 0}%` }} />
                                </div>
                                <span className={styles.proposalProgressPct}>{auditLoading.progress || 0}%</span>
                            </div>
                            <p className={styles.proposalLoadingSub}>Auditing <strong>{auditLoading.url}</strong></p>
                        </div>
                    </div>
                )}

                {/* Audit Results Modal */}
                {auditData && (
                    <div className={styles.proposalOverlay}>
                        <div className={styles.proposalPreview}>
                            <div className={styles.proposalPreviewHeader}>
                                <h2>{'\ud83d\udd0d'} Website Audit: {auditData.leadName}</h2>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        className={styles.proposalDownloadBtn}
                                        onClick={() => {
                                            const el = document.getElementById('audit-report');
                                            if (!el) return;
                                            const win = window.open('', '_blank');
                                            win.document.write(`
                                                <html><head><title>Audit - ${auditData.leadName}</title>
                                                <style>
                                                    * { margin: 0; padding: 0; box-sizing: border-box; }
                                                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #111; color: #eee; padding: 2rem; }
                                                    h1 { font-size: 1.6rem; margin-bottom: 0.3rem; color: #fff; }
                                                    h2 { font-size: 1.2rem; margin: 1.5rem 0 0.8rem; color: #ff8c00; border-bottom: 1px solid #333; padding-bottom: 0.4rem; }
                                                    .url { opacity: 0.5; font-size: 0.85rem; margin-bottom: 1.5rem; }
                                                    .scores { display: flex; gap: 1.5rem; margin-bottom: 1rem; }
                                                    .score-card { text-align: center; }
                                                    .score-num { font-size: 2rem; font-weight: 800; }
                                                    .score-label { font-size: 0.75rem; text-transform: uppercase; opacity: 0.6; display: block; margin-top: 0.2rem; }
                                                    .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; margin-bottom: 1rem; }
                                                    .metric { display: flex; justify-content: space-between; padding: 0.4rem 0.6rem; background: #1a1a1a; border: 1px solid #222; }
                                                    .metric-label { opacity: 0.6; font-size: 0.85rem; }
                                                    .metric-val { font-weight: 700; font-size: 0.85rem; }
                                                    .opp { padding: 0.3rem 0.6rem; border-left: 3px solid #ffb000; margin-bottom: 0.3rem; background: rgba(255,176,0,0.05); font-size: 0.85rem; }
                                                    .pitch { background: #1a1a1a; border: 1px solid #333; padding: 1rem; margin-top: 1.5rem; border-radius: 4px; }
                                                    .pitch h3 { margin-bottom: 0.5rem; color: #00ff41; }
                                                    @media print { body { background: #fff; color: #111; } .metric { background: #f5f5f5; border-color: #ddd; } .pitch { background: #f5f5f5; } h2 { color: #c26600; } }
                                                </style></head><body>
                                                ${el.innerHTML}
                                                </body></html>
                                            `);
                                            win.document.close();
                                            setTimeout(() => { win.print(); }, 500);
                                        }}
                                    >
                                        {'\u2b07'} Download PDF
                                    </button>
                                    <button className={styles.proposalCloseBtn} onClick={() => setAuditData(null)}>{'\u2715'} Close</button>
                                </div>
                            </div>
                            <div className={styles.proposalPreviewBody} id="audit-report">
                                <h1 className={styles.auditReportTitle}>Website Performance Audit</h1>
                                <p className={styles.auditReportUrl}>{auditData.url}</p>
                                <p className={styles.auditReportDate}>Audited {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

                                <div style={{ display: 'flex', justifyContent: 'center', margin: '1.5rem 0' }}>
                                    <div className={styles.auditScoreCard}>
                                        <div className={styles.auditScoreCircle} style={{
                                            width: '110px', height: '110px', fontSize: '2.5rem',
                                            borderColor: auditData.overallScore >= 80 ? '#00ff41' : auditData.overallScore >= 50 ? '#ffb000' : '#ff3333',
                                            color: auditData.overallScore >= 80 ? '#00ff41' : auditData.overallScore >= 50 ? '#ffb000' : '#ff3333',
                                        }}>
                                            {auditData.overallScore}
                                        </div>
                                        <span className={styles.auditScoreLabel}>Overall Score</span>
                                        <span className={styles.auditScoreRating} style={{
                                            color: auditData.overallScore >= 80 ? '#00ff41' : auditData.overallScore >= 50 ? '#ffb000' : '#ff3333',
                                        }}>
                                            {auditData.overallScore >= 80 ? 'Good' : auditData.overallScore >= 50 ? 'Needs Work' : 'Poor'}
                                        </span>
                                    </div>
                                </div>

                                <h2 className={styles.auditDeviceTitle}>Key Metrics</h2>
                                <div className={styles.auditMetrics}>
                                    <div className={styles.auditMetric}>
                                        <span className={styles.auditMetricLabel}>Load Time</span>
                                        <span className={styles.auditMetricValue} style={{ color: auditData.loadTimeMs > 3000 ? '#ff3333' : auditData.loadTimeMs > 1500 ? '#ffb000' : '#00ff41' }}>
                                            {(auditData.loadTimeMs / 1000).toFixed(1)}s
                                        </span>
                                    </div>
                                    <div className={styles.auditMetric}>
                                        <span className={styles.auditMetricLabel}>Server Response (TTFB)</span>
                                        <span className={styles.auditMetricValue} style={{ color: auditData.ttfbMs > 1000 ? '#ff3333' : auditData.ttfbMs > 600 ? '#ffb000' : '#00ff41' }}>
                                            {auditData.ttfbMs}ms
                                        </span>
                                    </div>
                                    <div className={styles.auditMetric}>
                                        <span className={styles.auditMetricLabel}>Page Size</span>
                                        <span className={styles.auditMetricValue} style={{ color: auditData.pageSizeKb > 2000 ? '#ff3333' : auditData.pageSizeKb > 500 ? '#ffb000' : '#00ff41' }}>
                                            {auditData.pageSizeKb > 1000 ? (auditData.pageSizeKb / 1024).toFixed(1) + 'MB' : auditData.pageSizeKb + 'KB'}
                                        </span>
                                    </div>
                                    <div className={styles.auditMetric}>
                                        <span className={styles.auditMetricLabel}>Status Code</span>
                                        <span className={styles.auditMetricValue} style={{ color: auditData.statusCode === 200 ? '#00ff41' : '#ff3333' }}>
                                            {auditData.statusCode}
                                        </span>
                                    </div>
                                    <div className={styles.auditMetric}>
                                        <span className={styles.auditMetricLabel}>Images</span>
                                        <span className={styles.auditMetricValue}>{auditData.performance?.imageCount || 0}</span>
                                    </div>
                                    <div className={styles.auditMetric}>
                                        <span className={styles.auditMetricLabel}>Scripts</span>
                                        <span className={styles.auditMetricValue}>{auditData.performance?.scriptCount || 0}</span>
                                    </div>
                                </div>

                                <div className={styles.auditScoreGrid} style={{ marginTop: '1rem' }}>
                                    {[
                                        { label: 'HTTPS', ok: auditData.security?.hasHttps },
                                        { label: 'Mobile Ready', ok: auditData.mobile?.hasViewport },
                                        { label: 'SEO Title', ok: auditData.seo?.hasTitle },
                                        { label: 'Meta Desc', ok: auditData.seo?.hasDescription },
                                    ].map(item => (
                                        <div key={item.label} className={styles.auditScoreCard}>
                                            <div className={styles.auditScoreCircle} style={{
                                                width: '48px', height: '48px', fontSize: '1.2rem',
                                                borderColor: item.ok ? '#00ff41' : '#ff3333',
                                                color: item.ok ? '#00ff41' : '#ff3333',
                                            }}>
                                                {item.ok ? '\u2713' : '\u2715'}
                                            </div>
                                            <span className={styles.auditScoreLabel}>{item.label}</span>
                                        </div>
                                    ))}
                                </div>

                                {auditData.issues?.length > 0 && (
                                    <div>
                                        <h2 className={styles.auditDeviceTitle}>Issues Found ({auditData.issues.length})</h2>
                                        {auditData.issues.map((issue, i) => (
                                            <div key={i} className={styles.auditOpp} style={{ borderLeftColor: '#ff3333', background: 'rgba(255,50,50,0.04)' }}>
                                                <span className={styles.auditOppName}>{issue}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {auditData.positives?.length > 0 && (
                                    <div>
                                        <h3 className={styles.auditSubhead}>What&apos;s Working</h3>
                                        {auditData.positives.map((pos, i) => (
                                            <div key={i} className={styles.auditOpp} style={{ borderLeftColor: '#00ff41', background: 'rgba(0,255,65,0.04)' }}>
                                                <span className={styles.auditOppName}>{pos}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className={styles.auditPitch}>
                                    <h3>AI-Generated Pitch</h3>
                                    <p className={styles.auditPitchText}>
                                        {auditData.aiPitch ? (
                                            <>&ldquo;{auditData.aiPitch}&rdquo;</>
                                        ) : (
                                            <>&ldquo;Your site scores <strong style={{ color: auditData.overallScore >= 50 ? '#ffb000' : '#ff3333' }}>{auditData.overallScore}/100</strong>. {auditData.issues?.length > 0 ? auditData.issues[0] : 'Multiple issues detected'}. I can build you a lightning-fast site that actually converts.&rdquo;</>
                                        )}
                                    </p>
                                    <button
                                        className={styles.auditCopyBtn}
                                        onClick={(e) => {
                                            const text = auditData.aiPitch || `Your site scores ${auditData.overallScore}/100. ${auditData.issues?.[0] || 'Multiple issues detected'}. I can build you a lightning-fast site that actually converts.`;
                                            navigator.clipboard.writeText(text);
                                            e.target.textContent = 'Copied!';
                                            setTimeout(() => { e.target.textContent = 'Copy Pitch'; }, 2000);
                                        }}
                                    >
                                        Copy Pitch
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

