import { NextResponse } from 'next/server';
import { searchBusinesses, assessWebsiteQuality } from '@/lib/google-maps';
import { scoreLead } from '@/lib/scoring';

export async function POST(request) {
    try {
        const body = await request.json();
        const { location, category } = body;

        if (!location || !category) {
            return NextResponse.json(
                { error: 'Location and category are required' },
                { status: 400 }
            );
        }

        // Search Google Maps — now paginates for up to 60 results
        const businesses = await searchBusinesses(location, category);

        if (!businesses || businesses.length === 0) {
            return NextResponse.json({
                message: 'No businesses found for this search',
                results: [],
                stats: { total: 0, noWebsite: 0, hasWebsite: 0 },
            });
        }

        // Process — score, assess, and deduplicate by name
        const seen = new Set();
        const results = [];

        for (const biz of businesses) {
            const key = biz.business_name.toLowerCase().trim();
            if (seen.has(key)) continue;
            seen.add(key);

            const websiteQuality = assessWebsiteQuality(biz.website_url);

            // Parse address: Google format is typically "Street, City, State ZIP, Country"
            const addressParts = biz.address.split(',').map(p => p.trim());
            let city = location;
            let state = '';

            if (addressParts.length >= 4) {
                // "123 Main St, Miami, FL 33132, USA" → city = Miami
                city = addressParts[addressParts.length - 3];
                const stateZip = addressParts[addressParts.length - 2];
                state = stateZip.split(' ')[0] || '';
            } else if (addressParts.length === 3) {
                // "Miami, FL 33132, USA" → city = Miami
                city = addressParts[0];
                const stateZip = addressParts[1];
                state = stateZip.split(' ')[0] || '';
            } else if (addressParts.length === 2) {
                city = addressParts[0];
            }

            const lead = {
                business_name: biz.business_name,
                category: biz.category || category,
                address: biz.address,
                city,
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
            };

            lead.lead_score = scoreLead({ ...lead, website_quality: websiteQuality });
            results.push(lead);
        }

        // CRITICAL SORT: No website FIRST (the whole point), then by score descending
        results.sort((a, b) => {
            // Primary: no website always on top
            if (!a.has_website && b.has_website) return -1;
            if (a.has_website && !b.has_website) return 1;
            // Secondary: by lead score descending
            return b.lead_score - a.lead_score;
        });

        // Cross-reference with already-saved leads
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
        const { data: savedLeads } = await supabase
            .from('leads')
            .select('id, business_name, city');

        const savedSet = new Map();
        (savedLeads || []).forEach(s => {
            savedSet.set(`${s.business_name.toLowerCase().trim()}::${(s.city || '').toLowerCase().trim()}`, s.id);
        });

        let alreadySavedCount = 0;
        for (const r of results) {
            const key = `${r.business_name.toLowerCase().trim()}::${(r.city || '').toLowerCase().trim()}`;
            if (savedSet.has(key)) {
                r.already_saved = true;
                r.saved_id = savedSet.get(key);
                alreadySavedCount++;
            } else {
                r.already_saved = false;
            }
        }

        const stats = {
            total: results.length,
            noWebsite: results.filter(r => !r.has_website).length,
            hasWebsite: results.filter(r => r.has_website).length,
            alreadySaved: alreadySavedCount,
        };

        return NextResponse.json({
            message: `Found ${results.length} businesses (${stats.noWebsite} without websites${alreadySavedCount > 0 ? `, ${alreadySavedCount} already saved` : ''})`,
            results,
            stats,
        });

    } catch (error) {
        console.error('Scraper error:', error);
        return NextResponse.json(
            { error: error.message || 'Scraping failed' },
            { status: 500 }
        );
    }
}
