
'use server';
/**
 * @fileOverview An AI agent for continuing a health investigation with new lab results.
 *
 * - continueInvestigation - Orchestrates AI analysis of new lab results and provides a deeper insight.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';

const LabResultInputSchema = z.object({
    testName: z.string(),
    imageDataUri: z.string().describe("The lab result image as a data URI."),
});

const NurseReportInputSchema = z.object({
    text: z.string().optional().describe("A text report from the nurse about the visit."),
    pictures: z.array(z.string()).optional().describe("Data URIs of pictures taken by the nurse."),
    videos: z.array(z.string()).optional().describe("Data URIs of videos taken by the nurse."),
});

// Public-facing Zod schema for the data submitted from the client.
const ContinueInvestigationClientInputSchema = z.object({
    userId: z.string(),
    investigationId: z.string(),
    labResults: z.array(LabResultInputSchema),
    nurseReport: NurseReportInputSchema.optional(),
});
export type ContinueInvestigationClientInput = z.infer<typeof ContinueInvestigationClientInputSchema>;

// Internal Zod schema for the full data required by the AI prompt.
const ContinueInvestigationInputSchema = z.object({
  investigationContext: z.string().describe("The full context of the investigation so far, including the initial chat, AI analysis, and doctor's plan."),
  labResults: z.array(LabResultInputSchema).describe("An array of the new lab results, including the test name and an image of the result."),
  nurseReport: NurseReportInputSchema.optional().describe("An optional report from the nurse including text, and references to submitted pictures or videos."),
});
export type ContinueInvestigationInput = z.infer<typeof ContinueInvestigationInputSchema>;

// Internal Zod schema for the AI's structured output.
const ContinueInvestigationOutputSchema = z.object({
    refinedAnalysis: z.string().describe("A new, deeper analysis summary for the doctor, incorporating the new lab results and nurse's report. Explain how the results confirm or change the initial assessment."),
    potentialConditions: z.array(z.object({
        condition: z.string().describe("The name of the potential health condition, updated with new data."),
        probability: z.number().int().min(0).max(100).describe("The estimated probability of this diagnosis (0-100)."),
        reasoning: z.string().describe("A final, conclusive reasoning for the diagnosis, citing evidence from the chat, history, and new lab/nurse reports."),
    })).describe("An updated list of potential diagnoses based on all available data."),
    suggestedNextSteps: z.object({
        suggestedLabTests: z.array(z.string()).describe("A list of any *additional* lab tests required to confirm a diagnosis. Return an empty array if no more tests are needed."),
        preliminaryMedications: z.array(z.string()).describe("An updated list of suggested medications for symptom relief while investigation is ongoing."),
    }).describe("A plan for the next steps in the investigation. This could be a final treatment plan if no more tests are needed."),
    isFinalDiagnosisPossible: z.boolean().describe("Set to true if you believe enough data exists to make a final diagnosis and treatment plan."),
    justification: z.string().describe("A clear rationale for why these next steps (or no further tests) were chosen."),
    urgency: z.enum(['Low', 'Medium', 'High', 'Critical']).describe("An updated urgency level for the doctor's review."),
});
export type ContinueInvestigationOutput = z.infer<typeof ContinueInvestigationOutputSchema>;


/**
 * The main public-facing function that orchestrates the follow-up analysis.
 */
export async function continueInvestigation(input: ContinueInvestigationClientInput): Promise<{ success: boolean }> {
    const { investigationId, labResults, nurseReport, userId } = input;

    // Step 1: Fetch the existing investigation context.
    const investigationDocRef = doc(db, 'investigations', investigationId);
    const investigationSnap = await getDoc(investigationDocRef);
    if (!investigationSnap.exists() || investigationSnap.data().userId !== userId) {
        throw new Error("Investigation not found or access denied.");
    }
    const investigationData = investigationSnap.data();
    const investigationContext = JSON.stringify(investigationData);

    // Step 2: Prepare the full input for the internal AI analysis flow.
    const aiFlowInput: ContinueInvestigationInput = {
        investigationContext,
        labResults,
        nurseReport,
    };

    // Step 3: Call the internal AI flow to get the new, deeper analysis.
    const aiResponse = await continueInvestigationFlow(aiFlowInput);

    // Step 4: Append this new step to the investigation and update the status.
    const currentSteps = investigationData.steps || [];
    const userInputPayload: any = { labResults };
    if (nurseReport) {
        userInputPayload.nurseReport = nurseReport;
    }
    
    const newStep: any = {
        type: 'lab_result_submission' as const,
        timestamp: new Date().toISOString(),
        userInput: userInputPayload,
        aiAnalysis: aiResponse,
    };

    // If this submission is for a follow-up, embed the doctor's request into the step for a complete record.
    if (investigationData.status === 'awaiting_follow_up_visit' && investigationData.followUpRequest) {
        newStep.doctorRequest = investigationData.followUpRequest;
    }

    const updatedInvestigation = {
        status: 'pending_final_review' as const,
        steps: [...currentSteps, newStep],
    };
    
    await updateDoc(investigationDocRef, updatedInvestigation);

    // Add an automatic message to the chat
    const messageContent = "The patient has uploaded new lab results. They are now awaiting your final review.";
    const messagesCol = collection(db, 'investigations', investigationId, 'messages');
    await addDoc(messagesCol, {
        role: 'doctor',
        content: messageContent,
        timestamp: new Date().toISOString(),
        authorId: 'system',
        authorName: 'Lifeline System',
    });

    await updateDoc(investigationDocRef, {
        lastMessageTimestamp: serverTimestamp(),
        lastMessageContent: "New lab results uploaded."
    });
    
    return { success: true };
}

// Internal Genkit prompt.
const continueInvestigationPrompt = ai.definePrompt({
  name: 'continueInvestigationPrompt',
  input: { schema: ContinueInvestigationInputSchema },
  output: { schema: ContinueInvestigationOutputSchema },
  prompt: `You are a world-class AI diagnostician. An investigation is ongoing. The patient has returned with lab results that were previously requested, and a nurse may have provided an on-site report. Your task is to perform a DEEP analysis and suggest the next logical step.

**Full Investigation Context (Initial chat, analysis, doctor's plan, etc.):**
{{{investigationContext}}}

**Newly Submitted Lab Results:**
{{#each labResults}}
- **Test:** {{this.testName}}
- **Result Image:** {{media url=this.imageDataUri}}
{{/each}}

{{#if nurseReport}}
**Nurse's On-site Visit Report:**
{{#if nurseReport.text}}
- **Observations:** {{nurseReport.text}}
{{/if}}
{{#if nurseReport.pictures}}
- **Note:** The nurse has submitted {{nurseReport.pictures.length}} picture(s) for review.
{{/if}}
{{#if nurseReport.videos}}
- **Note:** The nurse has submitted {{nurseReport.videos.length}} video(s) for review.
{{/if}}
{{/if}}

**Your Task:**
1.  **Analyze All New Data:** Meticulously analyze the images of the lab results AND the nurse's report if available. Correlate the findings with the full investigation history.
2.  **Refine Analysis:** Write a 'refinedAnalysis' that explains how these new results confirm, deny, or modify your previous hypotheses.
3.  **Update Potential Conditions:** Re-evaluate the 'potentialConditions' based on this new evidence. Update probabilities and reasoning.
4.  **Determine Next Step:** Based on ALL information, decide the next logical step.
    - If a diagnosis is now clear and certain, set 'isFinalDiagnosisPossible' to 'true'. The 'suggestedNextSteps.suggestedLabTests' should be an empty array. The 'preliminaryMedications' could now contain a full treatment plan.
    - If uncertainty remains, set 'isFinalDiagnosisPossible' to 'false' and populate 'suggestedNextSteps.suggestedLabTests' with any *additional* tests required.
5.  **Justify:** Provide a clear 'justification' for your decision.
6.  **Urgency:** Re-assess the 'urgency' of the case.

Your entire output must be in the specified JSON format. Your role is to guide the investigation, one step at a time, until a confident conclusion is reached.`,
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
