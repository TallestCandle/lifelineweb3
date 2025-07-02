
'use server';
/**
 * @fileOverview An AI agent that generates a world-class, comprehensive monthly health report.
 *
 * - generateMonthlyReport - A function that handles the report generation process.
 * - GenerateMonthlyReportInput - The input type for the function.
 * - GenerateMonthlyReportOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateMonthlyReportInputSchema = z.object({
  name: z.string().describe("The user's name."),
  month: z.string().describe("The month and year for the report (e.g., 'July 2024')."),
  vitalsHistory: z.string().describe("A JSON string of historical vital signs readings for the month."),
  testStripHistory: z.string().describe("A JSON string of historical urine test strip results for the month."),
  analysesHistory: z.string().describe("A JSON string of previous AI analysis results for the month."),
  alertsHistory: z.string().describe("A JSON string of triggered emergency alerts for the month."),
}).describe("A collection of a user's health data for a specific month.");

export type GenerateMonthlyReportInput = z.infer<typeof GenerateMonthlyReportInputSchema>;

const GenerateMonthlyReportOutputSchema = z.object({
  title: z.string().describe("The main title for the report, including the user's name and the month."),
  overallSummary: z.string().describe("A high-level executive summary of the patient's health for the month. Start with a direct statement about the overall health status."),
  vitalsAnalysis: z.object({
    title: z.string().default("Vitals Analysis"),
    content: z.string().describe("Detailed analysis of vital signs trends (Blood Pressure, Blood Sugar, etc.). Note stability, volatility, significant highs or lows, and any concerning patterns observed throughout the month."),
  }),
  testStripAnalysis: z.object({
    title: z.string().default("Urine Test Strip Insights"),
    content: z.string().describe("Analysis of urine test strip results. Explain what the combination of results might indicate. If no data, state that."),
  }),
  trendsAndCorrelations: z.object({
    title: z.string().default("Identified Trends & Correlations"),
    insights: z.array(z.string()).describe("A list of deep, granular, non-obvious insights and correlations discovered from the monthly data. This is the most critical section for showing advanced analysis."),
  }),
  riskAssessment: z.object({
    title: z.string().default("Monthly Risk Assessment"),
    level: z.enum(['Low', 'Medium', 'High', 'Critical']).describe("An overall risk classification for the month based on the data."),
    explanation: z.string().describe("A brief but clear justification for the assigned risk level, referencing specific data points or trends."),
  }),
  recommendations: z.object({
    title: z.string().default("Personalized Recommendations"),
    points: z.array(z.string()).describe("A list of 3-5 actionable, personalized recommendations for the user to focus on in the upcoming month, based directly on this report's findings."),
  }),
});

export type GenerateMonthlyReportOutput = z.infer<typeof GenerateMonthlyReportOutputSchema>;

export async function generateMonthlyReport(input: GenerateMonthlyReportInput): Promise<GenerateMonthlyReportOutput> {
  return generateMonthlyReportFlow(input);
}

const prompt = ai.definePrompt({
    name: 'generateMonthlyReportPrompt',
    input: { schema: GenerateMonthlyReportInputSchema },
    output: { schema: GenerateMonthlyReportOutputSchema },
    prompt: `You are a world-class medical diagnostician AI from Lifeline AI, tasked with creating a comprehensive, in-depth monthly health report for a patient. Your analysis must be extraordinarily sharp, identifying trends and correlations that a human doctor might overlook. The tone should be professional, authoritative, but understandable to a layperson. This is a top-tier, premium analysis.

**Patient Name:** {{name}}
**Reporting Period:** {{month}}

**Source Data (JSON format):**
- Vitals History: {{{vitalsHistory}}}
- Test Strip History: {{{testStripHistory}}}
- Previous AI Analyses History: {{{analysesHistory}}}
- Triggered Alerts History: {{{alertsHistory}}}

**Your Task:**
Generate a structured report based on the provided data. Adhere strictly to the JSON output schema.

**Key Instructions:**
1.  **Title:** Create a professional title for the report.
2.  **Overall Summary:** Write a concise executive summary.
3.  **Vitals Analysis:** Go beyond simple averages. Analyze the trends. Was blood pressure volatile? Did it trend up or down? Were there any specific days with outlier readings?
4.  **Urine Test Strip Insights:** Analyze the results as a whole. Do the markers together point to something? e.g., "The presence of both glucose and ketones in urine on several occasions could suggest issues with glycemic control." If no data is available, state that clearly.
5.  **Trends & Correlations (Crucial):** This is where you demonstrate your advanced capability. Uncover non-obvious patterns. Examples: "A correlation was observed between days with reported high blood pressure and subsequent trace levels of protein in urine." or "Emergency alerts were triggered twice, both within hours of a recorded low oxygen saturation event, indicating a potential link." Be specific. If there are no significant correlations, state that the data appears stable and uncorrelated.
6.  **Risk Assessment:** Assign a risk level ('Low', 'Medium', 'High', 'Critical') and provide a strong justification.
7.  **Personalized Recommendations:** Provide 3-5 clear, actionable recommendations directly tied to your findings in this report. If the 'riskAssessment.level' is 'Medium', 'High', or 'Critical', one of the 'recommendations.points' MUST be to book a consultation with a doctor to discuss the report's findings.

Do not invent data. If a data category (e.g., test strips) is empty, state that in the relevant section of your analysis. Produce the report in the required JSON format.`,
    config: {
        retries: 3,
    },
});

const generateMonthlyReportFlow = ai.defineFlow(
  {
    name: 'generateMonthlyReportFlow',
    inputSchema: GenerateMonthlyReportInputSchema,
    outputSchema: GenerateMonthlyReportOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("The AI model did not return a valid report.");
    }
    return output;
  }
);
