import type { LlmConfig, GeneDataTypeResult } from '#types'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import { extract_hiercluster_terms_from_query } from './hiercluster.ts'
import { TermTypes } from '#shared/terms.js'
import type {
	Scaffold,
	SummaryScaffold,
	DEScaffold,
	HierarchicalGeneExpressionScaffold,
	HierarchicalScaffold,
	GenomeBrowserScaffold,
	MatrixScaffold,
	SurvivalScaffold,
	PrebuiltScatterScaffold,
	MsgToUser
} from './scaffoldTypes.ts'
import { isMsgToUser } from './scaffoldTypes.ts'
import { extractGenesFromPrompt } from './utils.ts'
import { generateFilterTerm } from './filter.ts'
import { classifyGeneDataType } from './genedatatype.ts'
import { determineAmbiguousGenePrompt } from './determineAmbiguousGene.ts'

async function getScaffold_Survival(user_prompt: string, llm: LlmConfig): Promise<SurvivalScaffold | MsgToUser> {
	const prompt = `You are a ProteinPaint survival plot assistant. Your task is to extract the survival term, the stratification variable (term2), and an optional cohort filter from a user's natural language question, and return them in a strict JSON scaffold for configuring a survival (Kaplan-Meier) plot.

A survival plot shows survival probability over time for one or more groups of samples. It is defined by:
  - A survival time-to-event term (e.g. "overall survival", "OS", "event-free survival", "EFS", "progression-free survival", "PFS", "relapse-free survival", "RFS", "disease-free survival", "DFS").
  - A stratification variable (term2) used to split the cohort into curves (e.g. "sex", "BCR-ABL1 subtype", "TP53 mutation status", "age groups", "treatment arm").
  - An OPTIONAL cohort filter that restricts the sample set.

## OUTPUT SCHEMA
Return ONLY a valid JSON object with this structure — no extra fields, no surrounding text, no explanation, no code fences:
{
  "term": "<phrase>",     // OPTIONAL - the phrase describing the survival time-to-event term (e.g. "overall survival", "EFS")
  "term2": "<phrase>",    // REQUIRED - the phrase describing the stratification variable used to split curves
  "filter": "<phrase>"    // OPTIONAL - a cohort restriction phrase that narrows the sample set
}

## EXTRACTION RULES
1. term is OPTIONAL. Extract the phrase that describes the survival type. Preserve the user's EXACT wording (do not expand "OS" to "overall survival", do not normalize hyphenation). If the user does not mention a specific survival type, omit term entirely.
2. term2 is REQUIRED. Extract the phrase that describes the variable used to split survival curves (e.g. "by sex", "stratified by subtype", "across treatment arms"). Preserve the EXACT wording of the variable (e.g. keep "BCR-ABL1 subtype" not "subtype", keep "TP53 mutation status" not "TP53"). Drop only prepositions/connectors like "by", "stratified by", "across", "for each", "split by" — keep the variable phrase itself.
3. filter is OPTIONAL and only set when the user restricts the cohort to a specific subpopulation (e.g. "in pediatric patients", "for AML cases", "among women"). Do NOT paraphrase or invent a filter. If the user does not mention a cohort restriction, omit filter entirely.
4. Do NOT put the same information in both term2 AND filter. If a phrase describes the grouping variable, it belongs in term2; if it restricts the overall cohort, it belongs in filter.
5. If the user does not provide a stratification variable (no term2 can be extracted), return:
{ "type": "text", "text": "No stratification variable found for survival plot" }

## EXAMPLES

--- Survival term + stratification ---
Q: "Show overall survival by sex"
A: {
  "term": "overall survival",
  "term2": "sex"
}

--- Abbreviation + stratification ---
Q: "Plot EFS stratified by BCR-ABL1 subtype"
A: {
  "term": "EFS",
  "term2": "BCR-ABL1 subtype"
}

--- Stratification only (no survival type specified) ---
Q: "Survival curves by treatment arm"
A: {
  "term2": "treatment arm"
}

--- Survival term + stratification + cohort filter ---
Q: "Compare OS across TP53 mutation status in pediatric AML patients"
A: {
  "term": "OS",
  "term2": "TP53 mutation status",
  "filter": "pediatric AML patients"
}

--- Natural-language stratification phrasing ---
Q: "Show progression-free survival for each age group in women"
A: {
  "term": "progression-free survival",
  "term2": "age group",
  "filter": "women"
}

## NEGATIVE EXAMPLES — WHAT NOT TO DO
Q: "Plot OS by sex in pediatric patients"
WRONG:
{
  "term": "OS",
  "term2": "sex in pediatric patients"   // cohort filter must be split out into the filter field
}
RIGHT:
{
  "term": "OS",
  "term2": "sex",
  "filter": "pediatric patients"
}

Q: "Plot EFS stratified by BCR-ABL1 subtype"
WRONG:
{
  "term": "event-free survival",         // do NOT expand the user's exact wording "EFS"
  "term2": "subtype"                     // do NOT drop the qualifier "BCR-ABL1"
}
RIGHT:
{
  "term": "EFS",
  "term2": "BCR-ABL1 subtype"
}

Parse the following user query into the JSON scaffold according to the rules and schema defined above:
Query: "${user_prompt}"
`
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelConfig)
	mayLog(`--> Survival scaffold: ${response}`)
	if (isMsgToUser(response)) return response
	let parsed: any
	try {
		parsed = JSON.parse(response)
	} catch {
		mayLog(`Could not parse a survival plot configuration from the response: ${response}`)
		return { type: 'text', text: `Could not parse a survival plot configuration from the response: ${response}` }
	}
	if (parsed.type === 'text') return parsed as MsgToUser
	if (!parsed.term2) {
		return {
			type: 'text',
			text: 'No stratification variable (term2) could be extracted from the prompt for the survival plot.'
		}
	}
	const scaffold = parsed as SurvivalScaffold
	scaffold.plotType = 'survival'
	return scaffold
}

async function getScaffold_genomeBrowser(
	user_prompt: string,
	llm: LlmConfig
): Promise<GenomeBrowserScaffold | MsgToUser> {
	const prompt = `You are a ProteinPaint genome browser assistant. Your task is to extract the phrase describing the genomic region (and an optional cohort filter) from a user's natural language question, and return them in a strict JSON scaffold for configuring a genome browser view.

A genome browser view is defined by a genomic region — typically described by a chromosome and start/stop coordinates (e.g. "chr17:7,571,720-7,590,868", "chromosome 1 from 1Mb to 2Mb"). Do NOT parse the chromosome, start, or stop into separate fields here — that happens in a later step. In THIS step, just extract the entire phrase that describes the region as a single string.

## OUTPUT SCHEMA
Return ONLY a valid JSON object with this structure — no extra fields, no surrounding text, no explanation, no code fences:
{
  "genePhrase": "<phrase>",   // OPTIONAL - the word containing the gene name
  "genomeBrowserPhrase": "<phrase>",   // OPTIONAL - the phrase describing the genomic region (chromosome + start + stop coordinates)
  "viewMode": "<protein|genomic>",   // OPTIONAL - only when the user explicitly asks for a protein/lollipop view or a genomic view of a gene
  "filter": "<phrase>"                 // OPTIONAL - a cohort restriction phrase that narrows the sample set shown in the browser
}

## EXTRACTION RULES
1. genomeBrowserPhrase is OPTIONAL. Extract the phrase that describes the genomic region (chromosome + start + stop). Preserve the user's exact wording — do not normalize "chromosome 1" to "chr1", do not strip commas, do not convert "5kb" to 5000. Preserve the EXACT wording from the user's query (including the original chromosome formatting, commas, unit suffixes such as "kb"/"Mb", and the start-stop separator).
2. genomeBrowserPhrase (if present) should contain ONLY the region description — do not include the cohort filter, surrounding verbs ("show", "open"), or plot-type words ("genome browser", "browser view") unless they are inseparable from the region phrase.
3. genePhrase is OPTIONAL. If the user's query contains a recognizable gene name, extract the phrase containing the gene name along with information such as (mutation/variant/expression/methylation) into the genePhrase field. This is for downstream use in highlighting the gene in the genome browser, but it should be separate from the genomeBrowserPhrase which focuses on the region description.
4. filter is ONLY set when the user restricts the view to a specific subpopulation or cohort. Do NOT paraphrase or invent a filter. If the user does not mention a cohort restriction, omit filter entirely.
5. viewMode is OPTIONAL and applies ONLY to a gene query (genePhrase). Set "protein" when the user explicitly asks for a protein view or lollipop view (e.g. "protein view of TP53", "TP53 lollipop"). Set "genomic" when the user explicitly asks for a genomic view (e.g. "genomic view of TP53", "TP53 in genomic mode"). If the user does not state which view, OMIT viewMode entirely — do NOT guess a default.
6. If the user does not provide a region (no chromosome and/or no coordinates) AND no gene, return:
{ "type": "text","text": "No genomic region found" }

## EXAMPLES

--- Region string format ---
Q: "Show chr17:7,571,720-7,590,868 in the genome browser"
A: {
  "genomeBrowserPhrase": "chr17:7,571,720-7,590,868"
}

--- Natural language coordinates ---
Q: "Open the genome browser at chromosome 1 from 1000000 to 2000000"
A: {
  "genomeBrowserPhrase": "chromosome 1 from 1000000 to 2000000"
}

--- Natural language genes ---
Q: "show YGT5 mutations"
A: {
  "genePhrase": "YGT5 mutations"
}

--- Natural language genes ---
Q: "show lollipop plot of FRVT85 mutations for men"
A: {
  "genePhrase": "FRVT85 mutations",
  "viewMode": "protein",
  "filter": "men"
}

--- Explicit protein view ---
Q: "protein view of YGT5 in the genome browser"
A: {
  "genePhrase": "YGT5",
  "viewMode": "protein"
}

--- Explicit protein view (restriction phrasing) ---
Q: "restrict the FRVT85 genome browser to the protein view"
A: {
  "genePhrase": "FRVT85",
  "viewMode": "protein"
}

--- Explicit genomic view ---
Q: "show the genomic view of YGT5"
A: {
  "genePhrase": "YGT5",
  "viewMode": "genomic"
}

--- Explicit genomic view (restriction phrasing) ---
Q: "restrict the FRVT85 genome browser to the genomic view"
A: {
  "genePhrase": "FRVT85",
  "viewMode": "genomic"
}

--- Gene without a stated view (viewMode omitted) ---
Q: "show YGT5 in the genome browser"
A: {
  "genePhrase": "YGT5"
}

--- Unit suffix preserved ---
Q: "View chrX from 5kb to 10kb"
A: {
  "genomeBrowserPhrase": "chrX from 5kb to 10kb"
}

--- Region with cohort filter ---
Q: "Show chr7:140000000-141000000 in pediatric patients"
A: {
  "genomeBrowserPhrase": "chr7:140000000-141000000",
  "filter": "pediatric patients"
}

--- Comma-formatted coordinates with cohort filter ---
Q: "Genome browser at chr22 from 16,000,000 to 16,500,000 for AML cases"
A: {
  "genomeBrowserPhrase": "chr22 from 16,000,000 to 16,500,000",
  "filter": "AML cases"
}

## NEGATIVE EXAMPLES — WHAT NOT TO DO
Q: "Show chr1:1000-2000 in women"
WRONG:
{
  "genomeBrowserPhrase": "chr1:1000-2000 in women"   // filter cohort must be split out into the filter field
}
RIGHT:
{
  "genomeBrowserPhrase": "chr1:1000-2000",
  "filter": "women"
}

Q: "Open the genome browser at chromosome 1 from 1Mb to 2Mb"
WRONG:
{
  "genomeBrowserPhrase": "chr1:1000000-2000000"   // do NOT normalize chromosome formatting or unit suffixes
}
RIGHT:
{
  "genomeBrowserPhrase": "chromosome 1 from 1Mb to 2Mb"
}

Parse the following user query into the JSON scaffold according to the rules and schema defined above:
Query: "${user_prompt}"
`
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelConfig)
	mayLog(`--> Genome browser scaffold: ${response}`)
	if (isMsgToUser(response)) return response
	let parsed: any
	try {
		parsed = JSON.parse(response)
	} catch {
		mayLog(`Could not parse a genome browser configuration from the response: ${response}`)
		return { type: 'text', text: `Could not parse a genome browser configuration from the response: ${response}` }
	}
	const scaffold = parsed as GenomeBrowserScaffold
	scaffold.plotType = 'genomeBrowser'
	return scaffold
}

async function getScaffold_matrix(user_prompt: string, llm: LlmConfig): Promise<MatrixScaffold | MsgToUser> {
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
3. divideBy is ONLY set when the user indicates they want to divide/facet the matrix by a variable (e.g. "by sex", "separately for each subtype", "with age", etc). Do NOT set divideBy if the user does not explicitly indicate this.
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

Q: "Show a gene expression matrix of X and Y and age"
A: {
  "twLst": ["X gene expression", "Y gene expression", "age"]
}

Q: "Show expression of X and Y"
A: {
  "twLst": ["expression of X", "expression of Y"]
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
  "divideBy": "age",          // not a divideBy variable, age is just another variable in the matrix
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
	if (isMsgToUser(response)) return response
	let parsed: any
	try {
		parsed = JSON.parse(response)
	} catch {
		mayLog(`Could not parse a matrix plot configuration from the response: ${response}`)
		return { type: 'text', text: `Could not parse a matrix plot configuration from the response: ${response}` }
	}
	const scaffold = parsed as MatrixScaffold
	scaffold.plotType = 'matrix' // add plotType to the scaffold for downstream use
	return scaffold
}

async function getScaffold_dge(user_prompt: string, llm: LlmConfig): Promise<DEScaffold | MsgToUser> {
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
method: The method specified by the user for performing differential expression analysis (e.g. "edger", "limma", "wilcoxon"). This is optional; if the user does not specify a method, this field can be omitted and the system will default to "edger".

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
Q: "Compare gene expression between X and Y subtypes"
A: {
  "filter1": "X subtypes",
  "filter2": "Y subtypes"
}

--- Two explicit categorical groups ---
Q: "Compare gene expression between group C and D"
A: {
  "filter1": "group C",
  "filter2": "group D"
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

--- Two demographic groups with a cohort filter ---
Q: "Compare gene expression between men and women in Wilms tumor patients using wilcoxon method"
A: {
  "filter1": "men",
  "filter2": "women",
  "filter": "Wilms tumor patients"
  "method": "wilcoxon"
}

--- Two demographic groups with a cohort filter ---
Q: "Compare gene expression between men and women in Wilms tumor patients using limma method"
A: {
  "filter1": "men",
  "filter2": "women",
  "filter": "Wilms tumor patients"
  "method": "limma"
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
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelConfig)
	mayLog(`--> DE scaffold: ${response}`)
	if (isMsgToUser(response)) return response
	let parsed: any
	try {
		parsed = JSON.parse(response)
	} catch {
		mayLog(`Could not parse a differential expression configuration from the response: ${response}`)
		return {
			type: 'text',
			text: `Could not parse a differential expression configuration from the response: ${response}`
		}
	}
	const scaffold = parsed as DEScaffold
	scaffold.plotType = 'dge'
	return scaffold
}

async function getScaffold_summary(user_prompt: string, llm: LlmConfig): Promise<SummaryScaffold | MsgToUser> {
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

## Binning of continuous variables
A continuous/numeric variable (tw1, tw2, or tw3) may be binned into groups. Binning is described by a bin SIZE (the width of each bin, e.g. "in bins of 5", "bin size of 10", "every 5 years", "10-year intervals") and/or a bin START (the first bin's boundary, e.g. "starting at 20", "beginning from 0", "from age 10").
Do NOT create separate fields for binning. Instead, KEEP the binning information INSIDE the phrase of the term it pertains to (tw1/tw2/tw3). Break the prompt into phrases so that the bin size / bin start words travel with the variable they modify. For example, if the user wants tw1 binned, the bin words must remain part of the tw1 phrase; if a grouping variable (tw2/tw3) is binned, the bin words must remain part of that term's phrase.

## Extraction Rules
1. Always identify tw1 first — it answers "what is the primary data variable being plotted/summarized?" tw1 must be a DATA VARIABLE and when extracting tw1, preserve biological/analytical qualifiers that modify the variable
 (e.g. "overexpressed", "mutated", "deleted", "amplified", "methylated", "expressed", "activated"). These qualifiers are part of the analysis intent and must not be dropped. tw1 is never an analytical method or plot descriptor 
 (e.g. "correlation", "distribution", "summary", "comparison") are NOT valid tw1 values — look past these words to the actual variable being analyzed).
2. tw2 answers "compared across what groups?" — look for prepositions like "between", "across", "by", "among", etc. Use contextual understanding to confirm that it's a grouping variable
3. tw3 answers "divided/faceted by what?" — look for "divided by", "split by", "per", "for each", "stratified by", etc. Use contextual understanding to confirm that it's a grouping variable
4. Use filter when the user query restricts to a SPECIFIC subgroup (e.g. "in women", "for AML patients", "from X to Y", "where <condition>", etc). Use contextual understanding to confirm that it's a grouping variable. If words such as "subtype", "group" are used, this implies there is a filter term also along with the tw2/tw3 variable.
5. If tw2 and tw3 are ambiguous, prefer tw2 for binary/categorical comparisons and tw3 for a faceting/panel variable
6. Its possible a term might be present in both tw1/tw2 as well as filter — for example, "Compare tp53 gene expression between XXX and YYY subtypes" — here the "XXX and YYY subtypes" is relevant to both the grouping variable (tw2) and the filter (restricting to subtypes). In such cases, put "XXX and YYY subtypes" both in tw2 as well as filter. 
7. OPTIONAL fields should not be included in the JSON if they cannot be confidently extracted from the query. Do not fabricate or guess values that are not explicitly stated in the user prompt.
8. When the user requests binning of a continuous variable (e.g. "bins of 5", "in 10-year intervals", "starting at 20"), DO NOT add any new field. Keep the bin size / bin start words inside the phrase of the term (tw1/tw2/tw3) they pertain to, so each phrase fully describes its variable together with its binning. Attach the bin words to whichever variable they modify.
9. Return ONLY the JSON  with appropriate fields filled in — no explanation, no markdown fences, no extra text

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
    "tw2": "XXX and YYY subtypes",
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
- Query: "show diagnosis groups"
  Output:
  {
	"tw1": "diagnosis groups"
  }
- Query: "show ABC and BNG groups"
  Output:
  {
	"tw1": "ABC and BNG groups",
        "filter": ["ABC group", "BNG group"]
  }
- Query: "show IJK and GHT subtypes"
  Output:
  {
	"tw1": "IJK and GHT subtypes",
	"filter": ["IJK subtype", "GHT subtype"]
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
- Query: "Show age distribution in bins of 5 years"
  Output:
  {
	"tw1": "age in bins of 5 years"
  }
- Query: "Show age distribution in 10-year bins starting at 20"
  Output:
  {
	"tw1": "age in 10-year bins starting at 20"
  }
- Query: "Compare TP53 expression across age binned in intervals of 2 starting from 0"
  Output:
  {
	"tw1": "TP53 expression",
	"tw2": "age binned in intervals of 2 starting from 0"
  }
- Query: "Plot BMI with bin size 1.5 for AML patients"
  Output:
  {
	"tw1": "BMI with bin size 1.5",
	"filter": "AML patients"
  }


Parse the following query into the summary plot scaffold:
Query: ${user_prompt}
`
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelConfig)
	mayLog(`--> Summary scaffold: ${response}`)
	if (isMsgToUser(response)) return response
	let parsed: any
	try {
		parsed = JSON.parse(response)
	} catch {
		mayLog(`Could not parse a summary plot configuration from the response: ${response}`)
		return { type: 'text', text: `Could not parse a summary plot configuration from the response: ${response}` }
	}
	const scaffold = parsed as SummaryScaffold
	scaffold.plotType = 'summary'
	return scaffold
}

async function hierarchicalGeneExpression(
	user_prompt: string,
	llm: LlmConfig,
	genome: any,
	genes_list: string[],
	dataset_json?: any,
	ds?: any,
	dbPath?: string
): Promise<any | MsgToUser> {
	const prompt = `You are a ProteinPaint hierarchical clustering assistant. Your task is to extract the list of genes (and optionally gene sets) and an optional cohort filter from a user's natural language question.

A hierarchical clustering plot clusters samples and features (such as genes) and displays the result as a heatmap with dendrograms.

## OUTPUT SCHEMA
Return ONLY a valid JSON object with this structure, with NO extra fields, no surrounding text, no explanation, and no code fences:
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
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelConfig)
	mayLog(`--> Hierarchical scaffold: ${response}`)
	if (isMsgToUser(response)) return response
	{
		let parsedObj: any
		try {
			parsedObj = JSON.parse(response)
		} catch {
			mayLog(`Could not parse a hierarchical clustering configuration from the response: ${response}`)
			return {
				type: 'text',
				text: `Could not parse a hierarchical clustering configuration from the response: ${response}`
			}
		}
		const parsed = parsedObj as HierarchicalGeneExpressionScaffold
		parsed.plotType = 'hiercluster'
		// Ensure each gene symbol is followed by "expression" so downstream phrase2entity
		// resolves it to the geneExpression term type rather than flagging it as ambiguous.
		let filterTvs: any
		if (parsed.filter) {
			if (!genes_list || !dataset_json || !ds || !dbPath) {
				throw 'generateFilterTerm requires genes_list, dataset_json, ds, and dbPath to be provided'
			}
			filterTvs = await generateFilterTerm(parsed.filter, llm, genes_list, dataset_json, ds, dbPath, genome)
			if (filterTvs && 'type' in filterTvs && filterTvs.type === 'text') {
				return filterTvs as { type: 'text'; text: string }
			}
		}

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
			} else if (geneDataTypeMessage && geneDataTypeMessage.type === 'text') {
				return geneDataTypeMessage // MsgToUser — surface to the client for display
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
			TermTypes.GENE_EXPRESSION,
			filterTvs
		)
		mayLog('Time taken for hierCluster agent:', formatElapsedTime(Date.now() - time))
		return ai_output_json
	}
}

async function getScaffold_prebuiltScatter(
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
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelConfig)
	mayLog(`--> Prebuilt scatter scaffold: ${response}`)
	if (isMsgToUser(response)) return response
	let parsed: any
	try {
		parsed = JSON.parse(response)
	} catch {
		mayLog(`Could not parse a prebuilt scatter configuration from the response: ${response}`)
		return { type: 'text', text: `Could not parse a prebuilt scatter configuration from the response: ${response}` }
	}
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
}

export async function getScaffold_hierarchical(
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
  - "${TermTypes.GENE_EXPRESSION}": the user wants to cluster on gene expression (e.g. clustering by individual genes such as TP53, BRCA1, KMT2A, or by gene sets / pathways such as GO_T67_PATHWAY).
- "${TermTypes.METABOLITE_INTENSITY}": the user wants to cluster on metabolite intensity (e.g. clustering by metabolites such as glucose, lactate, alanine).
  - "dictionary": the user wants to cluster on dictionary / clinical variables (e.g. clustering by age, sex, treatment response, lab values, diagnosis).
  - "${TermTypes.SSGSEA}": the user wants to cluster on ssGSEA scores for gene sets.

## OUTPUT SCHEMA
Return ONLY a valid JSON object with this structure and no extra text, fields, or code fences:
{
"variableType": "${TermTypes.GENE_EXPRESSION}" | "${TermTypes.METABOLITE_INTENSITY}" | "dictionary" | "${TermTypes.SSGSEA}" | "ambiguous"
}

## EXAMPLES

Q: "Cluster ABC, PQR and XYZ gene expression"
A: { "variableType": "${TermTypes.GENE_EXPRESSION}" }

Q: "Show a gene expression dendrogram for XYZ4, CDE5 and AZF1"
A: { "variableType": "${TermTypes.GENE_EXPRESSION}" }

Q: "Hierarchical clustering of GO_T67_PATHWAY and HGC_676 genesets"
A: { "variableType": "${TermTypes.GENE_EXPRESSION}" }

Q: "Cluster patients by glucose and lactate metabolite intensity"
A: { "variableType": "${TermTypes.METABOLITE_INTENSITY}" }

Q: "Show a hierarchical clustering of metabolites"
A: { "variableType": "${TermTypes.METABOLITE_INTENSITY}" }

Q: "Cluster samples using age, sex, and treatment response"
A: { "variableType": "dictionary" }

Q: "Cluster samples using age, sex, and treatment response by ABC5 expression"
A: { "variableType": "dictionary" }

Q: "Hierarchical clustering by clinical variables"
A: { "variableType": "dictionary" }

Q: "Hierarchical clustering of ABC, IGH, and HGT ssGSEA scores"
A: { "variableType": "${TermTypes.SSGSEA}" }

Q: "cluster ssGSEA scores from XYZ, PQR, and LMN genesets"
A: { "variableType": "${TermTypes.SSGSEA}" }

Q: "cluster hvbjkbvk_gvjhv genes"
Comment: Not clear what kind of gene (inside the geneset) dataType the user is referring to 
A: { "variableType": "ambiguous" }

Classify the following query:
Query: ${user_prompt}
`
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelConfig)
	mayLog(`--> Hierarchical variable-type classifier: ${response}`)
	if (isMsgToUser(response)) return response
	let parsedClassifier: any
	try {
		parsedClassifier = JSON.parse(response)
	} catch {
		mayLog(`Could not parse the hierarchical variable-type classification from the response: ${response}`)
		return {
			type: 'text',
			text: `Could not parse the hierarchical variable-type classification from the response: ${response}`
		}
	}
	const variableType: string = parsedClassifier.variableType
	if (variableType === TermTypes.GENE_EXPRESSION) {
		if (allowedTermTypes.includes(TermTypes.GENE_EXPRESSION)) {
			return await hierarchicalGeneExpression(user_prompt, llm, genome, genes_list, dataset_json, ds, dbPath)
		} else {
			return {
				type: 'text',
				text: 'Hierarchical clustering for gene expression data is not supported because gene expression data is not available for this dataset.'
			}
		}
	}
	if (variableType === 'ambiguous') {
		return {
			type: 'text',
			text: 'Not clear what gene dataType the user is referring to.'
		}
	} else if (variableType === TermTypes.METABOLITE_INTENSITY) {
		if (allowedTermTypes.includes(TermTypes.METABOLITE_INTENSITY)) {
			return {
				type: 'text',
				text: 'Hierarchical clustering for metabolite intensity is not currently supported.'
			}
		} else {
			return {
				type: 'text',
				text: 'Hierarchical clustering for metabolite intensity data is not supported because metabolite intensity data is not available for this dataset.'
			}
		}
	} else if (variableType === TermTypes.SSGSEA) {
		if (allowedTermTypes.includes(TermTypes.SSGSEA)) {
			return await hierarchicalDictionaryssGSEA(user_prompt, llm, ds, dbPath, genes_list, dataset_json, genome)
		} else {
			return {
				type: 'text',
				text: 'Hierarchical clustering for ssGSEA is not supported because ssGSEA data is not available for this dataset.'
			}
		}
	} else if (variableType === 'dictionary') {
		return await hierarchicalDictionaryssGSEA(user_prompt, llm, ds, dbPath, genes_list, dataset_json, genome)
	} else {
		throw new Error(`Unexpected variableType "${variableType}" returned by hierarchical classifier`)
	}
}

export async function hierarchicalDictionaryssGSEA(
	user_prompt: string,
	llm: LlmConfig,
	ds: any,
	dbPath: string,
	genes_list: string[],
	dataset_json: any,
	genome: any
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

--- Dendrogram for ssGSEA scores ---
Q: "Show dendrogram of ssGSEA scores for ABC, PQR, and LMN genesets"
A: {
  "hierarchicalPhrases": ["ABC ssGSEA scores", "PQR ssGSEA scores", "LMN ssGSEA scores"]
}

--- Dendrogram for ssGSEA scores ---
Q: "Cluster XYZ, VXD and HYT ssGSEA scores"
A: {
  "hierarchicalPhrases": ["XYZ ssGSEA scores", "VXD ssGSEA scores", "HYT ssGSEA scores"]
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
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelConfig)
	mayLog(`--> Hierarchical dictionary scaffold: ${response}`)
	if (isMsgToUser(response)) return response
	let parsedObj: any
	try {
		parsedObj = JSON.parse(response)
	} catch {
		mayLog(`Could not parse hierarchical clustering configuration from the response: ${response}`)
		return {
			type: 'text',
			text: `Could not parse hierarchical clustering configuration from the response: ${response}`
		}
	}
	const parsed = parsedObj as HierarchicalScaffold
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
			const filterTvs = await generateFilterTerm(parsed.filter, llm, genes_list, dataset_json, ds, dbPath, genome)
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
			return await getScaffold_summary(user_prompt, llm)
		case 'dge':
			return await getScaffold_dge(user_prompt, llm)
		case 'genomeBrowser':
			return await getScaffold_genomeBrowser(user_prompt, llm)
		case 'survival':
			return await getScaffold_Survival(user_prompt, llm)
		case 'hiercluster':
			return await getScaffold_hierarchical(
				user_prompt,
				llm,
				genome,
				genes_list,
				allowedTermTypes,
				ds,
				dbPath,
				dataset_json
			)
		case 'matrix':
			return await getScaffold_matrix(user_prompt, llm)
		case 'prebuiltscatter':
			return await getScaffold_prebuiltScatter(user_prompt, llm, ds)
		default:
			throw `No scaffold function defined for plot type: ${plotType}`
	}
}
