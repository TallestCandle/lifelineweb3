
/**
 * A curated list of medically relevant Single Nucleotide Polymorphisms (SNPs).
 * This set is used to filter raw genetic data files, ensuring that only SNPs
 * with known and actionable implications are processed and displayed to the user.
 *
 * This list is not exhaustive and should be expanded over time as new research emerges.
 * Sources for this list include PharmGKB, ClinVar, and SNPedia.
 */
export const relevantSnps = new Set([
  // Pharmacogenomics (Drug Response)
  'rs4680',   // COMT: Pain sensitivity, response to some medications
  'rs1057910', // CYP2C9: Warfarin, phenytoin metabolism
  'rs4244285', // CYP2C19: Clopidogrel (Plavix), antidepressant metabolism
  'rs3892097', // CYP2D6: Codeine, tamoxifen, antidepressant metabolism
  'rs776746',  // CYP3A5: Tacrolimus (immunosuppressant) metabolism
  'rs1142345', // TPMT: Azathioprine, 6-mercaptopurine toxicity risk
  'rs1801133', // MTHFR: Folate metabolism, methotrexate response
  'rs1801131', // MTHFR (A1298C)
  'rs116855232',// DPYD: Fluoropyrimidine toxicity (e.g., 5-FU)
  'rs12248560',// UGT1A1: Irinotecan toxicity, bilirubin metabolism (Gilbert's syndrome)
  'rs4149056', // SLCO1B1: Statin-induced myopathy risk
  'rs1045642', // ABCB1 (MDR1): Multi-drug resistance and response
  'rs2231142', // ABCG2: Allopurinol, rosuvastatin response
  'rs699',     // AGT: Angiotensinogen, hypertension risk, response to ACE inhibitors
  'rs762551',  // CYP1A2: Caffeine metabolism speed

  // Carrier Screening / Disease Risk
  'rs1801725', // CASR: Familial hypocalciuric hypercalcemia
  'rs28934571',// SERPINA1 (PiZ allele): Alpha-1 antitrypsin deficiency
  'rs1799945', // HFE (H63D): Hereditary hemochromatosis
  'rs1800562', // HFE (C282Y): Hereditary hemochromatosis
  'rs397514444',// CFTR (deltaF508): Cystic Fibrosis - most common mutation
  'rs80357872',// BRCA1: Hereditary breast and ovarian cancer risk
  'rs80359323',// BRCA2: Hereditary breast and ovarian cancer risk
  'rs4988235', // LCT: Lactose intolerance
  'rs1799983', // NOS3: Endothelial function, risk for hypertension
  'rs662',     // PON1: Risk for coronary artery disease
  'rs9939609', // FTO: Obesity and type 2 diabetes risk
  'rs1815739', // ACTN3: "Sprint" gene, athletic performance
  'rs4994',    // ADRB3: Metabolic rate, type 2 diabetes risk
  'rs12255372',// TCF7L2: Type 2 diabetes risk
  'rs6152',    // AR: Androgen receptor, related to male pattern baldness
  
  // Alzheimer's Disease Risk
  'rs429358',  // APOE (defining SNP 1)
  'rs7412',    // APOE (defining SNP 2)

  // Traits and Wellness
  'rs12913832',// HERC2: Eye color (blue/brown)
  'rs17822931',// ABCC11: Earwax type (wet/dry) and body odor
  'rs1426654', // SLC24A5: Skin pigmentation
  'rs16891982',// SLC45A2: Skin, hair, and eye color
  'rs334',     // HBB: Sickle cell trait
  'rs713598',  // BCMO1: Beta-carotene to Vitamin A conversion
  'rs2228570', // VDR (FokI): Vitamin D receptor
  'rs1544410', // VDR (BsmI): Vitamin D receptor
  'rs731236',  // VDR (TaqI): Vitamin D receptor
  'rs4646421', // CYP17A1: Vitamin D metabolism
  'rs2241766', // ADIPOQ: Adiponectin levels, related to metabolism
  'rs53576',   // OXTR: Oxytocin receptor gene, related to empathy and social behavior
  'rs1800497', // DRD2: Dopamine receptor D2, associated with addictive behaviors
  'rs1805007', // MC1R: Red hair and fair skin
  'rs1805008', // MC1R
  'rs2228479', // MC1R
]);
