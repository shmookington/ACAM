import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch saved leads
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const sortBy = searchParams.get('sortBy') || 'lead_score';
        const sortOrder = searchParams.get('sortOrder') || 'desc';

        let query = supabase
            .from('leads')
            .select('*')
            .order(sortBy, { ascending: sortOrder === 'asc' });

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        if (search) {
            query = query.or(`business_name.ilike.%${search}%,city.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ leads: data || [] });
    } catch (error) {
        console.error('Error fetching leads:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Save individual leads (from scan results)
export async function POST(request) {
    try {
        const body = await request.json();
        const { leads } = body; // array of lead objects

        if (!leads || !Array.isArray(leads) || leads.length === 0) {
            return NextResponse.json({ error: 'No leads provided' }, { status: 400 });
        }

        // ── Round-robin team assignment ──
        const TEAM = [
            { name: 'Amiri', email: 'amiri@caelborne.io' },
            { name: 'Toby', email: 'toby.aro3@gmail.com' },
            { name: 'Yaz', email: 'yaz.abuzaid@gmail.com' },
        ];

        // Get current claim counts to balance distribution
        const { data: claimCounts } = await supabase
            .from('leads')
            .select('claimed_by');

        const countMap = {};
        TEAM.forEach(m => { countMap[m.email] = 0; });
        (claimCounts || []).forEach(l => {
            if (l.claimed_by && countMap[l.claimed_by] !== undefined) {
                countMap[l.claimed_by]++;
            }
        });

        // Sort team by fewest leads first for round-robin
        const sortedTeam = [...TEAM].sort((a, b) => countMap[a.email] - countMap[b.email]);
        let assignIndex = 0;

        const saved = [];
        const skipped = [];

        for (const lead of leads) {
            // Check for duplicates by business name + city
            const checkCity = lead.city || '';
            const { data: existing } = await supabase
                .from('leads')
                .select('id')
                .eq('business_name', lead.business_name)
                .eq('city', checkCity)
                .limit(1);

            if (existing && existing.length > 0) {
                console.log(`Skipping duplicate: ${lead.business_name} in ${checkCity}`);
                skipped.push(lead.business_name);
                continue;
            }

            // Remove any scan-only fields before inserting
            const { already_saved, saved_id, ...cleanLead } = lead;

            // Assign to next team member in rotation
            const assignee = sortedTeam[assignIndex % sortedTeam.length];
            assignIndex++;

            const { data, error } = await supabase
                .from('leads')
                .insert({
                    ...cleanLead,
                    city: checkCity,
                    status: 'saved',
                    scraped_at: new Date().toISOString(),
                    claimed_by: assignee.email,
                })
                .select()
                .single();

            if (error) {
                console.error(`Error saving ${lead.business_name}:`, error.message, error.details, error.hint);
                skipped.push(lead.business_name);
                continue;
            }

            saved.push(data);
        }

        return NextResponse.json({
            message: `${saved.length} saved, ${skipped.length} skipped`,
            saved,
            skipped,
        });
    } catch (error) {
        console.error('Error saving leads:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT - Update a lead
export async function PUT(request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('leads')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ lead: data });
    } catch (error) {
        console.error('Error updating lead:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
