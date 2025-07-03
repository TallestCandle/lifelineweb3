
'use server';
/**
 * @fileOverview An AI agent for continuing a health investigation with new lab results.
 *
 * - continueInvestigation - Orchestrates AI analysis of new lab results and provides a deeper insight.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, updateDoc } from 'firebase/firestore';

const LabResultInputSchema = z.object({
    testName: z.string(),
    imageDataUri: z.string().describe("The lab result image as a data URI."),
});

// Public-facing Zod schema for the data submitted from the client.
const ContinueInvestigationClientInputSchema = z.object({
    userId: z.string(),
    investigationId: z.string(),
    labResults: z.array(LabResultInputSchema),
});
export type ContinueInvestigationClientInput = z.infer<typeof ContinueInvestigationClientInputSchema>;

// Internal Zod schema for the full data required by the AI prompt.
const ContinueInvestigationInputSchema = z.object({
  investigationContext: z.string().describe("The full context of the investigation so far, including the initial chat, AI analysis, and doctor's plan."),
  labResults: z.array(LabResultInputSchema).describe("An array of the new lab results, including the test name and an image of the result."),
});
export type ContinueInvestigationInput = z.infer<typeof ContinueInvestigationInputSchema>;

// Internal Zod schema for the AI's structured output.
const ContinueInvestigationOutputSchema = z.object({
    refinedAnalysis: z.string().describe("A new, deeper analysis summary for the doctor, incorporating the new lab results. Explain how the results confirm or change the initial assessment."),
    finalDiagnosis: z.array(z.object({
        condition: z.string().describe("The name of the most likely diagnosis based on all available data."),
        probability: z.number().int().min(0).max(100).describe("The estimated probability of this diagnosis (0-100)."),
        reasoning: z.string().describe("A final, conclusive reasoning for the diagnosis, citing evidence from the chat, history, and new lab results."),
    })).describe("A list of final diagnoses with their likelihood and reasoning."),
    finalTreatmentPlan: z.object({
        medications: z.array(z.string()).describe("A list of specific, prescribed medications with dosage and frequency."),
        lifestyleChanges: z.array(z.string()).describe("A list of recommended lifestyle modifications."),
    }).describe("A definitive, comprehensive treatment plan for the human doctor's final review and approval."),
    justification: z.string().describe("A clear rationale for why this final treatment plan was chosen."),
});
export type ContinueInvestigationOutput = z.infer<typeof ContinueInvestigationOutputSchema>;


/**
 * The main public-facing function that orchestrates the follow-up analysis.
 */
export async function continueInvestigation(input: ContinueInvestigationClientInput): Promise<{ success: boolean }> {
    const { investigationId, labResults, userId } = input;

    // Step 1: Fetch the existing investigation context.
    const investigationDocRef = doc(db, 'investigations', investigationId);
    const investigationSnap = await getDoc(investigationDocRef);
    if (!investigationSnap.exists() || investigationSnap.data().userId !== userId) {
        throw new Error("Investigation not found or access denied.");
    }
    const investigationContext = JSON.stringify(investigationSnap.data());

    // Step 2: Prepare the full input for the internal AI analysis flow.
    const aiFlowInput: ContinueInvestigationInput = {
        investigationContext,
        labResults,
    };

    // Step 3: Call the internal AI flow to get the new, deeper analysis.
    const aiResponse = await continueInvestigationFlow(aiFlowInput);

    // Step 4: Append this new step to the investigation and update the status.
    const currentSteps = investigationSnap.data().steps || [];
    const updatedInvestigation = {
        status: 'pending_final_review' as const,
        steps: [...currentSteps, {
            type: 'lab_result_submission' as const,
            timestamp: new Date().toISOString(),
            userInput: { labResults },
            aiAnalysis: aiResponse,
        }],
    };
    
    await updateDoc(investigationDocRef, updatedInvestigation);
    
    return { success: true };
}

// Internal Genkit prompt.
const continueInvestigationPrompt = ai.definePrompt({
  name: 'continueInvestigationPrompt',
  input: { schema: ContinueInvestigationInputSchema },
  output: { schema: ContinueInvestigationOutputSchema },
  prompt: `You are a world-class AI diagnostician. You have previously conducted an initial analysis and requested lab tests. Now, the patient has returned with the results. Your task is to perform a DEEP and definitive analysis.

**Full Investigation Context (Initial chat, analysis, doctor's plan, etc.):**
{{{investigationContext}}}

**Newly Submitted Lab Results:**
{{#each labResults}}
- **Test:** {{this.testName}}
- **Result Image:** {{media url=this.imageDataUri}}
{{/each}}

**Your Task:**
1.  **Analyze Lab Results:** Meticulously analyze the images of the lab results. Correlate the findings with the initial chat transcript and patient history provided in the context.
2.  **Refine Analysis:** Write a 'refinedAnalysis' that explains how these lab results confirm, deny, or modify your initial hypotheses. This is for the human doctor.
3.  **Final Diagnosis:** Based on ALL evidence, provide a 'finalDiagnosis' with a high degree of confidence. State the condition, probability, and a conclusive 'reasoning'.
4.  **Final Treatment Plan:** Now that you have lab data, propose a definitive 'finalTreatmentPlan' including specific 'medications' and 'lifestyleChanges'.
5.  **Justification:** Provide a 'justification' for your final plan.

Your entire output must be in the specified JSON format. This is the final analytical step before the doctor's sign-off. Be precise and confident.`,
});

// Internal Genkit flow.
const continueInvestigationFlow = ai.defineFlow(
  {
    name: 'continueInvestigationFlow',
    inputSchema: ContinueInvestigationInputSchema,
    outputSchema: ContinueInvestigationOutputSchema,
  },
  async (input) => {
    const { output } = await continueInvestigationPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid follow-up analysis.");
    }
    return output;
  }
);
