import {
	dtgeneexpression,
	dtssgsea,
	dtdnamethylation,
	dtmetaboliteintensity,
	dtwholeproteomeabundance,
	TermTypeGroups,
	dtTerms
} from './common.js'
import { TermTypeGroups as TermTypeGroups2 } from './common.js'
const ROOT_SAMPLE_TYPE = 1
const DEFAULT_SAMPLE_TYPE = 2
const NumericModes = {
	continuous: 'continuous',
	discrete: 'discrete'
}
const CATEGORICAL = 'categorical'
const CONDITION = 'condition'
const DATE = 'date'
const DNA_METHYLATION = 'dnaMethylation'
const FLOAT = 'float'
const GENE_VARIANT = 'geneVariant'
const GENE_EXPRESSION = 'geneExpression'
const INTEGER = 'integer'
const METABOLITE_INTENSITY = 'metaboliteIntensity'
const MULTIVALUE = 'multivalue'
const SAMPLELST = 'samplelst'
const SINGLECELL_CELLTYPE = 'singleCellCellType'
const SINGLECELL_GENE_EXPRESSION = 'singleCellGeneExpression'
const SNP = 'snp'
const SNP_LIST = 'snplst'
const SNP_LOCUS = 'snplocus'
const SSGSEA = 'ssGSEA'
const SURVIVAL = 'survival'
const TERM_COLLECTION = 'termCollection'
const WHOLE_PROTEOME_ABUNDANCE = 'wholeProteomeAbundance'
const TermTypes = {
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
const dtTermTypes = new Set(dtTerms.map(t => t.type))
for (const dtTermType of dtTermTypes) {
	TermTypes[dtTermType.toUpperCase()] = dtTermType
}
const NUMERIC_DICTIONARY_TERM = 'numericDictTerm'
const TermTypes2Dt = {
	[GENE_EXPRESSION]: dtgeneexpression,
	[SSGSEA]: dtssgsea,
	[DNA_METHYLATION]: dtdnamethylation,
	[METABOLITE_INTENSITY]: dtmetaboliteintensity,
	[WHOLE_PROTEOME_ABUNDANCE]: dtwholeproteomeabundance
}
const typeGroup = {
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
const nonDictTypes = /* @__PURE__ */ new Set([
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
const numericTypes = /* @__PURE__ */ new Set([
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
const annoNumericTypes = /* @__PURE__ */ new Set([INTEGER, FLOAT, DATE])
const categoricalTypes = /* @__PURE__ */ new Set([CATEGORICAL, SNP])
const singleCellTerms = /* @__PURE__ */ new Set([SINGLECELL_CELLTYPE, SINGLECELL_GENE_EXPRESSION])
function isSingleCellTerm(term) {
	if (!term) return false
	return singleCellTerms.has(term.type)
}
function isNumericTerm(term) {
	if (!term) return false
	return numericTypes.has(term.type)
}
function isCategoricalTerm(term) {
	if (!term) return false
	return categoricalTypes.has(term.type)
}
function isDictionaryType(type) {
	return !isNonDictionaryType(type)
}
function isNonDictionaryType(type) {
	if (!type) throw new Error('Type is not defined')
	return nonDictTypes.has(type)
}
function equals(t1, t2) {
	if (!t1) throw new Error('First term is not defined ')
	if (!t2) throw new Error('Second term is not defined ')
	if (t1.type !== t2.type) return false
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
function getBin(lst, value) {
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
function getSampleType(term, ds) {
	if (!term) return null
	if (term.type && isNonDictionaryType(term.type)) return DEFAULT_SAMPLE_TYPE
	if (term.id) return ds.cohort.termdb.term2SampleType.get(term.id)
	if (term.type == 'samplelst') {
		const key = Object.keys(term.values)[0]
		const sampleId = term.values[key].list[0]?.sampleId
		if (sampleId) return ds.sampleId2Type.get(Number(sampleId) || sampleId)
		else return DEFAULT_SAMPLE_TYPE
	}
	return DEFAULT_SAMPLE_TYPE
}
function getParentType(types, ds) {
	if (Object.keys(ds.cohort.termdb.sampleTypes).length == 0) return null
	const ids = Array.from(types)
	if (!ids || ids.length == 0) return null
	for (const id of ids) {
		const typeObj = ds.cohort.termdb.sampleTypes[id]
		if (!typeObj) continue
		if (typeObj.parent_id == null) return id
		if (ids.includes(typeObj.parent_id)) continue
		else return typeObj.parent_id
	}
	return null
}
const typeMap = {
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
	numericDictTerm: 'Numeric Dictionary Term',
	termCollection: 'Term Collection'
}
function termType2label(type) {
	return typeMap[type] || 'Unknown term type'
}
function getDateFromNumber(value) {
	const year = Math.floor(value)
	const january1st = new Date(year, 0, 1)
	const totalDays = getDaysInYear(year)
	const time = Math.round((value - year) * totalDays) * oneDayTime
	const date = new Date(january1st.getTime() + time)
	return date
}
const oneDayTime = 24 * 60 * 60 * 1e3
function getDateStrFromNumber(value) {
	const date = getDateFromNumber(value)
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long'
	})
}
function getNumberFromDateStr(str) {
	const date = new Date(str)
	return getNumberFromDate(date)
}
function getNumberFromDate(date) {
	const year = date.getFullYear()
	const january1st = new Date(year, 0, 1)
	const diffDays = (date.getTime() - january1st.getTime()) / oneDayTime
	const daysTotal = getDaysInYear(year)
	const decimal = diffDays / daysTotal
	return year + decimal
}
function getDaysInYear(year) {
	const isLeap = new Date(year, 1, 29).getMonth() === 1
	const days = isLeap ? 366 : 365
	return days
}
export {
	CATEGORICAL,
	CONDITION,
	DATE,
	DEFAULT_SAMPLE_TYPE,
	DNA_METHYLATION,
	FLOAT,
	GENE_EXPRESSION,
	GENE_VARIANT,
	INTEGER,
	METABOLITE_INTENSITY,
	MULTIVALUE,
	NUMERIC_DICTIONARY_TERM,
	NumericModes,
	ROOT_SAMPLE_TYPE,
	SAMPLELST,
	SINGLECELL_CELLTYPE,
	SINGLECELL_GENE_EXPRESSION,
	SNP,
	SNP_LIST,
	SNP_LOCUS,
	SSGSEA,
	SURVIVAL,
	TERM_COLLECTION,
	TermTypeGroups2 as TermTypeGroups,
	TermTypes,
	TermTypes2Dt,
	WHOLE_PROTEOME_ABUNDANCE,
	annoNumericTypes,
	dtTermTypes,
	equals,
	getBin,
	getDateFromNumber,
	getDateStrFromNumber,
	getDaysInYear,
	getNumberFromDate,
	getNumberFromDateStr,
	getParentType,
	getSampleType,
	isCategoricalTerm,
	isDictionaryType,
	isNonDictionaryType,
	isNumericTerm,
	isSingleCellTerm,
	numericTypes,
	termType2label,
	typeGroup
}
