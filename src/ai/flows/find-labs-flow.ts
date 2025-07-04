
'use server';
/**
 * @fileOverview An AI agent for finding nearby medical laboratories using Google Maps.
 *
 * - findNearbyLabs - A function that finds labs based on geolocation.
 * - FindLabsInput - The input type for the function.
 * - FindLabsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { Client } from "@googlemaps/google-maps-services-js";

const FindLabsInputSchema = z.object({
  latitude: z.number().describe("The user's current latitude."),
  longitude: z.number().describe("The user's current longitude."),
});
export type FindLabsInput = z.infer<typeof FindLabsInputSchema>;

const LaboratorySchema = z.object({
    name: z.string().describe("The full name of the medical laboratory."),
    address: z.string().describe("The full street address of the laboratory."),
    contactNumber: z.string().optional().describe("The phone number for the laboratory."),
    googleMapsUrl: z.string().url().describe("A direct link to the laboratory on Google Maps."),
});

const FindLabsOutputSchema = z.object({
  labs: z.array(LaboratorySchema).describe("A list of nearby medical laboratories."),
});
export type FindLabsOutput = z.infer<typeof FindLabsOutputSchema>;

export async function findNearbyLabs(input: FindLabsInput): Promise<FindLabsOutput> {
  return findLabsFlow(input);
}

const findLabsFlow = ai.defineFlow(
  {
    name: 'findLabsFlow',
    inputSchema: FindLabsInputSchema,
    outputSchema: FindLabsOutputSchema,
  },
  async (input) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        throw new Error("Google Maps API key is not configured. Please set GOOGLE_MAPS_API_KEY in your environment variables.");
    }
    
    const client = new Client({});

    try {
        const response = await client.placesNearby({
            params: {
                location: { lat: input.latitude, lng: input.longitude },
                radius: 5000, // Search within a 5km radius
                keyword: 'medical laboratory diagnostic',
                type: 'health',
                key: apiKey,
            },
            timeout: 5000, // Optional timeout
        });

        if (response.data.status === 'OK') {
            const labs = await Promise.all(response.data.results.map(async (place) => {
                if (!place.place_id) return null;

                // Optionally, make a Place Details request to get the phone number if not in nearby search result
                let contactNumber = place.international_phone_number;
                if (!contactNumber && place.place_id) {
                     const detailsResponse = await client.placeDetails({
                        params: {
                            place_id: place.place_id,
                            fields: ['international_phone_number'],
                            key: apiKey,
                        }
                    });
                    contactNumber = detailsResponse.data.result.international_phone_number;
                }

                return {
                    name: place.name || "Unknown Lab",
                    address: place.vicinity || "Address not available",
                    contactNumber: contactNumber,
                    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name || '')}&query_place_id=${place.place_id}`,
                };
            }));

            return { labs: labs.filter(lab => lab !== null) as z.infer<typeof LaboratorySchema>[] };
        } else {
             console.error('Google Maps API Error:', response.data.status, response.data.error_message);
             throw new Error(`Failed to find labs. Reason: ${response.data.status}`);
        }
    } catch (e: any) {
        console.error("An error occurred while calling the Google Maps API: ", e);
        throw new Error("An unexpected error occurred while searching for laboratories.");
    }
  }
);
