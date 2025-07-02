
'use server';
/**
 * @fileOverview An AI agent for conducting an initial health consultation using a user's full health history.
 *
 * - initiateConsultation - A function that handles the initial analysis.
 * - InitiateConsultationInput - The input type for the function.
 * - InitiateConsultationOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const InitiateConsultationInputSchema = z.object({
  symptoms: z.string().describe("A detailed description of the user's current symptoms."),
  vitalsHistory: z.string().describe("A JSON string representing an array of historical vital signs readings."),
  testStripHistory: z.string().describe("A JSON string representing an array of historical urine test strip results."),
  previousAnalyses: z.string().describe("A JSON string representing an array of previous AI analysis results."),
  imageDataUri: z.string().optional().describe("An optional image of a health concern (e.g., a skin issue, test strip) as a data URI."),
});
export type InitiateConsultationInput = z.infer<typeof InitiateConsultationInputSchema>;

export const InitiateConsultationOutputSchema = z.object({
  analysisSummary: z.string().describe("A concise summary of the case for a human doctor to review. It should synthesize all inputs, including current symptoms and historical data."),
  potentialConditions: z.array(z.object({
    condition: z.string().describe("The name of the potential health condition."),
    probability: z.number().int().min(0).max(100).describe("The estimated probability of this condition (0-100)."),
    reasoning: z.string().describe("A brief explanation of why this condition is considered, based on the current symptoms and historical data trends."),
  })).describe("A list of potential health conditions with their likelihood and reasoning, derived from a holistic view of the user's health."),
  suggestedTreatmentPlan: z.object({
    medications: z.array(z.string()).describe("A list of suggested medications, including dosage and frequency."),
    lifestyleChanges: z.array(z.string()).describe("A list of recommended lifestyle modifications."),
    furtherTests: z.array(z.string()).describe("A list of suggested further diagnostic tests, if necessary, based on the comprehensive analysis."),
  }).describe("A comprehensive but cautious treatment plan suggested for the human doctor's review."),
  justification: z.string().describe("A clear rationale for why the suggested treatment plan was chosen, correlating current symptoms with patterns from the user's health history."),
  urgency: z.enum(['Low', 'Medium', 'High', 'Critical']).describe("The urgency level for the doctor's review, considering both acute symptoms and chronic trends."),
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
  prompt: `You are a highly intelligent AI diagnostic doctor. Your role is to conduct an initial consultation by analyzing a user's current symptoms in the context of their entire available health history. You will prepare a comprehensive case file for review by a human doctor. **You are an assistant to the human doctor.** Your suggestions are not final.

**Analysis Instructions:**
Analyze the user's current symptoms alongside their historical data to identify trends, correlations, and potential root causes. Do not just look at the current complaint in isolation.

**User's Submitted Data:**
- Current Symptoms: {{{symptoms}}}
{{#if imageDataUri}}- Image provided for current symptoms: {{media url=imageDataUri}}{{/if}}

**User's Health History:**
- Vitals History: {{{vitalsHistory}}}
- Test Strip History: {{{testStripHistory}}}
- Previous AI Analyses History: {{{previousAnalyses}}}

**Your Task:**
Based on ALL the provided information (current symptoms and full history), generate a complete case file in the required JSON format.

**JSON Output Instructions:**
1.  **analysisSummary:** Write a 'analysisSummary' that synthesizes all inputs into a clear overview for a human doctor. Highlight any connections between the current symptoms and past data.
2.  **potentialConditions:** Identify 'potentialConditions'. For each, provide the condition name, a 'probability' percentage, and 'reasoning' that explicitly links to both current symptoms and historical data points (e.g., "High probability due to reported chest pain and a historical trend of increasing blood pressure.").
3.  **suggestedTreatmentPlan:** Create a comprehensive but cautious 'suggestedTreatmentPlan'. Include 'medications', 'lifestyleChanges', and necessary 'furtherTests'. The plan should address both the acute symptoms and any underlying trends.
4.  **justification:** Write a clear 'justification' for your suggested plan, explaining how it addresses the holistic picture of the user's health.
5.  **urgency:** Assign an 'urgency' level ('Low', 'Medium', 'High', or 'Critical') based on the complete case.
6.  **followUpPlan:** Propose a 'followUpPlan' for how the AI assistant should follow up with the patient (e.g., "Request updated blood pressure readings daily for 5 days.").

Your entire output must be in the specified JSON format. Be thorough, logical, and safe.`,
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
