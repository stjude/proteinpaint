//Term types should be used gradually using these constants instead of hardcoding the values,
// eg: type == TermTypes.CATEGORICAL instead of type == 'categorical'
export const TermTypes = {
	GENE_VARIANT: 'geneVariant',
	GENE_EXPRESSION: 'geneExpression',
	CATEGORICAL: 'categorical',
	INTEGER: 'integer',
	FLOAT: 'float',
	SNP_LIST: 'snplst',
	SNP_LOCUS: 'snplocus',
	CONDITION: 'condition',
	SURVIVAL: 'survival',
	SAMPLELST: 'samplelst',
	METABOLITE_INTENSITY: 'metaboliteIntensity'
}

export const TermTypeGroups = {
	DICTIONARY_VARIABLES: 'Dictionary Variables',
	MUTATION_CNV_FUSION: 'Mutation/CNV/Fusion',
	VARIANT_GENOTYPE: 'Variant Genotype',
	DNA_METHYLATION: 'DNA Methylation',
	GENE_DEPENDENCY: 'Gene Dependency',
	GENE_EXPRESSION: 'Gene Expression',
	PROTEIN_EXPRESSION: 'Protein Expression',
	SPLICE_JUNCTION: 'Splice Junction',
	METABOLITE_INTENSITY: 'Metabolite Intensity',
	GSEA: 'GSEA',
	MUTATION_SIGNATURE: 'Mutation Signature',
	SNP_LIST: 'SNP List',
	SNP_LOCUS: 'SNP Locus'
}

//The dataset provides the allowed term types that are then mapped to the term type groups
//Depending on the dataset types and the use case only certain term type groups/tabs are allowed
export const typeGroup = {
	[TermTypes.CATEGORICAL]: TermTypeGroups.DICTIONARY_VARIABLES,
	[TermTypes.CONDITION]: TermTypeGroups.DICTIONARY_VARIABLES,
	[TermTypes.FLOAT]: TermTypeGroups.DICTIONARY_VARIABLES,
	[TermTypes.INTEGER]: TermTypeGroups.DICTIONARY_VARIABLES,
	[TermTypes.SAMPLELST]: TermTypeGroups.DICTIONARY_VARIABLES,
	[TermTypes.SURVIVAL]: TermTypeGroups.DICTIONARY_VARIABLES,
	[TermTypes.GENE_VARIANT]: TermTypeGroups.MUTATION_CNV_FUSION,
	[TermTypes.SNP_LIST]: TermTypeGroups.SNP_LIST,
	[TermTypes.SNP_LOCUS]: TermTypeGroups.SNP_LOCUS,
	[TermTypes.GENE_EXPRESSION]: TermTypeGroups.GENE_EXPRESSION,
	[TermTypes.METABOLITE_INTENSITY]: TermTypeGroups.METABOLITE_INTENSITY
}

const nonDictTypes = new Set([
	TermTypes.SNP_LIST,
	TermTypes.SNP_LOCUS,
	TermTypes.GENE_EXPRESSION,
	TermTypes.GENE_VARIANT,
	TermTypes.METABOLITE_INTENSITY
])
export const numericTypes = new Set([
	TermTypes.INTEGER,
	TermTypes.FLOAT,
	TermTypes.GENE_EXPRESSION,
	TermTypes.METABOLITE_INTENSITY
])
export function isNumericTerm(term) {
	if (!term) return false
	return numericTypes.has(term.type)
}

export function isDictionaryType(type) {
	return !isNonDictionaryType(type)
}

export function isNonDictionaryType(type) {
	if (!type) throw new Error('Type is not defined')
	return nonDictTypes.has(type)
}
