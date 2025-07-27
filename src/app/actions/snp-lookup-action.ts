
'use server';

import { z } from 'zod';
import { Readable } from 'stream';

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

async function parseVcfStream(file: File): Promise<string[]> {
    const ids: string[] = [];
    const BATCH_SIZE = 100; // Limit to processing the first 100 variants
    // @ts-ignore
    const fileStream = Readable.from(file.stream());
    let remaining = '';

    for await (const chunk of fileStream) {
        if (ids.length >= BATCH_SIZE) break;

        remaining += chunk.toString();
        let lastNewline = remaining.lastIndexOf('\n');
        
        if (lastNewline === -1) continue;

        const lines = remaining.substring(0, lastNewline).split('\n');
        remaining = remaining.substring(lastNewline + 1);
        
        for (const line of lines) {
            if (ids.length >= BATCH_SIZE) break;
            if (line.startsWith('#') || line.trim() === '') continue;
            
            const fields = line.split('\t');
            if (fields.length >= 3) {
                const rsid = fields[2];
                if (rsid && rsid.startsWith('rs')) {
                    ids.push(rsid);
                }
            }
        }
    }
    // Process any remaining data after the last newline if we haven't hit the batch size
    if (ids.length < BATCH_SIZE && remaining.trim() !== '' && !remaining.startsWith('#')) {
        const fields = remaining.split('\t');
        if (fields.length >= 3 && fields[2] && fields[2].startsWith('rs')) {
            ids.push(fields[2]);
        }
    }
    return ids;
}


// This function is now also exported to be used by the validation tool
export async function lookupSnp(identifier: string): Promise<SnpLookupResult[]> {
    const results: SnpLookupResult[] = [];
    const data = await fetchVariantConsequences(identifier);

    if (data && data.length > 0) {
        for (const variantData of data) {
            const transcriptConsequences = variantData.transcript_consequences || [];
            
            // Find the most severe consequence or the first one with protein impact
            const mostSevere = transcriptConsequences.find((c: any) => c.impact === 'HIGH' || c.impact === 'MODERATE' || c.amino_acids) || transcriptConsequences[0];
            
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
                const clinvarEntry = variantData.colocated_variants.find((v: any) => v.clin_sig);
                if (clinvarEntry) {
                    clinicalSignificance = clinvarEntry.clin_sig.join(', '); // Join if multiple exist
                }
            }

            results.push({
                id: variantData.id,
                most_severe_consequence: variantData.most_severe_consequence,
                gene: mostSevere?.gene_symbol,
                clinical_significance: clinicalSignificance,
                aminoAcidChange: aminoAcidChange,
                codonChange: mostSevere?.codons,
                transcriptId: mostSevere?.transcript_id,
            });
        }
    }
    return results;
}


export async function performSnpLookup(formData: FormData): Promise<SnpLookupResult[]> {
    const type = formData.get('type') as 'rsid' | 'position' | 'file';
    
    let identifiers: string[] = [];

    if (type === 'rsid') {
        const data = JSON.parse(formData.get('data') as string);
        const parsed = rsidSchema.safeParse(data);
        if (!parsed.success) throw new Error("Invalid rsID format.");
        identifiers.push(parsed.data.rsid);
    } else if (type === 'position') {
        const data = JSON.parse(formData.get('data') as string);
        const parsed = positionSchema.safeParse(data);
        if (!parsed.success) throw new Error("Invalid position format.");
        // Format for Ensembl VEP lookup by position
        const identifier = `${parsed.data.chromosome}:${parsed.data.position}-${parsed.data.position}/${parsed.data.allele}`;
        identifiers.push(identifier);
    } else if (type === 'file') {
        const file = formData.get('file') as File;
        if (!file) throw new Error("No file provided.");
        
        identifiers = await parseVcfStream(file);

        if (identifiers.length === 0) {
             throw new Error("No valid rsIDs found in the first 100 variants of the file. Please ensure it's a valid VCF with rsIDs in the 3rd column.");
        }
    } else {
        throw new Error("Invalid lookup type.");
    }
    
    // Process all identifiers found (up to the batch limit for files)
    // Using Promise.all to run API calls in parallel for performance.
    const allPromises = identifiers.map(id => lookupSnp(id));
    const allResultsNested = await Promise.all(allPromises);
    const allResults = allResultsNested.flat();

    return allResults;
}

