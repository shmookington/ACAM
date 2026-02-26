// Google Maps / Places API (NEW) integration for ACAM
// Uses exclusively the new Places API endpoints

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const BASE_URL = 'https://places.googleapis.com/v1/places';

/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Search businesses using the NEW Places API Text Search
 * The new API returns up to 20 per request with a nextPageToken for pagination
 */
export async function searchBusinesses(location, category) {
    const query = `${category} in ${location}`;
    let allPlaces = [];
    let pageToken = null;
    let pageCount = 0;
    const MAX_PAGES = 3; // up to 60 results

    const fieldMask = [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.websiteUri',
        'places.nationalPhoneNumber',
        'places.rating',
        'places.userRatingCount',
        'places.primaryTypeDisplayName',
        'places.googleMapsUri',
        'places.businessStatus',
    ].join(',');

    try {
        while (pageCount < MAX_PAGES) {
            const requestBody = {
                textQuery: query,
                pageSize: 20,
            };

            if (pageToken) {
                requestBody.pageToken = pageToken;
            }

            const response = await fetch(`${BASE_URL}:searchText`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
                    'X-Goog-FieldMask': fieldMask + ',nextPageToken',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Places API error:', response.status, errorData);
                if (pageCount === 0) {
                    throw new Error(`Places API: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
                }
                break;
            }

            const data = await response.json();
            const places = data.places || [];
            allPlaces = allPlaces.concat(places);
            pageCount++;

            console.log(`Page ${pageCount}: got ${places.length} results (total: ${allPlaces.length})`);

            // Check for next page
            if (data.nextPageToken) {
                pageToken = data.nextPageToken;
                // Brief delay between pages
                await sleep(1000);
            } else {
                break;
            }
        }

        // Transform to our format — the new API already includes website and phone
        return allPlaces.map((place) => ({
            google_place_id: place.id,
            business_name: place.displayName?.text || 'Unknown',
            category: place.primaryTypeDisplayName?.text || category,
            address: place.formattedAddress || '',
            phone: place.nationalPhoneNumber || null,
            google_rating: place.rating || null,
            review_count: place.userRatingCount || 0,
            has_website: !!place.websiteUri,
            website_url: place.websiteUri || null,
            google_maps_url: place.googleMapsUri || null,
            business_status: place.businessStatus || 'OPERATIONAL',
        }));

    } catch (error) {
        console.error('Error searching businesses:', error);
        throw error;
    }
}

/**
 * Assess website quality
 */
export function assessWebsiteQuality(websiteUrl) {
    if (!websiteUrl) return 'none';

    const poorIndicators = [
        'facebook.com', 'instagram.com', 'yelp.com',
        'yellowpages.com', 'wix.com/site', 'squarespace.com',
    ];

    const urlLower = websiteUrl.toLowerCase();
    for (const indicator of poorIndicators) {
        if (urlLower.includes(indicator)) return 'poor';
    }

    return 'decent';
}
