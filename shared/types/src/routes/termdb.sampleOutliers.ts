import type { ErrorResponse } from './errorResponse.ts'

/** which data of ds.queries the outliers are of: ssGSEA gene set scores, or gene expression */
export type SampleOutliersKind = 'ssGSEA' | 'geneExpression'

export type TermdbSampleOutliersRequest = {
	/** Genome id */
	genome: string
	/** Dataset label */
	dslabel: string
	/** sample name */
	sample: string
	kind: SampleOutliersKind
	/** the reference group: 'all' for all samples, the termId of a ds.cohort.termdb.sampleView.outliers.referenceGroups[]
	entry, for the samples sharing the sample's value of that term, or 'custom' for the samples of .referenceFilter;
	default: the first available entry, else 'all' */
	reference?: string
	/** with reference 'custom': the filter of the samples of a group the user built; the sample may or may not
	be in it */
	referenceFilter?: any
	/** most rows returned in each direction (highest and lowest z-scores); default: all */
	limit?: number
}

/** a reference group the sample can be compared with */
export type SampleOutliersReference = {
	/** 'all', a termId, or 'custom' */
	id: string
	/** e.g. 'Same diagnosis' */
	label: string
	/** the sample's value of the term, e.g. 'BCP-ALL'; absent for 'all' */
	value?: string
	/** number of other samples in the group */
	n: number
	/** why the group cannot be used, e.g. too few samples; absent when it can */
	unavailable?: string
}

/** a gene or gene set: the sample's value and its z-score against the reference group */
export type SampleOutlierRow = {
	/** gene or gene set name */
	name: string
	/** the sample's value: ssGSEA score, or FPKM etc as in the file */
	value: number
	/** (value - mean) / sd of the reference group, with expression values on the log2(value+1) scale and the sd of
	a gene at least 0.25 */
	z: number
}

type ValidResponse = {
	/** the reference group the z-scores are against */
	reference: SampleOutliersReference
	/** every reference group offered for the sample */
	references: SampleOutliersReference[]
	/** rows of z-scores of 0 or above, highest first */
	high: SampleOutlierRow[]
	/** rows of negative z-scores, lowest first */
	low: SampleOutlierRow[]
	/** number of rows with a z-score */
	total: number
	/** unit of the values, e.g. FPKM */
	unit?: string
}

export type TermdbSampleOutliersResponse = ValidResponse | ErrorResponse
