import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// POST /api/claim — Claim or unclaim a lead
export async function POST(request) {
    try {
        const { leadId, email } = await request.json();

        if (!leadId) {
            return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
        }

        // If email is null/empty, unclaim it
        const claimedBy = email || null;

        const { data, error } = await supabase
            .from('leads')
            .update({ claimed_by: claimedBy })
            .eq('id', leadId)
            .select()
            .single();

        if (error) {
            console.error('Claim error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, lead: data });
    } catch (error) {
        console.error('Claim API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
