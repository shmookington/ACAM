import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/resend';

// Authenticate Vercel Cron Request
function verifyCronAuth(request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV !== 'production' && !cronSecret) return true;

    if (authHeader !== `Bearer ${cronSecret}`) {
        return false;
    }
    return true;
}

export async function GET(request) {
    if (!verifyCronAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Calculate date 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const isoPast = sevenDaysAgo.toISOString();

        // 1. Leads Scraped (last 7 days)
        const { count: leadsFound, error: lfe } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', isoPast);

        // 2. Emails Sent (last 7 days)
        const { count: emailsSent, error: ese } = await supabase
            .from('outreach')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'sent')
            .gte('sent_at', isoPast);

        // 3. Responses (tracked via lead status)
        const { count: responses, error: re } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'responded');

        // Identify top industry (most leads or most contacted)
        const { data: contactedLeads } = await supabase
            .from('leads')
            .select('category')
            .eq('status', 'contacted')
            .gte('created_at', isoPast);

        let topIndustry = "N/A";
        if (contactedLeads && contactedLeads.length > 0) {
            const industryCounts = contactedLeads.reduce((acc, lead) => {
                const cat = lead.category || 'Unknown';
                acc[cat] = (acc[cat] || 0) + 1;
                return acc;
            }, {});
            topIndustry = Object.keys(industryCounts).reduce((a, b) => industryCounts[a] > industryCounts[b] ? a : b);
        }

        // Callback Reminders
        const today = new Date().toISOString().split('T')[0];
        const { data: callbackLeads } = await supabase
            .from('leads')
            .select('business_name, category, city, callback_date')
            .not('callback_date', 'is', null)
            .order('callback_date', { ascending: true });

        const callbacks = callbackLeads || [];
        const overdue = callbacks.filter(l => l.callback_date < today);
        const dueToday = callbacks.filter(l => l.callback_date === today);
        const upcoming = callbacks.filter(l => l.callback_date > today).slice(0, 5);

        // Build callback HTML section
        let callbackHtml = '';
        if (overdue.length > 0 || dueToday.length > 0 || upcoming.length > 0) {
            callbackHtml = `
                <br/>
                <h3 style="color: #ffb000;">📅 CALLBACK REMINDERS:</h3>
                ${overdue.length > 0 ? `
                    <p style="color: #ff3333; font-weight: bold;">⚠️ OVERDUE (${overdue.length}):</p>
                    <ul>${overdue.map(l => `<li style="color: #ff3333;"><strong>${l.business_name}</strong> — ${l.category} · ${l.city} (was due ${l.callback_date})</li>`).join('')}</ul>
                ` : ''}
                ${dueToday.length > 0 ? `
                    <p style="color: #ffb000; font-weight: bold;">📞 CALL TODAY (${dueToday.length}):</p>
                    <ul>${dueToday.map(l => `<li><strong>${l.business_name}</strong> — ${l.category} · ${l.city}</li>`).join('')}</ul>
                ` : ''}
                ${upcoming.length > 0 ? `
                    <p style="color: #00ff41;">📋 UPCOMING:</p>
                    <ul>${upcoming.map(l => `<li>${l.callback_date} — <strong>${l.business_name}</strong> (${l.category})</li>`).join('')}</ul>
                ` : ''}
            `;
        }

        // Format email
        const htmlBody = `
            <div style="font-family: monospace; max-width: 600px; padding: 20px; background-color: #0d0d0d; color: #00ff41; border: 1px solid #00ff41;">
                <h1 style="border-bottom: 1px solid #00ff41; padding-bottom: 10px;">ACAM WEEKLY PIPELINE REPORT</h1>
                <p>Hello Amiri,</p>
                <p>Here is your automated system update from the last 7 days.</p>
                <br/>
                <h3 style="color: #ffffff;">METRICS:</h3>
                <ul>
                    <li><strong>New Leads Discovered:</strong> ${leadsFound || 0}</li>
                    <li><strong>Outbound Emails Sent:</strong> ${emailsSent || 0}</li>
                    <li><strong>Total Responses (All Time):</strong> ${responses || 0}</li>
                </ul>
                <br/>
                <h3 style="color: #ffffff;">INTELLIGENCE:</h3>
                <ul>
                    <li><strong>Top Contacted Industry:</strong> ${topIndustry}</li>
                </ul>
                ${callbackHtml}
                <br/>
                <p style="color: #ffb000;">Keep the pipeline full.</p>
                <p>- ACAM System</p>
            </div>
        `;

        // Send to yourself. Resend API requires a verified domain if sending outside of the registered email, but we'll send to the owner.
        // For development, replace with the verified email in your Resend account.
        const ownerEmail = "amiritatedev@gmail.com";

        const sendResult = await sendEmail(ownerEmail, "ACAM: Your Weekly Pipeline Digest", "Weekly Summary", htmlBody);

        if (!sendResult.success) {
            throw new Error(sendResult.error);
        }

        return NextResponse.json({
            success: true,
            message: 'Weekly digest sent successfully',
            stats: { leadsFound, emailsSent, responses, topIndustry }
        });

    } catch (error) {
        console.error('Digest Error:', error);
        return NextResponse.json({ error: 'Failed to send digest' }, { status: 500 });
    }
}
