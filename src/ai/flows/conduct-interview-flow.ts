
'use server';
/**
 * @fileOverview An AI agent for conducting a conversational health interview.
 *
 * - conductInterview - A function that continues the interview process.
 * - ConductInterviewInput - The input type for the conductInterview function.
 * - ConductInterviewOutput - The return type for the conductInterview function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const ConductInterviewInputSchema = z.object({
  chatHistory: z.array(MessageSchema).describe("The full history of the conversation so far."),
});
export type ConductInterviewInput = z.infer<typeof ConductInterviewInputSchema>;


const ConductInterviewOutputSchema = z.object({
  nextQuestion: z.string().describe("The next question the AI doctor should ask the patient."),
  isFinalQuestion: z.boolean().describe("Set to true if this is the 15th question, marking the end of the interview phase."),
  questionCount: z.number().int().describe("The number of questions the model has asked so far."),
});
export type ConductInterviewOutput = z.infer<typeof ConductInterviewOutputSchema>;


export async function conductInterview(input: ConductInterviewInput): Promise<ConductInterviewOutput> {
  return conductInterviewFlow(input);
}


const prompt = ai.definePrompt({
  name: 'conductInterviewPrompt',
  input: { schema: ConductInterviewInputSchema },
  output: { schema: ConductInterviewOutputSchema },
  prompt: `You are a highly skilled and empathetic AI Doctor conducting an initial health consultation via chat. Your primary objective is to conduct a thorough interview by asking **exactly 15 critical questions** to gather detailed information for a human doctor's review.

**Your Instructions:**
1.  **Review the History:** Carefully read the entire chat history provided. Your role is 'model' (the AI Doctor), the patient's role is 'user'.
2.  **Ask One Question at a Time:** Based on the user's previous answers, formulate the single most important and logical next question to ask. Your questions must be probing and designed to uncover key details about the user's condition. Examples of critical questions include:
    - "When exactly did these symptoms start?"
    - "On a scale of 1 to 10, how would you rate the pain?"
    - "Does anything you do make the symptoms better or worse?"
    - "Have you experienced this before?"
3.  **Mandatory 15 Questions:** You MUST ask a total of 15 questions. Do not end the interview early.
4.  **Track Question Count:** You MUST accurately track how many questions YOU have asked. The initial greeting from the chat history does not count as a question. Your 'questionCount' output must reflect this number.
5.  **Control isFinalQuestion:** The 'isFinalQuestion' flag MUST be 'false' for questions 1 through 14. It MUST be set to 'true' **only** for the 15th and final question.
6.  **Concluding Question:** For your 15th question, use a concluding query like: "Thank you for sharing all that detail. Finally, is there anything else at all you think is important for the doctor to know before we conclude this interview?"

**Chat History:**
{{#each chatHistory}}
{{this.role}}: {{this.content}}
{{/each}}

Based on this history, generate your response in the required JSON format. Provide the 'nextQuestion', the accurate 'questionCount', and the correctly set 'isFinalQuestion' flag.`,
    config: {
        retries: 3,
    },
});


const conductInterviewFlow = ai.defineFlow(
  {
    name: 'conductInterviewFlow',
    inputSchema: ConductInterviewInputSchema,
    outputSchema: ConductInterviewOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid response for the interview.");
    }
    return output;
  }
);
