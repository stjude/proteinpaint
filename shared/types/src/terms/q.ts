import type { CategoricalBaseQ } from './categorical.js'
import type { Filter } from '../filter.js'

// MinBaseQ is BaseQ without .mode and .type
// MinBaseQ should eventually replace BaseQ because .mode and .type
// should be specified in a term-type-specific manner
export type MinBaseQ = {
	/**Automatically set by fillTermWrapper()
	Applies to barchart, survival plot, and cuminc plot.
	Contains categories of a term to be hidden in its chart. This should only apply to client-side rendering, and should not be part of “dataName” when requesting data from server. Server will always provide a summary for all categories. It’s up to the client to show/hide categories.
	This allows the key visibility to be stored in state, while toggling visibility will not trigger data re-request.
	Currently termsetting menu does not manage this attribute. It’s managed by barchart legend.
	*/
	hiddenValues?: HiddenValues
	/**indicates this object should not be extended by a copy-merge tool */
	isAtomic?: true
	name?: string
	reuseId?: string
}

export type RawValuesQ = MinBaseQ & { type?: 'values'; mode?: 'binary' }

export type RawPredefinedGroupsetQ = MinBaseQ & {
	type: 'predefined-groupset'
	mode?: 'binary' | 'discrete'
	predefined_groupset_idx: number
	/** deprecated nested object, will be handled by reshapeLegacyTW() in TwRouter */
	groupsetting?: { inuse?: boolean } & GroupSettingQ
}

export type RawCustomGroupsetQ = MinBaseQ & {
	type: 'custom-groupset'
	mode?: 'binary' | 'discrete'
	customset: {
		groups: GroupEntry[]
	}
	/** deprecated nested object, will be handled by reshapeLegacyTW() in TwRouter */
	groupsetting?: { inuse?: boolean } & GroupSettingQ
	sampleCounts?: { key: string; value?: number; label?: string }[]
}

export type HiddenValues = {
	[index: string]: number
}

/*** types supporting termwrapper q ***/

export type ValuesQ = CategoricalBaseQ & {
	type: 'values'
}

export type PredefinedGroupSettingQ = CategoricalBaseQ & {
	type: 'predefined-groupset'
	predefined_groupset_idx: number
}

export type CustomGroupSettingQ = CategoricalBaseQ & {
	type: 'custom-groupset'
	customset: BaseGroupSet
}

export type FilterQ = MinBaseQ & {
	type: 'filter'
}

export type GroupSettingQ = ValuesQ | FilterQ | PredefinedGroupSettingQ | CustomGroupSettingQ

export type ValuesGroup = {
	name: string
	type: 'values' | string // can remove boolean fallback once problematic js files are converted to .ts and can declare `type: 'values' as const`
	values: { key: number | string; label: string }[]
	uncomputable?: boolean // if true, do not include this group in computations
}

export type FilterGroup = {
	name: string
	type: 'filter'
	filter: Filter
	color: string
}

export type GroupEntry = ValuesGroup | FilterGroup

export type BaseGroupSet = {
	groups: GroupEntry[]
}

type Groupset = {
	name: string
	is_grade?: boolean
	is_subcondition?: boolean
	dt?: number // dt of groupset, used by geneVariant term
} & BaseGroupSet

export type TermGroupSetting = {
	disabled: boolean // true when term has <= 2 values, otherwise false
	lst?: Groupset[] // array of predefined groupsets
}
