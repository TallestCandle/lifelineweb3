
'use server';
/**
 * @fileOverview An AI agent for following up on user progress after a consultation.
 *
 * - conductFollowUp - A function that handles the follow-up analysis.
 * - FollowUpInput - The input type for the function.
 * - FollowUpOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const FollowUpInputSchema = z.object({
  originalConsultation: z.string().describe("A JSON string of the original consultation details, including user input, AI analysis, and the approved treatment plan."),
  followUpData: z.string().describe("A JSON string of the user's latest follow-up data, including symptoms and vital signs."),
});
export type FollowUpInput = z.infer<typeof FollowUpInputSchema>;

const FollowUpOutputSchema = z.object({
  progressSummary: z.string().describe("A concise summary of the user's progress since the last check-in, comparing new data to old data."),
  isImproving: z.boolean().describe("A boolean indicating if the user's condition is generally improving based on the follow-up data."),
  alertDoctor: z.boolean().describe("A boolean that is true if the follow-up data indicates a significant worsening of the condition or a new critical issue that requires the human doctor's immediate attention."),
  recommendation: z.string().describe("A brief recommendation for the user, e.g., 'Continue with the current plan,' 'Your progress is slow, ensure you are following the plan closely,' or 'A new critical issue was detected, your doctor has been notified.'"),
});
export type FollowUpOutput = z.infer<typeof FollowUpOutputSchema>;


export async function conductFollowUp(input: FollowUpInput): Promise<FollowUpOutput> {
  return followUpFlow(input);
}

const prompt = ai.definePrompt({
  name: 'followUpPrompt',
  input: { schema: FollowUpInputSchema },
  output: { schema: FollowUpOutputSchema },
  prompt: `You are an AI medical assistant from Lifeline AI responsible for patient follow-up.
Your task is to analyze a user's new health data in the context of their existing treatment plan and initial diagnosis.

Original Consultation Data:
{{{originalConsultation}}}

User's New Follow-Up Data:
{{{followUpData}}}

**Analysis Instructions:**
1.  **Compare Data:** Compare the new follow-up data with the original consultation data. Look for trends. Are vitals stabilizing, improving, or worsening? Are symptoms subsiding?
2.  **Assess Progress:** Based on the comparison, write a brief 'progressSummary'.
3.  **Determine Improvement:** Set the 'isImproving' boolean. 'true' if there's clear positive progress, 'false' otherwise.
4.  **Identify Red Flags:** This is critical. Scrutinize the new data for any signs of significant decline or new, alarming symptoms (e.g., a sharp rise in blood pressure, chest pain, difficulty breathing). If you find any such red flags, set 'alertDoctor' to 'true'. Otherwise, set it to 'false'.
5.  **Formulate Recommendation:** Based on your analysis, provide a short 'recommendation' for the user. If 'alertDoctor' is true, the recommendation must state that their doctor has been notified.

Provide the response in the required JSON format.`,
});

const followUpFlow = ai.defineFlow(
  {
    name: 'followUpFlow',
    inputSchema: FollowUpInputSchema,
    outputSchema: FollowUpOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid follow-up analysis.");
    }
    return output;
  }
);
