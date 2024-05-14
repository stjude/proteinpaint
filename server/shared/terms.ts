//Term types should be used gradually using these constants instead of hardcoding the values,
// eg: type == TermTypes.CATEGORICAL instead of type == 'categorical'
export const TermTypes = {
	CATEGORICAL: 'categorical',
	INTEGER: 'integer',
	FLOAT: 'float',
	CONDITION: 'condition',
	SURVIVAL: 'survival',
	SAMPLELST: 'samplelst',
	GENE_VARIANT: 'geneVariant',
	GENE_EXPRESSION: 'geneExpression',
	SNP_LIST: 'snplst',
	SNP_LOCUS: 'snplocus'
}

//The dataset provides the allowed term types that are then mapped to the term type groups.
//Depending on the dataset types and the use case only certain term type groups/tabs are allowed
export const TermTypeGroups = {
	DICTIONARY_VARIABLES: {
		label: 'Dictionary Variables',
		types: [
			TermTypes.CATEGORICAL,
			TermTypes.INTEGER,
			TermTypes.FLOAT,
			TermTypes.CONDITION,
			TermTypes.SURVIVAL,
			TermTypes.SAMPLELST
		]
	},
	MUTATION_CNV_FUSION: { label: 'Mutation/CNV/Fusion', types: [TermTypes.GENE_VARIANT] },
	VARIANT_GENOTYPE: { label: 'Variant Genotype', types: [] },
	DNA_METHYLATION: { label: 'DNA Methylation', types: [] },
	GENE_DEPENDENCY: { label: 'Gene Dependency', types: [] },
	GENE_EXPRESSION: { label: 'Gene Expression', types: [TermTypes.GENE_EXPRESSION] },
	PROTEIN_EXPRESSION: { label: 'Protein Expression', types: [] },
	SPLICE_JUNCTION: { label: 'Splice Junction', types: [] },
	METABOLITE: { label: 'Metabolite', types: [] },
	GSEA: { label: 'GSEA', types: [] },
	MUTATION_SIGNATURE: { label: 'Mutation Signature', types: [] },
	SNP_LIST: { label: 'SNP List', types: [] },
	SNP_LOCUS: { label: 'SNP Locus', types: [] }
}

const nonDictTypes = new Set([
	TermTypes.SNP_LIST,
	TermTypes.SNP_LOCUS,
	TermTypes.GENE_EXPRESSION,
	TermTypes.GENE_VARIANT
])

export function isNumericTerm(term) {
	if (!term) return false
	return term.type == TermTypes.INTEGER || term.type == TermTypes.FLOAT || term.type == TermTypes.GENE_EXPRESSION
}

export function isDictionaryType(type) {
	return !isNonDictionaryType(type)
}

export function isNonDictionaryType(type) {
	if (!type) throw new Error('Type is not defined')
	return nonDictTypes.has(type)
}
