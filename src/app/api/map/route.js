import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ── Hardcoded US City Coordinates (avoids geocoding API costs) ──
const CITY_COORDS = {
    // Florida
    'miami::fl': [25.7617, -80.1918], 'orlando::fl': [28.5383, -81.3792],
    'tampa::fl': [27.9506, -82.4572], 'jacksonville::fl': [30.3322, -81.6557],
    'fort lauderdale::fl': [26.1224, -80.1373], 'st. petersburg::fl': [27.7676, -82.6403],
    'hialeah::fl': [25.8576, -80.2781], 'tallahassee::fl': [30.4383, -84.2807],
    'cape coral::fl': [26.5629, -81.9495], 'pembroke pines::fl': [26.0128, -80.3241],
    'hollywood::fl': [26.0112, -80.1495], 'gainesville::fl': [29.6516, -82.3248],
    'coral springs::fl': [26.2712, -80.2706], 'clearwater::fl': [27.9659, -82.8001],
    'palm bay::fl': [28.0345, -80.5887], 'pompano beach::fl': [26.2379, -80.1248],
    'west palm beach::fl': [26.7153, -80.0534], 'lakeland::fl': [28.0395, -81.9498],
    'davie::fl': [26.0765, -80.2521], 'boca raton::fl': [26.3587, -80.0831],
    'sunrise::fl': [26.1667, -80.2561], 'plantation::fl': [26.1276, -80.2331],
    'deerfield beach::fl': [26.3184, -80.0998], 'melbourne::fl': [28.0836, -80.6081],
    'boynton beach::fl': [26.5254, -80.0664], 'delray beach::fl': [26.4615, -80.0728],
    'kissimmee::fl': [28.2920, -81.4076], 'sarasota::fl': [27.3364, -82.5307],
    'ocala::fl': [29.1872, -82.1401], 'fort myers::fl': [26.6406, -81.8723],
    'naples::fl': [26.1420, -81.7948], 'daytona beach::fl': [29.2108, -81.0228],
    'pensacola::fl': [30.4213, -87.2169], 'poinciana::fl': [28.1408, -81.4712],
    'port st. lucie::fl': [27.2730, -80.3582], 'panama city::fl': [30.1588, -85.6602],
    'sanford::fl': [28.8006, -81.2731], 'winter haven::fl': [28.0222, -81.7329],
    'st. cloud::fl': [28.2489, -81.2812],
    // New York
    'new york::ny': [40.7128, -74.0060], 'brooklyn::ny': [40.6782, -73.9442],
    'queens::ny': [40.7282, -73.7949], 'manhattan::ny': [40.7831, -73.9712],
    'bronx::ny': [40.8448, -73.8648], 'staten island::ny': [40.5795, -74.1502],
    'buffalo::ny': [42.8864, -78.8784], 'rochester::ny': [43.1566, -77.6088],
    'yonkers::ny': [40.9312, -73.8988], 'syracuse::ny': [43.0481, -76.1474],
    'albany::ny': [42.6526, -73.7562],
    // California
    'los angeles::ca': [34.0522, -118.2437], 'san francisco::ca': [37.7749, -122.4194],
    'san diego::ca': [32.7157, -117.1611], 'san jose::ca': [37.3382, -121.8863],
    'sacramento::ca': [38.5816, -121.4944], 'fresno::ca': [36.7378, -119.7871],
    'long beach::ca': [33.7701, -118.1937], 'oakland::ca': [37.8044, -122.2712],
    'bakersfield::ca': [35.3733, -119.0187], 'anaheim::ca': [33.8366, -117.9143],
    'santa ana::ca': [33.7455, -117.8677], 'riverside::ca': [33.9533, -117.3962],
    'stockton::ca': [37.9577, -121.2908], 'irvine::ca': [33.6846, -117.8265],
    'chula vista::ca': [32.6401, -117.0842],
    // Texas
    'houston::tx': [29.7604, -95.3698], 'dallas::tx': [32.7767, -96.7970],
    'san antonio::tx': [29.4241, -98.4936], 'austin::tx': [30.2672, -97.7431],
    'fort worth::tx': [32.7555, -97.3308], 'el paso::tx': [31.7619, -106.4850],
    'arlington::tx': [32.7357, -97.1081], 'corpus christi::tx': [27.8006, -97.3964],
    'plano::tx': [33.0198, -96.6989], 'laredo::tx': [27.5036, -99.5076],
    'lubbock::tx': [33.5779, -101.8552], 'irving::tx': [32.8140, -96.9489],
    // Illinois
    'chicago::il': [41.8781, -87.6298], 'aurora::il': [41.7606, -88.3201],
    'naperville::il': [41.7508, -88.1535], 'joliet::il': [41.5250, -88.0817],
    'rockford::il': [42.2711, -89.0940], 'springfield::il': [39.7817, -89.6501],
    // Pennsylvania
    'philadelphia::pa': [39.9526, -75.1652], 'pittsburgh::pa': [40.4406, -79.9959],
    'allentown::pa': [40.6084, -75.4902],
    // Arizona
    'phoenix::az': [33.4484, -112.0740], 'tucson::az': [32.2226, -110.9747],
    'mesa::az': [33.4152, -111.8315], 'scottsdale::az': [33.4942, -111.9261],
    'chandler::az': [33.3062, -111.8413], 'tempe::az': [33.4255, -111.9400],
    // Other major cities
    'atlanta::ga': [33.7490, -84.3880], 'savannah::ga': [32.0809, -81.0912],
    'augusta::ga': [33.4735, -81.9748], 'macon::ga': [32.8407, -83.6324],
    'athens::ga': [33.9519, -83.3576], 'tifton::ga': [31.4505, -83.5085],
    'valdosta::ga': [30.8327, -83.2785], 'albany::ga': [31.5785, -84.1557],
    'columbus::ga': [32.4610, -84.9877], 'marietta::ga': [33.9526, -84.5499],
    'charlotte::nc': [35.2271, -80.8431],
    'denver::co': [39.7392, -104.9903], 'seattle::wa': [47.6062, -122.3321],
    'portland::or': [45.5152, -122.6784], 'las vegas::nv': [36.1699, -115.1398],
    'nashville::tn': [36.1627, -86.7816], 'memphis::tn': [35.1495, -90.0490],
    'baltimore::md': [39.2904, -76.6122], 'boston::ma': [42.3601, -71.0589],
    'detroit::mi': [42.3314, -83.0458], 'minneapolis::mn': [44.9778, -93.2650],
    'columbus::oh': [39.9612, -82.9988], 'cleveland::oh': [41.4993, -81.6944],
    'cincinnati::oh': [39.1031, -84.5120], 'indianapolis::in': [39.7684, -86.1581],
    'milwaukee::wi': [43.0389, -87.9065], 'kansas city::mo': [39.0997, -94.5786],
    'st. louis::mo': [38.6270, -90.1994], 'new orleans::la': [29.9511, -90.0715],
    'oklahoma city::ok': [35.4676, -97.5164], 'raleigh::nc': [35.7796, -78.6382],
    'richmond::va': [37.5407, -77.4360], 'salt lake city::ut': [40.7608, -111.8910],
    'hartford::ct': [41.7658, -72.6734], 'honolulu::hi': [21.3069, -157.8583],
    'anchorage::ak': [61.2181, -149.9003], 'louisville::ky': [38.2527, -85.7585],
    'birmingham::al': [33.5186, -86.8104], 'providence::ri': [41.8240, -71.4128],
    'omaha::ne': [41.2565, -95.9345], 'albuquerque::nm': [35.0844, -106.6504],
    'jersey city::nj': [40.7178, -74.0431], 'newark::nj': [40.7357, -74.1724],
    'virginia beach::va': [36.8529, -75.9780], 'washington::dc': [38.9072, -77.0369],
};

// State abbreviation lookup (for normalizing "Florida" → "FL")
const STATE_ABBR = {
    'alabama': 'al', 'alaska': 'ak', 'arizona': 'az', 'arkansas': 'ar', 'california': 'ca',
    'colorado': 'co', 'connecticut': 'ct', 'delaware': 'de', 'florida': 'fl', 'georgia': 'ga',
    'hawaii': 'hi', 'idaho': 'id', 'illinois': 'il', 'indiana': 'in', 'iowa': 'ia',
    'kansas': 'ks', 'kentucky': 'ky', 'louisiana': 'la', 'maine': 'me', 'maryland': 'md',
    'massachusetts': 'ma', 'michigan': 'mi', 'minnesota': 'mn', 'mississippi': 'ms', 'missouri': 'mo',
    'montana': 'mt', 'nebraska': 'ne', 'nevada': 'nv', 'new hampshire': 'nh', 'new jersey': 'nj',
    'new mexico': 'nm', 'new york': 'ny', 'north carolina': 'nc', 'north dakota': 'nd', 'ohio': 'oh',
    'oklahoma': 'ok', 'oregon': 'or', 'pennsylvania': 'pa', 'rhode island': 'ri', 'south carolina': 'sc',
    'south dakota': 'sd', 'tennessee': 'tn', 'texas': 'tx', 'utah': 'ut', 'vermont': 'vt',
    'virginia': 'va', 'washington': 'wa', 'west virginia': 'wv', 'wisconsin': 'wi', 'wyoming': 'wy',
    'district of columbia': 'dc',
};

function normalizeState(state) {
    if (!state) return '';
    const s = state.trim().toLowerCase();
    if (s.length === 2) return s;
    return STATE_ABBR[s] || s;
}

function getCityKey(city, state) {
    const c = (city || '').trim().toLowerCase();
    const s = normalizeState(state);
    return `${c}::${s}`;
}

// ── Gamification: XP & Tiers ──
const TIERS = [
    { name: 'Scout', xp: 0, badge: '🔍' },
    { name: 'Hunter', xp: 100, badge: '🏹' },
    { name: 'Striker', xp: 500, badge: '⚡' },
    { name: 'Conqueror', xp: 1500, badge: '🗡️' },
    { name: 'Overlord', xp: 5000, badge: '👑' },
];

const XP_VALUES = { new: 5, contacted: 15, meeting: 50, closed: 200 };

function computeXP(statusCounts) {
    let total = 0;
    for (const [status, count] of Object.entries(statusCounts)) {
        total += (XP_VALUES[status] || 0) * count;
    }
    return total;
}

function getTier(xp) {
    let tier = TIERS[0];
    for (const t of TIERS) {
        if (xp >= t.xp) tier = t;
    }
    const nextTier = TIERS[TIERS.indexOf(tier) + 1] || null;
    return { ...tier, nextTier, progress: nextTier ? Math.round(((xp - tier.xp) / (nextTier.xp - tier.xp)) * 100) : 100 };
}

// Player name resolution
const NAME_MAP = {
    'amiri': 'Amiri', 'caelborne': 'Amiri',
    'toby': 'Toby',
    'yaz': 'Yaz',
};

const PLAYER_COLORS = {
    'Amiri': '#00ff41',
    'Toby': '#00d4ff',
    'Yaz': '#ffb000',
};

function resolvePlayerName(claimedBy) {
    if (!claimedBy) return null;
    const key = claimedBy.toLowerCase();
    for (const [pattern, name] of Object.entries(NAME_MAP)) {
        if (key.includes(pattern)) return name;
    }
    return claimedBy;
}

/**
 * GET /api/map
 * Returns all data needed for the World Domination Map
 */
export async function GET() {
    try {
        // Fetch all saved leads
        const { data: leads, error } = await supabase
            .from('leads')
            .select('id, business_name, category, city, state, status, claimed_by, lead_score, has_website, google_rating, review_count');

        if (error) throw error;

        const allLeads = leads || [];

        // ── Aggregate by city ──
        const cityMap = {};

        for (const lead of allLeads) {
            const city = (lead.city || '').trim();
            const state = (lead.state || '').trim();
            if (!city) continue;

            const key = getCityKey(city, state);
            if (!cityMap[key]) {
                cityMap[key] = {
                    city,
                    state,
                    key,
                    total: 0,
                    statuses: { new: 0, contacted: 0, responded: 0, meeting: 0, closed: 0 },
                    players: {},
                    categories: {},
                    coords: CITY_COORDS[key] || null,
                };
            }

            const c = cityMap[key];
            c.total++;
            const status = lead.status || 'new';
            if (c.statuses.hasOwnProperty(status)) c.statuses[status]++;

            // Track by player
            const player = resolvePlayerName(lead.claimed_by);
            if (player) {
                if (!c.players[player]) c.players[player] = { total: 0, statuses: { new: 0, contacted: 0, meeting: 0, closed: 0 } };
                c.players[player].total++;
                if (c.players[player].statuses.hasOwnProperty(status)) {
                    c.players[player].statuses[status]++;
                }
            }

            // Track categories
            const cat = lead.category || 'Unknown';
            c.categories[cat] = (c.categories[cat] || 0) + 1;
        }

        // Compute conquest % per city
        const cities = Object.values(cityMap).map(c => {
            const conquered = c.statuses.contacted + c.statuses.responded + c.statuses.meeting + c.statuses.closed;
            const conquestPct = c.total > 0 ? Math.round((conquered / c.total) * 100) : 0;
            return { ...c, conquestPct };
        });

        // ── Global player stats ──
        const globalPlayers = {};
        for (const lead of allLeads) {
            const player = resolvePlayerName(lead.claimed_by);
            if (!player) continue;

            if (!globalPlayers[player]) {
                globalPlayers[player] = {
                    name: player,
                    color: PLAYER_COLORS[player] || '#ffffff',
                    total: 0,
                    statuses: { new: 0, contacted: 0, meeting: 0, closed: 0 },
                    cities: new Set(),
                };
            }
            globalPlayers[player].total++;
            const status = lead.status || 'new';
            if (globalPlayers[player].statuses.hasOwnProperty(status)) {
                globalPlayers[player].statuses[status]++;
            }
            if (lead.city) globalPlayers[player].cities.add(lead.city);
        }

        // Compute XP + tiers for each player
        const players = Object.values(globalPlayers).map(p => {
            const xp = computeXP(p.statuses);
            const tier = getTier(xp);
            return {
                name: p.name,
                color: p.color,
                total: p.total,
                statuses: p.statuses,
                citiesCount: p.cities.size,
                xp,
                tier: tier.name,
                tierBadge: tier.badge,
                nextTier: tier.nextTier?.name || null,
                nextTierXP: tier.nextTier?.xp || null,
                tierProgress: tier.progress,
            };
        }).sort((a, b) => b.xp - a.xp);

        // ── Global stats ──
        const totalCities = cities.length;
        const totalLeads = allLeads.length;
        const totalContacted = allLeads.filter(l => ['contacted', 'responded', 'meeting', 'closed'].includes(l.status)).length;
        const globalConquestPct = totalLeads > 0 ? Math.round((totalContacted / totalLeads) * 100) : 0;

        return NextResponse.json({
            cities,
            players,
            globalStats: {
                totalCities,
                totalLeads,
                totalContacted,
                conquestPct: globalConquestPct,
            },
            tiers: TIERS,
        });

    } catch (error) {
        console.error('Map API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
