import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/resend';

// DeepSeek Setup
const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY || ''
});

// Authenticate Vercel Cron Request
function verifyCronAuth(request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // If not in production, or if no CRON_SECRET is set, allow (for local testing)
    if (process.env.NODE_ENV !== 'production' && !cronSecret) return true;

    if (authHeader !== `Bearer ${cronSecret}`) {
        return false;
    }
    return true;
}

function calculateDaysAgo(dateString) {
    if (!dateString) return 0;
    const past = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - past);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export async function GET(request) {
    // Vercel Cron triggers via GET requests
    if (!verifyCronAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Find leads that have been contacted but haven't responded
        // Assuming 'contacted' means an email was sent and they haven't been manually moved to 'responded'
        const { data: leads, error: leadsErr } = await supabase
            .from('leads')
            .select('*')
            .eq('status', 'contacted');

        if (leadsErr) throw leadsErr;

        const processedLeads = [];
        const errors = [];

        for (const lead of leads) {
            // Get their outreach history, sorted newest first
            const { data: outreachHistory, error: outErr } = await supabase
                .from('outreach')
                .select('*')
                .eq('lead_id', lead.id)
                .order('created_at', { ascending: false });

            if (outErr || !outreachHistory || outreachHistory.length === 0) continue;

            const latestOutreach = outreachHistory[0];

            // If the latest email hasn't been sent yet, skip
            if (latestOutreach.status !== 'sent') continue;

            const daysSinceLastEmail = calculateDaysAgo(latestOutreach.sent_at);
            let nextAction = null;
            let promptType = '';

            // Check logic for Follow-up 1
            if (latestOutreach.email_type === 'initial' && daysSinceLastEmail >= 3) {
                nextAction = 'followup_1';
                promptType = 'a short, casual bump to the top of their inbox (e.g. "Hey [Name], just bringing this to the top of your inbox. Did you have a chance to look at what I sent earlier?")';
            }
            // Check logic for Follow-up 2 (The Breakup)
            else if (latestOutreach.email_type === 'followup_1' && daysSinceLastEmail >= 4) {
                nextAction = 'followup_2';
                promptType = 'a final, polite "breakup" email. Assume they are super busy and say you won\'t bother them again, but leave the door open if they ever need a stunning new website for their local business.';
            }

            if (nextAction) {
                try {
                    // Generate email using DeepSeek
                    const aiPrompt = `You are Amiri, the founder of Caelborne Digital. You are writing a follow-up cold email.
                    
                    PREVIOUS EMAIL CONTEXT:
                    You previously sent an email to ${lead.business_name} at this location: ${lead.city}.
                    Their original email was about offering a free custom website mockup for their business.
                    
                    YOUR TASK:
                    Write exactly: ${promptType}
                    
                    RULES:
                    1. SUPER CASUAL. Talk like a friendly human sending a quick note from their phone. No corporate jargon.
                    2. Short. 2-4 sentences max.
                    3. Format: Double returns between sentences for skimmability.
                    4. Sign off: Best,\\nAmiri\\nCaelborne Digital (caelborne.io)
                    
                    OUTPUT FORMAT:
                    Return ONLY a JSON object with "subject" and "body".
                    For the subject, either reuse a variation of the old subject like "Re: Quick question" or write a new short one.`;

                    const completion = await openai.chat.completions.create({
                        messages: [{ role: "user", content: aiPrompt }],
                        model: "deepseek-chat",
                    });

                    const text = completion.choices[0].message.content;

                    let emailData;
                    try {
                        const jsonMatch = text.match(/\{[\s\S]*\}/);
                        emailData = JSON.parse(jsonMatch ? jsonMatch[0] : text);
                    } catch {
                        emailData = {
                            subject: `Following up with ${lead.business_name}`,
                            body: text
                        };
                    }

                    // Send the email via Resend
                    if (lead.email) {
                        const sendResult = await sendEmail(lead.email, emailData.subject, emailData.body);

                        if (sendResult.success) {
                            // Log the sent follow-up into Supabase
                            await supabase.from('outreach').insert({
                                lead_id: lead.id,
                                email_subject: emailData.subject,
                                email_body: emailData.body,
                                email_type: nextAction,
                                status: 'sent',
                                sent_at: new Date().toISOString(),
                                message_id: sendResult.messageId
                            });

                            processedLeads.push({
                                lead: lead.business_name,
                                type: nextAction,
                                status: 'sent'
                            });
                        } else {
                            throw new Error(`Resend failed: ${sendResult.error}`);
                        }
                    } else {
                        // For testing/leads without emails
                        await supabase.from('outreach').insert({
                            lead_id: lead.id,
                            email_subject: emailData.subject,
                            email_body: emailData.body,
                            email_type: nextAction,
                            status: 'sent',
                            sent_at: new Date().toISOString(),
                            notes: 'No recipient email — generated and logged only'
                        });
                        processedLeads.push({
                            lead: lead.business_name,
                            type: nextAction,
                            status: 'logged_no_email'
                        });
                    }

                } catch (err) {
                    console.error(`Failed to process follow-up for lead ${lead.id}:`, err);
                    errors.push({ leadId: lead.id, error: err.message });
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Follow-up job completed',
            processedCount: processedLeads.length,
            details: processedLeads,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Cron Followup Error:', error);
        return NextResponse.json({ error: 'Internal server error processing follow-ups' }, { status: 500 });
    }
}
