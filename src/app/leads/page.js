'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TronGrid from '@/components/tron/TronGrid';
import TronCard from '@/components/tron/TronCard';
import TronButton from '@/components/tron/TronButton';
import styles from './page.module.css';

const CATEGORIES = [
    'Restaurants', 'Hair Salons', 'Auto Repair', 'Dentists', 'Contractors',
    'Plumbers', 'Landscaping', 'Cleaning Services', 'Gyms', 'Real Estate Agents',
    'Lawyers', 'Accountants', 'Pet Grooming', 'Florists', 'Bakeries',
    'Tattoo Shops', 'Barbershops', 'Nail Salons', 'Photography Studios', 'Car Dealerships',
];

function getScoreColor(score) {
    if (score >= 80) return '#00ff41';
    if (score >= 60) return '#ffb000';
    if (score >= 40) return '#ff8c00';
    return '#ff3333';
}

function getScoreLabel(score) {
    if (score >= 80) return 'HOT';
    if (score >= 60) return 'WARM';
    if (score >= 40) return 'COOL';
    return 'COLD';
}

// CRT Terminal scanning animation
function ScanTerminal({ logs, logEndRef }) {
    return (
        <div className={styles.scanTerminal}>
            <div className={styles.termHeader}>
                <span className={styles.termDot} style={{ background: '#ff3333' }} />
                <span className={styles.termDot} style={{ background: '#ffb000' }} />
                <span className={styles.termDot} style={{ background: '#00ff41' }} />
                <span className={styles.termTitle}>ACAM_SCAN.EXE</span>
            </div>
            <div className={styles.termBody}>
                {logs.map((log, i) => (
                    <div key={i} className={styles.termLine}>
                        <span className={styles.termTime}>{log.time}</span>
                        <span className={styles.termSep}>│</span>
                        <span className={styles.termText}>{log.text}</span>
                    </div>
                ))}
                <div className={styles.termLine}>
                    <span className={styles.termCursor}>█</span>
                </div>
                <div ref={logEndRef} />
            </div>
            <div className={styles.termProgress}>
                <div className={styles.termProgressBar}>
                    <div className={styles.termProgressFill} />
                </div>
                <span className={styles.termProgressLabel}>SCANNING...</span>
            </div>
        </div>
    );
}

const SCAN_MESSAGES = [
    { text: 'INITIALIZING ACAM SCAN PROTOCOL...', delay: 0 },
    { text: 'CONNECTING TO GOOGLE MAPS API...', delay: 600 },
    { text: 'CONNECTION ESTABLISHED — API KEY VERIFIED', delay: 1200 },
    { text: 'SEARCHING: "%QUERY%"', delay: 1800 },
    { text: 'PAGE 1/3 — FETCHING FIRST 20 RESULTS...', delay: 3000 },
    { text: '>> 20 BUSINESSES FOUND — LOADING DETAILS...', delay: 5500 },
    { text: 'CHECKING WEBSITE PRESENCE FOR EACH BUSINESS...', delay: 7000 },
    { text: 'PAGE 2/3 — FETCHING NEXT 20 RESULTS...', delay: 9000 },
    { text: '>> 40 TOTAL — LOADING DETAILS...', delay: 12000 },
    { text: 'PAGE 3/3 — FETCHING FINAL BATCH...', delay: 14000 },
    { text: '>> ANALYZING WEBSITE QUALITY...', delay: 17000 },
    { text: 'SCORING LEADS — PRIORITIZING NO-WEBSITE BUSINESSES...', delay: 19000 },
    { text: 'SORTING RESULTS — HOT PROSPECTS FIRST...', delay: 21000 },
];

export default function LeadsPage() {
    const [scanResults, setScanResults] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [saveToast, setSaveToast] = useState(null);
    const [locations, setLocations] = useState(['']);
    const [category, setCategory] = useState('Restaurants');
    const [websiteFilter, setWebsiteFilter] = useState('none');
    const [scanResult, setScanResult] = useState(null);
    const [scanStats, setScanStats] = useState(null);
    const [savingIds, setSavingIds] = useState(new Set());
    const [savedNames, setSavedNames] = useState(new Set());
    const [scanLogs, setScanLogs] = useState([]);
    const [activeSuggestions, setActiveSuggestions] = useState({});
    const logEndRef = useRef(null);
    const timersRef = useRef([]);
    const debounceRefs = useRef({});
    const router = useRouter();

    // City autocomplete per input
    const handleLocationChange = (index, val) => {
        setLocations(prev => prev.map((l, i) => i === index ? val : l));
        if (debounceRefs.current[index]) clearTimeout(debounceRefs.current[index]);
        if (val.length < 2) {
            setActiveSuggestions(prev => ({ ...prev, [index]: { items: [], show: false } }));
            return;
        }
        debounceRefs.current[index] = setTimeout(async () => {
            try {
                const res = await fetch(`/api/autocomplete?input=${encodeURIComponent(val)}`);
                const data = await res.json();
                setActiveSuggestions(prev => ({ ...prev, [index]: { items: data.predictions || [], show: true } }));
            } catch {
                setActiveSuggestions(prev => ({ ...prev, [index]: { items: [], show: false } }));
            }
        }, 250);
    };

    const selectSuggestion = (index, desc) => {
        setLocations(prev => prev.map((l, i) => i === index ? desc : l));
        setActiveSuggestions(prev => ({ ...prev, [index]: { items: [], show: false } }));
    };

    const addCity = () => {
        if (locations.length < 5) setLocations(prev => [...prev, '']);
    };

    const removeCity = (index) => {
        if (locations.length <= 1) return;
        setLocations(prev => prev.filter((_, i) => i !== index));
    };

    // Stream scan log lines — only for single-city scans
    const cities = locations.map(l => l.trim()).filter(Boolean);
    useEffect(() => {
        if (scanning && cities.length === 1) {
            setScanLogs([]);
            const query = `${category} in ${cities[0]}`;
            timersRef.current = SCAN_MESSAGES.map((msg) => {
                return setTimeout(() => {
                    const text = msg.text.replace('%QUERY%', query);
                    setScanLogs(prev => [...prev, { text, time: new Date().toLocaleTimeString('en-US', { hour12: false }) }]);
                }, msg.delay);
            });
        } else if (!scanning) {
            timersRef.current.forEach(t => clearTimeout(t));
            timersRef.current = [];
        }
        return () => timersRef.current.forEach(t => clearTimeout(t));
    }, [scanning, category]);

    // Auto-scroll log terminal
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [scanLogs]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) router.push('/');
        });
    }, [router]);

    // Helper: add a log line
    const addLog = (text) => {
        setScanLogs(prev => [...prev, { text, time: new Date().toLocaleTimeString('en-US', { hour12: false }) }]);
    };

    // Run scan (supports multi-city via comma separation)
    const handleScan = async () => {
        const scanCities = locations.map(l => l.trim()).filter(Boolean);
        if (scanCities.length === 0) return;

        const isMultiCity = scanCities.length > 1;

        setScanning(true);
        setScanResult(null);
        setScanResults([]);
        setScanStats(null);
        setSavedNames(new Set());

        if (isMultiCity) {
            // MULTI-CITY MODE
            const cities = scanCities;
            setScanLogs([]);
            addLog('INITIALIZING ACAM MULTI-CITY SCAN PROTOCOL...');
            await new Promise(r => setTimeout(r, 400));
            addLog(`TARGETS LOCKED: ${cities.length} CITIES QUEUED`);
            await new Promise(r => setTimeout(r, 400));
            addLog(`CATEGORY: ${category.toUpperCase()}`);
            await new Promise(r => setTimeout(r, 300));
            addLog('');

            let allResults = [];
            let totalStats = { total: 0, noWebsite: 0, hasWebsite: 0, alreadySaved: 0 };
            let citiesScanned = 0;
            let citiesFailed = 0;

            for (let i = 0; i < cities.length; i++) {
                const city = cities[i];
                addLog(`╔════════════════════════════════════════════╗`);
                addLog(`║  SCANNING CITY ${i + 1}/${cities.length}: ${city.toUpperCase().padEnd(23)}║`);
                addLog(`╚════════════════════════════════════════════╝`);
                await new Promise(r => setTimeout(r, 300));
                addLog(`CONNECTING TO GOOGLE MAPS — ${city}...`);

                try {
                    const res = await fetch('/api/scrape', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ location: city, category }),
                    });
                    const data = await res.json();

                    if (res.ok && data.results) {
                        const count = data.results.length;
                        const noSite = data.results.filter(r => !r.has_website).length;
                        const dupes = data.results.filter(r => r.already_saved).length;

                        addLog(`>> ${count} BUSINESSES FOUND (${noSite} without websites${dupes > 0 ? `, ${dupes} already saved` : ''})`);

                        // Merge results — deduplicate across cities
                        const existingNames = new Set(allResults.map(r => r.business_name.toLowerCase()));
                        let newCount = 0;
                        for (const r of data.results) {
                            if (!existingNames.has(r.business_name.toLowerCase())) {
                                allResults.push(r);
                                existingNames.add(r.business_name.toLowerCase());
                                newCount++;
                            }
                        }

                        if (newCount < count) {
                            addLog(`>> ${count - newCount} DUPLICATES REMOVED (overlap with other cities)`);
                        }

                        totalStats.total += newCount;
                        totalStats.noWebsite += data.results.filter(r => !r.has_website && !existingNames.has(r.business_name.toLowerCase() + '_dup')).length;
                        totalStats.hasWebsite += data.results.filter(r => r.has_website).length;
                        totalStats.alreadySaved += dupes;
                        citiesScanned++;

                        addLog(`✓ ${city.toUpperCase()} COMPLETE`);
                    } else {
                        addLog(`⚠ ${city.toUpperCase()} — ${data.error || 'No results found'}`);
                        citiesFailed++;
                    }
                } catch (err) {
                    addLog(`✕ ${city.toUpperCase()} FAILED: ${err.message}`);
                    citiesFailed++;
                }

                addLog('');
                await new Promise(r => setTimeout(r, 200));
            }

            // Sort merged results
            allResults.sort((a, b) => {
                if (!a.has_website && b.has_website) return -1;
                if (a.has_website && !b.has_website) return 1;
                return b.lead_score - a.lead_score;
            });

            // Recalculate clean stats
            totalStats = {
                total: allResults.length,
                noWebsite: allResults.filter(r => !r.has_website).length,
                hasWebsite: allResults.filter(r => r.has_website).length,
                alreadySaved: allResults.filter(r => r.already_saved).length,
            };

            addLog('╔════════════════════════════════════════════╗');
            addLog(`║  MULTI-CITY SCAN COMPLETE                  ║`);
            addLog('╚════════════════════════════════════════════╝');
            addLog(`CITIES SCANNED: ${citiesScanned}/${cities.length}${citiesFailed > 0 ? ` (${citiesFailed} failed)` : ''}`);
            addLog(`TOTAL RESULTS: ${allResults.length} (${totalStats.noWebsite} without websites)`);
            addLog('RESULTS SORTED — HOT PROSPECTS FIRST');

            setScanResults(allResults);
            setScanStats(totalStats);
            setScanResult({
                type: 'success',
                message: `${allResults.length} businesses found across ${citiesScanned} cities (${totalStats.noWebsite} without websites${totalStats.alreadySaved > 0 ? `, ${totalStats.alreadySaved} already saved` : ''})`,
            });

            // Pre-populate savedNames
            const alreadySavedNames = new Set();
            allResults.forEach(r => { if (r.already_saved) alreadySavedNames.add(r.business_name); });
            if (alreadySavedNames.size > 0) setSavedNames(prev => new Set([...prev, ...alreadySavedNames]));
            setWebsiteFilter('none');
            setScanning(false);

        } else {
            // SINGLE-CITY MODE (original behavior)
            try {
                const res = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ location: scanCities[0], category }),
                });

                const data = await res.json();

                if (!res.ok) {
                    setScanResult({ type: 'error', message: data.error || 'Scan failed' });
                } else {
                    setScanResults(data.results || []);
                    setScanStats(data.stats || null);
                    setScanResult({ type: 'success', message: data.message });
                    const alreadySavedNames = new Set();
                    (data.results || []).forEach(r => {
                        if (r.already_saved) alreadySavedNames.add(r.business_name);
                    });
                    if (alreadySavedNames.size > 0) {
                        setSavedNames(prev => new Set([...prev, ...alreadySavedNames]));
                    }
                    setWebsiteFilter('none');
                }
            } catch (err) {
                setScanResult({ type: 'error', message: err.message });
            } finally {
                setScanning(false);
            }
        }
    };

    // Save lead
    const handleSave = async (lead) => {
        const key = lead.business_name;
        setSavingIds(prev => new Set([...prev, key]));
        try {
            const res = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leads: [lead] }),
            });
            const data = await res.json();
            if (res.ok) {
                // Mark as saved whether it was newly saved OR skipped (duplicate)
                setSavedNames(prev => new Set([...prev, key]));
                if (data.saved?.length > 0) {
                    setSaveToast({ message: `✓ ${key} saved!`, type: 'success' });
                } else if (data.skipped?.length > 0) {
                    setSaveToast({ message: `📁 ${key} already saved`, type: 'info' });
                }
                setTimeout(() => setSaveToast(null), 3000);
            }
        } catch (err) {
            console.error('Save error:', err);
            setSaveToast({ message: `✕ Failed to save ${key}`, type: 'error' });
            setTimeout(() => setSaveToast(null), 3000);
        } finally {
            setSavingIds(prev => { const n = new Set(prev); n.delete(key); return n; });
        }
    };

    // Save all filtered
    const handleSaveAll = async () => {
        const unsaved = filteredResults.filter(l => !savedNames.has(l.business_name) && !l.already_saved);
        if (unsaved.length === 0) return;
        setSavingIds(new Set(unsaved.map(l => l.business_name)));
        try {
            const res = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leads: unsaved }),
            });
            const data = await res.json();
            if (res.ok) {
                const newSaved = new Set(savedNames);
                // Mark both saved AND skipped as saved in the UI
                (data.saved || []).forEach(l => newSaved.add(l.business_name));
                (data.skipped || []).forEach(name => newSaved.add(name));
                setSavedNames(newSaved);
                const savedCount = data.saved?.length || 0;
                const skippedCount = data.skipped?.length || 0;
                setSaveToast({ message: `✓ ${savedCount} saved${skippedCount > 0 ? `, ${skippedCount} already existed` : ''}`, type: 'success' });
                setTimeout(() => setSaveToast(null), 3000);
            }
        } catch (err) {
            console.error(err);
            setSaveToast({ message: '✕ Failed to save leads', type: 'error' });
            setTimeout(() => setSaveToast(null), 3000);
        } finally {
            setSavingIds(new Set());
        }
    };

    const filteredResults = scanResults.filter(l => {
        if (websiteFilter === 'none') return !l.has_website;
        if (websiteFilter === 'has') return l.has_website;
        return true;
    });

    const noWebsiteCount = scanResults.filter(l => !l.has_website).length;
    const hasWebsiteCount = scanResults.filter(l => l.has_website).length;

    return (
        <div className={styles.page}>
            <TronGrid />
            <div className={styles.container}>
                {/* Header */}
                <header className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Lead Scanner</h1>
                        <p className={styles.subtitle}>Find businesses without websites</p>
                    </div>
                    <div className={styles.headerActions}>
                        <TronButton onClick={() => router.push('/saved')} variant="primary" size="sm">
                            📁 Saved Leads
                        </TronButton>
                        <TronButton onClick={() => router.push('/dashboard')} variant="secondary" size="sm">
                            ← Dashboard
                        </TronButton>
                    </div>
                </header>

                {/* Scan Controls */}
                <TronCard className={`${styles.scanPanel} animate-boot-in delay-1`}>
                    <h3 className={styles.sectionTitle}>⚡ Scan Configuration</h3>
                    <div className={styles.scanGrid}>
                        <div className={styles.cityInputs}>
                            <label>Target Location{locations.length > 1 ? 's' : ''}</label>
                            {locations.map((loc, idx) => {
                                const sug = activeSuggestions[idx];
                                const sugItems = sug?.items || [];
                                const sugShow = sug?.show || false;
                                return (
                                    <div key={idx} className={styles.cityRow} style={{ zIndex: 100 - idx }}>
                                        <div className={styles.autocompleteWrap}>
                                            <input
                                                type="text"
                                                value={loc}
                                                onChange={(e) => handleLocationChange(idx, e.target.value)}
                                                onFocus={() => {
                                                    const cur = activeSuggestions[idx];
                                                    if (cur?.items?.length > 0) {
                                                        setActiveSuggestions(prev => ({ ...prev, [idx]: { ...prev[idx], show: true } }));
                                                    }
                                                }}
                                                onBlur={() => setTimeout(() => setActiveSuggestions(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), show: false } })), 150)}
                                                placeholder={idx === 0 ? 'Enter a city...' : `City ${idx + 1}`}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleScan(); }}
                                                autoComplete="off"
                                            />
                                            {sugShow && sugItems.length > 0 && (
                                                <div className={styles.suggestionsList}>
                                                    {sugItems.map((s) => (
                                                        <button
                                                            key={s.placeId}
                                                            className={styles.suggestionItem}
                                                            onMouseDown={() => selectSuggestion(idx, s.description)}
                                                        >
                                                            📍 {s.description}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {locations.length > 1 && (
                                            <button className={styles.removeCityBtn} onClick={() => removeCity(idx)} title="Remove">✕</button>
                                        )}
                                    </div>
                                );
                            })}
                            {locations.length < 5 && (
                                <button className={styles.addCityBtn} onClick={addCity}>
                                    + Add City ({locations.length}/5)
                                </button>
                            )}
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="category">Business Category</label>
                            <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        <div className={styles.scanAction}>
                            <TronButton onClick={handleScan} loading={scanning} disabled={cities.length === 0} size="lg">
                                {scanning ? `Scanning ${cities.length} ${cities.length === 1 ? 'city' : 'cities'}...` : `⚡ SCAN${cities.length > 1 ? ` (${cities.length} CITIES)` : ''}`}
                            </TronButton>
                        </div>
                    </div>

                    {scanning && (
                        <ScanTerminal logs={scanLogs} logEndRef={logEndRef} />
                    )}

                    {scanResult && !scanning && (
                        <div className={`${styles.scanResult} ${styles[scanResult.type]}`}>
                            {scanResult.type === 'success' ? '✅' : '⚠️'} {scanResult.message}
                        </div>
                    )}
                </TronCard>

                {/* Stats Banner */}
                {scanStats && (
                    <div className={`${styles.statsBanner} animate-boot-in delay-2`}>
                        <div className={styles.statBlock}>
                            <span className={styles.statNumber}>{scanStats.total}</span>
                            <span className={styles.statLabel}>TOTAL</span>
                        </div>
                        <div className={`${styles.statBlock} ${styles.statHighlight}`}>
                            <span className={styles.statNumberHot}>{scanStats.noWebsite}</span>
                            <span className={styles.statLabelHot}>🎯 NO WEBSITE</span>
                        </div>
                        <div className={styles.statBlock}>
                            <span className={styles.statNumber}>{scanStats.hasWebsite}</span>
                            <span className={styles.statLabel}>HAS WEBSITE</span>
                        </div>
                        {scanStats.alreadySaved > 0 && (
                            <div className={styles.statBlock}>
                                <span className={styles.statNumberSaved}>{scanStats.alreadySaved}</span>
                                <span className={styles.statLabel}>ALREADY SAVED</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Results */}
                {scanResults.length > 0 && (
                    <>
                        <div className={`${styles.filters} animate-boot-in delay-2`}>
                            <div className={styles.statusTabs}>
                                <button
                                    className={`${styles.statusTab} ${websiteFilter === 'all' ? styles.active : ''}`}
                                    onClick={() => setWebsiteFilter('all')}
                                >
                                    ALL ({scanResults.length})
                                </button>
                                <button
                                    className={`${styles.statusTab} ${styles.hotTab} ${websiteFilter === 'none' ? styles.activeHot : ''}`}
                                    onClick={() => setWebsiteFilter('none')}
                                >
                                    🎯 NO WEBSITE ({noWebsiteCount})
                                </button>
                                <button
                                    className={`${styles.statusTab} ${websiteFilter === 'has' ? styles.active : ''}`}
                                    onClick={() => setWebsiteFilter('has')}
                                >
                                    HAS WEBSITE ({hasWebsiteCount})
                                </button>
                            </div>

                            <div className={styles.bulkActions}>
                                <TronButton onClick={handleSaveAll} size="sm" variant="primary">
                                    💾 Save All ({filteredResults.filter(l => !savedNames.has(l.business_name)).length})
                                </TronButton>
                            </div>
                        </div>

                        <div className={styles.leadsList}>
                            {filteredResults.map((lead) => {
                                const isSaved = savedNames.has(lead.business_name) || lead.already_saved;
                                const isSaving = savingIds.has(lead.business_name);

                                return (
                                    <div
                                        key={lead.business_name + lead.address}
                                        className={`${styles.leadCard} ${!lead.has_website ? styles.hotLead : ''}`}
                                    >
                                        <div className={styles.leadHeader}>
                                            <div className={styles.leadInfo}>
                                                <div className={styles.leadNameRow}>
                                                    {!lead.has_website && <span className={styles.hotBadge}>🎯</span>}
                                                    <h3 className={styles.leadName}>{lead.business_name}</h3>
                                                </div>
                                                <span className={styles.leadCategory}>{lead.category}</span>
                                            </div>
                                            <div className={styles.leadHeaderRight}>
                                                <div
                                                    className={styles.scoreBadge}
                                                    style={{
                                                        color: getScoreColor(lead.lead_score),
                                                        borderColor: getScoreColor(lead.lead_score),
                                                        boxShadow: `0 0 8px ${getScoreColor(lead.lead_score)}33`,
                                                    }}
                                                >
                                                    <span className={styles.scoreNumber}>{lead.lead_score}</span>
                                                    <span className={styles.scoreLabel}>{getScoreLabel(lead.lead_score)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={styles.leadDetails}>
                                            <span>📍 {lead.city}{lead.state ? `, ${lead.state}` : ''}</span>
                                            {lead.google_rating && <span>⭐ {lead.google_rating} ({lead.review_count})</span>}
                                            {lead.phone && <span>📞 {lead.phone}</span>}
                                            <span className={!lead.has_website ? styles.noWebsiteTag : styles.hasWebsiteTag}>
                                                {lead.has_website ? '🌐 Has website' : '🚫 NO WEBSITE'}
                                            </span>
                                        </div>

                                        <div className={styles.leadActions}>
                                            <div className={styles.actionLinks}>
                                                {lead.google_maps_url && (
                                                    <a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer">Maps</a>
                                                )}
                                                {lead.website_url && (
                                                    <a href={lead.website_url} target="_blank" rel="noopener noreferrer">Website</a>
                                                )}
                                            </div>
                                            {isSaved ? (
                                                <span className={lead.already_saved ? styles.alreadySavedBadge : styles.savedBadge}>
                                                    {lead.already_saved ? '📁 ALREADY SAVED' : '✓ SAVED'}
                                                </span>
                                            ) : (
                                                <TronButton onClick={() => handleSave(lead)} loading={isSaving} size="sm" variant="primary">
                                                    💾 SAVE
                                                </TronButton>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {scanResults.length === 0 && !scanning && (
                    <TronCard className={`${styles.emptyState} animate-boot-in delay-2`}>
                        <div className={styles.emptyContent}>
                            <p className={styles.emptyTitle}>AWAITING SCAN COMMAND</p>
                            <p>Enter a location + business category → SCAN → find businesses without websites</p>
                        </div>
                    </TronCard>
                )}
            </div>

            {/* Save Toast */}
            {saveToast && (
                <div style={{
                    position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999,
                    padding: '0.6rem 1.2rem',
                    fontFamily: 'var(--font-terminal)', fontSize: '0.85rem', letterSpacing: '0.04em',
                    background: saveToast.type === 'success' ? 'rgba(0,255,65,0.15)' : saveToast.type === 'info' ? 'rgba(100,160,255,0.15)' : 'rgba(255,50,50,0.15)',
                    border: `1px solid ${saveToast.type === 'success' ? 'var(--phosphor)' : saveToast.type === 'info' ? '#64a0ff' : '#ff3333'}`,
                    color: saveToast.type === 'success' ? 'var(--phosphor)' : saveToast.type === 'info' ? '#64a0ff' : '#ff3333',
                    animation: 'fadeInOverlay 0.3s ease',
                }}>
                    {saveToast.message}
                </div>
            )}
        </div>
    );
}
