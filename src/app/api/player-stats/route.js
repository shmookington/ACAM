import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const NAME_MAP = {
    'amiri': 'Amiri', 'caelborne': 'Amiri',
    'toby': 'Toby',
    'yaz': 'Yaz',
};

const PLAYER_COLORS = {
    'Amiri': '#00d4ff',
    'Toby': '#ff8c00',
    'Yaz': '#c084fc',
};

const PLAYER_AVATARS = {
    'Amiri': '😈',
    'Toby': '⚡',
    'Yaz': '🎯',
};

function resolvePlayer(email) {
    if (!email) return null;
    const e = email.toLowerCase();
    for (const [pattern, name] of Object.entries(NAME_MAP)) {
        if (e.includes(pattern)) return name;
    }
    return email.split('@')[0];
}

function getDateStr(d) {
    return new Date(d).toISOString().split('T')[0];
}

export async function GET() {
    try {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const todayStr = getDateStr(now);

        // Fetch all leads with relevant fields
        const { data: allLeads } = await supabase
            .from('leads')
            .select('id, business_name, category, city, claimed_by, status, call_outcome, last_called_at, scraped_at, lead_score, has_website');

        // Fetch outreach data
        const { data: allOutreach } = await supabase
            .from('outreach')
            .select('id, status, sent_at, created_at, lead_id');

        const leads = allLeads || [];
        const outreach = allOutreach || [];

        // Build per-player stats
        const playerStats = {};

        // Initialize all known players
        ['Amiri', 'Toby', 'Yaz'].forEach(name => {
            playerStats[name] = {
                name,
                color: PLAYER_COLORS[name],
                avatar: PLAYER_AVATARS[name],
                // Totals
                totalClaimed: 0,
                totalContacted: 0,
                totalInterested: 0,
                totalMeetings: 0,
                totalClosed: 0,
                totalCalls: 0,
                totalEmails: 0,
                // This week
                claimedThisWeek: 0,
                callsThisWeek: 0,
                interestedThisWeek: 0,
                // Today
                claimedToday: 0,
                callsToday: 0,
                // Records (best days)
                bestDayClaimed: { count: 0, date: null },
                bestDayCalls: { count: 0, date: null },
                bestDayInterested: { count: 0, date: null },
                // Streaks
                currentStreak: 0,
                bestStreak: 0,
                // Rate stats
                conversionRate: 0,
                interestRate: 0,
                // Daily breakdown for records
                _dailyClaimed: {},
                _dailyCalls: {},
                _dailyInterested: {},
                _activeDays: new Set(),
                // Avg score
                totalScore: 0,
                scoreCount: 0,
                avgLeadScore: 0,
                // Categories
                topCategories: {},
                // No website converts
                noWebsiteCount: 0,
            };
        });

        // Process leads
        leads.forEach(lead => {
            const player = resolvePlayer(lead.claimed_by);
            if (!player || !playerStats[player]) return;
            const ps = playerStats[player];

            ps.totalClaimed++;
            if (lead.lead_score) {
                ps.totalScore += lead.lead_score;
                ps.scoreCount++;
            }
            if (!lead.has_website) ps.noWebsiteCount++;

            // Category tracking
            const cat = lead.category || 'Unknown';
            ps.topCategories[cat] = (ps.topCategories[cat] || 0) + 1;

            // Daily claimed tracking
            if (lead.scraped_at) {
                const d = getDateStr(lead.scraped_at);
                ps._dailyClaimed[d] = (ps._dailyClaimed[d] || 0) + 1;
                ps._activeDays.add(d);
                if (d === todayStr) ps.claimedToday++;
                if (new Date(lead.scraped_at) >= weekAgo) ps.claimedThisWeek++;
            }

            // Status tracking
            if (lead.status === 'contacted') ps.totalContacted++;
            if (lead.status === 'meeting') ps.totalMeetings++;
            if (lead.status === 'closed') ps.totalClosed++;

            // Call tracking
            if (lead.call_outcome) {
                ps.totalCalls++;
                if (lead.last_called_at) {
                    const d = getDateStr(lead.last_called_at);
                    ps._dailyCalls[d] = (ps._dailyCalls[d] || 0) + 1;
                    ps._activeDays.add(d);
                    if (d === todayStr) ps.callsToday++;
                    if (new Date(lead.last_called_at) >= weekAgo) ps.callsThisWeek++;
                }
                if (lead.call_outcome === 'interested') {
                    ps.totalInterested++;
                    if (lead.last_called_at) {
                        const d = getDateStr(lead.last_called_at);
                        ps._dailyInterested[d] = (ps._dailyInterested[d] || 0) + 1;
                        if (new Date(lead.last_called_at) >= weekAgo) ps.interestedThisWeek++;
                    }
                }
            }
        });

        // Compute records and streaks
        Object.values(playerStats).forEach(ps => {
            // Best day claimed
            for (const [date, count] of Object.entries(ps._dailyClaimed)) {
                if (count > ps.bestDayClaimed.count) ps.bestDayClaimed = { count, date };
            }
            // Best day calls
            for (const [date, count] of Object.entries(ps._dailyCalls)) {
                if (count > ps.bestDayCalls.count) ps.bestDayCalls = { count, date };
            }
            // Best day interested
            for (const [date, count] of Object.entries(ps._dailyInterested)) {
                if (count > ps.bestDayInterested.count) ps.bestDayInterested = { count, date };
            }

            // Streak calculation
            const sortedDays = Array.from(ps._activeDays).sort().reverse();
            let streak = 0;
            let checkDate = new Date(todayStr);
            for (const day of sortedDays) {
                const dayDate = new Date(day);
                const diff = Math.round((checkDate - dayDate) / (24 * 60 * 60 * 1000));
                if (diff <= 1) {
                    streak++;
                    checkDate = dayDate;
                } else {
                    break;
                }
            }
            ps.currentStreak = streak;

            // Best streak
            let bestStreak = 0, tempStreak = 1;
            const allDays = Array.from(ps._activeDays).sort();
            for (let i = 1; i < allDays.length; i++) {
                const diff = (new Date(allDays[i]) - new Date(allDays[i - 1])) / (24 * 60 * 60 * 1000);
                if (diff === 1) tempStreak++;
                else { bestStreak = Math.max(bestStreak, tempStreak); tempStreak = 1; }
            }
            ps.bestStreak = Math.max(bestStreak, tempStreak, ps.currentStreak);

            // Rates
            ps.conversionRate = ps.totalClaimed > 0 ? Math.round((ps.totalContacted / ps.totalClaimed) * 100) : 0;
            ps.interestRate = ps.totalCalls > 0 ? Math.round((ps.totalInterested / ps.totalCalls) * 100) : 0;
            ps.avgLeadScore = ps.scoreCount > 0 ? Math.round(ps.totalScore / ps.scoreCount) : 0;

            // Top 3 categories
            ps.topCategories = Object.entries(ps.topCategories)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([cat, count]) => ({ category: cat, count }));

            // Clean up internal fields
            delete ps._dailyClaimed;
            delete ps._dailyCalls;
            delete ps._dailyInterested;
            delete ps._activeDays;
            delete ps.totalScore;
            delete ps.scoreCount;
        });

        // Leaderboard (simplified)
        const leaderboard = Object.values(playerStats)
            .map(ps => ({
                name: ps.name,
                color: ps.color,
                avatar: ps.avatar,
                totalClaimed: ps.totalClaimed,
                totalCalls: ps.totalCalls,
                totalInterested: ps.totalInterested,
                totalContacted: ps.totalContacted,
                totalClosed: ps.totalClosed,
                interestRate: ps.interestRate,
                currentStreak: ps.currentStreak,
                claimedThisWeek: ps.claimedThisWeek,
            }))
            .sort((a, b) => b.totalClaimed - a.totalClaimed);

        // XP calculation (gamified score)
        leaderboard.forEach(p => {
            p.xp = (p.totalClaimed * 10) + (p.totalCalls * 25) + (p.totalInterested * 50) + (p.totalContacted * 15) + (p.totalClosed * 100);
            // Level: every 500 XP
            p.level = Math.floor(p.xp / 500) + 1;
            p.xpToNext = 500 - (p.xp % 500);
        });

        // Add XP to player stats too
        Object.values(playerStats).forEach(ps => {
            const lb = leaderboard.find(l => l.name === ps.name);
            if (lb) {
                ps.xp = lb.xp;
                ps.level = lb.level;
                ps.xpToNext = lb.xpToNext;
            }
        });

        return NextResponse.json({
            players: playerStats,
            leaderboard,
        });
    } catch (error) {
        console.error('Player stats error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
