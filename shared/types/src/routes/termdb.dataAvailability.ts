import type { Filter } from '../filter.ts'

/** a sample group: defined by a filter, as the groups of a custom variable and a sunburst selection are,
 *  or listing its samples */
export type DataAvailabilityGroup = {
	name: string
	filter?: Filter
	/** the samples of the group, when it lists them instead */
	values?: { sampleId: number | string }[]
	filter0?: any
	mapParent2Children?: boolean
}

/** how many samples of each group have each kind of data of the dataset */
export type DataAvailabilityRequest = {
	genome: string
	dslabel: string
	groups: DataAvailabilityGroup[]
	filter0?: any
	/** the active cohort, as a cohort string (e.g. "ABC"), whose survival terms are counted; empty or
	 *  absent for a dataset without cohorts */
	cohort?: string
	/** injected by server middleware for access control */
	__protected__?: any
}

/** a kind of data that a group's samples may have; a key of DataAvailabilityGroupCounts.data.
 *  geneExpression: the samples of expression plots (queries.geneExpression); rnaseqGeneCount: the samples
 *  of differential expression (queries.rnaseqGeneCount) */
export type DataAvailabilityType =
	| 'geneExpression'
	| 'rnaseqGeneCount'
	| 'dnaMethylation'
	| 'junction'
	| 'NIdata'
	/** patients, of the group's samples, with longitudinal data: the lanes of the swimmer plot */
	| 'longitudinal'

/** the samples of a group that were assayed for one mutation data type, from ds.assayAvailability */
export type DataAvailabilityAssay = {
	/** dt, or dt.origin when the dataset tells the assays of each origin, e.g. "1.somatic" */
	key: string
	/** e.g. "SNV/indel (Somatic)" */
	label: string
	/** samples of the group that were assayed; they may be child samples of the group's samples */
	count: number
}

export type DataAvailabilityGroupCounts = {
	name: string
	/** samples of the group with each kind of data, for each kind in DataAvailabilityResponse.dataTypes */
	data: { [dataType in DataAvailabilityType]?: number }
	/** for a dataset that tells which samples were assayed for each kind of mutation data */
	assays?: DataAvailabilityAssay[]
	/** for a dataset with survival terms */
	survival?: DataAvailabilitySurvival[]
}

/** the patients or samples of a group with a value for a survival term */
export type DataAvailabilitySurvival = {
	termid: string
	name: string
	/** of the term's sample type, e.g. patients, where the dataset has several */
	unit?: string
	count: number
}

/** a kind of data that the groups are counted for, with its label */
export type DataAvailabilityDataType = {
	type: DataAvailabilityType
	label: string
	/** of the counts, when not the unit of the groups, e.g. "patients" for longitudinal data */
	unit?: string
}

export type DataAvailabilityResponse = {
	/** the kinds of data that the dataset has and the request may read, in display order; each group's data{}
	 *  has a count for each of them */
	dataTypes: DataAvailabilityDataType[]
	/** in request order */
	groups: DataAvailabilityGroupCounts[]
}
