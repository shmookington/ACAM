import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY || ''
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Generate AI proposal content WITH dynamic pricing
async function generateProposalContent(lead) {
    const prompt = `You are a senior strategist at Caelborne Digital, a boutique web design agency. Generate a website proposal for this business. The pricing MUST be realistic and tailored — think carefully about what kind of business this is, what area it's in, and what they can afford.

BUSINESS:
- Name: ${lead.business_name}
- Category: ${lead.category || 'Local Business'}
- Location: ${lead.city || ''}${lead.state ? ', ' + lead.state : ''}
- Has Website: ${lead.has_website ? 'Yes (needs upgrade)' : 'No'}
- Google Rating: ${lead.google_rating || 'N/A'} (${lead.review_count || 0} reviews)

PRICING STRATEGY:
Classify this business into ONE of these tiers and use the EXACT prices listed:

BUDGET BUSINESSES (food trucks, cleaning services, handyman, mobile detailing, lawn care, pressure washing, junk removal):
  Starter: $397  |  Professional: $897  |  Premium: $1,497

MID-TIER BUSINESSES (restaurants, salons, barbershops, auto repair, gyms, cafes, pet grooming, photography):
  Starter: $597  |  Professional: $1,497  |  Premium: $2,497

HIGH-TICKET BUSINESSES (law firms, medical/dental practices, med spas, real estate agencies, accounting firms, luxury services, consulting):
  Starter: $997  |  Professional: $2,497  |  Premium: $3,997

Pick the tier that best fits "${lead.category || 'Local Business'}" and use those exact dollar amounts.

Generate EXACTLY this JSON (no markdown fences, raw JSON only):
{
    "headline": "A compelling 1-line headline tailored to ${lead.business_name}",
    "executive_summary": "2-3 sentences about why this business needs a website or better website. Be specific to their industry and location.",
    "pain_points": [
        "Specific pain point about losing customers to competitors with websites",
        "Pain point about missing revenue from online search",
        "Pain point about credibility and trust in their specific industry"
    ],
    "solution_overview": "2-3 sentences about what Caelborne will build, tailored to their industry (e.g., online ordering for restaurants, booking for salons, portfolio for contractors).",
    "features_starter": [
        "Responsive single-page design",
        "Industry-specific feature 1",
        "Industry-specific feature 2",
        "Basic SEO setup",
        "30 days support"
    ],
    "features_pro": [
        "Multi-page custom design (up to 5 pages)",
        "Industry-specific feature 1",
        "Industry-specific feature 2",
        "Industry-specific feature 3",
        "Advanced SEO + Google Analytics",
        "60 days support"
    ],
    "features_premium": [
        "Unlimited custom pages",
        "Industry-specific premium feature 1",
        "Industry-specific premium feature 2",
        "Industry-specific premium feature 3",
        "Full SEO campaign + content strategy",
        "Email marketing integration",
        "90 days VIP support"
    ],
    "pricing": {
        "starter_price": "The exact starter price from the tier above (e.g. $397, $597, or $997)",
        "starter_name": "Tier name (e.g., 'Starter', 'Essential', 'Foundation')",
        "starter_tagline": "Short description (e.g., 'Get Online Fast')",
        "pro_price": "The exact pro price from the tier above (e.g. $897, $1,497, or $2,497)",
        "pro_name": "Tier name (e.g., 'Professional', 'Growth', 'Business')",
        "pro_tagline": "Short description",
        "premium_price": "The exact premium price from the tier above (e.g. $1,497, $2,497, or $3,997)",
        "premium_name": "Tier name (e.g., 'Premium', 'Enterprise', 'Elite')",
        "premium_tagline": "Short description"
    },
    "pricing_tier": "Which tier you chose: 'budget', 'mid-tier', or 'high-ticket'",
    "pricing_rationale": "1 sentence explaining why this pricing tier was chosen for this business",
    "why_us": [
        "Reason 1 tailored to their industry",
        "Reason 2 about quality",
        "Reason 3 about partnership/support"
    ],
    "cta": "1-2 sentence call to action mentioning Amiri Tate and scheduling a quick call"
}`;

    const response = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "deepseek-chat",
    });

    const raw = response.choices[0].message.content;
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
}

// ─── PDF Builder using pdf-lib ───
async function buildProposalPDF(lead, content) {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const W = 612, H = 792;
    const LM = 55, RM = 55;
    const pw = W - LM - RM;

    const black = rgb(0.04, 0.04, 0.04);
    const accent = rgb(0, 0.8, 0.33);
    const white = rgb(1, 1, 1);
    const gray = rgb(0.6, 0.6, 0.6);
    const ltGray = rgb(0.8, 0.8, 0.8);
    const darkBg = rgb(0.1, 0.1, 0.1);

    // Helper: draw text with wrapping
    function drawText(page, text, x, y, opts = {}) {
        const f = opts.bold ? fontBold : font;
        const size = opts.size || 11;
        const color = opts.color || ltGray;
        const maxW = opts.maxWidth || pw;

        const words = text.split(' ');
        let line = '';
        let cy = y;
        const lineH = size * 1.4;

        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            const tw = f.widthOfTextAtSize(test, size);
            if (tw > maxW && line) {
                page.drawText(line, { x, y: cy, size, font: f, color });
                cy -= lineH;
                line = word;
            } else {
                line = test;
            }
        }
        if (line) {
            page.drawText(line, { x, y: cy, size, font: f, color });
            cy -= lineH;
        }
        return cy;
    }

    function drawRect(page, x, y, w, h, color) {
        page.drawRectangle({ x, y, width: w, height: h, color });
    }

    // ──── PAGE 1: COVER ────
    const p1 = pdf.addPage([W, H]);
    drawRect(p1, 0, 0, W, H, black);

    // Top accent bar
    drawRect(p1, LM, H - 55, pw, 3, accent);

    // Agency name
    p1.drawText('CAELBORNE DIGITAL', { x: LM, y: H - 80, size: 14, font: fontBold, color: accent });
    p1.drawText('Premium Web Design for Local Businesses', { x: LM, y: H - 97, size: 9, font, color: gray });

    // Main title
    p1.drawText('Website Proposal', { x: LM, y: H - 200, size: 34, font: fontBold, color: white });

    // AI headline
    drawText(p1, content.headline, LM, H - 245, { size: 15, color: accent, bold: false });

    // Prepared for
    p1.drawText('PREPARED FOR', { x: LM, y: H - 340, size: 10, font, color: gray });
    p1.drawText(lead.business_name, { x: LM, y: H - 360, size: 20, font: fontBold, color: white });
    const locLine = `${lead.city || ''}${lead.state ? ', ' + lead.state : ''}`;
    p1.drawText(locLine, { x: LM, y: H - 385, size: 11, font, color: gray });
    p1.drawText(lead.category || 'Local Business', { x: LM, y: H - 402, size: 11, font, color: gray });
    if (lead.google_rating) {
        p1.drawText(`Google Rating: ${lead.google_rating} stars (${lead.review_count || 0} reviews)`, { x: LM, y: H - 419, size: 11, font, color: gray });
    }

    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    p1.drawText(`Date: ${today}`, { x: LM, y: H - 460, size: 10, font, color: gray });

    // Bottom accent
    drawRect(p1, LM, 55, pw, 2, accent);
    p1.drawText('caelborne.io  |  amiri@caelborne.io', { x: LM, y: 40, size: 8, font, color: gray });

    // ──── PAGE 2: EXEC SUMMARY + SOLUTION ────
    const p2 = pdf.addPage([W, H]);
    drawRect(p2, 0, 0, W, H, black);

    p2.drawText('CAELBORNE DIGITAL', { x: LM, y: H - 40, size: 9, font: fontBold, color: accent });
    drawRect(p2, LM, H - 55, pw, 1, darkBg);

    p2.drawText('Executive Summary', { x: LM, y: H - 80, size: 22, font: fontBold, color: white });

    let y2 = drawText(p2, content.executive_summary, LM, H - 115, { size: 11, color: ltGray, maxWidth: pw });

    y2 -= 30;
    p2.drawText('The Challenge', { x: LM, y: y2, size: 18, font: fontBold, color: accent });
    y2 -= 28;

    for (let i = 0; i < content.pain_points.length; i++) {
        p2.drawText(`${i + 1}.`, { x: LM, y: y2, size: 11, font: fontBold, color: white });
        y2 = drawText(p2, content.pain_points[i], LM + 20, y2, { size: 11, color: ltGray, maxWidth: pw - 20 });
        y2 -= 10;
    }

    y2 -= 20;
    p2.drawText('Our Solution', { x: LM, y: y2, size: 18, font: fontBold, color: accent });
    y2 -= 28;
    y2 = drawText(p2, content.solution_overview, LM, y2, { size: 11, color: ltGray, maxWidth: pw });

    // Feature highlights
    y2 -= 25;
    p2.drawText('Key Features Include:', { x: LM, y: y2, size: 14, font: fontBold, color: white });
    y2 -= 22;
    const previewFeats = content.features_pro.slice(0, 5);
    for (const feat of previewFeats) {
        p2.drawText('>', { x: LM, y: y2, size: 11, font: fontBold, color: accent });
        y2 = drawText(p2, feat, LM + 16, y2, { size: 11, color: ltGray, maxWidth: pw - 16 });
        y2 -= 6;
    }

    // Footer
    drawRect(p2, LM, 55, pw, 1, darkBg);
    p2.drawText('caelborne.io  |  amiri@caelborne.io', { x: LM, y: 40, size: 8, font, color: gray });

    // ──── PAGE 3: PRICING TIERS ────
    const p3 = pdf.addPage([W, H]);
    drawRect(p3, 0, 0, W, H, black);

    p3.drawText('CAELBORNE DIGITAL', { x: LM, y: H - 40, size: 9, font: fontBold, color: accent });
    drawRect(p3, LM, H - 55, pw, 1, darkBg);

    p3.drawText('Investment Options', { x: LM, y: H - 80, size: 22, font: fontBold, color: white });

    // Pricing rationale
    let y3 = drawText(p3, content.pricing_rationale, LM, H - 110, { size: 10, color: gray, maxWidth: pw });
    y3 -= 15;

    const tiers = [
        {
            name: content.pricing.starter_name,
            price: content.pricing.starter_price,
            tagline: content.pricing.starter_tagline,
            features: content.features_starter,
            popular: false,
        },
        {
            name: content.pricing.pro_name,
            price: content.pricing.pro_price,
            tagline: content.pricing.pro_tagline,
            features: content.features_pro,
            popular: true,
        },
        {
            name: content.pricing.premium_name,
            price: content.pricing.premium_price,
            tagline: content.pricing.premium_tagline,
            features: content.features_premium,
            popular: false,
        },
    ];

    const tierW = (pw - 20) / 3;
    const tierTop = y3;

    tiers.forEach((tier, i) => {
        const tx = LM + i * (tierW + 10);
        let ty = tierTop;

        // Tier box background
        const boxColor = tier.popular ? rgb(0.05, 0.12, 0.05) : darkBg;
        drawRect(p3, tx, ty - 420, tierW, 420, boxColor);

        // Border
        const borderColor = tier.popular ? accent : rgb(0.2, 0.2, 0.2);
        p3.drawRectangle({ x: tx, y: ty - 420, width: tierW, height: 420, borderColor, borderWidth: 1 });

        // Popular badge
        if (tier.popular) {
            drawRect(p3, tx, ty - 2, tierW, 20, accent);
            p3.drawText('RECOMMENDED', { x: tx + tierW / 2 - 38, y: ty + 4, size: 8, font: fontBold, color: black });
            ty -= 25;
        }

        ty -= 20;

        // Tier name
        p3.drawText(tier.name.toUpperCase(), { x: tx + 10, y: ty, size: 11, font: fontBold, color: tier.popular ? accent : gray });
        ty -= 30;

        // Price
        p3.drawText(tier.price, { x: tx + 10, y: ty, size: 26, font: fontBold, color: white });
        ty -= 22;

        // Tagline
        p3.drawText(tier.tagline, { x: tx + 10, y: ty, size: 9, font, color: gray });
        ty -= 18;

        // Divider
        drawRect(p3, tx + 10, ty, tierW - 20, 1, rgb(0.2, 0.2, 0.2));
        ty -= 15;

        // Features
        for (const feat of tier.features) {
            p3.drawText('>', { x: tx + 10, y: ty, size: 8, font: fontBold, color: accent });
            // Simple text (no wrapping for features to keep compact)
            const truncated = feat.length > 28 ? feat.substring(0, 26) + '...' : feat;
            p3.drawText(truncated, { x: tx + 22, y: ty, size: 8, font, color: ltGray });
            ty -= 14;
        }
    });

    // Footer
    drawRect(p3, LM, 55, pw, 1, darkBg);
    p3.drawText('caelborne.io  |  amiri@caelborne.io', { x: LM, y: 40, size: 8, font, color: gray });

    // ──── PAGE 4: WHY US + CTA ────
    const p4 = pdf.addPage([W, H]);
    drawRect(p4, 0, 0, W, H, black);

    p4.drawText('CAELBORNE DIGITAL', { x: LM, y: H - 40, size: 9, font: fontBold, color: accent });
    drawRect(p4, LM, H - 55, pw, 1, darkBg);

    p4.drawText('Why Caelborne Digital?', { x: LM, y: H - 80, size: 22, font: fontBold, color: white });

    let y4 = H - 120;
    for (let i = 0; i < content.why_us.length; i++) {
        p4.drawText(`${i + 1}`, { x: LM, y: y4, size: 22, font: fontBold, color: accent });
        y4 = drawText(p4, content.why_us[i], LM + 30, y4, { size: 12, color: ltGray, maxWidth: pw - 30 });
        y4 -= 20;
    }

    // CTA box
    y4 -= 20;
    drawRect(p4, LM, y4 - 70, pw, 80, rgb(0.05, 0.12, 0.05));
    p4.drawRectangle({ x: LM, y: y4 - 70, width: pw, height: 80, borderColor: accent, borderWidth: 1 });
    p4.drawText("Let's Get Started", { x: LM + 20, y: y4 - 5, size: 15, font: fontBold, color: white });
    drawText(p4, content.cta, LM + 20, y4 - 28, { size: 11, color: ltGray, maxWidth: pw - 40 });

    // Contact block
    y4 -= 120;
    p4.drawText('Amiri Tate', { x: LM, y: y4, size: 13, font: fontBold, color: white });
    p4.drawText('Founder, Caelborne Digital', { x: LM, y: y4 - 18, size: 11, font, color: gray });
    p4.drawText('amiri@caelborne.io', { x: LM, y: y4 - 35, size: 11, font, color: gray });
    p4.drawText('caelborne.io', { x: LM, y: y4 - 52, size: 11, font, color: gray });

    // Final accent bar
    drawRect(p4, LM, 55, pw, 3, accent);

    return await pdf.save();
}

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
