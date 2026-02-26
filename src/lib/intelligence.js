import { supabase } from '@/lib/supabase';

/**
 * Intelligence Layer — ACAM's learning engine.
 * 
 * Logs every AI action so ACAM gets smarter over time.
 * Queries past outcomes to find winning patterns per industry.
 * 
 * Table: intelligence_log
 * Columns: id, action_type, industry, lead_id, metadata (jsonb), outcome, created_at
 */

// Action types
export const ACTIONS = {
    EMAIL_GENERATED: 'email_generated',
    EMAIL_SENT: 'email_sent',
    SCRIPT_GENERATED: 'script_generated',
    CALL_OUTCOME: 'call_outcome',
    CASE_STUDY_GENERATED: 'case_study_generated',
    CASE_STUDY_SAVED: 'case_study_saved',
    LEAD_SCRAPED: 'lead_scraped',
};

/**
 * Log an action to the intelligence table.
 */
export async function logAction(actionType, { industry = null, leadId = null, metadata = {}, outcome = null } = {}) {
    try {
        await supabase.from('intelligence_log').insert({
            action_type: actionType,
            industry: industry?.toLowerCase()?.trim() || null,
            lead_id: leadId || null,
            metadata: metadata || {},
            outcome: outcome || null,
        });
    } catch (err) {
        // Silent fail — intelligence logging should never break the main flow
        console.error('[Intelligence] Log error:', err.message);
    }
}

/**
 * Get winning patterns for an industry.
 * Returns insights like: best email tone, common objections, success rate.
 */
export async function getIndustryInsights(industry) {
    if (!industry) return null;

    const cleanIndustry = industry.toLowerCase().trim();

    try {
        // Get call outcomes for this industry
        const { data: callData } = await supabase
            .from('intelligence_log')
            .select('outcome, metadata')
            .eq('action_type', ACTIONS.CALL_OUTCOME)
            .ilike('industry', `%${cleanIndustry}%`)
            .order('created_at', { ascending: false })
            .limit(50);

        // Get email generation data for this industry
        const { data: emailData } = await supabase
            .from('intelligence_log')
            .select('metadata')
            .eq('action_type', ACTIONS.EMAIL_GENERATED)
            .ilike('industry', `%${cleanIndustry}%`)
            .order('created_at', { ascending: false })
            .limit(50);

        if ((!callData || callData.length === 0) && (!emailData || emailData.length === 0)) {
            return null; // No data yet — too early to learn
        }

        // Calculate outcome distribution
        const outcomes = {};
        (callData || []).forEach(row => {
            if (row.outcome) {
                outcomes[row.outcome] = (outcomes[row.outcome] || 0) + 1;
            }
        });

        const totalCalls = Object.values(outcomes).reduce((a, b) => a + b, 0);
        const interestRate = totalCalls > 0 ? Math.round(((outcomes['interested'] || 0) / totalCalls) * 100) : 0;

        // Build insight string for AI prompts
        let insight = `\n[INTELLIGENCE DATA — ${cleanIndustry.toUpperCase()}]\n`;
        insight += `Total interactions logged: ${totalCalls + (emailData?.length || 0)}\n`;

        if (totalCalls > 0) {
            insight += `Call outcomes: ${Object.entries(outcomes).map(([k, v]) => `${k}=${v}`).join(', ')}\n`;
            insight += `Interest rate: ${interestRate}%\n`;

            if (interestRate > 50) {
                insight += `This industry responds WELL to outreach. Be confident.\n`;
            } else if (interestRate < 20 && totalCalls >= 5) {
                insight += `This industry is TOUGH. Lead with stronger value props and offer something free.\n`;
            }
        }

        // Extract any patterns from metadata (e.g., email tones that worked)
        const tones = {};
        (emailData || []).forEach(row => {
            if (row.metadata?.tone) {
                tones[row.metadata.tone] = (tones[row.metadata.tone] || 0) + 1;
            }
        });

        if (Object.keys(tones).length > 0) {
            const topTone = Object.entries(tones).sort((a, b) => b[1] - a[1])[0];
            insight += `Most used email tone: "${topTone[0]}" (${topTone[1]} times)\n`;
        }

        insight += `[END INTELLIGENCE DATA]\n`;

        return {
            text: insight,
            stats: {
                totalCalls,
                totalEmails: emailData?.length || 0,
                interestRate,
                outcomes,
            }
        };

    } catch (err) {
        console.error('[Intelligence] Insights error:', err.message);
        return null;
    }
}
