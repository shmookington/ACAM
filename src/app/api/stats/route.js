import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * GET /api/stats
 * Returns all dashboard metrics and recent activity from Supabase
 */
export async function GET() {
    try {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const weekAgoStr = weekAgo.toISOString();

        // Parallel queries for speed
        const [
            leadsResult,
            leadsThisWeekResult,
            outreachResult,
            sentResult,
            sentThisWeekResult,
            recentLeadsResult,
            recentOutreachResult,
        ] = await Promise.all([
            // Total leads (saved)
            supabase.from('leads').select('id, status', { count: 'exact', head: false }),
            // Leads saved this week
            supabase.from('leads').select('id', { count: 'exact' }).gte('scraped_at', weekAgoStr),
            // All outreach records
            supabase.from('outreach').select('id, status', { count: 'exact', head: false }),
            // Sent emails
            supabase.from('outreach').select('id', { count: 'exact' }).eq('status', 'sent'),
            // Sent this week
            supabase.from('outreach').select('id', { count: 'exact' }).eq('status', 'sent').gte('sent_at', weekAgoStr),
            // Recent leads (for activity feed)
            supabase.from('leads').select('business_name, category, google_rating, review_count, has_website, scraped_at').order('scraped_at', { ascending: false }).limit(10),
            // Recent outreach (for activity feed)
            supabase.from('outreach').select('email_subject, status, sent_at, created_at, leads(business_name)').order('created_at', { ascending: false }).limit(10),
        ]);

        // Intelligence Queries — powered by the Daily Auto-Discovery Engine
        // Top Picks: Today's highest-scored auto-discovered leads
        const { data: topPicks } = await supabase
            .from('daily_picks')
            .select('*')
            .order('lead_score', { ascending: false })
            .limit(5);

        // Easy Wins: Today's auto-discovered leads with no website
        const { data: easyWins } = await supabase
            .from('daily_picks')
            .select('*')
            .eq('has_website', false)
            .order('review_count', { ascending: false })
            .limit(5);

        // Hot Leads: User's leads that were called and marked "interested"
        const { data: hotLeads } = await supabase
            .from('leads')
            .select('id, business_name, category, city, state, lead_score, google_rating, call_outcome, last_called_at, google_maps_url, phone')
            .eq('call_outcome', 'interested')
            .order('last_called_at', { ascending: false })
            .limit(5);

        // Call Tracking: All leads with call outcomes
        const { data: calledLeads } = await supabase
            .from('leads')
            .select('id, business_name, category, city, call_outcome, last_called_at')
            .not('call_outcome', 'is', null)
            .order('last_called_at', { ascending: false });

        // Compute call tracking stats
        const allCalled = calledLeads || [];
        const totalCalls = allCalled.length;
        const callOutcomes = { interested: 0, call_back: 0, voicemail: 0, not_interested: 0 };
        const industryCallMap = {};

        allCalled.forEach(lead => {
            if (lead.call_outcome && callOutcomes.hasOwnProperty(lead.call_outcome)) {
                callOutcomes[lead.call_outcome]++;
            }
            // Track by industry
            const ind = lead.category?.toLowerCase()?.trim() || 'unknown';
            if (!industryCallMap[ind]) industryCallMap[ind] = { total: 0, interested: 0 };
            industryCallMap[ind].total++;
            if (lead.call_outcome === 'interested') industryCallMap[ind].interested++;
        });

        const callInterestRate = totalCalls > 0 ? Math.round((callOutcomes.interested / totalCalls) * 100) : 0;

        // Calls this week
        const callsThisWeek = allCalled.filter(l => l.last_called_at && new Date(l.last_called_at) >= weekAgo).length;

        // Top industries by interest rate (min 2 calls)
        const industryStats = Object.entries(industryCallMap)
            .filter(([, v]) => v.total >= 1)
            .map(([name, v]) => ({
                name: name.charAt(0).toUpperCase() + name.slice(1),
                total: v.total,
                interested: v.interested,
                rate: v.total > 0 ? Math.round((v.interested / v.total) * 100) : 0,
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 6);

        // Recent calls (last 10)
        const recentCalls = allCalled.slice(0, 10).map(lead => ({
            id: lead.id,
            business_name: lead.business_name,
            category: lead.category,
            city: lead.city,
            outcome: lead.call_outcome,
            called_at: lead.last_called_at,
        }));

        // Callback Reminders
        const today = now.toISOString().split('T')[0];
        const { data: callbackLeads } = await supabase
            .from('leads')
            .select('id, business_name, category, city, callback_date')
            .not('callback_date', 'is', null)
            .order('callback_date', { ascending: true });

        const allCallbacks = callbackLeads || [];
        const callbacksDueToday = allCallbacks.filter(l => l.callback_date === today);
        const callbacksOverdue = allCallbacks.filter(l => l.callback_date < today);
        const callbacksUpcoming = allCallbacks.filter(l => l.callback_date > today).slice(0, 5);

        // Compute metrics
        const allLeads = leadsResult.data || [];
        const totalLeads = allLeads.length;
        const leadsThisWeek = leadsThisWeekResult.count || 0;

        // Pipeline counts
        const pipeline = {
            new: allLeads.filter(l => l.status === 'new').length,
            contacted: allLeads.filter(l => l.status === 'contacted').length,
            responded: allLeads.filter(l => l.status === 'responded').length,
            meeting: allLeads.filter(l => l.status === 'meeting').length,
            closed: allLeads.filter(l => l.status === 'closed').length,
        };

        const allOutreach = outreachResult.data || [];
        const totalSent = sentResult.count || 0;
        const sentThisWeek = sentThisWeekResult.count || 0;
        const totalReplied = allOutreach.filter(o => o.status === 'replied').length;
        const responseRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

        // Build activity feed from recent events
        const activity = [];

        for (const lead of (recentLeadsResult.data || [])) {
            const time = lead.scraped_at ? new Date(lead.scraped_at).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '';
            activity.push({
                id: `lead-${lead.business_name}-${lead.scraped_at}`,
                time,
                timestamp: lead.scraped_at,
                message: `Lead saved: ${lead.business_name} (⭐${lead.google_rating || 'N/A'}, ${lead.review_count || 0} reviews)${!lead.has_website ? ' — NO WEBSITE 🎯' : ''}`,
                type: !lead.has_website ? 'success' : '',
            });
        }

        for (let idx = 0; idx < (recentOutreachResult.data || []).length; idx++) {
            const outreach = recentOutreachResult.data[idx];
            const name = outreach.leads?.business_name || 'Unknown';
            const time = (outreach.sent_at || outreach.created_at)
                ? new Date(outreach.sent_at || outreach.created_at).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
                : '';
            const uid = outreach.id || `idx-${idx}`;

            if (outreach.status === 'sent') {
                activity.push({
                    id: `sent-${uid}`,
                    time,
                    timestamp: outreach.sent_at || outreach.created_at,
                    message: `Email sent to: ${name}`,
                    type: 'success',
                });
            } else if (outreach.status === 'draft') {
                activity.push({
                    id: `draft-${uid}`,
                    time,
                    timestamp: outreach.created_at,
                    message: `Email drafted for: ${name}`,
                    type: '',
                });
            } else if (outreach.status === 'approved') {
                activity.push({
                    id: `approved-${uid}`,
                    time,
                    timestamp: outreach.created_at,
                    message: `Email approved for: ${name} — ready to send`,
                    type: 'warning',
                });
            }
        }

        // Sort by timestamp descending
        activity.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

        // ── Team Leaderboard ──
        const { data: allLeadsForTeam } = await supabase
            .from('leads')
            .select('claimed_by, status');

        const teamMap = {};
        const nameMap = {
            'amiri': 'Amiri', 'caelborne': 'Amiri',
            'toby': 'Toby',
            'yaz': 'Yaz',
        };
        (allLeadsForTeam || []).forEach(lead => {
            if (!lead.claimed_by) return;
            const key = lead.claimed_by.toLowerCase();
            // Resolve display name
            let displayName = lead.claimed_by;
            for (const [pattern, name] of Object.entries(nameMap)) {
                if (key.includes(pattern)) { displayName = name; break; }
            }
            if (!teamMap[displayName]) teamMap[displayName] = { name: displayName, total: 0, contacted: 0, meeting: 0, closed: 0 };
            teamMap[displayName].total++;
            if (lead.status === 'contacted') teamMap[displayName].contacted++;
            if (lead.status === 'meeting') teamMap[displayName].meeting++;
            if (lead.status === 'closed') teamMap[displayName].closed++;
        });
        const teamLeaderboard = Object.values(teamMap).sort((a, b) => b.total - a.total);
        const totalClaimed = teamLeaderboard.reduce((s, t) => s + t.total, 0);
        const totalUnclaimed = (allLeadsForTeam || []).filter(l => !l.claimed_by).length;

        return NextResponse.json({
            metrics: {
                totalLeads,
                leadsThisWeek,
                emailsSent: totalSent,
                emailsThisWeek: sentThisWeek,
                responseRate,
                meetingsBooked: pipeline.meeting,
                clientsClosed: pipeline.closed,
                drafts: allOutreach.filter(o => o.status === 'draft').length,
                approved: allOutreach.filter(o => o.status === 'approved').length,
            },
            pipeline,
            activity: activity.slice(0, 20),
            intelligence: {
                topPicks: topPicks || [],
                easyWins: easyWins || [],
                hotLeads: hotLeads || [],
            },
            callTracking: {
                totalCalls,
                callsThisWeek,
                callInterestRate,
                outcomes: callOutcomes,
                industryStats,
                recentCalls,
            },
            callbacks: {
                dueToday: callbacksDueToday,
                overdue: callbacksOverdue,
                upcoming: callbacksUpcoming,
            },
            team: {
                leaderboard: teamLeaderboard,
                totalClaimed,
                totalUnclaimed,
            },
        });

    } catch (error) {
        console.error('Stats API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
