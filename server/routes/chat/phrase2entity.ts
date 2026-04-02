import type { LlmConfig, GeneDataTypeResult } from '#types' // ,TermType
import { mayLog } from '#src/helpers.ts'
import { extractGenesFromPrompt } from './utils.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import type { Scaffold } from './scaffoldTypes.ts'
import { classifyGeneDataType } from './genedatatypeagent.ts'
import { determineAmbiguousGenePrompt } from './ambiguousgeneagent.ts'
// import { SINGLECELL_GENE_EXPRESSION } from 'terms.js'

const nonDictTypes = [
	'SNP',
	'SNP_LIST',
	'SNP_LOCUS',
	'GENE_EXPRESSION',
	'SSGSEA',
	'DNA_METHYLATION',
	'GENE_VARIANT',
	'METABOLITE_INTENSITY',
	'WHOLE_PROTEOME_ABUNDANCE',
	'SINGLECELL_CELLTYPE',
	'SINGLECELL_GENE_EXPRESSION'
]

export async function validateNonDictionaryTypes(
	phrase: string,
	llm: LlmConfig,
	genes_list: string[],
	dataset_json: any
): Promise<{ type: 'text'; text: string } | { geneFeatures: GeneDataTypeResult[] }> {
	const relevant_genes = extractGenesFromPrompt(phrase, genes_list)
	let geneFeatures: GeneDataTypeResult[] = [] // This will hold the specific gene features (e.g. expression, mutation, etc.) that are relevant to the user prompt, which can be used by downstream agents to determine which data to pull and how to interpret it. For example, if the user prompt is "Show me the expression of TP53", then we want to classify that the relevant gene feature is "expression". Or if the user prompt is "Show me TP53 mutations", then we want to classify that the relevant gene feature is "mutation". This is important for correctly interpreting the user's intent and providing accurate responses.
	if (relevant_genes.length > 0) {
		const AmbiguousGeneMessage = determineAmbiguousGenePrompt(phrase, relevant_genes, dataset_json) // for e.g. classifying prompts such as "Show TP53". In this prompt its not clear which feature (gene expression, mutation, etc.) of TP53 the user is referring to, so we want to classify this as an "ambiguous_gene_prompt" plot type and prompt the user to clarify their question. This function does NOT use an LLM and searches for specific keywords in the user prompt to determine if the prompt is ambiguous with respect to which gene feature the user is referring to.
		if (AmbiguousGeneMessage.length > 0) {
			return {
				type: 'text',
				text: AmbiguousGeneMessage
			}
		}
		const geneDataTypeMessage: GeneDataTypeResult[] | string = await classifyGeneDataType(
			// This function uses an LLM to classify which specific gene features (e.g. expression, mutation, etc.) are relevant to the user prompt for each of the relevant genes mentioned in the prompt.
			phrase,
			llm,
			relevant_genes,
			dataset_json
		)
		if (typeof geneDataTypeMessage === 'string' || geneDataTypeMessage instanceof String) {
			if (geneDataTypeMessage.length > 0) {
				// This shows error is any of the genes are missing relevant features
				return {
					type: 'text',
					text: geneDataTypeMessage
				}
			} else {
				// Should not happen
				throw 'classifyGeneDataType agent returned an empty string, which is unexpected.'
			}
		} else if (Array.isArray(geneDataTypeMessage)) {
			geneFeatures = geneDataTypeMessage
		} else {
			throw 'geneDataTypeMessage has unknown data type returned from classifyGeneDataType agent'
		}
	}
	return { geneFeatures: geneFeatures }
	// Need a similar exhaustive database for metabolites, genesets (e.g. msigdb)
}

export async function inferEntities(scaffold: Scaffold, llm: LlmConfig) {
	const prompt = ` You are a data analysis decomposing agent. Your task is to decompose each phrase into either "dictionary" or one of ${nonDictTypes} based on the corresponding role (or key) of the input scaffold JSON-like object.

    ## Definitions:
    - The non-dictionary term types are: ${nonDictTypes}.
    - Anything that does not fit into the non-dictionary term types should be classified as "dictionary".
    - Further definitions of the non-dictionary term types are as follows:
        ### Metabolite Intensity
        Metabolite intensity measures the abundance of small molecules (metabolites) in biological samples, quantified via mass spectrometry or NMR spectroscopy.
        Examples of metabolites: glucose, amino acids, lipids, ATP, etc.
        When a phrase seems to refer to:
        - "metabolites", "metabolomics", "small molecules"
        - "abundance of X" where X is a known metabolite
        - "mass spec", "NMR"
        - specific metabolite names (e.g. "citrate", "glutamine", "ATP")
        → Treat this as a METABOLITE_INTENSITY term type

        ### Gene Expression
        Gene expression measures RNA transcript abundance per gene across samples.
        When a phrase seems to refer to:
        - "expression of gene X", "RNA", "mRNA", "transcription"
        - "upregulated", "downregulated"
        - specific gene names (e.g. "TP53", "EGFR")
        → Treat this as a GENE_EXPRESSION term type


        ## ssGSEA scores
        ssGSEA (single-sample Gene Set Enrichment Analysis) scores represent the enrichment of predefined gene sets in individual samples.
        When a phrase seems to refer to:
        - "ssGSEA", "gene set enrichment", "pathway activity"
        - "enrichment score of gene set X"
        → Treat this as an SSGSEA term type

        ## DNA Methylation
        DNA methylation measures the addition of methyl groups to DNA, often at CpG sites, affecting gene regulation. Methylation can change the activity of a DNA segment without changing the sequence. When a phrase seems to refer to:
        - "DNA methylation", "methylation levels", "CpG methylation"
        - "methylation of gene X", "methylation at locus Y"
        → Treat this as a DNA_METHYLATION term type

        ## Gene Variant
        Gene variants refer to specific alterations in the DNA sequence of a gene, such as mutations, SNPs, or indels. When a phrase seems to refer to:
        - "gene variant", "mutation", "SNP", "indel", "knockoff", "negative"
        - "variant of gene X", "mutation in gene Y"
        → Treat this as a GENE_VARIANT term type

        ## Whole Proteome Abundance
        Protein abundance term. When a phrase seems to refer to:
        - "protein abundance", "proteomics", "protein levels"
        - "abundance of protein X", "protein expression of Y"
        → Treat this as a WHOLE_PROTEOME_ABUNDANCE term type
        
        ## Single-cell Cell Type
        Single-cell cell type refers to the classification of individual cells into distinct types based on their gene expression profiles in single-cell RNA sequencing data. When a phrase seems to refer to:
        - "cell type", "cell types", "single-cell cell type"
        - "type of cell X", "cell type Y"
        → Treat this as a SINGLECELL_CELLTYPE term type
        
        ## Single-cell Gene Expression
        Single-cell gene expression refers to the measurement of RNA transcript abundance for individual genes at the single-cell level in single-cell RNA sequencing data. When a phrase seems to refer to:
        - "single-cell gene expression", "gene expression in single cells"
        - "expression of gene X in single cells", "RNA levels of gene Y in single cells"
        → Treat this as a SINGLECELL_GENE_EXPRESSION term type


    ## Instructions:
    1. If the role (key) of the scaffold is "filter", the phrase can be resolved to >= 1 entities.
    2. If the role is "tw1", "tw2", or "tw3", the phrase should be resolved to exactly 1 entity.
    3. Each phrase string is replaced with entity = {type: termType, value: phrase}, where termType is either "dictionary" or one of the non-dictionary term types.
    3. All the entities must have a term type.
    4. Return the entire scaffold object with phrases replaced by entities.
    
    ## Output Format:
    Return the scaffold with the same keys, but each phrase value is replaced by an entity object in this format: {type: termType, value: phrase}. For example:
    Input scaffold:
    {
        "tw1": "expression of TP53",
        "tw2": "cell type",
        "filter": "age from 10 to 40"
    }

    Output scaffold:
    {
    "tw1": {"termType": "GENE_EXPRESSION", "phrase": "expression of TP53" },
    "tw2": { "termType": "SINGLECELL_CELLTYPE", "phrase": "cell type" },
    "filter": { "termType": "dictionary", "phrase": "age from 10 to 40" }
    }

    Identify the term type for each phrase based on its content and the definitions provided and return the scaffold with entities replacing the original phrases for the following query:
    Query:
    ${scaffold}
    `
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	mayLog(`--> Phrase to Entity phase: ${response}`)
	return response
}
