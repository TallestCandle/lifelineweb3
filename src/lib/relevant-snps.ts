
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
  'rs1801133', // MTHFR (C677T): Folate metabolism, methotrexate response
  'rs1801131', // MTHFR (A1298C): Folate metabolism
  'rs116855232',// DPYD: Fluoropyrimidine toxicity (e.g., 5-FU)
  'rs12248560',// UGT1A1: Irinotecan toxicity, bilirubin metabolism (Gilbert's syndrome)
  'rs4149056', // SLCO1B1: Statin-induced myopathy risk
  'rs1045642', // ABCB1 (MDR1): Multi-drug resistance and response
  'rs2231142', // ABCG2: Allopurinol, rosuvastatin response
  'rs699',     // AGT: Angiotensinogen, hypertension risk, response to ACE inhibitors
  'rs762551',  // CYP1A2: Caffeine metabolism speed
  'rs1065852', // CYP2D6*10: Reduced enzyme activity, common in Asian populations
  'rs12777823',// near MTNR1B: Melatonin receptor, risk for type 2 diabetes
  'rs7903146', // TCF7L2: Strongest genetic risk factor for type 2 diabetes
  'rs6265',    // BDNF (Val66Met): Brain-derived neurotrophic factor, memory and depression link
  'rs1137101', // LEPR: Leptin receptor, related to obesity and weight regulation
  'rs1042713', // ADRB2: Beta-2 adrenergic receptor, asthma and cardiovascular response
  'rs1042714', // ADRB2
  'rs4961',    // ADD1: Hypertension risk
  'rs5051',    // GNB3: G-protein, hypertension and obesity link

  // Carrier Screening / Disease Risk
  'rs1801725', // CASR: Familial hypocalciuric hypercalcemia
  'rs28934571',// SERPINA1 (PiZ allele): Alpha-1 antitrypsin deficiency
  'rs1799945', // HFE (H63D): Hereditary hemochromatosis
  'rs1800562', // HFE (C282Y): Hereditary hemochromatosis
  'rs397514444',// CFTR (deltaF508): Cystic Fibrosis - most common mutation
  'rs80357872',// BRCA1: Hereditary breast and ovarian cancer risk
  'rs80359323',// BRCA2: Hereditary breast and ovarian cancer risk
  'rs1799983', // NOS3: Endothelial function, risk for hypertension
  'rs662',     // PON1: Risk for coronary artery disease
  'rs9939609', // FTO: Obesity and type 2 diabetes risk
  'rs1815739', // ACTN3: "Sprint" gene, athletic performance
  'rs4994',    // ADRB3: Metabolic rate, type 2 diabetes risk
  'rs12255372',// TCF7L2: Type 2 diabetes risk (duplicate, but important)
  'rs6152',    // AR: Androgen receptor, related to male pattern baldness
  'rs2472297', // near CYP1A2, caffeine consumption behavior
  'rs9923231', // VKORC1: Warfarin dosing
  
  // Alzheimer's Disease Risk
  'rs429358',  // APOE (defining SNP 1)
  'rs7412',    // APOE (defining SNP 2)

  // Traits and Wellness
  'rs4988235', // LCT: Lactose intolerance
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
  'rs1805007', // MC1R: Red hair and fair skin (R151C)
  'rs1805008', // MC1R: Red hair and fair skin (R160W)
  'rs2228479', // MC1R: Red hair and fair skin (D294H)
  'rs1121980', // FADS1: Fatty acid metabolism (Omega-3 and Omega-6)
  'rs3849942', // TAS2R38: Bitter taste perception (PTC)
  'rs671',     // ALDH2: Alcohol flush reaction
  'rs1800955', // DRD4: Dopamine receptor, associated with novelty seeking
  'rs1800795', // IL6: Interleukin-6, inflammation and aging
  'rs1042718', // OPRM1: Opioid receptor, pain sensitivity
  'rs1799971', // OPRM1
  'rs375046',  // FUT2: Vitamin B12 absorption
  'rs2010963', // VEGFA: Vascular endothelial growth factor, athletic endurance
  'rs11549465',// HIF1A: Hypoxia-inducible factor, response to high altitude
  'rs4986934', // ESR2: Estrogen receptor beta
  'rs2981582', // FGFR2: Breast cancer risk
  'rs1219648', // TSHR: Thyroid stimulating hormone receptor
]);
