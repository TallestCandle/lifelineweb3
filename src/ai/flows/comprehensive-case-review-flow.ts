
'use server';
/**
 * @fileOverview An AI agent for performing a final, comprehensive review of an entire investigation case.
 *
 * - performComprehensiveCaseReview - Orchestrates the final AI analysis of a case.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Input from the client
const ComprehensiveCaseReviewClientInputSchema = z.object({
  investigationId: z.string(),
});
export type ComprehensiveCaseReviewClientInput = z.infer<typeof ComprehensiveCaseReviewClientInputSchema>;

// Input for the AI prompt, containing the full case context
const ComprehensiveCaseReviewAIInputSchema = z.object({
  fullInvestigationContext: z.string().describe("The entire investigation case as a JSON string, including all steps, user inputs, and previous AI analyses."),
});

// Output from the AI
const ComprehensiveCaseReviewOutputSchema = z.object({
  holisticSummary: z.string().describe("A final, comprehensive summary synthesizing the entire case from initial complaint to the latest data. This should be a narrative that connects all the dots."),
  finalDiagnosis: z.array(z.object({
    condition: z.string().describe("The name of the most likely health condition."),
    probability: z.number().int().min(0).max(100).describe("The final estimated probability of this diagnosis (0-100)."),
    reasoning: z.string().describe("A conclusive reasoning for the diagnosis, citing evidence from all stages of the investigation."),
  })).describe("The final list of potential diagnoses based on all available data."),
  suggestedTreatmentPlan: z.object({
    medications: z.array(z.string()).describe("A list of suggested medications for a full treatment plan."),
    lifestyleChanges: z.array(z.string()).describe("A list of recommended lifestyle changes or other non-medicinal treatments."),
    followUp: z.string().describe("A recommendation for patient follow-up (e.g., 'Re-evaluate in 3 months', 'No further follow-up required').")
  }).describe("A complete, suggested treatment plan for the doctor to review and approve."),
  isCaseResolvable: z.boolean().describe("Set to true if you believe enough data exists to make a final diagnosis and close the case."),
});
export type ComprehensiveCaseReviewOutput = z.infer<typeof ComprehensiveCaseReviewOutputSchema>;


/**
 * The main public-facing function that orchestrates the comprehensive review.
 */
export async function performComprehensiveCaseReview(input: ComprehensiveCaseReviewClientInput): Promise<ComprehensiveCaseReviewOutput> {
    const { investigationId } = input;

    // Fetch the existing investigation context.
    const investigationDocRef = doc(db, 'investigations', investigationId);
    const investigationSnap = await getDoc(investigationDocRef);
    if (!investigationSnap.exists()) {
        throw new Error("Investigation not found.");
    }
    const fullInvestigationContext = JSON.stringify(investigationSnap.data());

    // Call the internal AI flow.
    const aiResponse = await comprehensiveCaseReviewFlow({ fullInvestigationContext });

    return aiResponse;
}

// Internal Genkit prompt.
const comprehensiveCaseReviewPrompt = ai.definePrompt({
  name: 'comprehensiveCaseReviewPrompt',
  input: { schema: ComprehensiveCaseReviewAIInputSchema },
  output: { schema: ComprehensiveCaseReviewOutputSchema },
  prompt: `You are a world-class AI diagnostician performing a final, holistic review of a completed patient case. You have all the information: the initial interview, the doctor's plan, nurse reports, and lab results. Your task is to synthesize EVERYTHING into a final, conclusive analysis for the doctor.

**Full Investigation Case File (JSON):**
{{{fullInvestigationContext}}}

**Your Task:**
1.  **Read and Synthesize:** Meticulously review the entire case from start to finish. Trace the patient's journey, connect the initial symptoms to the lab results, and consider the doctor's and nurse's inputs.
2.  **Write Holistic Summary:** Create a 'holisticSummary' that tells the full story of the case. It should be a narrative that a doctor can read to quickly understand the entire investigation.
3.  **Propose Final Diagnosis:** Based on all evidence, update the 'finalDiagnosis'. Refine probabilities and provide a conclusive 'reasoning' that cites evidence from all steps.
4.  **Suggest Full Treatment Plan:** This is no longer preliminary. Propose a complete 'suggestedTreatmentPlan', including specific medications, lifestyle advice, and a follow-up schedule.
5.  **Assess Resolvability:** Based on your analysis, determine if the case is now resolvable. Set 'isCaseResolvable' to 'true' if you are confident in the diagnosis and treatment plan, or 'false' if critical information is still missing.

Your entire output must be in the specified JSON format. Your goal is to provide the human doctor with a world-class final report that they can use to confidently close the case.`,
});

// Internal Genkit flow.
const comprehensiveCaseReviewFlow = ai.defineFlow(
  {
    name: 'comprehensiveCaseReviewFlow',
    inputSchema: ComprehensiveCaseReviewAIInputSchema,
    outputSchema: ComprehensiveCaseReviewOutputSchema,
  },
  async (input) => {
    const { output } = await comprehensiveCaseReviewPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid comprehensive case review.");
    }
    return output;
  }
);
