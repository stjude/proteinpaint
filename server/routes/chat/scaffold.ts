import type { LlmConfig, GeneDataTypeResult } from '#types'
// import { ambiguousPoints } from '#types'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import { extract_hiercluster_terms_from_query } from './hiercluster.ts'
import type {
	Scaffold,
	SummaryScaffold,
	DEScaffold,
	HierarchicalGeneExpressionScaffold,
	HierarchicalScaffold,
	MatrixScaffold,
	PrebuiltScatterScaffold,
	MsgToUser,
	Entity
} from './scaffoldTypes.ts'
import { extractGenesFromPrompt } from './utils.ts'
import { classifyGeneDataType } from './genedatatypeagent.ts'
import { determineAmbiguousGenePrompt } from './ambiguousgeneagent.ts'
import { evaluateFilterTerm, phrase2entitytw, collectLeaves, type FilterTreeResult } from './phrase2entity.ts'
import { getTermObj, type Value } from './entity2termObj.ts'
import { resolveToTvs } from './entity2twTvs.ts'

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

async function hierarchicalGeneExpression(
	user_prompt: string,
	llm: LlmConfig,
	genome: any,
	genes_list: string[],
	allowedTermTypes: string[],
	dataset_json?: any,
	ds?: any,
	dbPath?: string
): Promise<any | MsgToUser> {
	const prompt = `You are a ProteinPaint hierarchical clustering assistant. Your task is to extract the list of genes (and optionally gene sets) and an optional cohort filter from a user's natural language question.

A hierarchical clustering plot clusters samples and features (such as genes) and displays the result as a heatmap with dendrograms.

## OUTPUT SCHEMA
Return ONLY a valid JSON object with this structure:
{
"hierarchicalPhrase": "<phrase>",   // REQUIRED - the phrase indicating details for hierarchical clustering which may include gene names, geneset names or calculating the top variably expressed genes, etc. Extract the entire phrase that indicates hierarchical clustering intent, preserving the exact wording.
"filter": "<phrase>"                // OPTIONAL — a cohort restriction phrase that narrows the sample set used for clustering
}

## EXAMPLES

--- Simple gene list ---
Q: "Cluster ABC, PQR and XYZ gene expression"
A: {
  "hierarchicalPhrase": "Cluster ABC, PQR and XYZ gene expression"
}

--- Gene list with cohort filter ---
Q: "Cluster IJK45, MNO4 and RSTB4 gene expression for patients with acute lymphoblastic leukemia"
A: {
  "hierarchicalPhrase": "Cluster IJK45, MNO4 and RSTB4 gene expression:",
  "filter": "acute lymphoblastic leukemia"
}

--- Dendrogram phrasing ---
Q: "Show a gene expression dendrogram for XYZ4, CDE5 and AZF1"
A: {
  "hierarchicalPhrase": "Show a gene expression dendrogram for XYZ4, CDE5 and AZF1"
}

--- Subtype-restricted cluster ---
Q: "Cluster HGT3, XCFT53 and KRRDF gene expression for patients with SBG5B subtype"
A: {
  "hierarchicalPhrase": "Cluster HGT3, XCFT53 and KRRDF gene expression",
  "filter": "SBG5B subtype"
}

--- Gene set clustering ---
Q: "Hierarchical clustering of GO_T67_PATHWAY and HGC_676 genesets"
A: {
  "hierarchicalPhrase": "Hierarchical clustering of GO_T67_PATHWAY and HGC_676 genesets"
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
		const parsed = JSON.parse(response) as HierarchicalGeneExpressionScaffold
		parsed.plotType = 'hiercluster'
		// Ensure each gene symbol is followed by "expression" so downstream phrase2entity
		// resolves it to the geneExpression term type rather than flagging it as ambiguous.
		let filterTvs: any
		if (parsed.filter) {
			if (!genes_list || !dataset_json || !ds || !dbPath) {
				throw 'generateFilterTerm requires genes_list, dataset_json, ds, and dbPath to be provided'
			}
			filterTvs = await generateFilterTerm(parsed.filter, llm, genes_list, dataset_json, ds, dbPath)
			if (filterTvs && 'type' in filterTvs && filterTvs.type === 'text') {
				return filterTvs as { type: 'text'; text: string }
			}
		}

		if (allowedTermTypes.includes('geneExpression')) {
			// For now assuming that only 'geneExpression' is the only term that hierarchical clustering plot supports,
			// Will later add support for metabolite intensity and other numeric data types, in which case this relevant terms extraction step
			// and subsequent gene data type classification step will need to be modified to include relevant terms of those data types as well, not just genes.
			const genesInPrompt = extractGenesFromPrompt(parsed.hierarchicalPhrase, genes_list)
			let geneFeatures: GeneDataTypeResult[] = []
			mayLog('Relevant genes extracted from prompt for hierarchical clustering:', genesInPrompt)
			if (genesInPrompt.length > 0) {
				const ambiguousMsg = determineAmbiguousGenePrompt(parsed.hierarchicalPhrase, genesInPrompt, dataset_json)
				if (ambiguousMsg.length > 0) {
					return { type: 'text', text: ambiguousMsg }
				}
				const geneDataTypeMessage = await classifyGeneDataType(
					parsed.hierarchicalPhrase,
					llm,
					genesInPrompt,
					dataset_json
				) // classifyGeneDataType() in chat/genedatatypeagent.ts is DIFFERENT from classifyGeneDataTypePhrase() in chat/genedatatypeagentnew.ts, the former returns a string message when there is an issue with gene data type classification, while the latter returns an array of gene data type results. The reason for this difference is that for hierarchical clustering, we need to know the specific data type for each gene in order to determine if hierarchical clustering is supported and how to perform it, whereas for the initial classification of gene vs group, we only needed to know if the term was a gene or a group, not the specific data type.
				if (typeof geneDataTypeMessage === 'string') {
					if (geneDataTypeMessage.length > 0) {
						return { type: 'text', text: geneDataTypeMessage }
					}
					throw 'classifyGeneDataType agent returned an empty string, which is unexpected.'
				} else if (Array.isArray(geneDataTypeMessage)) {
					geneFeatures = geneDataTypeMessage
				} else {
					throw 'geneDataTypeMessage has unknown data type returned from classifyGeneDataType agent'
				}
			}

			const time = new Date().valueOf()
			const ai_output_json = await extract_hiercluster_terms_from_query(
				parsed.hierarchicalPhrase,
				llm,
				genome,
				ds,
				geneFeatures,
				'geneExpression',
				filterTvs
			)
			mayLog('Time taken for hierCluster agent:', formatElapsedTime(Date.now() - time))
			return ai_output_json
		}
		// else if() // Will later add support for other hierarchical clustering types e.g. metaboliteIntensity
		else {
			return {
				type: 'text',
				text: 'Hierarchical clustering is not supported for this dataset because gene expression data is not available.'
			}
		}
	} catch {
		throw new Error(`Failed to parse HierarchicalScaffold from LLM response: ${response}`)
	}
}

async function prebuiltScatter(
	user_prompt: string,
	llm: LlmConfig,
	ds: any
): Promise<PrebuiltScatterScaffold | MsgToUser> {
	const prebuiltScatterNames: Map<string, string> = new Map()
	if (ds?.cohort?.scatterplots?.plots) {
		for (const plot of ds.cohort.scatterplots.plots) {
			if (plot.name) {
				prebuiltScatterNames.set(plot.name, plot.descriptionShort)
			}
		}
	}

	// Build a formatted list of available plots and descriptions for the prompt
	const availablePlotsList = Array.from(prebuiltScatterNames.entries())
		.map(([name, description]) => `  - "${name}": ${description}`)
		.join('\n')

	const prompt = `You are a ProteinPaint prebuilt scatter plot assistant.
  Your task is to parse a user query about scatter plots based on pre-built dimensionality reduction embeddings (e.g. UMAP, t-SNE, PCA) and return a strict JSON scaffold.

  The user can overlay clinical variables or gene expression on these plots via color or shape.

  ## AVAILABLE PREBUILT SCATTER PLOTS
  The "name" field MUST be exactly one of the keys listed below. Each key is followed by a short description — use the descriptions to map the user's intent (e.g. "tsne", "t-sne", "umap", "pca", or descriptive phrases) to the correct key.

  ${availablePlotsList}

  ## OUTPUT SCHEMA
  Return ONLY a valid JSON object — no extra fields, no surrounding text, no explanation, no code fences.

  {
    "name": <string>,        // REQUIRED - see rules below
    "colorBy": <string>,     // OPTIONAL - include only if user specifies coloring intent
    "shapeBy": <string>,     // OPTIONAL - include only if user specifies shaping intent
    "filter": <string>,      // OPTIONAL - A RESTRICTION on the data or cohort constraints — only when the user restricts to a specific subgroup based on a condition (e.g., "age from 10 to 40", "only female patients", "stage I only", "asian males")
    "divideBy": <string>     // OPTIONAL - include only if user specifies intent to facet/divide the plot by a variable (e.g. "divided by sex", "separately for each subtype", "split by treatment response")
  }

  ## RULES FOR "name" (REQUIRED)
  The "name" field must be one of:
    (a) An EXACT key from the AVAILABLE PREBUILT SCATTER PLOTS list above — choose this when the user's query clearly matches one of the available plots based on the descriptions.
    (b) The string "unsure" — choose this when the query mentions a scatter plot or embedding but you cannot confidently determine which available key it corresponds to (e.g. ambiguous phrasing, multiple plausible matches, or vague references).
    (c) The string "nomatch" — choose this when the query is clearly NOT requesting any of the available prebuilt scatter plots (e.g. the user asks for a plot type that is not in the list, or the query is unrelated to scatter plots entirely).

  Do NOT invent, modify, or paraphrase keys. The exact key string must be copied verbatim from the list.

  ## RULES FOR "colorBy" (OPTIONAL)
  - Include "colorBy" ONLY if the user explicitly indicates they want to color points by some variable (e.g. "color by sex", "colored by subtype", "colored by age").
  - Preserve the EXACT phrasing of the variable from the user's query — do not paraphrase, normalize, capitalize, or generalize.
  - Set "colorBy" to the string "null" (not JSON null) ONLY if the user explicitly asks to remove coloring (e.g. "without coloring", "no color overlay", "color by none", "remove color").
  - If the user says nothing about coloring, OMIT the "colorBy" field entirely. Do NOT guess or fabricate.

  ## RULES FOR "shapeBy" (OPTIONAL)
  - Include "shapeBy" ONLY if the user explicitly indicates they want to shape points by some variable (e.g. "shape by treatment response", "shaped by mutation status").
  - Preserve the EXACT phrasing of the variable from the user's query — do not paraphrase, normalize, capitalize, or generalize.
  - Set "shapeBy" to the string "null" (not JSON null) ONLY if the user explicitly asks to remove shaping (e.g. "without shaping", "no shape overlay", "shape by none", "remove shape").
  - If the user says nothing about shaping, OMIT the "shapeBy" field entirely. Do NOT guess or fabricate.

  ## RULES FOR "filter" (OPTIONAL)
  - Use filter when the user query restricts to a SPECIFIC subgroup (e.g. "in women", "for AML patients", "from X to Y", "where <condition>", etc). 
  - Use contextual understanding to confirm that it's a grouping variable
  - Preserve the EXACT phrasing of the variable from the user's query — do not paraphrase, normalize, capitalize, or generalize.
  - If the user says nothing about filtering, OMIT the "filter" field entirely. Do NOT guess or fabricate.

  ## RULES FOR "divideBy" (OPTIONAL)
  - Include "divideBy" ONLY if the user explicitly indicates they want to facet/divide the plot by some variable (e.g. "divided by sex", "separately for each subtype", "split by treatment response").
  - Preserve the EXACT phrasing of the variable from the user's query — do not paraphrase, normalize, capitalize, or generalize.
  - If the user says nothing about dividing/faceting, OMIT the "divideBy" field entirely. Do NOT guess or fabricate.

  ## EXAMPLES
  The following examples assume the available plots include keys whose descriptions match t-SNE, UMAP, and PCA. In your actual output, use the literal key strings from the AVAILABLE PREBUILT SCATTER PLOTS section.

  Query: "Show me a t-SNE plot colored by sex and shaped by subtype"
  Output:
  {
    "name": "<exact key matching t-SNE>",
    "colorBy": "sex",
    "shapeBy": "subtype"
  }

  Query: "Show a UMAP divided by age"
  Output:
  {
    "name": "<exact key matching UMAP>",
    "dividedBy": "age"
  }

  Query: "Show a UMAP colored by age"
  Output:
  {
    "name": "<exact key matching UMAP>",
    "colorBy": "age"
  }

  Query: "PCA plot shaped by treatment response"
  Output:
  {
    "name": "<exact key matching PCA>",
    "shapeBy": "treatment response"
  }

  Query: "Show me the t-SNE without any coloring"
  Output:
  {
    "name": "<exact key matching t-SNE>",
    "colorBy": "null"
  }

  Query: "Show me a scatter plot"
  Output:
  {
    "name": "unsure"
  }

  Query: "Show me a bar chart of gene expression"
  Output:
  {
    "name": "nomatch"
  }

  Query: "Show the embedding plot colored by diagnosis"
  Output:
  {
    "name": "unsure",
    "colorBy": "diagnosis"
  }

  ## TASK
  Parse the following query into the prebuilt scatter scaffold:
  Query: ${user_prompt}
  `

	/*
const prebuiltScatterNames: Map<string, string> = new Map()
if (ds?.cohort?.scatterplots?.plots) {
for (const plot of ds.cohort.scatterplots.plots) {
if (plot.name) {
prebuiltScatterNames.set(plot.name, plot.descriptionShort)
}
}
}


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
`*/
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	mayLog(`--> Prebuilt scatter scaffold: ${response}`)
	try {
		const parsed = JSON.parse(response) as PrebuiltScatterScaffold
		if (!parsed.name)
			return {
				type: 'text',
				text: 'Name of pre-built map (e.g. t-SNE, UMAP, etc) is required for prebuilt scatter scaffold'
			}
		if (parsed.name === 'unsure') {
			return {
				type: 'text',
				text: 'LLM was unsure which prebuilt scatter plot the user query corresponded to based on the descriptions, indicating that the query did not clearly match any of the available options.'
			}
		} else if (parsed.name === 'nomatch') {
			return { type: 'text', text: 'The plot you are asking for is not currently supported.' }
		}
		parsed.plotType = 'prebuiltscatter'
		return parsed
	} catch {
		throw new Error(`Failed to parse PrebuiltScatterScaffold from LLM response: ${response}`)
	}
}

export async function hierarchical(
	user_prompt: string,
	llm: LlmConfig,
	genome: any,
	genes_list: string[],
	allowedTermTypes: string[],
	ds: any,
	dbPath: string,
	dataset_json: any
): Promise<any | HierarchicalScaffold | MsgToUser> {
	const prompt = `You are a ProteinPaint hierarchical clustering classifier. Your task is to determine what kind of variable the user wants to cluster on.

A hierarchical clustering plot clusters samples based on a chosen feature type. Classify the user's query into exactly one of the following categories:
  - "geneExpression": the user wants to cluster on gene expression (e.g. clustering by individual genes such as TP53, BRCA1, KMT2A, or by gene sets / pathways such as GO_T67_PATHWAY).
  - "metaboliteIntensity": the user wants to cluster on metabolite intensity (e.g. clustering by metabolites such as glucose, lactate, alanine).
  - "dictionary": the user wants to cluster on dictionary / clinical variables (e.g. clustering by age, sex, treatment response, lab values, diagnosis).

## OUTPUT SCHEMA
Return ONLY a valid JSON object with this structure and no extra text, fields, or code fences:
{
  "variableType": "geneExpression" | "metaboliteIntensity" | "dictionary"
}

## EXAMPLES

Q: "Cluster ABC, PQR and XYZ gene expression"
A: { "variableType": "geneExpression" }

Q: "Show a gene expression dendrogram for XYZ4, CDE5 and AZF1"
A: { "variableType": "geneExpression" }

Q: "Hierarchical clustering of GO_T67_PATHWAY and HGC_676 genesets"
A: { "variableType": "geneExpression" }

Q: "Cluster patients by glucose and lactate metabolite intensity"
A: { "variableType": "metaboliteIntensity" }

Q: "Show a hierarchical clustering of metabolites"
A: { "variableType": "metaboliteIntensity" }

Q: "Cluster samples using age, sex, and treatment response"
A: { "variableType": "dictionary" }

Q: "Cluster samples using age, sex, and treatment response by ABC5 expression"
A: { "variableType": "dictionary" }

Q: "Hierarchical clustering by clinical variables"
A: { "variableType": "dictionary" }

Classify the following query:
Query: ${user_prompt}
`
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	mayLog(`--> Hierarchical variable-type classifier: ${response}`)
	let variableType: string
	try {
		const parsed = JSON.parse(response)
		variableType = parsed.variableType
	} catch {
		throw new Error(`Failed to parse hierarchical variable-type classifier response: ${response}`)
	}

	if (variableType === 'geneExpression') {
		return await hierarchicalGeneExpression(
			user_prompt,
			llm,
			genome,
			genes_list,
			allowedTermTypes,
			dataset_json,
			ds,
			dbPath
		)
	} else if (variableType === 'metaboliteIntensity') {
		return {
			type: 'text',
			text: 'Hierarchical clustering on metabolite intensity is not currently supported.'
		}
	} else if (variableType === 'dictionary') {
		return await hierarchicalDictionary(user_prompt, llm, ds, dbPath, genes_list, dataset_json)
	} else {
		throw new Error(`Unexpected variableType "${variableType}" returned by hierarchical classifier`)
	}
}

export async function hierarchicalDictionary(
	user_prompt: string,
	llm: LlmConfig,
	ds: any,
	dbPath: string,
	genes_list: string[],
	dataset_json: any
): Promise<HierarchicalScaffold | MsgToUser> {
	const prompt = `You are a ProteinPaint hierarchical clustering assistant. Your task is to extract the list of dictionary (clinical) variables and an optional cohort filter from a user's natural language question.

A hierarchical clustering plot clusters samples based on selected continuous (either integral or float variables) dictionary variables (e.g. age, BMI, lab values, weight, height) and displays the result as a heatmap with dendrograms.

## OUTPUT SCHEMA
Return ONLY a valid JSON object with this structure and no extra text, fields, or code fences:
{
  "hierarchicalPhrase": ["<phrase>"],   // REQUIRED - Array of phrases listing the dictionary variables to cluster on. Extract the entire phrase that indicates the variables of interest, preserving the exact wording.
  "filter": "<phrase>"                // OPTIONAL — a cohort restriction phrase that narrows the sample set used for clustering
}

## EXAMPLES

--- Simple dictionary variable list ---
Q: "Cluster patients by age, height and treatment response"
A: {
  "hierarchicalPhrases": ["age", "height", "treatment response"]
}

--- Dictionary variables with cohort filter ---
Q: "Cluster age, weight and BMI for patients with acute lymphoblastic leukemia"
A: {
  "hierarchicalPhrases": ["age", "weight", "BMI"]
  "filter": "acute lymphoblastic leukemia"
}

--- Dendrogram phrasing ---
Q: "Show a clinical-variable dendrogram for weight, height and lab values"
A: {
  "hierarchicalPhrases": ["weight", "height", "lab values"]
}

--- Subtype-restricted cluster ---
Q: "Hierarchical clustering of weight, height, and treatment response for patients with SBG5B subtype"
A: {
  "hierarchicalPhrases": ["weight", "height", "treatment response"],
  "filter": "SBG5B subtype"
}

## EDGE CASES
- If no dictionary variables are mentioned, return:
  { "error": "No dictionary variables found", "reason": "<brief explanation>" }

Parse the following query into the hierarchical clustering scaffold:
Query: ${user_prompt}
`
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	mayLog(`--> Hierarchical dictionary scaffold: ${response}`)
	let parsed: HierarchicalScaffold
	try {
		parsed = JSON.parse(response) as HierarchicalScaffold
	} catch {
		throw new Error(`Failed to parse HierarchicalScaffold from LLM response: ${response}`)
	}
	parsed.plotType = 'hiercluster'

	if (!parsed.hierarchicalPhrases) {
		return {
			type: 'text',
			text: 'No dictionary variables found in the query. Please specify at least one dictionary variable to cluster on.'
		}
	} else if (!Array.isArray(parsed.hierarchicalPhrases)) {
		return {
			type: 'text',
			text: 'hierarchicalPhrase field should be an array of strings listing the dictionary variables to cluster on.'
		}
	} else if (parsed.hierarchicalPhrases.length < 3) {
		return {
			type: 'text',
			text: 'For hierarchical clustering, at least 3 variables are required to generate a dendrogram.'
		}
	} else {
		if (parsed.filter) {
			const filterTvs = await generateFilterTerm(parsed.filter, llm, genes_list, dataset_json, ds, dbPath)
			if (filterTvs && 'type' in filterTvs && filterTvs.type === 'text') {
				throw new Error(filterTvs.text)
			}
			parsed.filterTvs = filterTvs
		}
	}
	return parsed
}

export async function inferScaffold(
	user_prompt: string,
	plotType: string,
	llm: LlmConfig,
	genome: any,
	genes_list: string[],
	allowedTermTypes: string[],
	dataset_json: any,
	ds: any,
	dbPath: string
): Promise<Scaffold | MsgToUser | any> {
	// any is for final output in case of hierarchical clustering
	switch (plotType) {
		case 'summary':
			return await summary(user_prompt, llm)
		case 'dge':
			return await dge(user_prompt, llm)
		case 'hiercluster':
			return await hierarchical(user_prompt, llm, genome, genes_list, allowedTermTypes, ds, dbPath, dataset_json)
		case 'matrix':
			return await matrix(user_prompt, llm)
		case 'prebuiltscatter':
			return await prebuiltScatter(user_prompt, llm, ds)
		default:
			throw `No scaffold function defined for plot type: ${plotType}`
	}
}

/**
 * Convert a natural-language filter phrase into a tvslst object that can be sent to the UI.
 * Pipeline:
 *   1. evaluateFilterTerm() — parse the phrase into a binary AND/OR tree of leaf phrases
 *   2. phrase2entitytw() per leaf — resolve each leaf phrase into an Entity (mirrors the
 *      filter-loop pattern used in phrase2entity.ts)
 *   3. getTermObj() per Entity — resolve each Entity into a Value (mirrors lines 210-219 of
 *      entity2termObj.ts, which does the same conversion for hierCluster filter entities)
 *   4. resolveToTvs() — assemble the Value[] into a final tvslst object
 */
async function generateFilterTerm(
	phrase: string,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any,
	ds: any,
	dbPath: string
): Promise<any | MsgToUser> {
	const filterTree: FilterTreeResult = await evaluateFilterTerm(phrase, llm)
	mayLog('generateFilterTerm parsed filter tree:', JSON.stringify(filterTree, null, 2))

	const leafPhrases = collectLeaves(filterTree.tree)
	const filterEntities: Entity[] = []
	for (const leaf of leafPhrases) {
		mayLog('generateFilterTerm evaluating filter leaf:', leaf.phrase)
		const filterTw = await phrase2entitytw(leaf.phrase, llm, genes_list, dataset_json, ds)
		if ('type' in filterTw && filterTw.type === 'text') {
			return filterTw as MsgToUser
		}
		const filterEntity = filterTw as Entity
		if (leaf.logicalOperator) filterEntity.logicalOperator = leaf.logicalOperator
		filterEntities.push(filterEntity)
	}

	const filterValues: Value[] = []
	for (const filterTerm of filterEntities) {
		mayLog('generateFilterTerm evaluating filter term:', filterTerm)
		const termObj = await getTermObj('filter', filterTerm, llm, dbPath, genes_list)
		if (!termObj) continue
		if (filterTerm.logicalOperator) termObj.logicalOperator = filterTerm.logicalOperator
		filterValues.push(termObj)
	}

	return await resolveToTvs(filterValues, dbPath, llm)
}
