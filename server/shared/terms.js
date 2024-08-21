import { dtgeneexpression, dtmetaboliteintensity, TermTypeGroups } from './common.js'
// moved TermTypeGroups to `server/src/common.js`, so now has to re-export
export { TermTypeGroups } from './common.js'

export const ROOT_SAMPLE_TYPE = 1
export const DEFAULT_SAMPLE_TYPE = 2

export const NumericModes = {
	continuous: 'continuous',
	discrete: 'discrete'
}

//Term types should be used gradually using these constants instead of hardcoding the values,
// eg: type == TermTypes.CATEGORICAL instead of type == 'categorical'
export const TermTypes = {
	GENE_VARIANT: 'geneVariant',
	GENE_EXPRESSION: 'geneExpression',
	CATEGORICAL: 'categorical',
	INTEGER: 'integer',
	FLOAT: 'float',
	SNP: 'snp',
	SNP_LIST: 'snplst',
	SNP_LOCUS: 'snplocus',
	CONDITION: 'condition',
	SURVIVAL: 'survival',
	SAMPLELST: 'samplelst',
	METABOLITE_INTENSITY: 'metaboliteIntensity',
	SINGLECELL_GENE_EXPRESSION: 'singleCellGeneExpression',
	SINGLECELL_CELLTYPE: 'singleCellCellType'
}

export const TermTypes2Dt = {
	[TermTypes.GENE_EXPRESSION]: dtgeneexpression,
	[TermTypes.METABOLITE_INTENSITY]: dtmetaboliteintensity
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
	[TermTypes.SNP]: TermTypeGroups.SNP,
	[TermTypes.SNP_LIST]: TermTypeGroups.SNP_LIST,
	[TermTypes.SNP_LOCUS]: TermTypeGroups.SNP_LOCUS,
	[TermTypes.GENE_EXPRESSION]: TermTypeGroups.GENE_EXPRESSION,
	[TermTypes.METABOLITE_INTENSITY]: TermTypeGroups.METABOLITE_INTENSITY
}

const nonDictTypes = new Set([
	TermTypes.SNP,
	TermTypes.SNP_LIST,
	TermTypes.SNP_LOCUS,
	TermTypes.GENE_EXPRESSION,
	TermTypes.GENE_VARIANT,
	TermTypes.METABOLITE_INTENSITY,
	TermTypes.SINGLECELL_GENE_EXPRESSION,
	TermTypes.SINGLECELL_CELLTYPE
])

export const numericTypes = new Set([
	TermTypes.INTEGER,
	TermTypes.FLOAT,
	TermTypes.GENE_EXPRESSION,
	TermTypes.METABOLITE_INTENSITY,
	TermTypes.SINGLECELL_GENE_EXPRESSION
])

const categoricalTypes = new Set([TermTypes.CATEGORICAL, TermTypes.SNP])

const singleSampleTerms = new Set([TermTypes.SINGLECELL_GENE_EXPRESSION])

export function isSingleSampleTerm(term) {
	if (!term) return false
	return singleSampleTerms.has(term.type)
}
export function isNumericTerm(term) {
	if (!term) return false
	return numericTypes.has(term.type)
}
export function isCategoricalTerm(term) {
	if (!term) return false
	return categoricalTypes.has(term.type)
}

export function isDictionaryType(type) {
	return !isNonDictionaryType(type)
}

export function isNonDictionaryType(type) {
	if (!type) throw new Error('Type is not defined')
	return nonDictTypes.has(type)
}

export function equals(t1, t2) {
	if (!t1) throw new Error('First term is not defined ')
	if (!t2) throw new Error('Second term is not defined ')
	if (t1.type !== t2.type) return false //term types are different
	if (isDictionaryType(t1.type) && isDictionaryType(t2.type) && t1.type != TermTypes.SAMPLELST) return t1.id === t2.id
	switch (t1.type) {
		case TermTypes.GENE_EXPRESSION:
			return t1.gene == t2.gene
		case TermTypes.METABOLITE_INTENSITY:
			return t1.name == t2.name
		case TermTypes.GENE_VARIANT:
			return t1.gene == t2.gene || (t1.chr == t2.chr && t1.start == t2.start && t1.stop == t2.stop)

		// TO DO: Add more cases
		// case TermTypes.SNP_LIST:
		// case TermTypes.SNP_LOCUS:
		// case TermTypes.SAMPLELST:

		default:
			return false
	}
}

export function getBin(lst, value) {
	value = Math.round(value * 100) / 100 //to keep 2 decimal places

	let bin = lst.findIndex(
		b => (b.startunbounded && value < b.stop) || (b.startunbounded && b.stopinclusive && value == b.stop)
	)
	if (bin == -1)
		bin = lst.findIndex(
			b => (b.stopunbounded && value > b.start) || (b.stopunbounded && b.startinclusive && value == b.start)
		)
	if (bin == -1)
		bin = lst.findIndex(
			b =>
				(value > b.start && value < b.stop) ||
				(b.startinclusive && value == b.start) ||
				(b.stopinclusive && value == b.stop)
		)
	return bin
}
