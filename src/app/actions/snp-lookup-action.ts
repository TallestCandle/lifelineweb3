
'use server';

import { z } from 'zod';

const ENSEMBL_API_URL = "https://rest.ensembl.org";

export interface SnpLookupResult {
    id: string;
    most_severe_consequence: string;
    gene?: string;
    transcriptId?: string;
}

const rsidSchema = z.object({
  rsid: z.string().regex(/^rs\d+$/),
});

const positionSchema = z.object({
  chromosome: z.string(),
  position: z.string(),
  allele: z.string(),
});

// Fetches annotations for a single variant from Ensembl
async function fetchVariantConsequences(identifier: string, species: string = 'human'): Promise<any[]> {
    try {
        const response = await fetch(`${ENSEMBL_API_URL}/vep/${species}/id/${identifier}`, {
            headers: { 'Content-Type': 'application/json' },
            next: { revalidate: 3600 } // Cache for 1 hour
        });
        if (!response.ok) {
            if(response.status === 404 || response.status === 400) {
                console.warn(`Variant ${identifier} not found in Ensembl.`);
                return [];
            }
            throw new Error(`Ensembl API error: ${response.statusText}`);
        }
        return response.json();
    } catch (error) {
        console.error(`Error fetching data for ${identifier}:`, error);
        throw error;
    }
}


// This function is now also exported to be used by the validation tool
export async function lookupSnp(identifier: string): Promise<SnpLookupResult[]> {
    const results: SnpLookupResult[] = [];
    const data = await fetchVariantConsequences(identifier);

    if (data && data.length > 0) {
        // Ensembl VEP can return multiple entries for one ID if it maps to multiple locations.
        // We iterate through each of them.
        for (const variantData of data) {
            const transcriptConsequences = variantData.transcript_consequences || [];
            
            // Find the first transcript that matches the most severe consequence
            const mostSevereConsequence = variantData.most_severe_consequence;
            const primaryConsequence = transcriptConsequences.find((tc: any) => 
                tc.consequence_terms.includes(mostSevereConsequence)
            );

            if (primaryConsequence) {
                 results.push({
                    id: variantData.id,
                    most_severe_consequence: primaryConsequence.consequence_terms.join(', '),
                    gene: primaryConsequence?.gene_symbol,
                    transcriptId: primaryConsequence?.transcript_id,
                });
            } else if (mostSevereConsequence) {
                 // Fallback if no specific transcript matches, but a consequence is listed
                 results.push({
                    id: variantData.id,
                    most_severe_consequence: mostSevereConsequence,
                });
            }
        }
    }
    return results;
}


export async function performSnpLookup(formData: FormData): Promise<SnpLookupResult[]> {
    const type = formData.get('type') as 'rsid' | 'position';
    const dataString = formData.get('data') as string;
    if (!dataString) throw new Error("No data provided for lookup.");
    
    let identifiers: string[] = [];
    const parsedData = JSON.parse(dataString);

    if (type === 'rsid') {
        const validatedData = z.array(rsidSchema).parse(parsedData);
        identifiers = validatedData.map(d => d.rsid);
    } else if (type === 'position') {
        const validatedData = positionSchema.parse(parsedData[0]);
        const identifier = `${validatedData.chromosome}:${validatedData.position}/${validatedData.allele}`;
        identifiers.push(identifier);
    } else {
        throw new Error("Invalid lookup type.");
    }
    
    const allPromises = identifiers.map(id => lookupSnp(id));
    const allResultsNested = await Promise.all(allPromises);
    const allResults = allResultsNested.flat();

    return allResults;
}

    
