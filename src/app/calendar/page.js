'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TronGrid from '@/components/tron/TronGrid';
import TronCard from '@/components/tron/TronCard';
import TronButton from '@/components/tron/TronButton';
import styles from './page.module.css';

export default function CalendarPage() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [callbacks, setCallbacks] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const router = useRouter();

    // Auth check
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) { router.push('/'); }
            else { setSession(session); setLoading(false); }
        });
    }, [router]);

    // Fetch all callbacks
    useEffect(() => {
        if (loading) return;
        const fetchCallbacks = async () => {
            const { data } = await supabase
                .from('leads')
                .select('id, business_name, category, city, phone, callback_date, call_outcome, notes')
                .not('callback_date', 'is', null)
                .order('callback_date', { ascending: true });
            setCallbacks(data || []);
        };
        fetchCallbacks();
    }, [loading]);

    // Calendar math
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const today = new Date().toISOString().split('T')[0];

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Map callbacks to dates
    const callbackMap = useMemo(() => {
        const map = {};
        callbacks.forEach(cb => {
            if (!cb.callback_date) return;
            if (!map[cb.callback_date]) map[cb.callback_date] = [];
            map[cb.callback_date].push(cb);
        });
        return map;
    }, [callbacks]);

    // Get leads for a specific date
    const selectedLeads = selectedDate ? (callbackMap[selectedDate] || []) : [];

    // Navigation
    const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
    const goToday = () => setCurrentMonth(new Date());

    // Build calendar grid
    const calendarDays = [];
    // Empty cells before first day
    for (let i = 0; i < firstDayOfWeek; i++) {
        calendarDays.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        calendarDays.push(dateStr);
    }

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
                        <TronButton onClick={() => router.push('/dashboard')} variant="secondary" size="sm">← Dashboard</TronButton>
                        <h1 className={styles.title}>📅 Call Calendar</h1>
                    </div>
                    <div className={styles.headerRight}>
                        <span className={styles.summaryText}>
                            {callbacks.filter(c => c.callback_date === today).length} today · {callbacks.filter(c => c.callback_date < today).length} overdue · {callbacks.length} total
                        </span>
                    </div>
                </header>

                <div className={styles.calendarLayout}>
                    {/* Calendar Grid */}
                    <div className={styles.calendarPanel}>
                        <TronCard>
                            {/* Month Navigation */}
                            <div className={styles.monthNav}>
                                <button className={styles.monthBtn} onClick={prevMonth}>◀</button>
                                <span className={styles.monthName}>{monthName}</span>
                                <button className={styles.monthBtn} onClick={nextMonth}>▶</button>
                                <button className={styles.todayBtn} onClick={goToday}>Today</button>
                            </div>

                            {/* Day Headers */}
                            <div className={styles.dayHeaders}>
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                    <span key={d} className={styles.dayHeader}>{d}</span>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className={styles.calendarGrid}>
                                {calendarDays.map((dateStr, idx) => {
                                    if (!dateStr) return <div key={`empty-${idx}`} className={styles.dayEmpty} />;

                                    const dayNum = parseInt(dateStr.split('-')[2]);
                                    const dayCallbacks = callbackMap[dateStr] || [];
                                    const isToday = dateStr === today;
                                    const isSelected = dateStr === selectedDate;
                                    const isOverdue = dateStr < today && dayCallbacks.length > 0;
                                    const isPast = dateStr < today;

                                    return (
                                        <button
                                            key={dateStr}
                                            className={`${styles.dayCell} ${isToday ? styles.dayCellToday : ''} ${isSelected ? styles.dayCellSelected : ''} ${isPast ? styles.dayCellPast : ''} ${isOverdue ? styles.dayCellOverdue : ''}`}
                                            onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                                        >
                                            <span className={styles.dayNum}>{dayNum}</span>
                                            {dayCallbacks.length > 0 && (
                                                <div className={styles.dayDots}>
                                                    {dayCallbacks.slice(0, 3).map((cb, i) => (
                                                        <span
                                                            key={i}
                                                            className={styles.dayDot}
                                                            style={{ background: isOverdue ? '#ff3333' : isToday ? '#ffb000' : '#00ff41' }}
                                                        />
                                                    ))}
                                                    {dayCallbacks.length > 3 && <span className={styles.dayDotMore}>+{dayCallbacks.length - 3}</span>}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </TronCard>
                    </div>

                    {/* Detail Panel */}
                    <div className={styles.detailPanel}>
                        <TronCard>
                            {selectedDate ? (
                                <>
                                    <h3 className={styles.detailTitle}>
                                        {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                    </h3>
                                    {selectedDate < today && <p className={styles.overdueTag}>⚠️ PAST DATE</p>}
                                    {selectedDate === today && <p className={styles.todayTag}>📞 TODAY</p>}
                                    {selectedLeads.length === 0 ? (
                                        <p className={styles.emptyDetail}>No callbacks scheduled</p>
                                    ) : (
                                        <div className={styles.detailList}>
                                            {selectedLeads.map(lead => (
                                                <div key={lead.id} className={styles.detailCard}>
                                                    <div className={styles.detailCardHeader}>
                                                        <strong>{lead.business_name}</strong>
                                                        <span className={styles.detailCategory}>{lead.category}</span>
                                                    </div>
                                                    <span className={styles.detailMeta}>
                                                        {lead.city}{lead.phone ? ` · ${lead.phone}` : ''}
                                                    </span>
                                                    {lead.notes && (
                                                        <p className={styles.detailNote}>📝 {lead.notes}</p>
                                                    )}
                                                    <div className={styles.detailActions}>
                                                        <TronButton size="sm" onClick={() => router.push('/saved?mode=calls')}>
                                                            📞 Open Dialer
                                                        </TronButton>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className={styles.emptyDetail}>
                                    <p>👈 Click a day to see scheduled callbacks</p>
                                    {callbacks.filter(c => c.callback_date < today).length > 0 && (
                                        <p className={styles.overdueTag}>
                                            🚨 {callbacks.filter(c => c.callback_date < today).length} overdue callback{callbacks.filter(c => c.callback_date < today).length > 1 ? 's' : ''}
                                        </p>
                                    )}
                                </div>
                            )}
                        </TronCard>
                    </div>
                </div>
            </div>
        </div>
    );
}
