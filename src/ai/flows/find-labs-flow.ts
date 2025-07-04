
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
    name: z.string().describe("The full name of the medical laboratory."),
    address: z.string().describe("The full street address of the laboratory."),
    contactNumber: z.string().optional().describe("A plausible contact phone number for the laboratory."),
    googleMapsUrl: z.string().describe("A best-effort, hypothetical link to what the laboratory's location might be on Google Maps."),
    imageUrl: z.string().optional().describe("A representative stock photo URL for a medical laboratory building."),
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
    prompt: `You are an expert local search assistant. Your task is to identify medical laboratories near a given geographic coordinate.

User's Location:
- Latitude: {{latitude}}
- Longitude: {{longitude}}

Search Radius: {{distanceInKm}} kilometers

Please identify up to 5 medical diagnostic laboratories within that radius. For each lab, provide:
1.  A realistic, common name for a lab in that region.
2.  A plausible street address.
3.  A plausible contact phone number.
4.  A hypothetical Google Maps URL based on the name and plausible location.
5.  An optional, representative stock photo URL of a generic, modern laboratory or medical building from a placeholder image service like Pexels or Unsplash. The image should be landscape.

It is critical that you provide plausible, realistic-sounding information, but you do not need to use real-time data. Generate a list of fictional but believable labs. Structure your entire response in the required JSON format.`,
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
