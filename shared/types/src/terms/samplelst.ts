import type { BaseTerm, MinBaseQ } from '../index.ts'
import type { TermWrapper } from './tw.ts'
import type { Filter } from '../filter.ts'

/*
--------EXPORTED--------
SampleLstGroup
SampleLstGroupByList
SampleLstGroupByFilter
SampleFilterGroup
SampleLstTermValues
SampleLstQ
SampleLstTerm
SampleLstTW
SampleLstSettingInstance

*/

/** A sample group, of a samplelst term (tw.q.groups[]) or of a two-group analysis
(samplelst.groups[]). It either lists its samples or is defined by a filter, and not both: a group
with `values` is read as its list. */
export type SampleLstGroup = SampleLstGroupByList | SampleLstGroupByFilter

type SampleLstGroupBase = {
	name: string
	/** false for the samples that are not in `values` */
	in?: boolean
}

/** A group that lists its samples, such as the ones picked on a plot */
export type SampleLstGroupByList = SampleLstGroupBase & {
	values: { sampleId: number | string; sample?: string }[]
	filter?: never
	filter0?: never
	sampleCount?: never
	mapParent2Children?: never
}

/** A group defined by a filter: the server resolves the samples that the filter selects for the
request, and no sample is listed */
export type SampleLstGroupByFilter = SampleLstGroupBase & {
	filter: Filter
	values?: never
	/** the cohort filter that the group was made with, for a dataset that takes one (null for none).
	 * It is used in place of the request's */
	filter0?: any
	/** the number of samples that the client was told the filter selects when the group was made */
	sampleCount?: number
	/** as for the termdb getsamplelist query */
	mapParent2Children?: boolean
}

/** A group that is defined by a filter, as a request gives one that has no use for a group name:
the filter with what its samples depend on */
export type SampleFilterGroup = Pick<SampleLstGroupByFilter, 'filter' | 'filter0' | 'mapParent2Children'>

export type SampleLstTermValues = {
	[index: string | number]: {
		name: string
		inuse: boolean
		list: { sampleId: string; sample: string }[]
		values: any
	}
}

export type SampleLstQ = MinBaseQ & {
	groups: SampleLstGroup[]
}

export type SampleLstTerm = BaseTerm & {
	values: SampleLstTermValues
}

export type SampleLstTW = TermWrapper & {
	q: SampleLstQ
	term: SampleLstTerm
}
