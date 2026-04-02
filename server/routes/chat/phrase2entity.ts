import type { LlmConfig } from '#types' // ,TermType
import { mayLog } from '#src/helpers.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
// import { Scaffold } from './scaffoldTypes.ts'
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
