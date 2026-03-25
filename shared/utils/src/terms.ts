import type { Term } from '#types'
import {
	dtgeneexpression,
	dtssgsea,
	dtdnamethylation,
	dtmetaboliteintensity,
	dtwholeproteomeabundance,
	TermTypeGroups,
	dtTerms
} from './common.js'

// moved TermTypeGroups to `server/src/common.js`, so now has to re-export
export { TermTypeGroups } from './common.js'

/*
For datasets with multiple types of samples the ROOT_SAMPLE_TYPE is used to represent the root sample type, for example, 
the type patient, that has one or more samples associated to it. This should be the id used as sample_type, when generating the db to identify the root samples
in sampleidmap or the terms annotating root samples in the terms table.
The samples associated to a patient have annotations that are specific to a timepoint, for example, the age of the patient,
the doses of the drugs the patient was taking at the time of the data collection, etc. These annotations are associated to a sample.
*/
export const ROOT_SAMPLE_TYPE = 1

//For datasets with one sample type the DEFAULT_SAMPLE_TYPE is used to represent the sample type
export const DEFAULT_SAMPLE_TYPE = 2

export const NumericModes = {
	continuous: 'continuous',
	discrete: 'discrete'
}

export const CATEGORICAL = 'categorical'
export const CONDITION = 'condition'
export const DATE = 'date'
export const DNA_METHYLATION = 'dnaMethylation'
export const FLOAT = 'float'
export const GENE_VARIANT = 'geneVariant'
export const GENE_EXPRESSION = 'geneExpression'
export const INTEGER = 'integer'
export const METABOLITE_INTENSITY = 'metaboliteIntensity'
export const MULTIVALUE = 'multivalue'
export const SAMPLELST = 'samplelst'
export const SINGLECELL_CELLTYPE = 'singleCellCellType'
export const SINGLECELL_GENE_EXPRESSION = 'singleCellGeneExpression'
export const SNP = 'snp'
export const SNP_LIST = 'snplst'
export const SNP_LOCUS = 'snplocus'
export const SSGSEA = 'ssGSEA'
export const SURVIVAL = 'survival'
export const TERM_COLLECTION = 'termCollection'
export const WHOLE_PROTEOME_ABUNDANCE = 'wholeProteomeAbundance'

//Term types should be used gradually using these constants instead of hardcoding the values,
// eg: type == CATEGORICAL instead of type == 'categorical'
export const TermTypes: { [key: string]: string } = {
	GENE_VARIANT,
	GENE_EXPRESSION,
	SSGSEA,
	DNA_METHYLATION,
	CATEGORICAL,
	INTEGER,
	FLOAT,
	SNP,
	SNP_LIST,
	SNP_LOCUS,
	CONDITION,
	SURVIVAL,
	SAMPLELST,
	METABOLITE_INTENSITY,
	WHOLE_PROTEOME_ABUNDANCE,
	SINGLECELL_CELLTYPE,
	SINGLECELL_GENE_EXPRESSION,
	MULTIVALUE,
	DATE,
	TERM_COLLECTION
}
export const dtTermTypes: Set<string> = new Set(dtTerms.map((t: any) => t.type))
for (const dtTermType of dtTermTypes) {
	TermTypes[dtTermType.toUpperCase()] = dtTermType
}

export const TermTypes2Dt = {
	[GENE_EXPRESSION]: dtgeneexpression,
	[SSGSEA]: dtssgsea,
	[DNA_METHYLATION]: dtdnamethylation,
	[METABOLITE_INTENSITY]: dtmetaboliteintensity,
	[WHOLE_PROTEOME_ABUNDANCE]: dtwholeproteomeabundance
}

// maps term type to group (as is shown as toggles in search ui)
export const typeGroup = {
	[CATEGORICAL]: TermTypeGroups.DICTIONARY_VARIABLES,
	[CONDITION]: TermTypeGroups.DICTIONARY_VARIABLES,
	[FLOAT]: TermTypeGroups.DICTIONARY_VARIABLES,
	[INTEGER]: TermTypeGroups.DICTIONARY_VARIABLES,
	[SAMPLELST]: TermTypeGroups.DICTIONARY_VARIABLES,
	[SURVIVAL]: TermTypeGroups.DICTIONARY_VARIABLES,
	[DATE]: TermTypeGroups.DICTIONARY_VARIABLES,
	[MULTIVALUE]: TermTypeGroups.DICTIONARY_VARIABLES,
	[GENE_VARIANT]: TermTypeGroups.MUTATION_CNV_FUSION,
	[SNP]: TermTypeGroups.SNP,
	[SNP_LIST]: TermTypeGroups.SNP_LIST,
	[SNP_LOCUS]: TermTypeGroups.SNP_LOCUS,
	[GENE_EXPRESSION]: TermTypeGroups.GENE_EXPRESSION,
	[SSGSEA]: TermTypeGroups.SSGSEA,
	[DNA_METHYLATION]: TermTypeGroups.DNA_METHYLATION,
	[METABOLITE_INTENSITY]: TermTypeGroups.METABOLITE_INTENSITY,
	[WHOLE_PROTEOME_ABUNDANCE]: TermTypeGroups.WHOLE_PROTEOME_ABUNDANCE,
	[TERM_COLLECTION]: TermTypeGroups.TERM_COLLECTION,
	[SINGLECELL_CELLTYPE]: TermTypeGroups.SINGLECELL_CELLTYPE,
	[SINGLECELL_GENE_EXPRESSION]: TermTypeGroups.SINGLECELL_GENE_EXPRESSION
}

const nonDictTypes = new Set([
	SNP,
	SNP_LIST,
	SNP_LOCUS,
	GENE_EXPRESSION,
	SSGSEA,
	DNA_METHYLATION,
	GENE_VARIANT,
	METABOLITE_INTENSITY,
	WHOLE_PROTEOME_ABUNDANCE,
	SINGLECELL_CELLTYPE,
	SINGLECELL_GENE_EXPRESSION
])

for (const dtTermType of dtTermTypes) {
	nonDictTypes.add(TermTypes[dtTermType.toUpperCase()])
}

export const numericTypes = new Set([
	INTEGER,
	FLOAT,
	GENE_EXPRESSION,
	SSGSEA,
	DNA_METHYLATION,
	METABOLITE_INTENSITY,
	WHOLE_PROTEOME_ABUNDANCE,
	SINGLECELL_GENE_EXPRESSION,
	DATE
])

// available termdb numeric table names used as anno_<term.type>,
// for example anno_integer, anno_float, anno_date
export const annoNumericTypes = new Set([INTEGER, FLOAT, DATE])

const categoricalTypes = new Set([CATEGORICAL, SNP])

const singleCellTerms = new Set([SINGLECELL_CELLTYPE, SINGLECELL_GENE_EXPRESSION])

export function isSingleCellTerm(term: any) {
	if (!term) return false
	return singleCellTerms.has(term.type)
}
export function isNumericTerm(term: Term) {
	if (!term) return false
	return numericTypes.has(term.type)
}
export function isCategoricalTerm(term: Term) {
	if (!term) return false
	return categoricalTypes.has(term.type)
}

export function isDictionaryType(type: string) {
	return !isNonDictionaryType(type)
}

export function isNonDictionaryType(type: string) {
	if (!type) throw new Error('Type is not defined')
	return nonDictTypes.has(type)
}

export function equals(t1: any, t2: any) {
	if (!t1) throw new Error('First term is not defined ')
	if (!t2) throw new Error('Second term is not defined ')
	if (t1.type !== t2.type) return false //term types are different
	if (isDictionaryType(t1.type) && isDictionaryType(t2.type) && t1.type != SAMPLELST) return t1.id === t2.id
	switch (t1.type) {
		case GENE_EXPRESSION:
			return t1.gene == t2.gene
		case SSGSEA:
			return t1.id == t2.id
		case DNA_METHYLATION:
			return t1.chr == t2.chr && t1.start == t2.start && t1.stop == t2.stop
		case METABOLITE_INTENSITY:
		case WHOLE_PROTEOME_ABUNDANCE:
			return t1.name == t2.name
		case GENE_VARIANT:
			return t1.gene == t2.gene || (t1.chr == t2.chr && t1.start == t2.start && t1.stop == t2.stop)

		// TO DO: Add more cases
		// case SNP_LIST:
		// case SNP_LOCUS:
		// case SAMPLELST:

		default:
			return false
	}
}

export function getBin(lst: any[], value: number) {
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
//Terms may  have a sample type associated to them, in datasets with multiple types of samples.
//For example the gender is associated to the patient while the age is associated to the type sample. This function is used
//for example when calling getData or getFilter, to return either the parent or the child samples, depending on the use case.
export function getSampleType(term: any, ds: any) {
	if (!term) return null
	//non dict terms annotate only samples, eg: gene expression, metabolite intensity, gene variant.
	//Their sample type is the default sample type that may or may not have a parent type, depending on the dataset
	if (term.type && isNonDictionaryType(term.type)) return DEFAULT_SAMPLE_TYPE
	//dictionary terms may annotate different types of samples, eg: patient and sample or mouse and crop.
	if (term.id) return ds.cohort.termdb.term2SampleType.get(term.id)
	if (term.type == 'samplelst') {
		const key = Object.keys(term.values)[0]
		const sampleId = term.values[key].list[0]?.sampleId
		if (sampleId) return ds.sampleId2Type.get(Number(sampleId) || sampleId)
		else return DEFAULT_SAMPLE_TYPE
	}
	// samplelst or non dict terms
	return DEFAULT_SAMPLE_TYPE //later own term needs to know what type annotates based on the samples
}

export function getParentType(types: Set<string>, ds: any) {
	if (Object.keys(ds.cohort.termdb.sampleTypes).length == 0) return null //dataset only has one type of sample
	const ids = Array.from(types)
	if (!ids || ids.length == 0) return null
	for (const id of ids) {
		const typeObj = ds.cohort.termdb.sampleTypes[id]
		if (!typeObj) continue
		if (typeObj.parent_id == null) return id //this is the root type
		//if my parent is in the list, then I am not the parent
		if (ids.includes(typeObj.parent_id)) continue
		else return typeObj.parent_id //my parent is not in the list, so I am the parent
	}
	return null //no parent found
}

//Returns human readable label for each term type; label is just for printing and not computing
const typeMap: { [key: string]: string } = {
	categorical: 'Categorical',
	condition: 'Condition',
	float: 'Numerical',
	integer: 'Numerical',
	geneExpression: 'Gene Expression',
	ssGSEA: 'Geneset Expression',
	dnaMethylation: 'DNA Methylation',
	geneVariant: 'Gene Variant',
	metaboliteIntensity: 'Metabolite Intensity',
	wholeProteomeAbundance: 'Whole Proteome Abundance',
	multivalue: 'Multi Value',
	singleCellGeneExpression: 'Single Cell, Gene Expression',
	singleCellCellType: 'Single Cell, Cell Type',
	snplocus: 'SNP Locus',
	snp: 'SNP',
	snplst: 'SNP List',
	termCollection: 'Term Collection'
}

export function termType2label(type: string) {
	return typeMap[type] || 'Unknown term type'
}

export function getDateFromNumber(value: number) {
	const year = Math.floor(value)
	const january1st = new Date(year, 0, 1)
	const totalDays = getDaysInYear(year)
	const time = Math.round((value - year) * totalDays) * oneDayTime
	const date = new Date(january1st.getTime() + time)
	return date
}
/*
Value is a decimal year.
A decimal year is a way of expressing a date or time period as a year with a decimal part, where the decimal portion 
represents the fraction of the year that has elapsed. 
Example:
2025.0 represents the beginning of the year 2025. 
2025.5 represents the middle of the year 2025. 
 */
const oneDayTime = 24 * 60 * 60 * 1000

export function getDateStrFromNumber(value: number) {
	const date = getDateFromNumber(value)

	//Omit day to  deidentify the patients
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long'
	})
}

//The value returned is a decimal year
//A decimal year is a way of expressing a date or time period as a year with a decimal part, where the decimal portion
//represents the fraction of the year that has elapsed.
export function getNumberFromDateStr(str: string) {
	const date = new Date(str)
	return getNumberFromDate(date)
}

export function getNumberFromDate(date: Date) {
	const year = date.getFullYear()
	const january1st: Date = new Date(year, 0, 1)
	const diffDays = (date.getTime() - january1st.getTime()) / oneDayTime
	const daysTotal = getDaysInYear(year)
	const decimal = diffDays / daysTotal
	return year + decimal
}

export function getDaysInYear(year: number) {
	const isLeap = new Date(year, 1, 29).getMonth() === 1
	const days = isLeap ? 366 : 365
	return days
}
