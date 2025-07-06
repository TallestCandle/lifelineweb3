
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
    pulseRate: z.string().optional().describe("Pulse rate in beats per minute (BPM)."),
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
    otherData: z.record(z.string()).optional().describe("A dictionary for any other metrics found on the device that do not fit into the standard vitals or test strip fields. Use the metric's name as the key and its value as the value. For example, {'Irregular Heartbeat': 'Detected'}. Only include this field if you find such data."),
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
    prompt: `You are an expert AI at reading and interpreting images of medical device screens and test strips. Your task is to analyze the provided image and extract specific health data into a structured format with extreme precision.

User context: "{{userPrompt}}"
Image to analyze: {{media url=imageDataUri}}

**Instructions:**
1.  **Identify Device:** First, determine the single type of device in the image. Is it a Blood Pressure Monitor, Glucometer, Pulse Oximeter, Thermometer, Scale, or a Urine Test Strip?
2.  **Prioritize Structured Fields:** Your primary goal is to accurately populate the \`extractedVitals\` or \`extractedTestStrip\` objects using their predefined fields. Extract ONLY the data relevant to the identified device.
    *   **Blood Pressure Monitor:** Extract 'systolic' and 'diastolic'.
    *   **Pulse Oximeter:** Extract 'oxygenSaturation' and 'pulseRate'.
    *   **Glucometer:** Extract 'bloodSugar'.
    *   **Thermometer:** Extract 'temperature'.
    *   **Scale:** Extract 'weight'.
    *   **Urine Test Strip:** Populate the fields in 'extractedTestStrip'.
3.  **CRITICAL - Handle Unknown Metrics:** If you identify a metric on the device that does NOT have a corresponding field in the structured objects (e.g., an 'Irregular Heartbeat' indicator, 'Body Fat %'), you MUST place this information in the \`otherData\` object. Use the metric's name as the key (e.g., "Irregular Heartbeat") and its reading as the value (e.g., "Detected").
4.  **Data Precision:** NEVER force a value into an incorrect field. If a value doesn't match a predefined field, use \`otherData\`. If a value is unreadable, OMIT it entirely. Do not include fields with empty strings or "N/A".
5.  **Create Summary:** Write a short 'analysisSummary' confirming what you found.
6.  **Assess Confidence:** Set 'isConfident' to 'false' if the image is blurry, poorly lit, or you cannot reliably read the values.
7.  **Mutually Exclusive Output:** For devices measuring vitals, populate ONLY the 'extractedVitals' object (and 'otherData' if needed). For a urine test strip, populate ONLY the 'extractedTestStrip' object (and 'otherData' if needed). NEVER populate both 'extractedVitals' and 'extractedTestStrip' from the same image.`,
    config: {
        temperature: 0,
    },
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
