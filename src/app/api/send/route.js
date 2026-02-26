import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/resend';
import { rescoreLead } from '@/lib/scoring';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * POST /api/send
 * Sends an approved email via Resend and updates its status in the outreach table
 * Body: { outreachId }
 */
export async function POST(request) {
    try {
        const { outreachId, attachProposal } = await request.json();

        if (!outreachId) {
            return NextResponse.json({ error: 'outreachId is required' }, { status: 400 });
        }

        // Fetch the outreach record with lead data
        const { data: outreach, error: fetchErr } = await supabase
            .from('outreach')
            .select('*, leads(*)')
            .eq('id', outreachId)
            .single();

        if (fetchErr || !outreach) {
            return NextResponse.json({ error: 'Email not found' }, { status: 404 });
        }

        if (outreach.status !== 'approved') {
            return NextResponse.json(
                { error: `Email must be approved before sending. Current status: ${outreach.status}` },
                { status: 400 }
            );
        }

        // Get recipient email — use lead's email if available, otherwise skip
        const lead = outreach.leads;
        const recipientEmail = lead?.email;

        // Generate proposal PDF attachment if requested
        let attachments = null;
        if (attachProposal && lead) {
            try {
                const { generateProposalContent, buildProposalPDF } = await import('@/lib/proposal');
                const content = await generateProposalContent(lead);
                const pdfBytes = await buildProposalPDF(lead, content);
                const filename = `Caelborne_Proposal_${lead.business_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
                attachments = [{
                    filename,
                    content: Buffer.from(pdfBytes),
                    contentType: 'application/pdf',
                }];
            } catch (pdfErr) {
                console.error('Proposal PDF generation error:', pdfErr);
                // Continue sending without attachment
            }
        }

        if (!recipientEmail) {
            const { error: updateErr } = await supabase
                .from('outreach')
                .update({
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    notes: 'No recipient email — marked as sent for tracking',
                })
                .eq('id', outreachId);

            if (updateErr) {
                return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
            }

            if (lead?.id) {
                const followUpDate = new Date();
                followUpDate.setDate(followUpDate.getDate() + 3);
                const newScore = rescoreLead(lead.lead_score || 50, 'email_sent');
                await supabase.from('leads').update({
                    status: 'contacted',
                    callback_date: followUpDate.toISOString().split('T')[0],
                    lead_score: newScore,
                }).eq('id', lead.id);
            }

            return NextResponse.json({
                success: true,
                message: 'Email marked as sent (no recipient email on file)',
                noRecipient: true,
            });
        }

        // Send the email via Gmail SMTP (with optional proposal attachment)
        const result = await sendEmail(recipientEmail, outreach.email_subject, outreach.email_body, null, attachments);

        if (!result.success) {
            return NextResponse.json(
                { error: `Send failed: ${result.error}` },
                { status: 500 }
            );
        }

        // Update outreach status to sent
        const { error: updateErr } = await supabase
            .from('outreach')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                message_id: result.messageId,
            })
            .eq('id', outreachId);

        if (updateErr) {
            console.error('Update error:', updateErr);
        }

        // Update lead status to contacted + auto-schedule follow-up in 3 days
        if (lead?.id) {
            const followUpDate = new Date();
            followUpDate.setDate(followUpDate.getDate() + 3);
            const newScore = rescoreLead(lead.lead_score || 50, 'email_sent');
            await supabase.from('leads').update({
                status: 'contacted',
                callback_date: followUpDate.toISOString().split('T')[0],
                lead_score: newScore,
            }).eq('id', lead.id);
        }

        return NextResponse.json({
            success: true,
            message: `Email sent to ${recipientEmail}`,
            messageId: result.messageId,
        });

    } catch (error) {
        console.error('Send API error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to send' },
            { status: 500 }
        );
    }
}
