'use server';
/**
 * @fileOverview An AI agent for extracting structured health data from images.
 *
 * - extractDataFromImage - A function that handles the data extraction process.
 * - ExtractDataFromImageInput - The input type for the function.
 * - ExtractDataFromImageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ExtractDataFromImageInputSchema = z.object({
    imageDataUri: z.string().describe("An image of a medical device display (e.g., blood pressure monitor, glucometer) or a test strip as a data URI. Must include a MIME type and use Base64 encoding."),
    userPrompt: z.string().optional().describe("An optional hint from the user about what the image contains, e.g., 'This is my blood pressure reading' or 'urine test strip for ketones'."),
});
export type ExtractDataFromImageInput = z.infer<typeof ExtractDataFromImageInputSchema>;

const ExtractedVitalsSchema = z.object({
    systolic: z.string().optional().describe("Systolic blood pressure in mmHg."),
    diastolic: z.string().optional().describe("Diastolic blood pressure in mmHg."),
    bloodSugar: z.string().optional().describe("Blood sugar level in mg/dL."),
    oxygenSaturation: z.string().optional().describe("Oxygen saturation percentage."),
    temperature: z.string().optional().describe("Body temperature in Fahrenheit."),
    weight: z.string().optional().describe("Body weight in pounds (lbs)."),
});

const ExtractedTestStripSchema = z.object({
    protein: z.string().optional().describe("Urine protein level (e.g., Negative, Trace, +, ++, +++)."),
    glucose: z.string().optional().describe("Urine glucose level (e.g., Negative, Trace, +, ++, +++)."),
    ketones: z.string().optional().describe("Urine ketones level (e.g., Negative, Trace, +, ++, +++)."),
    blood: z.string().optional().describe("Urine blood level (e.g., Negative, Trace, +, ++, +++)."),
    nitrite: z.string().optional().describe("Urine nitrite level (e.g., Negative, Trace)."),
    ph: z.string().optional().describe("Urine pH level (e.g., 5.0, 6.0, 7.0)."),
});

const ExtractDataFromImageOutputSchema = z.object({
    extractedVitals: ExtractedVitalsSchema.optional().describe("Structured data extracted for vital signs. Only populate if vitals are found."),
    extractedTestStrip: ExtractedTestStripSchema.optional().describe("Structured data extracted from a urine test strip. Only populate if test strip results are found."),
    analysisSummary: z.string().describe("A brief, human-readable summary of what was found in the image, for user confirmation. e.g., 'Found a blood pressure reading of 125/85 mmHg.' or 'Detected Glucose at ++ and Ketones as Trace.'"),
    isConfident: z.boolean().describe("Set to true if you are highly confident in the extracted values. If the image is blurry, ambiguous, or doesn't seem to contain medical data, set this to false."),
});
export type ExtractDataFromImageOutput = z.infer<typeof ExtractDataFromImageOutputSchema>;

export async function extractDataFromImage(input: ExtractDataFromImageInput): Promise<ExtractDataFromImageOutput> {
  return extractDataFromImageFlow(input);
}

const extractDataPrompt = ai.definePrompt({
    name: 'extractDataFromImagePrompt',
    input: { schema: ExtractDataFromImageInputSchema },
    output: { schema: ExtractDataFromImageOutputSchema },
    prompt: `You are an expert AI at reading and interpreting images of medical device screens and test strips. Your task is to analyze the provided image and extract any relevant health data into a structured format. The user will upload an image of a single device or test strip at a time.

User context: "{{userPrompt}}"
Image to analyze: {{media url=imageDataUri}}

**Instructions:**
1.  **Identify the Image Content:** First, determine if the image shows a medical device (like a blood pressure monitor, glucometer, thermometer) or a urine test strip.
2.  **Extract Relevant Data Only:** Based on your identification, extract the corresponding data.
    *   If it is a **medical device**, populate the relevant fields in the 'extractedVitals' object ONLY. Leave 'extractedTestStrip' completely empty.
    *   If it is a **urine test strip**, populate the relevant fields in the 'extractedTestStrip' object ONLY. Leave 'extractedVitals' completely empty.
3.  **Be Precise:** Extract only the data you can clearly see. Do not invent or guess values. If a specific value isn't present, leave its field empty.
4.  **Create Summary:** Write a very short 'analysisSummary' confirming what you found, e.g., "Extracted blood pressure: 120/80 mmHg." or "Detected trace ketones."
5.  **Assess Confidence:** If the image is blurry, cut off, or you cannot reliably read the values, set 'isConfident' to 'false'. Otherwise, set it to 'true'.
6.  **CRITICAL RULE:** You MUST populate EITHER the 'extractedVitals' object OR the 'extractedTestStrip' object, never both. Your response should only contain data for the single type of item you identified in the image.`,
});

const extractDataFromImageFlow = ai.defineFlow(
  {
    name: 'extractDataFromImageFlow',
    inputSchema: ExtractDataFromImageInputSchema,
    outputSchema: ExtractDataFromImageOutputSchema,
  },
  async (input) => {
    const { output } = await extractDataPrompt(input);
    if (!output) {
        throw new Error("The AI model did not return a valid data extraction.");
    }
    return output;
  }
);
