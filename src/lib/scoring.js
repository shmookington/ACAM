// Lead Scoring Engine for ACAM
// Computes a 0-100 score based on how good a lead is

/**
 * Score a lead based on multiple factors
 * Higher score = better prospect for Caelborne's web design services
 * @param {Object} business - Business data from Google Maps
 * @returns {number} Score from 0-100
 */
export function scoreLead(business) {
    let score = 0;

    // --- No website = huge bonus (this is our main target) ---
    if (!business.has_website || business.website_quality === 'none') {
        score += 40;
    } else if (business.website_quality === 'poor') {
        score += 25; // Social media as "website" = still a good lead
    } else {
        score += 5; // Already has a decent website = low priority
    }

    // --- Review count (established business = more likely to pay) ---
    const reviews = business.review_count || 0;
    if (reviews >= 200) {
        score += 20;
    } else if (reviews >= 100) {
        score += 16;
    } else if (reviews >= 50) {
        score += 12;
    } else if (reviews >= 20) {
        score += 8;
    } else if (reviews >= 5) {
        score += 4;
    }
    // 0-5 reviews = no bonus (too new / too small)

    // --- Rating (successful business = can afford a website) ---
    const rating = business.google_rating || 0;
    if (rating >= 4.5) {
        score += 15;
    } else if (rating >= 4.0) {
        score += 12;
    } else if (rating >= 3.5) {
        score += 8;
    } else if (rating >= 3.0) {
        score += 4;
    }
    // Below 3.0 = no bonus

    // --- Has phone number (contactable) ---
    if (business.phone) {
        score += 10;
    }

    // --- Has email (even better for outreach) ---
    if (business.email) {
        score += 15;
    }

    // Cap at 100
    return Math.min(100, score);
}

/**
 * Get score adjustment based on engagement action
 * @param {string} action - The engagement action
 * @returns {number} Score adjustment (positive = boost, negative = drop)
 */
export function getScoreAdjustment(action) {
    const adjustments = {
        'interested': +20,
        'call_back': +10,
        'no_answer': 0,
        'not_interested': -15,
        'wrong_number': -10,
        'email_sent': +5,
        'email_opened': +10,
        'responded': +25,
    };
    return adjustments[action] ?? 0;
}

/**
 * Apply a score adjustment to a lead's current score
 * Only adjusts if the new action differs from the previous outcome
 * @param {number} currentScore - The lead's current score
 * @param {string} action - The new engagement action
 * @param {string} [previousOutcome] - The lead's previous call outcome
 * @returns {number} New score (capped 0-100)
 */
export function rescoreLead(currentScore, action, previousOutcome = null) {
    // Don't re-adjust if same outcome is logged again
    if (previousOutcome && previousOutcome === action) {
        return currentScore;
    }
    // If changing from a previous outcome, reverse that first, then apply new
    let score = currentScore;
    if (previousOutcome) {
        score -= getScoreAdjustment(previousOutcome);
    }
    score += getScoreAdjustment(action);
    return Math.max(0, Math.min(100, score));
}

/**
 * Get a human-readable score label
 * @param {number} score 
 * @returns {string}
 */
export function getScoreLabel(score) {
    if (score >= 80) return 'HOT';
    if (score >= 60) return 'WARM';
    if (score >= 40) return 'COOL';
    return 'COLD';
}

/**
 * Get the CSS class for a score badge
 * @param {number} score 
 * @returns {string}
 */
export function getScoreColor(score) {
    if (score >= 80) return '#00ff41';    // Bright green — HOT
    if (score >= 60) return '#ffb000';    // Amber — WARM
    if (score >= 40) return '#ff8c00';    // Orange — COOL
    return '#ff3333';                     // Red — COLD
}
