import { HiddenValues, GroupSettingQ, GroupEntry } from './term.ts'

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
}
