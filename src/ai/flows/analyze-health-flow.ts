
'use server';
/**
 * @fileOverview An AI agent for analyzing user health data.
 *
 * - analyzeHealth - A function that handles the health analysis process.
 * - AnalyzeHealthInput - The input type for the analyzeHealth function.
 * - AnalyzeHealthOutput - The return type for the analyzeHealth function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Zod schema for the input data. All fields are optional strings.
const AnalyzeHealthInputSchema = z.object({
    systolic: z.string().optional().describe("Systolic blood pressure in mmHg"),
    diastolic: z.string().optional().describe("Diastolic blood pressure in mmHg"),
    bloodSugar: z.string().optional().describe("Blood sugar level in mg/dL"),
    oxygenSaturation: z.string().optional().describe("Oxygen saturation percentage"),
    temperature: z.string().optional().describe("Body temperature in Fahrenheit"),
    weight: z.string().optional().describe("Body weight in pounds (lbs)"),
    protein: z.string().optional().describe("Urine protein level (e.g., Negative, Trace, +, ++, +++)"),
    glucose: z.string().optional().describe("Urine glucose level (e.g., Negative, Trace, +, ++, +++)"),
    ketones: z.string().optional().describe("Urine ketones level (e.g., Negative, Trace, +, ++, +++)"),
    blood: z.string().optional().describe("Urine blood level (e.g., Negative, Trace, +, ++, +++)"),
    nitrite: z.string().optional().describe("Urine nitrite level (e.g., Negative, Trace)"),
    ph: z.string().optional().describe("Urine pH level (e.g., 5.0, 6.0, 7.0)"),
    imageDataUri: z.string().optional().describe("An optional image of a health concern (e.g., a rash, wound, or test strip result) as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
}).describe("A collection of user's health metrics for analysis.");

export type AnalyzeHealthInput = z.infer<typeof AnalyzeHealthInputSchema>;

// Zod schema for the structured output from the AI.
const AnalyzeHealthOutputSchema = z.object({
    summary: z.string().describe("A short, readable summary of the health status based on the provided data. This should be easily understandable for a non-medical user."),
    advice: z.string().describe("Specific, actionable advice for the user based on the health data. Keep it concise and clear."),
    urgency: z.enum(['Good', 'Mild', 'Moderate', 'Critical']).describe("An urgency level classification. 'Good' for no issues, 'Mild' for minor concerns, 'Moderate' for issues that need attention, and 'Critical' for serious red flags requiring immediate action."),
    potentialConditions: z.array(z.object({
        condition: z.string().describe("The name of the potential health condition."),
        probability: z.number().int().min(0).max(100).describe("The estimated probability of this condition, as a percentage (0-100)."),
        explanation: z.string().describe("A brief explanation of why this condition is considered, based on the provided data."),
    })).describe("A list of potential health conditions with their likelihood, based on an analysis of millions of medical data points. This is not a diagnosis."),
});

export type AnalyzeHealthOutput = z.infer<typeof AnalyzeHealthOutputSchema>;

// The wrapper function that client-side code will call.
export async function analyzeHealth(input: AnalyzeHealthInput): Promise<AnalyzeHealthOutput> {
  return analyzeHealthFlow(input);
}

// Define the Genkit prompt with structured input and output.
const analyzeHealthPrompt = ai.definePrompt({
    name: 'analyzeHealthPrompt',
    input: { schema: AnalyzeHealthInputSchema },
    output: { schema: AnalyzeHealthOutputSchema },
    prompt: `You are an advanced AI diagnostic assistant from Lifeline AI. Your purpose is to analyze user-provided health data and cross-reference it with millions of anonymized medical data points to identify potential health conditions. IMPORTANT: You are not providing a medical diagnosis. You are providing a probabilistic analysis for informational purposes to help the user have a more informed conversation with a healthcare professional.

Based on the following health data, perform a comprehensive analysis.

Health Data:
{{#if systolic}}Systolic Blood Pressure: {{systolic}} mmHg{{/if}}
{{#if diastolic}}Diastolic Blood Pressure: {{diastolic}} mmHg{{/if}}
{{#if bloodSugar}}Blood Sugar: {{bloodSugar}} mg/dL{{/if}}
{{#if oxygenSaturation}}Oxygen Saturation: {{oxygenSaturation}}%{{/if}}
{{#if temperature}}Temperature: {{temperature}}°F{{/if}}
{{#if weight}}Weight: {{weight}} lbs{{/if}}
{{#if protein}}Urine Protein: {{protein}}{{/if}}
{{#if glucose}}Urine Glucose: {{glucose}}{{/if}}
{{#if ketones}}Urine Ketones: {{ketones}}{{/if}}
{{#if blood}}Urine Blood: {{blood}}{{/if}}
{{#if nitrite}}Urine Nitrite: {{nitrite}}{{/if}}
{{#if ph}}Urine pH: {{ph}}{{/if}}
{{#if imageDataUri}}Image Analysis: An image has been provided. Analyze it in conjunction with the other data. For example, if it's a skin rash, consider its appearance along with the body temperature. If it's a test strip, correlate its colors with the provided values. {{media url=imageDataUri}}{{/if}}

Please provide a response in the required JSON format with four fields:
1.  'summary': A short, readable summary of the user's overall health status.
2.  'advice': Specific, actionable advice. If the 'urgency' level is 'Moderate' or 'Critical', your 'advice' MUST include a strong recommendation to book an appointment with a doctor for a consultation.
3.  'urgency': The urgency level ('Good', 'Mild', 'Moderate', or 'Critical').
4.  'potentialConditions': An array of potential conditions. For each condition, give a 'condition' name, an estimated 'probability' (as a percentage from 0 to 100), and a brief 'explanation' linking your reasoning to the specific data points provided (e.g., "High probability due to elevated temperature and positive nitrite in urine test").`,
});


// Define the Genkit flow that orchestrates the AI call.
const analyzeHealthFlow = ai.defineFlow(
  {
    name: 'analyzeHealthFlow',
    inputSchema: AnalyzeHealthInputSchema,
    outputSchema: AnalyzeHealthOutputSchema,
  },
  async (input) => {
    const { output } = await analyzeHealthPrompt(input);
    if (!output) {
        throw new Error("The AI model did not return a valid response.");
    }
    return output;
  }
);
