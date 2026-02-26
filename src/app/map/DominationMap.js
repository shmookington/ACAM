'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import styles from './page.module.css';

const PLAYER_COLORS = {
    'Amiri': '#00ff41',
    'Toby': '#00d4ff',
    'Yaz': '#ffb000',
};

// Heat color from opportunity score (0-100)
function getHeatColor(score) {
    if (score >= 80) return '#ff2d55';
    if (score >= 60) return '#ff6b35';
    if (score >= 45) return '#ffb000';
    if (score >= 30) return '#ff8c00';
    if (score >= 15) return '#7a5af5';
    return '#3a3f9e';
}

function getConquestColor(pct) {
    if (pct >= 75) return '#00ff41';
    if (pct >= 50) return '#ffb000';
    if (pct >= 25) return '#ff8c00';
    return '#ff3333';
}

const DominationMap = forwardRef(function DominationMap({ allCities = [], conqueredCities = [], players = [], onCityClick }, ref) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);

    // Expose flyTo method to parent
    useImperativeHandle(ref, () => ({
        flyTo(lat, lng, zoom = 10) {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.flyTo([lat, lng], zoom, { duration: 1.2 });
            }
        },
    }));

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

            // Label
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

            // Click handler — select city AND fly to it
            marker.on('click', () => {
                if (onCityClick) onCityClick({ ...city, conquered });
                map.flyTo([city.lat, city.lng], 10, { duration: 1.0 });
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

    return <div ref={mapRef} className={styles.leafletMap} />;
});

export default DominationMap;

function formatPop(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'K';
    return n.toString();
}

function formatIncome(n) {
    if (n >= 1000) return Math.round(n / 1000) + 'K';
    return n.toString();
}
