
'use server';
/**
 * @fileOverview An AI agent for summarizing a health investigation chat and suggesting next steps.
 *
 * - startInvestigation - Orchestrates AI analysis of a chat and saves the case for a doctor.
 * - StartInvestigationInput - The input type for the internal AI analysis.
 * - StartInvestigationOutput - The return type for the internal AI analysis.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, addDoc, orderBy, limit } from 'firebase/firestore';


// Internal Zod schema for the full data required by the AI prompt.
const StartInvestigationInputSchema = z.object({
  chatTranscript: z.string().describe("The complete transcript of the conversation between the AI Doctor and the patient."),
  vitalsHistory: z.string().describe("A JSON string representing an array of the user's historical vital signs readings."),
  testStripHistory: z.string().describe("A JSON string representing an array of the user's historical urine test strip results."),
  previousAnalyses: z.string().describe("A JSON string representing an array of the user's previous AI analysis results."),
  imageDataUri: z.string().optional().describe("An optional image of a health concern (e.g., a skin issue, test strip) as a data URI."),
});
export type StartInvestigationInput = z.infer<typeof StartInvestigationInputSchema>;


// Internal Zod schema for the AI's structured output.
const StartInvestigationOutputSchema = z.object({
  analysisSummary: z.string().describe("A concise summary of the case for a human doctor to review. It should synthesize all inputs, including the chat transcript and historical data."),
  potentialConditions: z.array(z.object({
    condition: z.string().describe("The name of the potential health condition."),
    probability: z.number().int().min(0).max(100).describe("The estimated probability of this condition (0-100)."),
    reasoning: z.string().describe("A brief explanation of why this condition is considered, based on the chat transcript and historical data trends."),
  })).describe("A list of potential health conditions with their likelihood and reasoning, derived from a holistic view of the user's health."),
  suggestedNextSteps: z.object({
    preliminaryMedications: z.array(z.object({
        name: z.string().describe("The name of the suggested medication."),
        dosage: z.string().describe("The suggested dosage plan for the medication (e.g., '1 tablet twice a day for 5 days', '20mg once daily').")
    })).describe("A list of suggested medications ONLY for critical symptom relief (like pain management) while investigation is ongoing. This is NOT a definitive treatment."),
    suggestedLabTests: z.array(z.string()).describe("A list of suggested further diagnostic lab tests required to confirm a diagnosis."),
  }).describe("A comprehensive plan for the next steps in the investigation for the human doctor's review. You MUST suggest at least one lab test if there is any uncertainty."),
  justification: z.string().describe("A clear rationale for why the suggested next steps were chosen, correlating information from the chat with patterns from the user's health history."),
  urgency: z.enum(['Low', 'Medium', 'High', 'Critical']).describe("The urgency level for the doctor's review, considering both acute symptoms from the chat and chronic trends."),
  followUpPlan: z.string().describe("A proposed plan for user follow-up (e.g., 'Request user to upload lab results within 3 days.')."),
});
export type StartInvestigationOutput = z.infer<typeof StartInvestigationOutputSchema>;


// Public-facing Zod schema for the data submitted from the client.
const SubmitInvestigationClientInputSchema = z.object({
    userId: z.string(),
    userName: z.string(),
    chatTranscript: z.string(),
    imageDataUri: z.string().optional(),
});
export type SubmitInvestigationClientInput = z.infer<typeof SubmitInvestigationClientInputSchema>;


/**
 * The main public-facing function that orchestrates the entire investigation submission process.
 * It fetches data, runs AI analysis, and saves the results for a doctor to review.
 */
export async function startInvestigation(input: SubmitInvestigationClientInput): Promise<{ success: boolean, investigationId: string }> {
    const { userId, userName, chatTranscript, imageDataUri } = input;

    // Step 1: Fetch user's historical data from Firestore.
    const basePath = `users/${userId}`;
    const vitalsCol = collection(db, `${basePath}/vitals`);
    const stripsCol = collection(db, `${basePath}/test_strips`);
    const analysesCol = collection(db, `${basePath}/health_analyses`);

    const [vitalsSnap, stripsSnap, analysesSnap] = await Promise.all([
        getDocs(query(vitalsCol, orderBy('date', 'desc'), limit(100))),
        getDocs(query(stripsCol, orderBy('date', 'desc'), limit(100))),
        getDocs(query(analysesCol, orderBy('timestamp', 'desc'), limit(50))),
    ]);
    
    const vitalsHistory = JSON.stringify(vitalsSnap.docs.map(d => d.data()));
    const testStripHistory = JSON.stringify(stripsSnap.docs.map(d => d.data()));
    const previousAnalyses = JSON.stringify(analysesSnap.docs.map(d => d.data().analysisResult));

    // Step 2: Prepare the full input for the internal AI analysis flow.
    const aiFlowInput: StartInvestigationInput = {
        chatTranscript,
        vitalsHistory,
        testStripHistory,
        previousAnalyses,
        imageDataUri: imageDataUri || undefined,
    };

    // Step 3: Call the internal AI flow to get the analysis.
    const aiResponse = await startInvestigationFlow(aiFlowInput);

    // Step 4: Save the complete investigation case to the central 'investigations' collection for doctors.
    const userInputData: { chatTranscript: string, imageDataUri?: string } = { chatTranscript };
    if (imageDataUri) {
        userInputData.imageDataUri = imageDataUri;
    }

    const newInvestigation = {
        userId,
        userName,
        status: 'pending_review' as const,
        createdAt: new Date().toISOString(),
        steps: [{
            type: 'initial_submission' as const,
            timestamp: new Date().toISOString(),
            userInput: userInputData,
            aiAnalysis: aiResponse,
        }],
    };
    
    const docRef = await addDoc(collection(db, "investigations"), newInvestigation);
    
    return { success: true, investigationId: docRef.id };
}


// Internal Genkit prompt. This is not exported.
const startInvestigationPrompt = ai.definePrompt({
  name: 'startInvestigationPrompt',
  input: { schema: StartInvestigationInputSchema },
  output: { schema: StartInvestigationOutputSchema },
  prompt: `You are a highly intelligent AI diagnostic doctor. Your role is to analyze a completed patient interview and their health history to prepare a comprehensive case file and suggest the NEXT STEPS for an investigation. Your primary goal is to help a human doctor diagnose the issue, not to make the final diagnosis yourself.

**CRITICAL RULE: DO NOT PRESCRIBE A FULL TREATMENT PLAN.** Your task is to determine the most logical next steps. Until a diagnosis is confirmed with lab results, you can only suggest medications for critical symptom relief (like pain management or acute symptom reduction). Your main focus should be on suggesting the necessary lab tests to get a definitive answer.

**Analysis Instructions:**
Analyze the user's interview transcript alongside their historical data to identify trends, correlations, and potential root causes.

**Patient Interview Transcript:**
{{{chatTranscript}}}

{{#if imageDataUri}}- An image was provided by the patient: {{media url=imageDataUri}}{{/if}}

**User's Health History (for context):**
- Vitals History: {{{vitalsHistory}}}
- Test Strip History: {{{testStripHistory}}}
- Previous AI Analyses History: {{{previousAnalyses}}}

**Your Task:**
Based on ALL the provided information, generate the initial investigation steps in the required JSON format.

**JSON Output Instructions:**
1.  **analysisSummary:** Write a summary that synthesizes all inputs for a human doctor.
2.  **potentialConditions:** Identify potential conditions with probability and reasoning.
3.  **suggestedNextSteps:** This is the most important field.
    - **suggestedLabTests:** Propose specific lab tests needed to confirm or rule out your potential conditions (e.g., 'Complete Blood Count', 'Liver Function Test', 'Urinalysis'). You MUST suggest at least one test if the diagnosis is not 100% certain.
    - **preliminaryMedications:** Suggest medications ONLY if needed for urgent symptom relief. For each medication, provide a 'name' and a 'dosage' (e.g., name: 'Ibuprofen', dosage: '200mg as needed for pain'). If none are needed, return an empty array.
4.  **justification:** Justify your suggested next steps.
5.  **urgency:** Assign an urgency level ('Low', 'Medium', 'High', 'Critical').
6.  **followUpPlan:** Propose a follow-up plan, e.g., 'Request user to upload lab results in 3 days.'

Your entire output must be in the specified JSON format. Be thorough, logical, and safe.`,
});

// Internal Genkit flow. This is not exported.
const startInvestigationFlow = ai.defineFlow(
  {
    name: 'startInvestigationFlow',
    inputSchema: StartInvestigationInputSchema,
    outputSchema: StartInvestigationOutputSchema,
  },
  async (input) => {
    const { output } = await startInvestigationPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid investigation plan.");
    }
    // Ensure lab tests are suggested if there's any uncertainty
    if (output.potentialConditions.some(c => c.probability < 95) && output.suggestedNextSteps.suggestedLabTests.length === 0) {
        output.suggestedNextSteps.suggestedLabTests.push("General Health Panel (Complete Blood Count, Metabolic Panel)");
    }
    return output;
  }
);
