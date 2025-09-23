import { dtgeneexpression, dtssgsea, dtmetaboliteintensity, TermTypeGroups, dtTerms } from './common.js'

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

//Term types should be used gradually using these constants instead of hardcoding the values,
// eg: type == TermTypes.CATEGORICAL instead of type == 'categorical'
export const TermTypes = {
	GENE_VARIANT: 'geneVariant',
	GENE_EXPRESSION: 'geneExpression',
	SSGSEA: 'ssGSEA',
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
	SINGLECELL_CELLTYPE: 'singleCellCellType',
	MULTIVALUE: 'multivalue',
	DATE: 'date'
}
export const dtTermTypes = new Set(dtTerms.map(t => t.type))
for (const dtTermType of dtTermTypes) {
	TermTypes[dtTermType.toUpperCase()] = dtTermType
}

export const NUMERIC_DICTIONARY_TERM = 'numericDictTerm'

export const TermTypes2Dt = {
	[TermTypes.GENE_EXPRESSION]: dtgeneexpression,
	[TermTypes.SSGSEA]: dtssgsea,
	[TermTypes.METABOLITE_INTENSITY]: dtmetaboliteintensity
}

// maps term type to group (as is shown as toggles in search ui)
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
	[TermTypes.SSGSEA]: TermTypeGroups.SSGSEA,
	[TermTypes.METABOLITE_INTENSITY]: TermTypeGroups.METABOLITE_INTENSITY
}

const nonDictTypes = new Set([
	TermTypes.SNP,
	TermTypes.SNP_LIST,
	TermTypes.SNP_LOCUS,
	TermTypes.GENE_EXPRESSION,
	TermTypes.SSGSEA,
	TermTypes.GENE_VARIANT,
	TermTypes.METABOLITE_INTENSITY,
	TermTypes.SINGLECELL_GENE_EXPRESSION,
	TermTypes.SINGLECELL_CELLTYPE
])
for (const dtTermType of dtTermTypes) {
	nonDictTypes.add(TermTypes[dtTermType.toUpperCase()])
}

export const numericTypes = new Set([
	TermTypes.INTEGER,
	TermTypes.FLOAT,
	TermTypes.GENE_EXPRESSION,
	TermTypes.SSGSEA,
	TermTypes.METABOLITE_INTENSITY,
	TermTypes.SINGLECELL_GENE_EXPRESSION,
	TermTypes.DATE
])

// available termdb numeric table names used as anno_<term.type>,
// for example anno_integer, anno_float, anno_date
export const annoNumericTypes = new Set([TermTypes.INTEGER, TermTypes.FLOAT, TermTypes.DATE])

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
		case TermTypes.SSGSEA:
			return t1.id == t2.id
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
export function getSampleType(term, ds) {
	if (!term) return null
	//non dict terms annotate only samples, eg: gene expression, metabolite intensity, gene variant.
	//Their sample type is the default sample type that may or may not have a parent type, depending on the dataset
	if (term.type && isNonDictionaryType(term.type)) return DEFAULT_SAMPLE_TYPE
	//dictionary terms may annotate different types of samples, eg: patient and sample or mouse and crop.
	if (term.id) return ds.cohort.termdb.term2SampleType.get(term.id)
	if (term.type == 'samplelst') {
		const key = Object.keys(term.values)[0]
		const sampleId = term.values[key].list[0]?.sampleId
		// sampleId2Type expects number as key
		if (sampleId) return ds.sampleId2Type.get(Number(sampleId))
		else return DEFAULT_SAMPLE_TYPE
	}
	// samplelst or non dict terms
	return DEFAULT_SAMPLE_TYPE //later own term needs to know what type annotates based on the samples
}

export function getParentType(types, ds) {
	if (Object.keys(ds.cohort.termdb.sampleTypes).length == 0) return null //dataset only has one type of sample
	const ids = Array.from(types)
	if (!ids || ids.length == 0) return null
	for (const id of ids) {
		const typeObj = ds.cohort.termdb.sampleTypes[id]
		if (typeObj.parent_id == null) return id //this is the root type
		//if my parent is in the list, then I am not the parent
		if (ids.includes(typeObj.parent_id)) continue
		else return typeObj.parent_id //my parent is not in the list, so I am the parent
	}
	return null //no parent found
}

//Returns human readable label for each term type; label is just for printing and not computing
const typeMap = {
	categorical: 'Categorical',
	condition: 'Condition',
	float: 'Numerical',
	integer: 'Numerical',
	geneExpression: 'Gene Expression',
	ssGSEA: 'Geneset Expression',
	geneVariant: 'Gene Variant',
	metaboliteIntensity: 'Metabolite Intensity',
	multiValue: 'Multi Value',
	singleCellGeneExpression: 'Single Cell, Gene Expression',
	singleCellCellType: 'Single Cell, Cell Type',
	snplocus: 'SNP Locus',
	snp: 'SNP',
	snplst: 'SNP List',
	numericDictTerm: 'Numeric Dictionary Term'
}

export function termType2label(type) {
	return typeMap[type] || 'Unknown term type'
}

export function getDateFromNumber(value) {
	const year = Math.floor(value)
	const january1st = new Date(year, 0, 1)
	const totalDays = getDaysInYear(year)
	const time = Math.round((value - year) * totalDays) * oneDay
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
const oneDay = 24 * 60 * 60 * 1000

export function getDateStrFromNumber(value) {
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
export function getNumberFromDateStr(str) {
	const date = new Date(str)
	return getNumberFromDate(date)
}

export function getNumberFromDate(date) {
	const year = date.getFullYear()
	const january1st = new Date(year, 0, 1)
	const diffDays = (date - january1st) / oneDay
	const daysTotal = getDaysInYear(year)
	const decimal = diffDays / daysTotal
	return year + decimal
}

export function getDaysInYear(year) {
	const isLeap = new Date(year, 1, 29).getMonth() === 1
	const days = isLeap ? 366 : 365
	return days
}
