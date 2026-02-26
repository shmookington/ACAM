import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { logAction, getIndustryInsights, ACTIONS } from '@/lib/intelligence';

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY || ''
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateWithRetry(openaiClient, prompt, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await openaiClient.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "deepseek-chat",
            });
            return response.choices[0].message.content;
        } catch (err) {
            const is429 = err.message?.includes('429') || err.status === 429;
            if (is429 && attempt < maxRetries - 1) {
                const delay = (attempt + 1) * 10000;
                console.log(`Rate limited, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
                await sleep(delay);
            } else {
                throw err;
            }
        }
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { leadId } = body;

        if (!leadId) {
            return NextResponse.json({ error: 'No lead ID provided' }, { status: 400 });
        }

        const { data: lead, error: fetchError } = await supabase
            .from('leads')
            .select('*')
            .eq('id', leadId)
            .single();

        if (fetchError || !lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Query intelligence for industry insights
        const insights = await getIndustryInsights(lead.category);
        const insightsBlock = insights?.text || '';

        const prompt = `You are a professional but conversational sales agent generating a comprehensive cold call script for Caelborne Digital, a high-end web design agency. You use double returns separating each block of the script for skimmability.
${insightsBlock}

BUSINESS DETAILS:
- Name: ${lead.business_name}
- Category: ${lead.category || 'Local Business'}
- Location: ${lead.city || 'their area'}${lead.state ? `, ${lead.state}` : ''}
- Has Website: ${lead.has_website ? 'Yes' : 'No'}
- Google Rating: ${lead.google_rating ? `${lead.google_rating} stars` : 'N/A'} (${lead.review_count || 0} reviews)

SCRIPT RULES:
1. Format: Break the script into distinct sections with clear bold headers: "**1. The Hook**", "**2. Discovery (If they are open)**", "**3. The Pitch**", "**4. Objection Handling (If they push back)**", "**5. Call to Action**".
2. Format: Use DOUBLE RETURNS between sentences/blocks for extreme skimmability on a dialer monitor.
3. Length: The script must provide enough material to confidently carry a 2 to 3-minute conversation. It should not just be a quick pitch and hang up.
4. Tone: Confident, friendly, direct, and conversational. Talk like a real human. Do not sound like you are reading from a paper. Avoid corporate jargon (like "synergy" or "digital landscape").
5. Personalization: 
   - Strongly leverage their ${lead.google_rating} star rating on Google (if it's good) to build immediate rapport. 
   - Contrast their excellent real-world reputation with their current digital presence.
6. The Flow:
   - **The Hook**: Quick intro, ask if they have a brief moment, butter them up about their reviews.
   - **Discovery**: Ask 1 or 2 casual questions about how business is going in ${lead.city}, or how they currently handle new customers online.
   - **The Pitch**: 
     - If they have NO website: "I was actually looking for you online to show a friend, but realized you don't have a site..."
     - If they HAVE a website: "I was checking out your site and noticed a few things keeping you from getting more local traffic..."
   - **Objection Handling**: Provide 2 common pushbacks (e.g., "We get enough word-of-mouth" or "We don't have the budget right now") and write the exact rebuttal for each.
   - **Call to Action**: Offer to design a free, custom mockup for them. No strings attached, just to show them what a premium Caelborne site looks like.

OUTPUT: Return ONLY the raw markdown script. Do not output JSON.`;

        const phoneScript = await generateWithRetry(openai, prompt);

        // Update lead with the new script
        const { error: updateError } = await supabase
            .from('leads')
            .update({ phone_script: phoneScript.trim() })
            .eq('id', lead.id);

        if (updateError) {
            throw updateError;
        }

        // Log to intelligence
        logAction(ACTIONS.SCRIPT_GENERATED, {
            industry: lead.category,
            leadId: lead.id,
            metadata: { business_name: lead.business_name, city: lead.city, has_website: lead.has_website },
        });

        return NextResponse.json({ success: true, phone_script: phoneScript.trim() });
    } catch (error) {
        console.error('Script generation error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate call script' },
            { status: 500 }
        );
    }
}
