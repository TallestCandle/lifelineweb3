
'use server';
/**
 * @fileOverview An AI agent for conducting an initial health consultation.
 *
 * - initiateConsultation - A function that handles the initial analysis.
 * - InitiateConsultationInput - The input type for the function.
 * - InitiateConsultationOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const InitiateConsultationInputSchema = z.object({
  symptoms: z.string().describe("A detailed description of the user's symptoms."),
  vitals: z.string().optional().describe("A JSON string of the user's current vital signs (e.g., blood pressure, temperature)."),
  imageDataUri: z.string().optional().describe("An optional image of a health concern (e.g., a skin issue, test strip) as a data URI."),
});
export type InitiateConsultationInput = z.infer<typeof InitiateConsultationInputSchema>;

export const InitiateConsultationOutputSchema = z.object({
  analysisSummary: z.string().describe("A concise summary of the case for a human doctor to review. It should synthesize all inputs."),
  potentialConditions: z.array(z.object({
    condition: z.string().describe("The name of the potential health condition."),
    probability: z.number().int().min(0).max(100).describe("The estimated probability of this condition (0-100)."),
    reasoning: z.string().describe("A brief explanation of why this condition is considered, based on the provided data."),
  })).describe("A list of potential health conditions with their likelihood and reasoning."),
  suggestedTreatmentPlan: z.object({
    medications: z.array(z.string()).describe("A list of suggested medications, including dosage and frequency."),
    lifestyleChanges: z.array(z.string()).describe("A list of recommended lifestyle modifications."),
    furtherTests: z.array(z.string()).describe("A list of suggested further diagnostic tests, if necessary."),
  }).describe("A comprehensive but cautious treatment plan suggested for the human doctor's review."),
  justification: z.string().describe("A clear rationale for why the suggested treatment plan was chosen based on the potential conditions."),
  urgency: z.enum(['Low', 'Medium', 'High', 'Critical']).describe("The urgency level for the doctor's review."),
  followUpPlan: z.string().describe("A proposed plan for user follow-up (e.g., 'Request vital signs update in 3 days.')."),
});
export type InitiateConsultationOutput = z.infer<typeof InitiateConsultationOutputSchema>;


export async function initiateConsultation(input: InitiateConsultationInput): Promise<InitiateConsultationOutput> {
  return initiateConsultationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'initiateConsultationPrompt',
  input: { schema: InitiateConsultationInputSchema },
  output: { schema: InitiateConsultationOutputSchema },
  prompt: `You are a highly intelligent AI diagnostic doctor. Your role is to conduct an initial consultation, analyze the user's data, and prepare a comprehensive case file for review by a human doctor. **You are an assistant to the human doctor.** Your suggestions are not final.

**User's Submitted Data:**
- Symptoms: {{{symptoms}}}
{{#if vitals}}- Vitals: {{{vitals}}}{{/if}}
{{#if imageDataUri}}- Image provided: {{media url=imageDataUri}}{{/if}}

**Your Task:**
Based on all the provided information, generate a complete case file in the required JSON format.

**Instructions:**
1.  **Analysis Summary:** Write a 'analysisSummary' that synthesizes all the inputs into a clear, concise overview for a human doctor.
2.  **Potential Conditions:** Identify a list of 'potentialConditions'. For each, provide the condition name, a 'probability' percentage, and your 'reasoning'.
3.  **Suggested Treatment Plan:** Create a 'suggestedTreatmentPlan'. This is the most critical part. Be comprehensive but cautious. Include suggestions for 'medications' (with dose/frequency), 'lifestyleChanges', and any 'furtherTests' you deem necessary.
4.  **Justification:** Write a clear 'justification' for your suggested plan, linking it directly to the symptoms and potential conditions.
5.  **Urgency:** Assign an 'urgency' level for the human doctor's review ('Low', 'Medium', 'High', or 'Critical').
6.  **Follow-up Plan:** Propose a 'followUpPlan' for how the AI assistant should follow up with the patient after the plan is approved (e.g., "Request updated vitals and symptoms in 3 days.").

Your entire output must be in the specified JSON format. This is a critical step in a medical process; be thorough, logical, and safe.`,
});

const initiateConsultationFlow = ai.defineFlow(
  {
    name: 'initiateConsultationFlow',
    inputSchema: InitiateConsultationInputSchema,
    outputSchema: InitiateConsultationOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid consultation analysis.");
    }
    return output;
  }
);
