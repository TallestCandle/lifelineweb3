
'use server';

import { z } from 'zod';

const ENSEMBL_API_URL = "https://rest.ensembl.org";

// Map for 1-letter to 3-letter amino acid codes
const aminoAcidMap: { [key: string]: string } = {
    'A': 'Ala', 'R': 'Arg', 'N': 'Asn', 'D': 'Asp', 'C': 'Cys',
    'Q': 'Gln', 'E': 'Glu', 'G': 'Gly', 'H': 'His', 'I': 'Ile',
    'L': 'Leu', 'K': 'Lys', 'M': 'Met', 'F': 'Phe', 'P': 'Pro',
    'S': 'Ser', 'T': 'Thr', 'W': 'Trp', 'Y': 'Tyr', 'V': 'Val',
    '*': 'Ter' // For termination codon
};

export interface SnpLookupResult {
    id: string;
    most_severe_consequence: string;
    gene?: string;
    clinical_significance?: string;
    aminoAcidChange?: string;
    codonChange?: string;
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
        const response = await fetch(`${ENSEMBL_API_URL}/vep/${species}/id/${identifier}?clinvar=1`, {
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
            if (transcriptConsequences.length > 0) {
                 // Often, one SNP has consequences on multiple transcripts. We list them all.
                 for (const mostSevere of transcriptConsequences) {
                    let aminoAcidChange: string | undefined = undefined;
                    if (mostSevere?.protein_start && mostSevere?.amino_acids) {
                        const [ref, alt] = mostSevere.amino_acids.split('/');
                        const ref_3_letter = aminoAcidMap[ref] || ref;
                        const alt_3_letter = aminoAcidMap[alt] || alt;
                        aminoAcidChange = `${ref_3_letter}${mostSevere.protein_start}${alt_3_letter}`;
                    }
        
                    // Find clinical significance from colocated variants
                    let clinicalSignificance: string | undefined = variantData.clinical_significance?.[0];
                    if (!clinicalSignificance && variantData.colocated_variants) {
                        const clinvarEntry = variantData.colocated_variants.find((v: any) => v.clin_sig && v.id === variantData.id);
                        if (clinvarEntry) {
                            clinicalSignificance = clinvarEntry.clin_sig.join(', '); // Join if multiple exist
                        }
                    }
        
                    results.push({
                        id: variantData.id,
                        most_severe_consequence: mostSevere.consequence_terms.join(', '),
                        gene: mostSevere?.gene_symbol,
                        clinical_significance: clinicalSignificance,
                        aminoAcidChange: aminoAcidChange,
                        codonChange: mostSevere?.codons,
                        transcriptId: mostSevere?.transcript_id,
                    });
                 }
            } else {
                 // Case where there are no transcript consequences but there might be other data
                 results.push({
                    id: variantData.id,
                    most_severe_consequence: variantData.most_severe_consequence,
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
        // For now, position lookup is one at a time from the UI
        const validatedData = positionSchema.parse(parsedData[0]);
        // Format for Ensembl VEP lookup by position
        const identifier = `${validatedData.chromosome}:${validatedData.position}/${validatedData.allele}`;
        identifiers.push(identifier);
    } else {
        throw new Error("Invalid lookup type.");
    }
    
    // Process all identifiers found
    // Using Promise.all to run API calls in parallel for performance.
    const allPromises = identifiers.map(id => lookupSnp(id));
    const allResultsNested = await Promise.all(allPromises);
    const allResults = allResultsNested.flat();

    return allResults;
}

    