'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { US_CITIES } from '@/lib/us-cities';
import TronGrid from '@/components/tron/TronGrid';
import TronCard from '@/components/tron/TronCard';
import TronButton from '@/components/tron/TronButton';
import styles from './page.module.css';
import dynamic from 'next/dynamic';

const DominationMap = dynamic(() => import('./DominationMap'), { ssr: false });

const CATEGORIES = [
    'Restaurants', 'Hair Salons', 'Auto Repair', 'Dentists', 'Contractors',
    'Plumbers', 'Landscaping', 'Cleaning Services', 'Gyms', 'Real Estate Agents',
    'Lawyers', 'Accountants', 'Pet Grooming', 'Florists', 'Bakeries',
    'Tattoo Shops', 'Barbershops', 'Nail Salons', 'Photography Studios', 'Car Dealerships',
];

function getConquestColor(pct) {
    if (pct >= 75) return '#00ff41';
    if (pct >= 50) return '#ffb000';
    if (pct >= 25) return '#ff8c00';
    return '#ff3333';
}

function getConquestLabel(pct) {
    if (pct >= 75) return 'DOMINATED';
    if (pct >= 50) return 'ADVANCING';
    if (pct >= 25) return 'CONTESTED';
    return 'UNTOUCHED';
}

export default function MapPage() {
    const [loading, setLoading] = useState(true);
    const [mapData, setMapData] = useState(null);
    const [error, setError] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [selectedCity, setSelectedCity] = useState(null);
    const [scanCategory, setScanCategory] = useState('Restaurants');
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState(null);
    const router = useRouter();
    const mapComponentRef = useRef(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) router.push('/');
            else setLoading(false);
        });
    }, [router]);

    const fetchMapData = useCallback(async () => {
        try {
            const res = await fetch('/api/map');
            const data = await res.json();
            if (res.ok) setMapData(data);
            else setError(data.error || 'Failed to load map data');
        } catch (err) {
            setError(err.message);
        }
    }, []);

    useEffect(() => {
        if (!loading) fetchMapData();
    }, [loading, fetchMapData]);

    // ── Click-to-Scan: navigate to leads page with city pre-filled ──
    const handleMapScan = () => {
        if (!selectedCity) return;
        const location = `${selectedCity.city}, ${selectedCity.state}`;
        router.push(`/leads?city=${encodeURIComponent(location)}&category=${encodeURIComponent(scanCategory)}`);
    };

    if (loading) {
        return (
            <div className={styles.loadingScreen}>
                <TronGrid />
                <div className="tron-loader tron-loader-large" style={{ position: 'relative', zIndex: 1 }} />
            </div>
        );
    }

    const conqueredCities = mapData?.cities || [];
    const players = mapData?.players || [];
    const globalStats = mapData?.globalStats || {};

    // Compute some extra stats
    const totalCitiesConquered = conqueredCities.length;
    const totalCitiesOnMap = US_CITIES.length;
    const conquestPct = totalCitiesOnMap > 0 ? Math.round((totalCitiesConquered / totalCitiesOnMap) * 100) : 0;

    return (
        <div className={styles.page}>
            <TronGrid />

            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <TronButton onClick={() => router.push('/dashboard')} variant="secondary" size="sm">
                        ← Dashboard
                    </TronButton>
                    <h1 className={styles.title}>WORLD DOMINATION</h1>
                </div>
                <div className={styles.headerCenter}>
                    <div className={styles.globalStats}>
                        <div className={styles.globalStat}>
                            <span className={styles.globalStatValue} style={{ color: '#ff2d55' }}>{totalCitiesOnMap}</span>
                            <span className={styles.globalStatLabel}>TARGETS</span>
                        </div>
                        <div className={styles.globalStatDivider} />
                        <div className={styles.globalStat}>
                            <span className={styles.globalStatValue} style={{ color: '#00ff41' }}>{totalCitiesConquered}</span>
                            <span className={styles.globalStatLabel}>CONQUERED</span>
                        </div>
                        <div className={styles.globalStatDivider} />
                        <div className={styles.globalStat}>
                            <span className={styles.globalStatValue}>{globalStats.totalLeads || 0}</span>
                            <span className={styles.globalStatLabel}>LEADS</span>
                        </div>
                        <div className={styles.globalStatDivider} />
                        <div className={styles.globalStat}>
                            <span className={styles.globalStatValue} style={{ color: getConquestColor(conquestPct) }}>
                                {conquestPct}%
                            </span>
                            <span className={styles.globalStatLabel}>DOMINATION</span>
                        </div>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <button
                        className={styles.sidebarToggle}
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        {sidebarOpen ? '◀' : '▶'} INTEL
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className={styles.mainContent}>
                {/* Map */}
                <div className={styles.mapContainer}>
                    {error ? (
                        <div className={styles.mapError}>
                            <p>⚠ {error}</p>
                            <TronButton onClick={fetchMapData} size="sm">Retry</TronButton>
                        </div>
                    ) : (
                        <DominationMap
                            ref={mapComponentRef}
                            allCities={US_CITIES}
                            conqueredCities={conqueredCities}
                            players={players}
                            onCityClick={setSelectedCity}
                        />
                    )}

                    {/* Heat Legend */}
                    <div className={styles.legend}>
                        <div className={styles.legendTitle}>HEAT SIGNATURES</div>
                        <div className={styles.legendItem}>
                            <span className={styles.legendDot} style={{ background: '#ff2d55' }} />
                            <span>High Opportunity</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span className={styles.legendDot} style={{ background: '#ffb000' }} />
                            <span>Medium Opportunity</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span className={styles.legendDot} style={{ background: '#7a5af5' }} />
                            <span>Low Opportunity</span>
                        </div>
                        <div className={styles.legendDivider} />
                        <div className={styles.legendTitle}>CONQUEST</div>
                        <div className={styles.legendItem}>
                            <span className={styles.legendDot} style={{ background: '#00ff41' }} />
                            <span>Amiri</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span className={styles.legendDot} style={{ background: '#00d4ff' }} />
                            <span>Toby</span>
                        </div>
                        <div className={styles.legendItem}>
                            <span className={styles.legendDot} style={{ background: '#ffb000' }} />
                            <span>Yaz</span>
                        </div>
                    </div>

                    {/* ── City Scan Panel (Click-to-Scan) ── */}
                    {selectedCity && (
                        <div className={styles.cityPanel}>
                            <div className={styles.cityPanelHeader}>
                                <h3>{selectedCity.city}, {selectedCity.state}</h3>
                                <button className={styles.closePanelBtn} onClick={() => { setSelectedCity(null); setScanResult(null); }}>✕</button>
                            </div>

                            <div className={styles.cityPanelStats}>
                                {/* City stats */}
                                <div className={styles.cityStatGrid}>
                                    <div className={styles.cityStat}>
                                        <span className={styles.cityStatVal}>{formatPop(selectedCity.population)}</span>
                                        <span>Population</span>
                                    </div>
                                    <div className={styles.cityStat}>
                                        <span className={styles.cityStatVal} style={{ color: '#ffb000' }}>${formatIncome(selectedCity.income)}</span>
                                        <span>Med. Income</span>
                                    </div>
                                    <div className={styles.cityStat}>
                                        <span className={styles.cityStatVal} style={{ color: getHeatColor(selectedCity.opportunityScore) }}>{selectedCity.opportunityScore}</span>
                                        <span>Opp. Score</span>
                                    </div>
                                    {selectedCity.conquered && (
                                        <div className={styles.cityStat}>
                                            <span className={styles.cityStatVal} style={{ color: '#00ff41' }}>{selectedCity.conquered.total}</span>
                                            <span>Leads</span>
                                        </div>
                                    )}
                                </div>

                                {/* Conquest meter if conquered */}
                                {selectedCity.conquered && (
                                    <div className={styles.conquestMeter}>
                                        <div className={styles.conquestMeterLabel}>
                                            <span>CONQUEST</span>
                                            <span style={{ color: getConquestColor(selectedCity.conquered.conquestPct) }}>
                                                {selectedCity.conquered.conquestPct}% — {getConquestLabel(selectedCity.conquered.conquestPct)}
                                            </span>
                                        </div>
                                        <div className={styles.conquestMeterTrack}>
                                            <div
                                                className={styles.conquestMeterFill}
                                                style={{
                                                    width: `${selectedCity.conquered.conquestPct}%`,
                                                    background: getConquestColor(selectedCity.conquered.conquestPct),
                                                    boxShadow: `0 0 8px ${getConquestColor(selectedCity.conquered.conquestPct)}`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Player breakdown if conquered */}
                                {selectedCity.conquered && Object.keys(selectedCity.conquered.players || {}).length > 0 && (
                                    <div className={styles.cityPlayers}>
                                        <div className={styles.cityPlayersTitle}>PLAYER BREAKDOWN</div>
                                        {Object.entries(selectedCity.conquered.players).map(([name, stats]) => {
                                            const playerColor = players.find(p => p.name === name)?.color || '#ffffff';
                                            return (
                                                <div key={name} className={styles.cityPlayerRow}>
                                                    <span className={styles.cityPlayerDot} style={{ background: playerColor, boxShadow: `0 0 6px ${playerColor}` }} />
                                                    <span className={styles.cityPlayerName}>{name}</span>
                                                    <span className={styles.cityPlayerCount}>{stats.total} leads</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* ── SCAN FROM MAP ── */}
                                <div className={styles.scanFromMap}>
                                    <div className={styles.scanFromMapTitle}>
                                        ⚡ SCAN THIS CITY
                                    </div>
                                    <div className={styles.scanFromMapControls}>
                                        <select
                                            value={scanCategory}
                                            onChange={(e) => setScanCategory(e.target.value)}
                                            className={styles.scanCategorySelect}
                                        >
                                            {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                        <TronButton
                                            onClick={handleMapScan}
                                            size="sm"
                                            variant="primary"
                                        >
                                            [{'>'}] SCAN ON LEADS PAGE
                                        </TronButton>
                                    </div>

                                    {scanResult && (
                                        <div className={`${styles.scanResultBadge} ${styles[scanResult.type]}`}>
                                            {scanResult.type === 'success' ? '✅' : '⚠️'} {scanResult.message}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Sidebar ── */}
                {sidebarOpen && (
                    <aside className={styles.sidebar}>
                        <TronCard>
                            <h3 className={styles.sidebarTitle}>🎮 PLAYER RANKINGS</h3>
                            {players.length === 0 ? (
                                <p className={styles.emptyText}>No players yet. Claim some leads!</p>
                            ) : (
                                <div className={styles.playerList}>
                                    {players.map((player, i) => (
                                        <div key={player.name} className={styles.playerCard}>
                                            <div className={styles.playerHeader}>
                                                <div className={styles.playerRank}>
                                                    {i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                                </div>
                                                <div className={styles.playerInfo}>
                                                    <div className={styles.playerName} style={{ color: player.color }}>
                                                        {player.name}
                                                    </div>
                                                    <div className={styles.playerTier}>
                                                        {player.tierBadge} {player.tier}
                                                    </div>
                                                </div>
                                                <div className={styles.playerXP}>{player.xp} XP</div>
                                            </div>

                                            <div className={styles.xpBar}>
                                                <div
                                                    className={styles.xpBarFill}
                                                    style={{
                                                        width: `${player.tierProgress}%`,
                                                        background: player.color,
                                                        boxShadow: `0 0 4px ${player.color}`,
                                                    }}
                                                />
                                            </div>
                                            {player.nextTier && (
                                                <div className={styles.xpNext}>
                                                    {player.nextTierXP - player.xp} XP to {player.nextTier}
                                                </div>
                                            )}

                                            <div className={styles.playerStats}>
                                                <div className={styles.playerStatItem}>
                                                    <span className={styles.playerStatVal}>{player.total}</span>
                                                    <span>Leads</span>
                                                </div>
                                                <div className={styles.playerStatItem}>
                                                    <span className={styles.playerStatVal}>{player.citiesCount}</span>
                                                    <span>Cities</span>
                                                </div>
                                                <div className={styles.playerStatItem}>
                                                    <span className={styles.playerStatVal}>{player.statuses?.contacted || 0}</span>
                                                    <span>Called</span>
                                                </div>
                                                <div className={styles.playerStatItem}>
                                                    <span className={styles.playerStatVal} style={{ color: '#00ff41' }}>{player.statuses?.closed || 0}</span>
                                                    <span>Closed</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </TronCard>

                        <TronCard>
                            <h3 className={styles.sidebarTitle}>🏆 TIER SYSTEM</h3>
                            <div className={styles.tierList}>
                                {(mapData?.tiers || []).map(tier => (
                                    <div key={tier.name} className={styles.tierRow}>
                                        <span className={styles.tierBadge}>{tier.badge}</span>
                                        <span className={styles.tierName}>{tier.name}</span>
                                        <span className={styles.tierXP}>{tier.xp} XP</span>
                                    </div>
                                ))}
                            </div>
                        </TronCard>

                        {/* Hot Spots — top opportunity cities not yet conquered */}
                        <TronCard>
                            <h3 className={styles.sidebarTitle}>🔥 HOT SPOTS</h3>
                            <div className={styles.cityLeaderboard}>
                                {US_CITIES
                                    .filter(c => !conqueredCities.some(cc => cc.city.toLowerCase() === c.city.toLowerCase() && cc.state.toLowerCase() === c.state.toLowerCase()))
                                    .sort((a, b) => b.opportunityScore - a.opportunityScore)
                                    .slice(0, 10)
                                    .map(city => (
                                        <button
                                            key={`${city.city}-${city.state}`}
                                            className={styles.cityLeaderRow}
                                            onClick={() => {
                                                setSelectedCity({ ...city, conquered: null });
                                                if (mapComponentRef.current) {
                                                    mapComponentRef.current.flyTo(city.lat, city.lng, 10);
                                                }
                                            }}
                                        >
                                            <span className={styles.cityLeaderDot} style={{ background: getHeatColor(city.opportunityScore) }} />
                                            <span className={styles.cityLeaderName}>{city.city}, {city.state}</span>
                                            <span className={styles.cityLeaderCount}>{city.opportunityScore}</span>
                                        </button>
                                    ))}
                            </div>
                        </TronCard>
                    </aside>
                )}
            </div>
        </div>
    );
}

function getHeatColor(score) {
    if (score >= 80) return '#ff2d55';
    if (score >= 60) return '#ff6b35';
    if (score >= 45) return '#ffb000';
    if (score >= 30) return '#ff8c00';
    if (score >= 15) return '#7a5af5';
    return '#3a3f9e';
}

function formatPop(n) {
    if (!n) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'K';
    return n.toString();
}

function formatIncome(n) {
    if (!n) return '—';
    if (n >= 1000) return Math.round(n / 1000) + 'K';
    return n.toString();
}
