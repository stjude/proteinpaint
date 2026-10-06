import type { Filter } from '../filter.ts'

/** one treatment phase or other time interval on a lane, days from the dataset's time origin */
export type SwimmerRange = {
	/** raw category key from the range file; ds.queries.swimmer.categories maps it to label/color */
	category: string
	start: number
	/** null when the source row has no end (e.g. NA): an ongoing interval, drawn up to the lane end with an
	arrowhead */
	end: number | null
}

/** one clinical event on a lane */
export type SwimmerPoint = {
	/** raw event key from the point file; ds.queries.swimmer.events maps it to label/color */
	event: string
	time: number
	/** optional sample the event refers to (e.g. the CSF sample collected at this time), from the
	point file's optional 4th column. only sent when the sample is in the db and the user may access it;
	the client then opens its sample view on click */
	sample?: string
	sampleId?: number
	/** only when the request has pointTerm and the point sample has a value for it: the category label
	(bin label for a numeric term) used to color the marker */
	category?: string
}

/** one lane, i.e. one patient */
export type SwimmerLane = {
	sample: string
	sampleId: number
	ranges: SwimmerRange[]
	points: SwimmerPoint[]
	/** only when the request has term0: the divide-by categories (labels) of this patient, from the patient or,
	for a term of a lower level, from all its samples. several for a multivalue term or for samples in different
	categories, the lane is then drawn in each group. absent when neither has a value for term0 */
	divideBy?: string[]
}

export type SwimmerRequest = {
	genome: string
	dslabel: string
	/** optional termdb filter; only lanes of patients passing the filter (and access control) are returned */
	filter?: Filter
	/** optional divide-by term wrapper; lanes are then split into one panel per category */
	term0?: any
	/** optional sample names (e.g. the samples shown in sample view); only the lanes of these patients or of the
	patients of these samples are returned */
	samples?: string[]
	/** optional term wrapper of a point-sample term (e.g. a CSF term) to mark the linked points by */
	pointTerm?: any
	/** injected by server middleware for access control */
	__protected__?: any
}

export type SwimmerResponse = {
	lanes: SwimmerLane[]
	/** only with term0: divide-by category labels in display order (bin order for numeric terms,
	term.values order for categorical terms, then any other label alphabetically) */
	divideByOrder?: string[]
	/** only with pointTerm: point category labels in display order, ordered as divideByOrder */
	pointCategoryOrder?: string[]
}
