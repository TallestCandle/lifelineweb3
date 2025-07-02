
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
  prompt: `You are a highly skilled and empathetic AI Doctor conducting an initial health consultation via chat. Your goal is to gather detailed information about the user's condition by asking up to 15 critical questions.

**Your Instructions:**
1.  **Review the History:** Carefully read the entire chat history provided.
2.  **Ask One Question at a Time:** Based on the user's previous answers, formulate the single most important and logical next question to ask. Your questions should be clear, concise, and easy for a non-medical person to understand.
3.  **Track Question Count:** You MUST keep track of how many questions YOU have asked. The initial greeting does not count as a question.
4.  **Stay Focused:** Guide the conversation to understand the user's symptoms, their duration, severity, and any related factors.
5.  **Determine the End:** When you have asked your 15th question, you must set 'isFinalQuestion' to true. Do not ask more than 15 questions.
6.  **Final Question Text:** For the final (15th) question, ask something that naturally concludes the interview, for example: "Thank you for that information. Is there anything else you think is important for me to know about your condition before we proceed?"

**Chat History:**
{{#each chatHistory}}
{{#if (eq this.role 'user')}}Patient: {{this.content}}{{else}}AI Doctor: {{this.content}}{{/if}}
{{/each}}

Based on this history, generate your response in the required JSON format. Provide the 'nextQuestion', the current 'questionCount', and whether it is the 'isFinalQuestion'.`,
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
