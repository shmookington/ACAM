import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { searchBusinesses, assessWebsiteQuality } from '@/lib/google-maps';
import { scoreLead } from '@/lib/scoring';

// 50 Major US Cities — rotated daily
const CITIES = [
    'Miami, FL', 'Houston, TX', 'Atlanta, GA', 'Phoenix, AZ', 'Dallas, TX',
    'Los Angeles, CA', 'Chicago, IL', 'Tampa, FL', 'Denver, CO', 'Las Vegas, NV',
    'San Antonio, TX', 'Charlotte, NC', 'Austin, TX', 'Nashville, TN', 'San Diego, CA',
    'Orlando, FL', 'Seattle, WA', 'Portland, OR', 'Minneapolis, MN', 'Raleigh, NC',
    'Jacksonville, FL', 'Columbus, OH', 'Indianapolis, IN', 'Fort Worth, TX', 'San Jose, CA',
    'Salt Lake City, UT', 'Kansas City, MO', 'Sacramento, CA', 'New Orleans, LA', 'Tucson, AZ',
    'Albuquerque, NM', 'Omaha, NE', 'Louisville, KY', 'Richmond, VA', 'Memphis, TN',
    'Oklahoma City, OK', 'Milwaukee, WI', 'Detroit, MI', 'Bakersfield, CA', 'Mesa, AZ',
    'Birmingham, AL', 'Boise, ID', 'Fresno, CA', 'Honolulu, HI', 'Tulsa, OK',
    'El Paso, TX', 'Knoxville, TN', 'Chattanooga, TN', 'Savannah, GA', 'Charleston, SC',
];

// High-value categories for web design leads
const CATEGORIES = [
    'restaurants', 'hair salons', 'auto repair', 'dentists', 'gyms',
    'landscaping', 'plumbers', 'electricians', 'chiropractors', 'bakeries',
    'pet grooming', 'car wash', 'nail salons', 'yoga studios', 'tattoo shops',
    'florists', 'daycares', 'veterinarians', 'moving companies', 'roofing contractors',
];

function verifyCronAuth(request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (process.env.NODE_ENV !== 'production' && !cronSecret) return true;
    if (authHeader !== `Bearer ${cronSecret}`) return false;
    return true;
}

function pickRandom(arr, count) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

export async function GET(request) {
    if (!verifyCronAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Pick 3 random cities and 2 random categories = 6 searches
        const todayCities = pickRandom(CITIES, 3);
        const todayCategories = pickRandom(CATEGORIES, 2);

        const allDiscoveries = [];
        const searchLog = [];

        for (const city of todayCities) {
            for (const category of todayCategories) {
                try {
                    const businesses = await searchBusinesses(city, category);
                    if (!businesses || businesses.length === 0) continue;

                    // Process each business
                    const seen = new Set();
                    for (const biz of businesses) {
                        const key = biz.business_name.toLowerCase().trim();
                        if (seen.has(key)) continue;
                        seen.add(key);

                        const websiteQuality = assessWebsiteQuality(biz.website_url);
                        const addressParts = biz.address.split(',').map(p => p.trim());
                        const parsedCity = addressParts.length >= 2 ? addressParts[addressParts.length - 2] : city;
                        const stateZip = addressParts.length >= 1 ? addressParts[addressParts.length - 1] : '';
                        const state = stateZip.split(' ')[0] || '';

                        const lead = {
                            business_name: biz.business_name,
                            category: biz.category || category,
                            address: biz.address,
                            city: parsedCity,
                            state,
                            phone: biz.phone,
                            email: null,
                            google_rating: biz.google_rating,
                            review_count: biz.review_count,
                            has_website: biz.has_website,
                            website_url: biz.website_url,
                            website_quality: websiteQuality,
                            google_maps_url: biz.google_maps_url,
                            lead_score: 0,
                            source: 'daily_discovery',
                            discovered_at: new Date().toISOString(),
                        };

                        lead.lead_score = scoreLead({ ...lead, website_quality: websiteQuality });

                        // Only keep high-value leads (score >= 50 or no website)
                        if (lead.lead_score >= 50 || !lead.has_website) {
                            allDiscoveries.push(lead);
                        }
                    }

                    searchLog.push({ city, category, found: businesses.length });
                } catch (err) {
                    console.error(`Discovery failed for ${category} in ${city}:`, err.message);
                    searchLog.push({ city, category, error: err.message });
                }
            }
        }

        // Deduplicate across all searches by business name
        const uniqueMap = new Map();
        for (const lead of allDiscoveries) {
            const key = lead.business_name.toLowerCase().trim();
            if (!uniqueMap.has(key) || lead.lead_score > uniqueMap.get(key).lead_score) {
                uniqueMap.set(key, lead);
            }
        }
        const uniqueLeads = Array.from(uniqueMap.values());

        // Sort: no website first, then by score
        uniqueLeads.sort((a, b) => {
            if (!a.has_website && b.has_website) return -1;
            if (a.has_website && !b.has_website) return 1;
            return b.lead_score - a.lead_score;
        });

        // Clear yesterday's daily picks
        const { error: deleteError } = await supabase.from('daily_picks').delete().gte('created_at', '1970-01-01');
        if (deleteError) {
            console.error('Delete error:', deleteError);
        }

        // Insert the top 15 discoveries
        const topPicks = uniqueLeads.slice(0, 15);
        let insertErr = null;
        if (topPicks.length > 0) {
            const rows = topPicks.map(lead => ({
                business_name: lead.business_name,
                category: lead.category,
                address: lead.address,
                city: lead.city,
                state: lead.state,
                phone: lead.phone,
                google_rating: lead.google_rating,
                review_count: lead.review_count,
                has_website: lead.has_website,
                website_url: lead.website_url,
                google_maps_url: lead.google_maps_url,
                lead_score: lead.lead_score,
            }));

            const { error: ie } = await supabase.from('daily_picks').insert(rows);
            if (ie) {
                console.error('Insert error:', ie);
                insertErr = ie.message;
            }
        }

        return NextResponse.json({
            success: !insertErr,
            message: `Daily discovery complete: ${uniqueLeads.length} high-value leads found across ${todayCities.length} cities.`,
            searches: searchLog,
            leadsStored: topPicks.length,
            deleteError: deleteError?.message || null,
            insertError: insertErr || null,
        });

    } catch (error) {
        console.error('Daily Discovery Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
