import type { Filter } from '../filter.ts'

/** nested sample counts of a sunburst, one ring per term wrapper */
export type SunburstRequest = {
	genome: string
	dslabel: string
	/** ring term wrappers, inside out: categorical, or numeric in discrete (binned) mode; each must have
	 *  a unique $id */
	twLst: any[]
	filter?: Filter
	filter0?: any
	/** injected by server middleware for access control */
	__protected__?: any
	__abortSignal?: any
}

/** one wedge: a category of its ring's term, under its parent wedge's category */
export type SunburstNode = {
	/** category key in rings[ring].categories */
	key: string
	/** samples under the wedge; includes the samples that have no value for the next ring and so
	 *  end here, which is the difference between count and the sum of children[].count */
	count: number
	children?: SunburstNode[]
}

/** a category of one ring and how to select its samples: `tvs` holds the tvs fields without `term`
 *  (values for a categorical term, ranges for a numeric bin), `filter` the filter of a filter-type
 *  group of a groupset. The client joins the ring's term to a tvs */
export type SunburstCategory = {
	label: string
	/** the term's own category, group or bin colour, when it has one */
	color?: string
	tvs?: { values: { key: string | number; label?: string }[] } | { ranges: any[] }
	filter?: Filter
}

export type SunburstResponse = {
	/** samples with a value for the first ring, i.e. the samples in the chart */
	total: number
	/** samples passing the filter that have no value, or a hidden one (tw.q.hiddenValues), for the first ring and are not shown */
	noFirstRingValue: number
	/** per ring, in twLst order */
	rings: { categories: { [key: string]: SunburstCategory } }[]
	/** first-ring wedges; children are ordered by groupset, bin or term value order, else by count */
	nodes: SunburstNode[]
	/** the counted unit, e.g. patient(s), primary sample(s); added by the route */
	unit?: { one: string; many: string }
}
