import type { LlmConfig } from '#types'
// import { ambiguousPoints } from '#types'
import { mayLog } from '#src/helpers.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import type {
	Scaffold,
	SummaryScaffold,
	DEScaffold,
	HierarchicalScaffold,
	MatrixScaffold,
	PrebuiltScatterScaffold
} from './scaffoldTypes.ts'

async function matrix(user_prompt: string, llm: LlmConfig): Promise<MatrixScaffold> {
	const prompt = ` You are a ProteinPaint matrix plot assistant. Your task is to extract the necessary variables from a user's natural language question to populate a strict JSON scaffold for configuring a matrix plot. 

## OUTPUT SCHEMA
Return ONLY a valid JSON object with this structure:
{
  "twLst": ["<phrase1>", "<phrase2>", ...],   // REQUIRED - list of variables to include in the matrix
  "divideBy": "<phrase>",                     // OPTIONAL - variable to divide the matrix by (e.g. for faceting)
  "filter": "<phrase>"                       // OPTIONAL - global cohort constraint applied to the matrix
}

## FIELD DEFINITIONS
- twLst (REQUIRED): A list of variables or terms that the user wants to include in the matrix plot. Extract the phrases from the query that most likely refer to these variables, preserving the exact wording and descriptive qualifiers.
- divideBy (OPTIONAL): A variable that the user wants to use to divide or facet the matrix (e.g. "by sex" or "separately for each subtype"). Extract the phrase that indicates this variable, preserving the exact wording. 
- filter (OPTIONAL): A global constraint that applies to the entire matrix (e.g. "in pediatric patients", "for AML cases", "for men", etc.). Only populate this when the user restricts the analysis to a specific subpopulation.

## EXTRACTION RULES
1. ALWAYS extract at least one variable into twLst — this is the core of the matrix plot.
2. Preserve the EXACT phrasing from the user's question for all fields — do not paraphrase, normalize, or generalize.
3. divideBy is ONLY set when the user indicates they want to divide/facet the matrix by a variable (e.g. "by sex", "separately for each subtype"). Do NOT set divideBy if the user does not explicitly indicate this.
4. filter is ONLY set when the user restricts the entire matrix to a specific subpopulation (e.g. "in women", "for pediatric patients", "among AML cases"). Do not populate filter for terms like "for all patients" or "for the whole cohort" that do not indicate a specific subset.
5. If the user does not mention a global cohort constraint, omit filter entirely.
6. If the user does not mention a divideBy variable, omit divideBy entirely.

## EXAMPLES
Q: "Show a matrix of X and Y gene expression, and age"
A: {
  "twLst": ["X gene expression", "Y gene expression", "age"]
}

Q: "Show a matrix of X and Y gene expression, and age"
A: {
  "twLst": ["X gene expression", "Y gene expression", "age"]
}

Q: "Show a matrix of gene expression and mutation status, divided by sex"
A: {
  "twLst": ["gene expression", "mutation status"],
  "divideBy": "sex" 
}

Q: "Show a matrix of gene expression and mutation status for pediatric patients"
A: {
  "twLst": ["gene expression", "mutation status"],
  "filter": "pediatric patients"
}

Q: "Show a matrix of gene expression and mutation status, divided by sex, for pediatric patients"
A: {
  "twLst": ["gene expression", "mutation status"],
  "divideBy": "sex",
  "filter": "pediatric patients"
}

## NEGATIVE EXAMPLES — WHAT NOT TO DO
Q: "Show a matrix of gene expression, mutation status, and age"
WRONG:
{
  "twLst": ["gene expression", "mutation status", "age"],
  "divideBy": "sex",          // do not add fields not supported by the query
  "filter": "pediatric patients"  // do not add fields not supported by the query
}
Q: "Show a matrix of gene expression and mutation status, divided by sex"
WRONG:
{
  "twLst": ["gene expression", "mutation status"],
  "divideBy": "sex",
  "filter": "pediatric patients"  // do not add fields not supported by the query
}

Parse the following user query into the JSON scaffold according to the rules and schema defined above:
Query: "${user_prompt}"
`
	const response = await route_to_appropriate_llm_provider(prompt, llm)
	mayLog(`--> Matrix Scaffold LLM response: ${response}`)
	try {
		const scaffold = JSON.parse(response)
		scaffold.plotType = 'matrix' // add plotType to the scaffold for downstream use
		return scaffold
	} catch (error) {
		throw new Error(`Failed to parse LLM response as JSON: ${response}\nError: ${error}`)
	}
}

async function dge(user_prompt: string, llm: LlmConfig): Promise<DEScaffold> {
	const prompt = ` You are a ProteinPaint differential expression analysis assistant. Your task is to extract exactly two comparison groups and an optional cohort filter from a user's natural language question.

## OUTPUT SCHEMA
Return ONLY a valid JSON object with this structure:
{
  "filter1": "<phrase>",   // REQUIRED - the first comparison group
  "filter2": "<phrase>",   // REQUIRED - the second comparison group  
  "filter": "<phrase>"     // OPTIONAL - global cohort constraint applied to both groups
}

## FIELD DEFINITIONS
filter1: The first group in the comparison. Preserve the exact phrase from the user's question
         including any numeric thresholds, qualifiers, or descriptors.
filter2: The second group in the comparison. Preserve the exact phrase from the user's question
         including any numeric thresholds, qualifiers, or descriptors.
filter:  A global constraint that applies to BOTH groups — i.e. the overall cohort being 
         studied. Only populate this when the user restricts the analysis to a specific 
         subpopulation BEFORE or AFTER stating the two groups.

## Extraction RULES
1. ALWAYS extract exactly two groups into filter1 and filter2 — no more, no less.
2. filter1 is usually the first group mentioned, filter2 is usually the second group mentioned. Think carefully.
3. Preserve the EXACT phrasing from the user's question — do not paraphrase, normalize, 
   or generalize (e.g. keep "age < 10" not "young patients", keep "BCR-ABL1" not "subtype").
4. filter is ONLY set when the user restricts the entire analysis to a subpopulation 
   (e.g. "in women", "for pediatric patients", "among AML cases").
5. Do NOT put the same information in both filter1/filter2 AND filter.
6. If the user does not mention a global cohort constraint, omit filter entirely.
7. If the two groups are defined by a threshold on the same variable 
   (e.g. "high vs low expression"), preserve the threshold detail in each filter.
8. If only one group is explicitly mentioned with an implicit complement 
   (e.g. "is TP53 overexpressed in women?"), infer the complement as the second group.

## EXAMPLES
--- Two explicit categorical groups ---
Q: "Compare gene expression between BCR-ABL1 and ETV6-RUNX1 subtypes"
A: {
  "filter1": "BCR-ABL1 subtypes",
  "filter2": "ETV6-RUNX1 subtypes"
}

--- Two groups defined by a numeric threshold ---
Q: "Show differential expression between TP53 FPKM < 10 and TP53 FPKM >= 10"
A: {
  "filter1": "TP53 FPKM < 10",
  "filter2": "TP53 FPKM >= 10"
}

--- Two groups with a global cohort filter ---
Q: "Compare BCR-ABL1 vs ETV6-RUNX1 subtypes in pediatric patients"
A: {
  "filter1": "BCR-ABL1 subtypes",
  "filter2": "ETV6-RUNX1 subtypes",
  "filter": "pediatric patients"
}

--- Two demographic groups with a cohort filter ---
Q: "Compare gene expression between men and women in Wilms tumor patients"
A: {
  "filter1": "men",
  "filter2": "women",
  "filter": "Wilms tumor patients"
}

--- Implicit second group ---
Q: "Is TP53 overexpressed in BCR-ABL1 compared to all other subtypes?"
A: {
  "filter1": "BCR-ABL1 subtype",
  "filter2": "all other subtypes"
}

--- Multiple cohort constraints in filter ---
Q: "Compare early (<10) vs late (>=10) onset in female neuroblastoma patients"
A: {
  "filter1": "early onset (<10)",
  "filter2": "late onset (>=10)",
  "filter": "female neuroblastoma patients"
}

--- Age-based groups with disease filter ---
Q: "Differential analysis between patients under 5 and over 15 years old among AML cases"
A: {
  "filter1": "patients under 5 years old",
  "filter2": "patients over 15 years old",
  "filter": "AML cases"
}

## NEGATIVE EXAMPLES — WHAT NOT TO DO

Q: "Compare BCR-ABL1 vs ETV6-RUNX1 in pediatric patients"

WRONG — paraphrasing the phrases:
{
  "filter1": "BCR-ABL1 subtype",       // do not add words not in the question
  "filter2": "ETV6-RUNX1 subtype",     // do not add words not in the question
  "filter": "young patients"           // do not paraphrase "pediatric patients"
}

WRONG — putting cohort info in filter1/filter2:
{
  "filter1": "BCR-ABL1 in pediatric patients",   // cohort belongs in filter, not here
  "filter2": "ETV6-RUNX1 in pediatric patients"
}

RIGHT:
{
  "filter1": "BCR-ABL1",
  "filter2": "ETV6-RUNX1",
  "filter": "pediatric patients"
}

## EDGE CASES
- If you cannot identify two distinct comparison groups, return:
  { "error": "Could not identify two comparison groups", "reason": "<brief explanation>" }

- If the question is not about differential analysis, return:
  { "error": "Not a differential analysis question", "reason": "<brief explanation>" }

- If a group is described with multiple conditions (e.g. "young female BCR-ABL1 patients"), 
  preserve the entire multi-condition phrase as-is in filter1 or filter2.

Parse the following query into the summary plot scaffold:
Query: ${user_prompt}
`
	// let response = summaryScaffold
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	mayLog(`--> DE scaffold: ${response}`)
	try {
		const parsed = JSON.parse(response) as DEScaffold
		parsed.plotType = 'dge'
		return parsed
	} catch {
		throw new Error(`Failed to parse DEScaffold from LLM response: ${response}`)
	}
}

async function summary(user_prompt: string, llm: LlmConfig): Promise<SummaryScaffold> {
	const prompt = `You are a structured data extraction assistant. Your job is to parse the user prompt string and extract variables into a strict JSON scaffold for a summary plot configuration.
## Output Schema
Always return ONLY a JSON object in this exact format:
{
  "tw1": "<phrase>",        // REQUIRED
  "tw2": "<phrase>",        // OPTIONAL
  "tw3": "<phrase>",        // OPTIONAL
  "filter": "<phrase>"      // OPTIONAL
  "chartType": "<phrase>"      // OPTIONAL
}

## Field Definitions
- tw1 (REQUIRED): The PRIMARY analysis variable — what is being measured, summarized, or analyzed. Extract the phrase from the query that most likely refers to tw1.
- tw2 (OPTIONAL): GROUPING variable — only when the user wants to compare or split tw1 across groups. (e.g., "between X and Y", "by group", "across conditions").
- tw3 (OPTIONAL): DIVIDE BY variable — a tertiary variable used to split or facet the plot generated with tw1 and tw2 data (e.g., "divided by", "split by", "per", "for each").
- filter (OPTIONAL): A RESTRICTION on the data or cohort constraints — only when the user restricts to a specific subgroup based on a condition (e.g., "age from 10 to 40", "only female patients", "stage I only", "asian males").
- chartType (OPTIONAL): The specific type of summary chart the user wants (ONLY among "violin", "boxplot", "barchart", "sampleScatter"). Only populate this when the user explicitly specifies a chart type in the prompt.

## Extraction Rules
1. Always identify tw1 first — it answers "what is the primary data variable being plotted/summarized?" tw1 must be a DATA VARIABLE and when extracting tw1, preserve biological/analytical qualifiers that modify the variable
 (e.g. "overexpressed", "mutated", "deleted", "amplified", "methylated", "expressed", "activated"). These qualifiers are part of the analysis intent and must not be dropped. tw1 is never an analytical method or plot descriptor 
 (e.g. "correlation", "distribution", "summary", "comparison") are NOT valid tw1 values — look past these words to the actual variable being analyzed).
2. tw2 answers "compared across what groups?" — look for prepositions like "between", "across", "by", "among", etc. Use contextual understanding to confirm that it's a grouping variable
3. tw3 answers "divided/faceted by what?" — look for "divided by", "split by", "per", "for each", "stratified by", etc. Use contextual understanding to confirm that it's a grouping variable
4. Use filter when the user query restricts to a SPECIFIC subgroup (e.g. "in women", "for AML patients", "from X to Y", "where <condition>", etc). Use contextual understanding to confirm that it's a grouping variable
5. If tw2 and tw3 are ambiguous, prefer tw2 for binary/categorical comparisons and tw3 for a faceting/panel variable
6. Its possible a term might be present in both tw1/tw2 as well as filter — for example, "Compare tp53 gene expression between XXX and YYY subtypes" — here the "XXX and YYY subtypes" is relevant to both the grouping variable (tw2) and the filter (restricting to subtypes). In such cases, put "XXX and YYY subtypes" both in tw2 as well as filter. 
7. OPTIONAL fields should not be included in the JSON if they cannot be confidently extracted from the query. Do not fabricate or guess values that are not explicitly stated in the user prompt.
8. Return ONLY the JSON  with appropriate fields filled in — no explanation, no markdown fences, no extra text

## Examples:
-Query: "compare tp53 expression vs age using a scatter plot"
  Output:
  {
    "tw1": "tp53 expression",
    "tw2": "age",
    "chartType": "sampleScatter"
  }
-Query: "Show ABCD expression for XXX and YYY subtypes"
  Output:
  {
    "tw1": "ABCD expression",
    "filter": ["XXX", "YYY"]
  }
- Query: "Show me the expression of EGFR."
  Output:
  {
	"tw1": "expression of EGFR"
  }
- Query: "show XYZ for black males"
  Output:
  {
	"tw1": "XYZ",
	"filter": ["black", "male"]
  }
- Query: "Show correlation between age at diagnosis and ancestry."
  Output:
  {
	"tw1": "age at diagnosis",
	"tw2": "ancestry"
  }
- Query: "compare age between wilms tumor and hodgkin lymphoma"
  Output:
  {
	"tw1": "age",
  "tw2": "wilms tumor, hodgkin lymphoma",
  }
- Query: "Show me the distribution of gene expression in TP53 across different cell types, but only for patients aged 10 to 40."
  Output:
  {
	"tw1": "gene expression in TP53",
	"tw2": "different cell types",
	"filter": "patients aged 10 to 40"
  }
- Query: "Compare the mutation burden between responders and non-responders, divided by treatment arm."
  Output:
  {
	"tw1": "mutation burden",
	"tw2": "responders and non-responders",
	"tw3": "treatment arm"
  }
- Query: "What is the overall survival distribution for stage I patients?"
  Output:
  {
	"tw1": "overall survival distribution",
	"filter": "stage I patients"
  }


Parse the following query into the summary plot scaffold:
Query: ${user_prompt}
`
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	mayLog(`--> Summary scaffold: ${response}`)
	try {
		const parsed = JSON.parse(response) as SummaryScaffold
		parsed.plotType = 'summary'
		return parsed
	} catch {
		throw new Error(`Failed to parse SummaryScaffold from LLM response: ${response}`)
	}
}

async function hierarchical(user_prompt: string, llm: LlmConfig): Promise<HierarchicalScaffold> {
	const prompt = `You are a ProteinPaint hierarchical clustering assistant. Your task is to extract the list of genes (and optionally gene sets) and an optional cohort filter from a user's natural language question.

A hierarchical clustering plot clusters samples and features (such as genes) and displays the result as a heatmap with dendrograms.

## OUTPUT SCHEMA
Return ONLY a valid JSON object with this structure:
{
  "geneNames": ["<gene>", ...],       // OPTIONAL — list of gene symbols to cluster
  "genesetNames": ["<geneset>", ...], // OPTIONAL — list of gene set/pathway names to cluster (e.g. HALLMARK pathways)
  "filter": "<phrase>"                // OPTIONAL — a cohort restriction phrase
}

## FIELD DEFINITIONS
geneNames:    List of gene symbols mentioned in the query (e.g. "TP53", "KRAS", "BCR"). ALSO INCLUDE their corresponding descriptive words like "expression", "methylation" or "mutation".
genesetNames: Gene set / pathway names mentioned in the query (e.g. "HALLMARK_APOPTOSIS", "HALLMARK_P53_PATHWAY"). Only include if explicitly named.
filter:       A cohort restriction that narrows the sample set used for clustering (e.g. "in women", "for AML patients", "KMT2A subtype"). Preserve the exact phrase from the user's question. Omit this field if the user does not restrict the cohort.

## Extraction RULES
1. At least one of "geneNames" or "genesetNames" must be extracted — a hierarchical clustering plot is meaningless without features to cluster.
2. Preserve the EXACT gene symbols as written (upper/lower case is fine — downstream code will normalize).
3. Do NOT include descriptive/analytic words (e.g. "expression", "clustering", "dendrogram") in geneNames or genesetNames.
4. Only populate "filter" when the user restricts the analysis to a specific subpopulation.
5. OPTIONAL fields should be omitted from the JSON (not set to null or empty array) if they cannot be confidently extracted from the query.
6. Return ONLY the JSON — no explanation, no markdown fences, no extra text.

## EXAMPLES

--- Simple gene list ---
Q: "Cluster ABC, PQR and XYZ gene expression"
A: {
  "geneNames": ["ABC expression", "PQR expression", "XYZ expression"]
}

--- Gene list with cohort filter ---
Q: "Cluster IJK45, MNO4 and RSTB4 gene expression for patients with acute lymphoblastic leukemia"
A: {
  "geneNames": ["IJK45 expression", "MNO4 expression", RSTB4 gene expression"],
  "filter": "acute lymphoblastic leukemia"
}

--- Dendrogram phrasing ---
Q: "Show a gene expression dendrogram for XYZ4, CDE5 and AZF1"
A: {
  "geneNames": ["XYZ4 expression, CDE5 expression, AZF1 gene expression"]
}

--- Subtype-restricted cluster ---
Q: "Cluster HGT3, XCFT53 and KRRDF for patients with SBG5B subtype"
A: {
  "geneNames": ["HGT3 expression", "XCFT53 expression", "KRRDF expression"],
  "filter": "SBG5B subtype"
}

--- Gene set clustering ---
Q: "Hierarchical clustering of GO_T67_PATHWAY and HGC_676 genesets"
A: {
  "genesetNames": "GO_T67_PATHWAY and HGC_676 genesets"]
}

## EDGE CASES
- If no genes or gene sets are mentioned, return:
  { "error": "No genes or gene sets found", "reason": "<brief explanation>" }

Parse the following query into the hierarchical clustering scaffold:
Query: ${user_prompt}
`
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	mayLog(`--> Hierarchical scaffold: ${response}`)
	try {
		const parsed = JSON.parse(response) as HierarchicalScaffold
		parsed.plotType = 'hiercluster'
		// Ensure each gene symbol is followed by "expression" so downstream phrase2entity
		// resolves it to the geneExpression term type rather than flagging it as ambiguous.
		if (parsed.geneNames) {
			parsed.geneNames = parsed.geneNames.map(g => (/\bexpression\b/i.test(g) ? g : `${g} expression`))
		}
		return parsed
	} catch {
		throw new Error(`Failed to parse HierarchicalScaffold from LLM response: ${response}`)
	}
}

async function prebuiltScatter(user_prompt: string, llm: LlmConfig): Promise<PrebuiltScatterScaffold> {
	const prompt = `You are a ProteinPaint prebuilt scatter plot assistant. 
  Your task is to determine if the user query is asking for a scatter plot based on pre-built dimensionality reduction embeddings (UMAP, t-SNE, PCA). Extract the necessary variables into a strict JSON scaffold.
  The user can overlay clinical variables or gene expression on these plots via color, shape, or divide (Z). To remove an overlay, set the corresponding field to null. If the user does not specify a plot name, default to 'TermdbTest TSNE'. If the user says 'tsne' or 't-sne' match it to 'TermdbTest TSNE'. This dataset does NOT have UMAP plots

  ## OUTPUT SCHEMA
  Return ONLY a valid JSON object with this structure and do not add any extra fields, text, or explanation or code fences:
  {
    "name": "name of the prebuilt map"          // REQUIRED - name of the prebuilt scatter plot (e.g. "UMAP", "PCA", "t-SNE", etc)
    "colorBy": "<phrase>",                      // OPTIONAL - variable to divide the matrix by (e.g. for faceting)
    "shapeBy": "<phrase>"                       // OPTIONAL - global cohort constraint applied to the matrix
  }

  ## FIELD DEFINITIONS
  name: The specific prebuilt scatter plot the user wants (e.g. "UMAP", "PCA", "t-SNE", etc). If the user does not specify a plot name, default to "t-SNE".
  colorBy: A variable that the user wants to use for coloring points (e.g. "by sex", "color by subtype", "colored by age"). Extract the phrase that indicates this variable, preserving the exact wording.
  shapeBy: A variable that the user wants to use for shaping points (e.g. "shaped by treatment response", "shape by mutation status"). Extract the phrase that indicates this variable, preserving the exact wording.  
  
  ## Extraction RULES
  1. name is REQUIRED — if the user does not specify a plot name, default to "t-SNE". If the user says "tsne" or "t-sne" match it to "t-SNE".
  2. Use colorBy when the user indicates they want to color points by a variable (e.g. "color by sex", "colored by subtype", "color by age"). Preserve the EXACT phrasing from the user's question — do not paraphrase, normalize, or generalize.
  3. Use shapeBy when the user indicates they want to shape points by a variable (e.g. "shape by treatment response", "shape by mutation status"). Preserve the EXACT phrasing from the user's question — do not paraphrase, normalize, or generalize.
  4. OPTIONAL fields should not be included in the JSON if they cannot be confidently extracted from the query. Do not fabricate or guess values that are not explicitly stated in the user prompt.
  
  ## EXAMPLES
  Query: "Show me a t-SNE plot colored by X and shaped by Y"
  Output: 
  {
    "name": "t-SNE",
    "colorBy": "X",
    "shapeBy": "Y"
  }
  
  Query: "Show a UMAP plot colored by age"
  Output: 
  {
    "name": "UMAP",
    "colorBy": "age"
  }
  
  Query: "I want to see a PCA plot shaped by treatment response"
  Output: 
  {
    "name": "PCA",
    "shapeBy": "treatment response"
  }
  
  Query: "Show me a t-SNE plot"
  Output: 
  {
    "name": "t-SNE"
  }

  Parse the following query into the prebuilt scatter scaffold:
  Query: ${user_prompt}
  `
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	mayLog(`--> Prebuilt scatter scaffold: ${response}`)
	try {
		const parsed = JSON.parse(response) as PrebuiltScatterScaffold
		if (!parsed.name)
			throw new Error('Name of pre-built map (e.g. t-SNE, UMAP, etc) is required for prebuilt scatter scaffold')
		parsed.plotType = 'prebuiltscatter'
		return parsed
	} catch {
		throw new Error(`Failed to parse PrebuiltScatterScaffold from LLM response: ${response}`)
	}
}

export async function inferScaffold(user_prompt: string, plotType: string, llm: LlmConfig): Promise<Scaffold> {
	switch (plotType) {
		case 'summary':
			return await summary(user_prompt, llm)
		case 'dge':
			return await dge(user_prompt, llm)
		case 'hiercluster':
			return await hierarchical(user_prompt, llm)
		case 'matrix':
			return await matrix(user_prompt, llm)
		case 'prebuiltscatter':
			return await prebuiltScatter(user_prompt, llm)
		default:
			throw `No scaffold function defined for plot type: ${plotType}`
	}
}
