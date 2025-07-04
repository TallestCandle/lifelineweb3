'use server';
/**
 * @fileOverview An AI agent for finding nearby medical laboratories.
 *
 * - findNearbyLabs - A function that finds labs based on geolocation.
 * - FindLabsInput - The input type for the function.
 * - FindLabsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const FindLabsInputSchema = z.object({
  latitude: z.number().describe("The user's current latitude."),
  longitude: z.number().describe("The user's current longitude."),
});
export type FindLabsInput = z.infer<typeof FindLabsInputSchema>;

const LaboratorySchema = z.object({
    name: z.string().describe("The full name of the medical laboratory."),
    address: z.string().describe("The full street address of the laboratory."),
});

const FindLabsOutputSchema = z.object({
  labs: z.array(LaboratorySchema).describe("A list of nearby medical laboratories."),
});
export type FindLabsOutput = z.infer<typeof FindLabsOutputSchema>;

export async function findNearbyLabs(input: FindLabsInput): Promise<FindLabsOutput> {
  return findLabsFlow(input);
}

const prompt = ai.definePrompt({
    name: 'findLabsPrompt',
    input: { schema: FindLabsInputSchema },
    output: { schema: FindLabsOutputSchema },
    prompt: `You are a helpful local directory assistant for Lifeline AI, specializing in finding medical facilities in Nigeria.

A user has provided their location and needs to find a medical laboratory nearby.

User's Latitude: {{latitude}}
User's Longitude: {{longitude}}

Based on these coordinates, generate a list of 5 fictional, but realistic-sounding, medical laboratories. For each laboratory, provide a 'name' and a plausible 'address' that seems appropriate for a location within a major Nigerian city near the given coordinates.`,
});


const findLabsFlow = ai.defineFlow(
  {
    name: 'findLabsFlow',
    inputSchema: FindLabsInputSchema,
    outputSchema: FindLabsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("The AI model did not return a valid list of laboratories.");
    }
    return output;
  }
);
