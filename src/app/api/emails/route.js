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

function buildEmailPrompt(lead, insightsBlock) {
    const ratingLine = lead.google_rating
        ? `${lead.google_rating} stars (${lead.review_count || 0} reviews)`
        : 'N/A';

    const websiteHook = lead.has_website
        ? 'You checked out their website and see room to better showcase what they do — help turn online visitors into actual customers.'
        : 'You noticed they don\'t have a website yet, which means they\'re likely missing out on customers who search for their services online every day.';

    const ratingHook = lead.google_rating && lead.google_rating >= 4
        ? `their impressive ${lead.google_rating}-star rating across ${lead.review_count || 0} reviews`
        : 'their reputation in ' + (lead.city || 'the area');

    return `You are Amiri Tate, the founder of Caelborne Digital — a boutique web design agency that builds premium websites for local businesses. You are writing a thoughtful, professional cold outreach email to the owner of a local business.

${insightsBlock}

BUSINESS DETAILS:
- Name: ${lead.business_name}
- Category: ${lead.category || 'Local Business'}
- Location: ${lead.city || 'their area'}${lead.state ? ', ' + lead.state : ''}
- Has Website: ${lead.has_website ? 'Yes' : 'No'}
- Google Rating: ${ratingLine}

EMAIL STRUCTURE (follow this exactly):

1. OPENER (1-2 sentences): Lead with something specific about THEM — ${ratingHook}, their reputation in ${lead.city || 'the area'}, or something genuine about the ${lead.category || 'local business'} industry. Make it real.

2. BRIDGE (1-2 sentences): ${websiteHook}

3. VALUE PROP (1-2 sentences): Explain what Caelborne Digital does — build premium, modern websites specifically designed to drive real customers to local businesses like theirs. Not just a pretty site, but one that actually converts browsers into buyers.

4. SOFT CTA (1 sentence): Offer to put together a free mockup or quick site audit — zero commitment, no obligation. Make it easy to say yes.

5. SIGN-OFF:
   Best,
   Amiri Tate
   Caelborne Digital
   caelborne.io

FORMATTING RULES:
- Use DOUBLE LINE BREAKS between each paragraph so the email is easy to skim on mobile
- Keep the entire email under 120 words — concise and respectful of their time
- Subject line should reference their specific business name or industry — never generic

TONE RULES:
- Professional but warm — like a real person reaching out, not a marketing automation
- Confident but not pushy — you are offering genuine value, not begging for business
- NO corporate buzzwords: never use "elevate", "synergy", "digital landscape", "unlock", "leverage", "empower", "next level", "game-changer", "cutting-edge"
- NO exclamation marks in the subject line
- DO NOT use brackets like [Owner Name] — say "Hi there" or "Hey team" if you don't know the owner's name

OUTPUT FORMAT:
Return ONLY a valid JSON object: {"subject": "...", "body": "..."}
Use \\n\\n for line breaks in the body. No markdown wrapping, no extra text outside the JSON.`;
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { leadIds } = body;

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return NextResponse.json({ error: 'No lead IDs provided' }, { status: 400 });
        }

        // Fetch the leads
        const { data: leads, error: fetchError } = await supabase
            .from('leads')
            .select('*')
            .in('id', leadIds);

        if (fetchError) throw fetchError;
        if (!leads || leads.length === 0) {
            return NextResponse.json({ error: 'No leads found' }, { status: 404 });
        }

        const emails = [];
        const errors = [];

        for (let i = 0; i < leads.length; i++) {
            const lead = leads[i];

            // Delay between leads to avoid rate limiting
            if (i > 0) await sleep(3000);

            // Query intelligence for this industry
            const insights = await getIndustryInsights(lead.category);
            const insightsBlock = insights?.text || '';

            const prompt = buildEmailPrompt(lead, insightsBlock);

            try {
                const text = await generateWithRetry(openai, prompt);

                // Parse JSON from response
                let emailData;
                try {
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    emailData = JSON.parse(jsonMatch ? jsonMatch[0] : text);
                } catch {
                    emailData = {
                        subject: `Quick thought about ${lead.business_name}`,
                        body: text,
                    };
                }

                // Save to outreach table
                const { data: outreach, error: insertError } = await supabase
                    .from('outreach')
                    .insert({
                        lead_id: lead.id,
                        email_subject: emailData.subject,
                        email_body: emailData.body,
                        email_type: 'initial',
                        status: 'draft',
                    })
                    .select()
                    .single();

                if (insertError) {
                    console.error('Error saving outreach:', insertError);
                    continue;
                }

                emails.push({
                    ...outreach,
                    business_name: lead.business_name,
                    category: lead.category,
                    city: lead.city,
                    has_website: lead.has_website,
                    lead_score: lead.lead_score,
                });

                // NOTE: Do NOT update status to 'contacted' here.
                // Status only changes when the email is actually SENT (via /api/send).

                // Log to intelligence
                logAction(ACTIONS.EMAIL_GENERATED, {
                    industry: lead.category,
                    leadId: lead.id,
                    metadata: { business_name: lead.business_name, city: lead.city, has_website: lead.has_website },
                });

            } catch (genError) {
                console.error(`DeepSeek error for ${lead.business_name}:`, genError.message || genError);
                errors.push({ business: lead.business_name, error: genError.message || 'Unknown error' });
                continue;
            }
        }

        return NextResponse.json({
            message: `${emails.length} emails generated${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
            emails,
            errors: errors.length > 0 ? errors : undefined,
        });

    } catch (error) {
        console.error('Email generation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET - Fetch all draft/pending emails
export async function GET() {
    try {
        const { data, error } = await supabase
            .from('outreach')
            .select(`
        *,
        leads (
          business_name,
          category,
          city,
          state,
          has_website,
          lead_score,
          phone,
          email
        )
      `)
            .in('status', ['draft', 'approved', 'sent'])
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ emails: data || [] });
    } catch (error) {
        console.error('Error fetching emails:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT - Update email (edit, approve, or reject)
export async function PUT(request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Email ID required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('outreach')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ email: data });
    } catch (error) {
        console.error('Error updating email:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
