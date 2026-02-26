import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateProposalContent, buildProposalPDF } from '@/lib/proposal';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
    try {
        const { leadId } = await request.json();

        if (!leadId) {
            return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
        }

        // Fetch lead data
        const { data: lead, error: leadErr } = await supabase
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single();

        if (leadErr || !lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Generate AI content with dynamic pricing
        const content = await generateProposalContent(lead);

        // Build PDF
        const pdfBytes = await buildProposalPDF(lead, content);

        // Convert to base64
        const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
        const filename = `Caelborne_Proposal_${lead.business_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

        return NextResponse.json({
            content,
            pdfBase64,
            filename,
            lead: {
                business_name: lead.business_name,
                category: lead.category,
                city: lead.city,
                state: lead.state,
                google_rating: lead.google_rating,
                review_count: lead.review_count,
                has_website: lead.has_website,
            },
        });

    } catch (error) {
        console.error('Proposal error:', error);
        return NextResponse.json({ error: error.message || 'Failed to generate proposal' }, { status: 500 });
    }
}
