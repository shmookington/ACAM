'use client';

import { useEffect, useRef } from 'react';
import styles from './page.module.css';

const PLAYER_COLORS = {
    'Amiri': '#00ff41',
    'Toby': '#00d4ff',
    'Yaz': '#ffb000',
};

// Heat color from opportunity score (0-100)
// Low opportunity = cool blue, Medium = warm amber, High = hot red/magenta
function getHeatColor(score) {
    if (score >= 80) return '#ff2d55'; // hot magenta
    if (score >= 60) return '#ff6b35'; // hot orange
    if (score >= 45) return '#ffb000'; // warm amber
    if (score >= 30) return '#ff8c00'; // mild orange
    if (score >= 15) return '#7a5af5'; // cool purple
    return '#3a3f9e'; // cold blue
}

// Get conquest color (green shades) — used when a city is conquered
function getConquestColor(pct) {
    if (pct >= 75) return '#00ff41';
    if (pct >= 50) return '#ffb000';
    if (pct >= 25) return '#ff8c00';
    return '#ff3333';
}

export default function DominationMap({ allCities = [], conqueredCities = [], players = [], onCityClick }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);

    useEffect(() => {
        if (mapInstanceRef.current) return;
        if (!mapRef.current) return;

        if (mapRef.current._leaflet_id) {
            delete mapRef.current._leaflet_id;
        }

        const initMap = async () => {
            const L = (await import('leaflet')).default;
            await import('leaflet/dist/leaflet.css');

            if (!mapRef.current || mapInstanceRef.current) return;

            const map = L.map(mapRef.current, {
                center: [39.8283, -98.5795],
                zoom: 4,
                zoomControl: false,
                attributionControl: false,
                minZoom: 3,
                maxZoom: 18,
            });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                subdomains: 'abcd',
                maxZoom: 19,
            }).addTo(map);

            L.control.zoom({ position: 'topright' }).addTo(map);
            map.getContainer().style.background = '#0a0a0a';

            mapInstanceRef.current = map;
            renderAllMarkers(L, map);
        };

        initMap();

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Re-render markers when data changes
    useEffect(() => {
        if (!mapInstanceRef.current) return;
        const loadAndRender = async () => {
            const L = (await import('leaflet')).default;
            renderAllMarkers(L, mapInstanceRef.current);
        };
        loadAndRender();
    }, [allCities, conqueredCities]);

    // Build a lookup of conquered cities
    function getConqueredLookup() {
        const lookup = {};
        (conqueredCities || []).forEach(c => {
            const key = `${(c.city || '').toLowerCase()}::${(c.state || '').toLowerCase()}`;
            lookup[key] = c;
        });
        return lookup;
    }

    function renderAllMarkers(L, map) {
        markersRef.current.forEach(m => map.removeLayer(m));
        markersRef.current = [];

        const conqueredLookup = getConqueredLookup();

        (allCities || []).forEach(city => {
            const key = `${city.city.toLowerCase()}::${city.state.toLowerCase()}`;
            const conquered = conqueredLookup[key];
            const isConquered = !!conquered;

            // Determine color and size
            let color, glowIntensity, markerSize, labelSuffix;

            if (isConquered) {
                // Conquered city — show dominant player color or conquest color
                const topPlayer = getTopPlayer(conquered);
                if (topPlayer) {
                    color = PLAYER_COLORS[topPlayer] || '#00ff41';
                } else {
                    color = getConquestColor(conquered.conquestPct || 0);
                }
                glowIntensity = 0.5;
                markerSize = Math.min(Math.max(conquered.total * 1.5, 10), 40);
                labelSuffix = `${conquered.total} leads · ${conquered.conquestPct}%`;
            } else {
                // Unconquered city — heat signature based on opportunity
                color = getHeatColor(city.opportunityScore);
                glowIntensity = 0.15 + (city.opportunityScore / 100) * 0.25;
                markerSize = Math.min(Math.max((city.population / 50000), 8), 24);
                labelSuffix = `Pop: ${formatPop(city.population)} · $${formatIncome(city.income)}`;
            }

            // Outer glow
            const outerMarker = L.circleMarker([city.lat, city.lng], {
                radius: markerSize * 1.6,
                fillColor: color,
                fillOpacity: glowIntensity * 0.3,
                color: color,
                weight: 0,
                opacity: 0,
            }).addTo(map);

            // Main marker
            const marker = L.circleMarker([city.lat, city.lng], {
                radius: markerSize,
                fillColor: color,
                fillOpacity: glowIntensity,
                color: color,
                weight: isConquered ? 2 : 1,
                opacity: isConquered ? 0.8 : 0.4,
            }).addTo(map);

            // Inner core
            const innerMarker = L.circleMarker([city.lat, city.lng], {
                radius: markerSize * 0.4,
                fillColor: color,
                fillOpacity: isConquered ? 0.8 : 0.4,
                color: color,
                weight: 0,
            }).addTo(map);

            // Label (only show at zoom > 5 for non-conquered, always show conquered)
            const labelIcon = L.divIcon({
                className: styles.mapLabel,
                html: `
                    <div class="${styles.mapLabelContent}" style="color: ${color}; text-shadow: 0 0 6px ${color}; opacity: ${isConquered ? 1 : 0.7};">
                        <div class="${styles.mapLabelCity}">${city.city}</div>
                        <div class="${styles.mapLabelCount}">${labelSuffix}</div>
                    </div>
                `,
                iconSize: [140, 40],
                iconAnchor: [70, -markerSize - 4],
            });
            const labelMarker = L.marker([city.lat, city.lng], { icon: labelIcon, interactive: false }).addTo(map);

            // Build popup
            const popupHtml = buildPopupHtml(city, conquered, color, isConquered);
            marker.bindPopup(popupHtml, {
                className: styles.tronPopup,
                closeButton: true,
                maxWidth: 320,
            });

            // Click handler
            marker.on('click', () => {
                if (onCityClick) onCityClick({ ...city, conquered });
            });

            // Hover effects
            marker.on('mouseover', () => {
                marker.setStyle({ fillOpacity: glowIntensity + 0.3, weight: 2 });
                outerMarker.setStyle({ fillOpacity: glowIntensity * 0.6 });
                innerMarker.setStyle({ fillOpacity: 0.9 });
            });
            marker.on('mouseout', () => {
                marker.setStyle({ fillOpacity: glowIntensity, weight: isConquered ? 2 : 1 });
                outerMarker.setStyle({ fillOpacity: glowIntensity * 0.3 });
                innerMarker.setStyle({ fillOpacity: isConquered ? 0.8 : 0.4 });
            });

            // Zoom-based label visibility
            map.on('zoomend', () => {
                const zoom = map.getZoom();
                if (!isConquered && zoom < 5) {
                    labelMarker.setOpacity(0);
                } else if (!isConquered && zoom < 7) {
                    // Only show larger cities at mid-zoom
                    labelMarker.setOpacity(city.population > 200000 ? 1 : 0);
                } else {
                    labelMarker.setOpacity(1);
                }
            });

            // Initial label visibility
            const zoom = map.getZoom();
            if (!isConquered && zoom < 5) {
                labelMarker.setOpacity(0);
            } else if (!isConquered && zoom < 7) {
                labelMarker.setOpacity(city.population > 200000 ? 1 : 0);
            }

            markersRef.current.push(marker, innerMarker, outerMarker, labelMarker);
        });
    }

    function getTopPlayer(conquered) {
        if (!conquered?.players) return null;
        let topPlayer = null, topCount = 0;
        Object.entries(conquered.players).forEach(([name, stats]) => {
            if (stats.total > topCount) {
                topPlayer = name;
                topCount = stats.total;
            }
        });
        return topPlayer;
    }

    function buildPopupHtml(city, conquered, color, isConquered) {
        const statusLine = isConquered
            ? `<div style="color:${color};font-size:17px;margin-bottom:10px;letter-spacing:0.06em;">CONQUERED — ${conquered.conquestPct}%</div>`
            : `<div style="color:${color};font-size:17px;margin-bottom:10px;letter-spacing:0.06em;">UNCONQUERED — OPPORTUNITY: ${city.opportunityScore}/100</div>`;

        const statsGrid = isConquered ? `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center;margin-bottom:12px;border:1px solid rgba(0,255,65,0.15);padding:10px 0;">
                <div><div style="color:#fff;font-size:22px;">${conquered.total}</div><div style="color:#888;font-size:13px;margin-top:2px;">TOTAL</div></div>
                <div><div style="color:#00d4ff;font-size:22px;">${conquered.statuses?.contacted || 0}</div><div style="color:#888;font-size:13px;margin-top:2px;">HIT UP</div></div>
                <div><div style="color:#ffb000;font-size:22px;">${conquered.statuses?.meeting || 0}</div><div style="color:#888;font-size:13px;margin-top:2px;">MEETINGS</div></div>
                <div><div style="color:#00ff41;font-size:22px;">${conquered.statuses?.closed || 0}</div><div style="color:#888;font-size:13px;margin-top:2px;">CLOSED</div></div>
            </div>
        ` : `
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;text-align:center;margin-bottom:12px;border:1px solid rgba(0,255,65,0.1);padding:12px 0;">
                <div><div style="color:#fff;font-size:22px;">${formatPop(city.population)}</div><div style="color:#888;font-size:13px;margin-top:2px;">POPULATION</div></div>
                <div><div style="color:#ffb000;font-size:22px;">$${formatIncome(city.income)}</div><div style="color:#888;font-size:13px;margin-top:2px;">MED. INCOME</div></div>
            </div>
        `;

        // Player breakdown for conquered cities
        let playerHtml = '';
        if (isConquered && conquered.players) {
            const playerLines = Object.entries(conquered.players).map(([name, stats]) => {
                const pColor = PLAYER_COLORS[name] || '#fff';
                return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:15px;">
                    <span style="width:10px;height:10px;background:${pColor};box-shadow:0 0 6px ${pColor};display:inline-block;"></span>
                    <span style="color:#ccc;">${name}</span>
                    <span style="margin-left:auto;color:${pColor};font-weight:bold;">${stats.total}</span>
                </div>`;
            }).join('');
            playerHtml = `<div style="border-top:1px solid rgba(0,255,65,0.1);padding-top:8px;margin-top:6px;">
                <div style="color:#888;font-size:13px;letter-spacing:0.1em;margin-bottom:4px;">PLAYERS</div>${playerLines}
            </div>`;
        }

        const scanPrompt = !isConquered ? `
            <div style="border-top:1px solid rgba(0,255,65,0.1);padding-top:10px;margin-top:10px;text-align:center;">
                <div style="color:${color};font-size:15px;letter-spacing:0.08em;">
                    ▶ CLICK TO START SCANNING
                </div>
            </div>
        ` : '';

        return `
            <div style="font-family:'VT323','Courier New',monospace;background:#0a0a0a;border:1px solid ${color};padding:16px 20px;min-width:260px;">
                <div style="font-size:26px;color:${color};text-shadow:0 0 8px ${color};margin-bottom:6px;letter-spacing:0.12em;">
                    ${city.city}, ${city.state}
                </div>
                ${statusLine}
                ${statsGrid}
                ${playerHtml}
                ${scanPrompt}
            </div>
        `;
    }

    return <div ref={mapRef} className={styles.leafletMap} />;
}

function formatPop(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'K';
    return n.toString();
}

function formatIncome(n) {
    if (n >= 1000) return Math.round(n / 1000) + 'K';
    return n.toString();
}
