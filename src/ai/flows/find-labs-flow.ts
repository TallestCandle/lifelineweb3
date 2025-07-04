
'use server';
/**
 * @fileOverview An AI agent for finding nearby medical laboratories using Gemini.
 *
 * - findNearbyLabs - A function that finds labs based on geolocation and a specified distance.
 * - FindLabsInput - The input type for the function.
 * - FindLabsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const FindLabsInputSchema = z.object({
  latitude: z.number().describe("The user's current latitude."),
  longitude: z.number().describe("The user's current longitude."),
  distanceInKm: z.number().min(1).max(50).describe("The search radius in kilometers."),
});
export type FindLabsInput = z.infer<typeof FindLabsInputSchema>;

const LaboratorySchema = z.object({
    name: z.string().describe("The real, official name of the medical laboratory."),
    address: z.string().describe("The full, verifiable street address of the laboratory."),
    contactNumber: z.string().optional().describe("The lab's actual contact phone number."),
    googleMapsUrl: z.string().describe("A direct link to the lab's official business profile on Google Maps. This must not be a search query link."),
});

const FindLabsOutputSchema = z.object({
  labs: z.array(LaboratorySchema).describe("A list of nearby medical laboratories."),
});
export type FindLabsOutput = z.infer<typeof FindLabsOutputSchema>;

export async function findNearbyLabs(input: FindLabsInput): Promise<FindLabsOutput> {
  return findLabsFlow(input);
}

const findLabsPrompt = ai.definePrompt({
    name: 'findLabsPrompt',
    input: { schema: FindLabsInputSchema },
    output: { schema: FindLabsOutputSchema },
    prompt: `You are an expert local search assistant with access to real-time, real-world map data. Your task is to find *actual* and *verifiable* medical diagnostic laboratories near a given geographic coordinate.

User's Location:
- Latitude: {{latitude}}
- Longitude: {{longitude}}

Search Radius: {{distanceInKm}} kilometers

Please identify up to 5 *real* medical diagnostic laboratories within that radius. For each lab, you MUST provide:
1.  'name': The real, official name of the laboratory.
2.  'address': The full, verifiable street address.
3.  'contactNumber': The lab's actual contact phone number.
4.  'googleMapsUrl': A direct link to the lab's official business profile on Google Maps. This must not be a search query link.

Do not invent or create fictional information. The data must be accurate and reflect real-world places. Structure your entire response in the required JSON format.`,
});


const findLabsFlow = ai.defineFlow(
  {
    name: 'findLabsFlow',
    inputSchema: FindLabsInputSchema,
    outputSchema: FindLabsOutputSchema,
  },
  async (input) => {
    const { output } = await findLabsPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid list of laboratories.");
    }
    return output;
  }
);
