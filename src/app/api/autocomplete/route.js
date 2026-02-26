import { NextResponse } from 'next/server';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const input = searchParams.get('input');

        if (!input || input.length < 2) {
            return NextResponse.json({ predictions: [] });
        }

        // Use the NEW Places API autocomplete endpoint (same API as our scraper)
        const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
            },
            body: JSON.stringify({
                input,
                includedPrimaryTypes: ['locality', 'administrative_area_level_3', 'sublocality'],
                includedRegionCodes: ['us'],
            }),
        });

        if (!response.ok) {
            // Fallback: try the legacy autocomplete API
            const legacyResponse = await fetch(
                `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=(cities)&key=${GOOGLE_PLACES_API_KEY}`
            );
            const legacyData = await legacyResponse.json();

            if (legacyData.status === 'OK' && legacyData.predictions?.length > 0) {
                return NextResponse.json({
                    predictions: legacyData.predictions.map(p => ({
                        description: p.description,
                        placeId: p.place_id,
                    })),
                });
            }

            return NextResponse.json({ predictions: [] });
        }

        const data = await response.json();

        const predictions = (data.suggestions || [])
            .filter(s => s.placePrediction)
            .map(s => ({
                description: s.placePrediction.text?.text || s.placePrediction.structuredFormat?.mainText?.text || '',
                placeId: s.placePrediction.placeId || '',
            }))
            .filter(p => p.description);

        return NextResponse.json({ predictions });

    } catch (error) {
        console.error('Autocomplete error:', error);
        return NextResponse.json({ predictions: [] });
    }
}
