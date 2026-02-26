'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TronGrid from '@/components/tron/TronGrid';
import TronCard from '@/components/tron/TronCard';
import TronButton from '@/components/tron/TronButton';
import styles from './page.module.css';

export default function EmailQueuePage() {
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editSubject, setEditSubject] = useState('');
    const [editBody, setEditBody] = useState('');
    const [sendingIds, setSendingIds] = useState(new Set());
    const [activeTab, setActiveTab] = useState('draft');
    const [toast, setToast] = useState(null);
    const [confirmApproveId, setConfirmApproveId] = useState(null);
    const [attachProposalIds, setAttachProposalIds] = useState(new Set());
    const [userEmail, setUserEmail] = useState('');
    const router = useRouter();



    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) router.push('/');
            else setUserEmail(session.user.email || '');
        });
    }, [router]);

    const fetchEmails = useCallback(async () => {
        try {
            const res = await fetch('/api/emails');
            const data = await res.json();
            setEmails(data.emails || []);
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchEmails(); }, [fetchEmails]);

    // Toast helper
    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    const startEdit = (email) => {
        setEditingId(email.id);
        setEditSubject(email.email_subject);
        setEditBody(email.email_body);
    };

    const saveEdit = async (id) => {
        try {
            await fetch('/api/emails', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, email_subject: editSubject, email_body: editBody }),
            });
            setEditingId(null);
            fetchEmails();
            showToast('success', 'Changes saved');
        } catch (err) { console.error('Save error:', err); }
    };

    const approveEmail = async (id) => {
        try {
            await fetch('/api/emails', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: 'approved' }),
            });
            fetchEmails();
            setConfirmApproveId(null);
            showToast('success', '✓ Email approved — ready to send');
        } catch (err) { console.error('Approve error:', err); }
    };

    const rejectEmail = async (id) => {
        try {
            await supabase.from('outreach').delete().eq('id', id);
            setEmails(prev => prev.filter(e => e.id !== id));
            showToast('warn', 'Email deleted');
        } catch (err) { console.error('Reject error:', err); }
    };

    const sendEmail = async (email) => {
        setSendingIds(prev => new Set([...prev, email.id]));
        try {
            const shouldAttach = attachProposalIds.has(email.id);
            const res = await fetch('/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outreachId: email.id, attachProposal: shouldAttach }),
            });
            const data = await res.json();
            if (res.ok) {
                fetchEmails();
                if (data.noRecipient) {
                    showToast('warn', 'Marked as sent — no recipient email on file for this lead');
                } else {
                    showToast('success', `🚀 Email sent to ${data.message?.replace('Email sent to ', '') || 'recipient'}`);
                }
            } else {
                showToast('error', `Send failed: ${data.error}`);
            }
        } catch (err) {
            console.error('Send error:', err);
            showToast('error', `Send error: ${err.message}`);
        } finally {
            setSendingIds(prev => {
                const next = new Set(prev);
                next.delete(email.id);
                return next;
            });
        }
    };

    const draftEmails = emails.filter(e => e.status === 'draft');
    const approvedEmails = emails.filter(e => e.status === 'approved');
    const sentEmails = emails.filter(e => e.status === 'sent');

    const tabEmails = activeTab === 'draft' ? draftEmails : activeTab === 'approved' ? approvedEmails : sentEmails;

    const renderEmailCard = (email) => {
        const lead = email.leads;
        const isEditing = editingId === email.id;
        const isSending = sendingIds.has(email.id);
        const statusClass = email.status === 'approved' ? styles.approved : email.status === 'sent' ? styles.sent : '';

        return (
            <TronCard key={email.id} className={`${styles.emailCard} ${statusClass}`} animate={false}>
                <div className={styles.emailHeader}>
                    <div>
                        <h3 className={styles.businessName}>{lead?.business_name || 'Unknown'}</h3>
                        <span className={styles.emailMeta}>
                            {lead?.category} · {lead?.city}
                            {lead?.has_website === false && <span className={styles.noSite}> · NO WEBSITE</span>}
                            {lead?.email && <span className={styles.hasEmail}> · {lead.email}</span>}
                            {email.status === 'sent' && email.sent_at && ` · Sent ${new Date(email.sent_at).toLocaleDateString()}`}
                        </span>
                    </div>
                    <span className={styles[`badge_${email.status}`]}>
                        {email.status === 'sent' ? '✓ SENT' : email.status.toUpperCase()}
                    </span>
                </div>

                <div className={styles.emailContent}>
                    {isEditing ? (
                        <>
                            <div className={styles.editField}>
                                <label>Subject</label>
                                <input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
                            </div>
                            <div className={styles.editField}>
                                <label>Body</label>
                                <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={6} />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className={styles.subjectLine}>
                                <span className={styles.subjectLabel}>SUBJ:</span>
                                <span>{email.email_subject}</span>
                            </div>
                            <div className={styles.bodyPreview}>{email.email_body}</div>
                        </>
                    )}
                </div>

                {email.status !== 'sent' && (
                    <div className={styles.emailActions}>
                        {isEditing ? (
                            <>
                                <TronButton onClick={() => saveEdit(email.id)} size="sm" variant="primary">Save Changes</TronButton>
                                <TronButton onClick={() => setEditingId(null)} size="sm" variant="secondary">Cancel</TronButton>
                            </>
                        ) : (
                            <>
                                <TronButton onClick={() => startEdit(email)} size="sm" variant="secondary">✏️ Edit</TronButton>
                                {email.status === 'draft' && (
                                    confirmApproveId === email.id ? (
                                        <>
                                            <span className={styles.confirmText}>Approve?</span>
                                            <TronButton onClick={() => approveEmail(email.id)} size="sm" variant="primary">Yes</TronButton>
                                            <TronButton onClick={() => setConfirmApproveId(null)} size="sm" variant="secondary">No</TronButton>
                                        </>
                                    ) : (
                                        <TronButton onClick={() => setConfirmApproveId(email.id)} size="sm" variant="primary">✓ Approve</TronButton>
                                    )
                                )}
                                {email.status === 'approved' && (
                                    <>
                                        <label className={styles.attachToggle}>
                                            <input
                                                type="checkbox"
                                                checked={attachProposalIds.has(email.id)}
                                                onChange={() => {
                                                    setAttachProposalIds(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(email.id)) next.delete(email.id);
                                                        else next.add(email.id);
                                                        return next;
                                                    });
                                                }}
                                            />
                                            📎 Attach Proposal
                                        </label>
                                        <TronButton onClick={() => sendEmail(email)} loading={isSending} size="sm" variant="primary">🚀 Send</TronButton>
                                    </>
                                )}
                                <TronButton onClick={() => rejectEmail(email.id)} size="sm" variant="danger">✕ Delete</TronButton>
                            </>
                        )}
                    </div>
                )}
            </TronCard>
        );
    };

    return (
        <div className={styles.page}>
            <TronGrid />
            <div className={styles.container}>
                <header className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Email Queue</h1>
                    </div>
                    <div className={styles.headerActions}>
                        <TronButton onClick={() => router.push('/saved')} variant="secondary" size="sm">📁 Saved Leads</TronButton>
                        <TronButton onClick={() => router.push('/dashboard')} variant="secondary" size="sm">← Dashboard</TronButton>
                    </div>
                </header>

                {/* Filter Tabs */}
                <div className={styles.filterTabs}>
                    <button
                        className={`${styles.filterTab} ${activeTab === 'draft' ? styles.filterTabActive : ''}`}
                        onClick={() => setActiveTab('draft')}
                    >
                        📝 Drafts ({draftEmails.length})
                    </button>
                    <button
                        className={`${styles.filterTab} ${activeTab === 'approved' ? styles.filterTabActive : ''}`}
                        onClick={() => setActiveTab('approved')}
                    >
                        ✓ Approved ({approvedEmails.length})
                    </button>
                    <button
                        className={`${styles.filterTab} ${activeTab === 'sent' ? styles.filterTabActive : ''}`}
                        onClick={() => setActiveTab('sent')}
                    >
                        📤 Sent ({sentEmails.length})
                    </button>
                </div>

                {/* Toast Notification */}
                {toast && (
                    <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>
                        {toast.message}
                    </div>
                )}

                {loading ? (
                    <TronCard className={styles.emptyState}><p>Loading email queue...</p></TronCard>
                ) : tabEmails.length === 0 ? (
                    <TronCard className={styles.emptyState}>
                        <p>
                            {activeTab === 'draft' && 'No drafts. Go to Saved Leads and click ✉️ Email on a lead.'}
                            {activeTab === 'approved' && 'No approved emails. Approve a draft first.'}
                            {activeTab === 'sent' && 'No sent emails yet.'}
                        </p>
                    </TronCard>
                ) : (
                    <div className={styles.emailList}>
                        {tabEmails.map(email => renderEmailCard(email))}
                    </div>
                )}
            </div>
        </div>
    );
}
