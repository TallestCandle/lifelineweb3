
'use server';
/**
 * @fileOverview An AI agent for summarizing a health consultation chat and saving the case.
 *
 * - submitNewConsultation - Orchestrates AI analysis of a chat and saves the case for a doctor.
 * - InitiateConsultationInput - The input type for the internal AI analysis.
 * - InitiateConsultationOutput - The return type for the internal AI analysis.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, addDoc, orderBy, limit } from 'firebase/firestore';


// Internal Zod schema for the full data required by the AI prompt.
const InitiateConsultationInputSchema = z.object({
  chatTranscript: z.string().describe("The complete transcript of the conversation between the AI Doctor and the patient."),
  vitalsHistory: z.string().describe("A JSON string representing an array of the user's historical vital signs readings."),
  testStripHistory: z.string().describe("A JSON string representing an array of the user's historical urine test strip results."),
  previousAnalyses: z.string().describe("A JSON string representing an array of the user's previous AI analysis results."),
  imageDataUri: z.string().optional().describe("An optional image of a health concern (e.g., a skin issue, test strip) as a data URI."),
});
export type InitiateConsultationInput = z.infer<typeof InitiateConsultationInputSchema>;


// Internal Zod schema for the AI's structured output.
const InitiateConsultationOutputSchema = z.object({
  analysisSummary: z.string().describe("A concise summary of the case for a human doctor to review. It should synthesize all inputs, including the chat transcript and historical data."),
  potentialConditions: z.array(z.object({
    condition: z.string().describe("The name of the potential health condition."),
    probability: z.number().int().min(0).max(100).describe("The estimated probability of this condition (0-100)."),
    reasoning: z.string().describe("A brief explanation of why this condition is considered, based on the chat transcript and historical data trends."),
  })).describe("A list of potential health conditions with their likelihood and reasoning, derived from a holistic view of the user's health."),
  suggestedTreatmentPlan: z.object({
    medications: z.array(z.string()).describe("A list of suggested medications, including dosage and frequency. This is a mandatory field."),
    lifestyleChanges: z.array(z.string()).describe("A list of recommended lifestyle modifications."),
    furtherTests: z.array(z.string()).describe("A list of suggested further diagnostic tests, if necessary, based on the comprehensive analysis."),
  }).describe("A comprehensive but cautious treatment plan suggested for the human doctor's review. You MUST suggest at least one medication."),
  justification: z.string().describe("A clear rationale for why the suggested treatment plan was chosen, correlating information from the chat with patterns from the user's health history."),
  urgency: z.enum(['Low', 'Medium', 'High', 'Critical']).describe("The urgency level for the doctor's review, considering both acute symptoms from the chat and chronic trends."),
  followUpPlan: z.string().describe("A proposed plan for user follow-up (e.g., 'Request vital signs update in 3 days.')."),
});
export type InitiateConsultationOutput = z.infer<typeof InitiateConsultationOutputSchema>;


// Public-facing Zod schema for the data submitted from the client.
const SubmitConsultationClientInputSchema = z.object({
    userId: z.string(),
    userName: z.string(),
    chatTranscript: z.string(),
    imageDataUri: z.string().optional(),
});
export type SubmitConsultationClientInput = z.infer<typeof SubmitConsultationClientInputSchema>;


/**
 * The main public-facing function that orchestrates the entire consultation submission process.
 * It fetches data, runs AI analysis, and saves the results for a doctor to review.
 */
export async function submitNewConsultation(input: SubmitConsultationClientInput): Promise<{ success: boolean, consultationId: string }> {
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
    const aiFlowInput: InitiateConsultationInput = {
        chatTranscript,
        vitalsHistory,
        testStripHistory,
        previousAnalyses,
        imageDataUri: imageDataUri || undefined,
    };

    // Step 3: Call the internal AI flow to get the analysis.
    const aiResponse = await initiateConsultationFlow(aiFlowInput);

    // Step 4: Save the complete consultation case to the central 'consultations' collection for doctors.
    const userInputData: { chatTranscript: string, imageDataUri?: string } = { chatTranscript };
    if (imageDataUri) {
        userInputData.imageDataUri = imageDataUri;
    }

    const newConsultation = {
        userId,
        userName,
        status: 'pending_review' as const,
        createdAt: new Date().toISOString(),
        userInput: userInputData,
        aiAnalysis: aiResponse,
    };
    
    const docRef = await addDoc(collection(db, "consultations"), newConsultation);
    
    return { success: true, consultationId: docRef.id };
}


// Internal Genkit prompt. This is not exported.
const initiateConsultationPrompt = ai.definePrompt({
  name: 'summarizeConsultationPrompt', // Renamed for clarity
  input: { schema: InitiateConsultationInputSchema },
  output: { schema: InitiateConsultationOutputSchema },
  prompt: `You are a highly intelligent AI diagnostic doctor. Your role is to analyze a completed patient interview and their health history to prepare a comprehensive case file for review by a human doctor. **You are an assistant to the human doctor.**

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
Based on ALL the provided information (the interview, the image, and the full history), generate a complete case file in the required JSON format.

**JSON Output Instructions:**
1.  **analysisSummary:** Write a 'analysisSummary' that synthesizes all inputs into a clear overview for a human doctor.
2.  **potentialConditions:** Identify 'potentialConditions' with 'probability' and 'reasoning' that explicitly links to both the interview and historical data.
3.  **suggestedTreatmentPlan:** Create a comprehensive 'suggestedTreatmentPlan'. You MUST include suggestions in the 'medications' array. This is not optional.
4.  **justification:** Write a clear 'justification' for your suggested plan.
5.  **urgency:** Assign an 'urgency' level ('Low', 'Medium', 'High', 'Critical').
6.  **followUpPlan:** Propose a 'followUpPlan'.

Your entire output must be in the specified JSON format. Be thorough, logical, and safe.`,
});

// Internal Genkit flow. This is not exported.
const initiateConsultationFlow = ai.defineFlow(
  {
    name: 'initiateConsultationFlow',
    inputSchema: InitiateConsultationInputSchema,
    outputSchema: InitiateConsultationOutputSchema,
  },
  async (input) => {
    const { output } = await initiateConsultationPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid consultation analysis.");
    }
     // Ensure there's always at least a placeholder medication if AI fails to provide one
    if (!output.suggestedTreatmentPlan.medications || output.suggestedTreatmentPlan.medications.length === 0) {
        output.suggestedTreatmentPlan.medications = ["No specific medication suggested. Review patient history for options."];
    }
    return output;
  }
);
