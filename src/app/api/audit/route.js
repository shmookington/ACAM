import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ─── Self-Hosted Website Audit ───
// Fetches the site directly, measures load time, analyzes HTML for SEO/mobile/performance signals.
// No external API dependency = instant, free, never rate-limited.

async function auditWebsite(url) {
    const results = {
        url,
        loadTimeMs: 0,
        ttfbMs: 0,
        pageSizeKb: 0,
        statusCode: 0,
        https: url.startsWith('https'),
        mobile: { hasViewport: false, hasResponsiveMeta: false },
        seo: { hasTitle: false, title: '', hasDescription: false, description: '', hasH1: false, h1Count: 0 },
        performance: { imageCount: 0, scriptCount: 0, stylesheetCount: 0, inlineStyleCount: 0 },
        security: { hasHttps: url.startsWith('https'), headers: {} },
        issues: [],
        positives: [],
    };

    try {
        const startTime = Date.now();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            },
            redirect: 'follow',
        });

        const ttfb = Date.now() - startTime;
        results.ttfbMs = ttfb;
        results.statusCode = res.status;

        const html = await res.text();
        const loadTime = Date.now() - startTime;
        results.loadTimeMs = loadTime;
        results.pageSizeKb = Math.round(new TextEncoder().encode(html).length / 1024);

        clearTimeout(timeout);

        // Security headers
        const secHeaders = ['strict-transport-security', 'x-content-type-options', 'x-frame-options', 'content-security-policy'];
        secHeaders.forEach(h => {
            results.security.headers[h] = res.headers.has(h);
        });

        // Mobile readiness
        const viewportMatch = html.match(/<meta[^>]*name=["']viewport["'][^>]*>/i);
        results.mobile.hasViewport = !!viewportMatch;
        results.mobile.hasResponsiveMeta = viewportMatch ? viewportMatch[0].includes('width=device-width') : false;

        // SEO
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
        if (titleMatch) {
            results.seo.hasTitle = true;
            results.seo.title = titleMatch[1].trim().substring(0, 120);
        }

        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["'][^>]*>/i) ||
            html.match(/<meta[^>]*content=["'](.*?)["'][^>]*name=["']description["'][^>]*>/i);
        if (descMatch) {
            results.seo.hasDescription = true;
            results.seo.description = descMatch[1].trim().substring(0, 200);
        }

        const h1Matches = html.match(/<h1[\s>]/gi);
        results.seo.h1Count = h1Matches ? h1Matches.length : 0;
        results.seo.hasH1 = results.seo.h1Count > 0;

        // Performance signals
        results.performance.imageCount = (html.match(/<img[\s>]/gi) || []).length;
        results.performance.scriptCount = (html.match(/<script[\s>]/gi) || []).length;
        results.performance.stylesheetCount = (html.match(/<link[^>]*stylesheet/gi) || []).length;
        results.performance.inlineStyleCount = (html.match(/style=["']/gi) || []).length;

        // Generate issues & positives
        if (results.loadTimeMs > 3000) results.issues.push(`Page takes ${(results.loadTimeMs / 1000).toFixed(1)}s to load — should be under 3s`);
        else results.positives.push(`Page loads in ${(results.loadTimeMs / 1000).toFixed(1)}s`);

        if (results.ttfbMs > 1000) results.issues.push(`Server response time is ${results.ttfbMs}ms — should be under 600ms`);
        else results.positives.push(`Server responds in ${results.ttfbMs}ms`);

        if (results.pageSizeKb > 2000) results.issues.push(`Page is ${results.pageSizeKb}KB — should be under 2000KB for fast mobile loading`);
        else if (results.pageSizeKb > 500) results.issues.push(`Page is ${results.pageSizeKb}KB — could be lighter for mobile`);
        else results.positives.push(`Page size is lean at ${results.pageSizeKb}KB`);

        if (!results.mobile.hasViewport) results.issues.push('No mobile viewport tag — site will look broken on phones');
        else results.positives.push('Has mobile viewport meta tag');

        if (!results.seo.hasTitle) results.issues.push('Missing title tag — invisible to Google search');
        else if (results.seo.title.length < 20) results.issues.push(`Title tag is too short (${results.seo.title.length} chars) — should be 50-60`);
        else results.positives.push('Has a proper title tag');

        if (!results.seo.hasDescription) results.issues.push('Missing meta description — won\'t show a preview in Google results');
        else results.positives.push('Has a meta description');

        if (!results.seo.hasH1) results.issues.push('No H1 heading — hurts SEO ranking');
        else if (results.seo.h1Count > 1) results.issues.push(`Has ${results.seo.h1Count} H1 tags — should only have 1`);
        else results.positives.push('Has a single H1 heading');

        if (!results.https) results.issues.push('Not using HTTPS — browsers show "Not Secure" warning');
        else results.positives.push('Uses HTTPS');

        if (results.performance.imageCount > 20) results.issues.push(`${results.performance.imageCount} images on the page — likely unoptimized`);
        if (results.performance.scriptCount > 10) results.issues.push(`${results.performance.scriptCount} scripts loaded — slows the page down`);
        if (results.performance.inlineStyleCount > 30) results.issues.push(`${results.performance.inlineStyleCount} inline styles — poor code quality`);

    } catch (err) {
        if (err.name === 'AbortError') {
            results.issues.push('Site took over 15 seconds to respond — extremely slow');
            results.loadTimeMs = 15000;
        } else {
            results.issues.push(`Could not load site: ${err.message}`);
        }
    }

    // Calculate an overall score (0-100)
    const maxIssues = 10;
    const issueWeight = Math.min(results.issues.length, maxIssues) / maxIssues;
    results.overallScore = Math.max(0, Math.round(100 - (issueWeight * 80) - (results.loadTimeMs > 5000 ? 15 : results.loadTimeMs > 3000 ? 8 : 0)));

    return results;
}

// ─── DeepSeek AI Pitch Generator ───
async function generatePitch(auditData, businessName, category) {
    try {
        const res = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a web design sales expert. Write a short, punchy pitch (2-3 sentences max) based on the website audit data. Use specific numbers from the audit. Be direct and conversational — like texting a friend who owns a business. Do NOT use greetings, signatures, or formal language. Just the pitch.'
                    },
                    {
                        role: 'user',
                        content: `Business: ${businessName} (${category || 'local business'})
Website: ${auditData.url}
Load time: ${(auditData.loadTimeMs / 1000).toFixed(1)}s
Server response: ${auditData.ttfbMs}ms
Page size: ${auditData.pageSizeKb}KB
Overall score: ${auditData.overallScore}/100
Issues found: ${auditData.issues.join('; ')}
Positives: ${auditData.positives.join('; ')}

Write a 2-3 sentence sales pitch I can use to sell them a new website. Reference their specific numbers. Make it compelling.`
                    }
                ],
                max_tokens: 200,
                temperature: 0.8,
            }),
        });

        if (!res.ok) {
            console.error('DeepSeek error:', await res.text());
            return null;
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (err) {
        console.error('DeepSeek pitch error:', err.message);
        return null;
    }
}

export async function POST(request) {
    try {
        const { leadId, url, businessName, category } = await request.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        let targetUrl = url;
        if (!targetUrl.startsWith('http')) {
            targetUrl = 'https://' + targetUrl;
        }

        // Run self-hosted audit
        const auditData = await auditWebsite(targetUrl);

        // Generate AI pitch
        const aiPitch = await generatePitch(auditData, businessName || 'this business', category);
        auditData.aiPitch = aiPitch;

        // Save to Supabase
        if (leadId) {
            await supabase
                .from('leads')
                .update({
                    audit_data: auditData,
                    audit_date: new Date().toISOString(),
                })
                .eq('id', leadId);
        }

        return NextResponse.json(auditData);

    } catch (error) {
        console.error('Audit error:', error);
        return NextResponse.json({ error: error.message || 'Audit failed' }, { status: 500 });
    }
}
