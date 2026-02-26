import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';
import { logAction, getIndustryInsights, ACTIONS } from '@/lib/intelligence';

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY || ''
});

// The Caelborne 6-Stage Website Building Methodology
// This is embedded directly into the AI's prompts so every plan follows the exact framework
const METHODOLOGY = `
You follow the Caelborne Digital 6-Stage Website Building Methodology:

STAGE 1 — IDEATION & INSPIRATION
Define the emotional target (3 words that describe how users should feel). Mine references from Awwwards, Dribbble, Land-book. Extract color palette using Coolors. Identify typography patterns. Create a mood board. Write a one-page brief.

STAGE 2 — ASSET CURATION
Audit asset needs. Source backgrounds from Haikei/BGJar/MeshGradient. Source icon set from Lucide/Radix/Bootstrap Icons. Source illustrations from Open Doodles/Undraw/Humaaans. Source 1-2 subtle animations from Lordicon/LottieFiles. Organize in /backgrounds, /icons, /illustrations, /animations.

STAGE 3 — STRUCTURE & LAYOUT
Map content hierarchy (most to least important). Sketch wireframe (boxes for each section). Define each section's purpose. Plan asset placement. Annotate interactions (sticky header, fade-ins, hover effects). Create the blueprint document.

STAGE 4 — AI-POWERED CODING
Set up workspace. Write base HTML structure with semantic tags. Style section by section (atomic prompts, not one-shot). Implement asset placeholders. Add responsive breakpoints. Review against wireframe.

STAGE 5 — INTEGRATION & CUSTOMIZATION
Clean up generated code. Inject SVG backgrounds. Implement icon system. Place custom illustrations. Integrate animations. Add custom touches (spacing, hover states, animation timings).

STAGE 6 — REFINEMENT & POLISH
Cross-browser testing. Performance optimization (PageSpeed 80+ mobile, 90+ desktop). Accessibility audit. Micro-interaction layer. Content & copy pass. Final launch prep (hosting, analytics, favicon, deployment).
`;

// GET — list all portfolio showcases
export async function GET() {
    try {
        const { data, error } = await supabase
            .from('portfolio')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ showcases: data || [] });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();

        // Step 1: Generate smart industry-specific questions mapped to the 6-stage methodology
        if (body.action === 'questions') {
            const { business_name, category, city, google_rating, review_count, has_website, website_url } = body;

            const prompt = `You are a senior web design strategist at Caelborne Digital.
${METHODOLOGY}

A potential client has been identified:
BUSINESS: ${business_name}
INDUSTRY: ${category}
LOCATION: ${city}
GOOGLE RATING: ${google_rating || 'N/A'}
REVIEWS: ${review_count || 0}
HAS WEBSITE: ${has_website ? 'Yes — ' + (website_url || 'unknown URL') : 'No'}

Generate exactly 5 smart multiple-choice questions that will inform the website plan across Stages 1-3 of the methodology. Each question should have 4 options.

The questions should cover:
1. EMOTIONAL TARGET (Stage 1) — How should visitors feel? Tailor options to the ${category} industry.
2. DESIGN DIRECTION (Stage 1) — What visual style fits? Options should be specific to ${category} businesses.
3. KEY FEATURES (Stage 3) — What functionality is most important? Options must be industry-specific (e.g. online booking for salons, menu display for restaurants, patient portal for dentists).
4. CONTENT PRIORITY (Stage 3) — What content should dominate the homepage? Options specific to ${category}.
5. COMPETITIVE EDGE (Stage 2) — What should make this site stand out from other ${category} sites in ${city}?

RULES:
- Every option must be 3-6 words max.
- No generic questions. A salon gets different options than a dentist or a restaurant.
- The answers will directly feed into a 6-stage website build plan.

OUTPUT FORMAT (strict JSON only, no markdown, no backticks):
[
  {
    "question": "How should visitors feel?",
    "stage": "Stage 1: Ideation",
    "options": ["Relaxed & Pampered", "Energized & Inspired", "Trusted & Professional", "Trendy & Exclusive"]
  }
]`;

            const completion = await openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "deepseek-chat",
            });

            let questions;
            try {
                const raw = completion.choices[0].message.content.trim();
                const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                questions = JSON.parse(cleaned);
            } catch (e) {
                return NextResponse.json({ error: 'Failed to parse AI questions' }, { status: 500 });
            }

            return NextResponse.json({ questions });
        }

        // Step 2: Generate the full 6-stage website plan from answers
        if (body.action === 'generate') {
            const { business_name, category, city, google_rating, review_count, has_website, website_url, answers } = body;

            // Query intelligence for this industry
            const insights = await getIndustryInsights(category);
            const insightsBlock = insights?.text || '';

            const answersText = answers.map((a, i) => `Q${i + 1}: ${a.question} → ${a.answer}`).join('\n');

            const prompt = `You are a senior web design strategist at Caelborne Digital. You build websites using a precise 6-stage methodology.
${METHODOLOGY}
${insightsBlock}

Create a comprehensive website build plan for this client, structured exactly around the 6 stages.

BUSINESS: ${business_name}
INDUSTRY: ${category}
LOCATION: ${city}
GOOGLE RATING: ${google_rating || 'N/A'}
REVIEWS: ${review_count || 0}
CURRENT WEBSITE: ${has_website ? (website_url || 'Has one, URL unknown') : 'None — building from scratch'}

DISCOVERY ANSWERS:
${answersText}

Generate the plan in this exact structure:

# Website Blueprint: ${business_name}

## Stage 1 — Ideation & Inspiration
- **Emotional Target:** 3 words based on the discovery answers
- **Color Palette:** 4-5 specific hex codes with names (e.g. #2C3E50 — Midnight Navy)
- **Typography:** Primary font + secondary font recommendation from Google Fonts
- **Mood Direction:** 2-3 sentences capturing the visual vibe
- **Reference Sites:** 2-3 real websites to draw inspiration from (similar industry, matching vibe)

## Stage 2 — Asset Curation
- **Background:** Specific recommendation (mesh gradient, solid, pattern, photo overlay)
- **Icon Set:** Which icon library and specific icons needed
- **Illustrations:** Whether to use illustrations, what style, and where
- **Animations:** 1-2 specific micro-animation ideas (what triggers them, what they do)
- **Photography:** What photos the client needs to provide

## Stage 3 — Structure & Layout
- **Page Map:** Every page the site needs, listed with one-line purpose
- **Hero Section:** Exactly what goes in it (headline idea, subhead, CTA, imagery)
- **Section Flow:** The order of sections below the hero and why
- **Key Features:** The 4-5 must-have features specific to a ${category} in ${city}
- **Mobile Priority:** What changes on mobile

## Stage 4 — AI Coding Plan
- **Tech Stack:** Recommended framework/tools
- **Build Order:** Which sections to build first → last
- **Estimated Sections:** Number of distinct sections to code
- **Complexity Rating:** Simple / Medium / Complex and why

## Stage 5 — Integration Notes
- **Custom Touches:** What will make this site feel handcrafted vs. templated
- **Brand Elements:** Logo placement, brand voice guidelines for copy
- **Content Needed from Client:** Exact list of what the business owner must provide

## Stage 6 — Launch Checklist
- **Performance Target:** PageSpeed goals
- **Must-Test:** Browser/device priorities for this audience
- **Analytics:** Recommended tracking setup
- **Competitive Edge:** The one thing that will make this site better than every other ${category} website in ${city}

Be specific to the ${category} industry. Every recommendation should feel tailored, not generic. Use the discovery answers to inform every decision.`;

            const completion = await openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "deepseek-chat",
            });

            const plan = completion.choices[0].message.content.trim();

            // Log to intelligence
            logAction(ACTIONS.CASE_STUDY_GENERATED, {
                industry: category,
                metadata: { business_name, city, answers_count: answers?.length },
            });

            return NextResponse.json({ case_study: plan });
        }

        // Step 3: Save the plan to the portfolio
        if (body.action === 'save') {
            const { client_name, industry, case_study, answers_json } = body;

            const { data, error } = await supabase.from('portfolio').insert({
                client_name,
                industry,
                case_study,
                description: answers_json || '',
            }).select().single();

            if (error) throw error;

            // Log to intelligence
            logAction(ACTIONS.CASE_STUDY_SAVED, {
                industry,
                metadata: { client_name },
            });

            return NextResponse.json({ showcase: data });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE — remove a showcase
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Showcase ID is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('portfolio')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });

    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
