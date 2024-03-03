import { Filter } from '../filter.ts'

/**
 * @param id      term.id for dictionary terms, undefined for non-dictionary terms
 * @params $id    client-generated random unique identifier, to distinguish tw with the same term but different q, that are in the same payload
 */
export type BaseTW = {
	id?: string
	$id?: string
	isAtomic?: true
}

export type BaseValue = {
	key?: string
	uncomputable?: boolean
	label?: string | number
	order?: string
	color?: string
	group?: number
	filter?: Filter
}

export type TermValues = {
	[key: string | number]: BaseValue
}

export type ValuesGroup = {
	name: string
	type: 'values'
	values: { key: number | string; label: string }[]
	color?: string
}

export type FilterGroup = {
	name: string
	type: 'filter'
	filter?: Filter
}

export type GroupEntry = ValuesGroup | FilterGroup

export type BaseGroupSet = {
	groups: GroupEntry[]
}

export type GroupSetEntry = BaseGroupSet & {
	name?: string
	is_grade?: boolean
	is_subcondition?: boolean
}

export type CustomGroupSetting = {
	/** When “predefined_groupset_idx” is undefined, will use this set of groups.
	This is a custom set of groups either copied from predefined set, or created with UI.
	Custom set definition is the same as a predefined set. */
	customset: BaseGroupSet
	disabled?: boolean
	inuse?: boolean
	lst?: GroupSetEntry[] // quick-fix
}

export type PredefinedGroupSetting = {
	/** If true, apply and will require the following attributes */
	inuse?: boolean
	disabled?: boolean
	useIndex?: number
	/**Value is array index of term.groupsetting.lst[] */
	predefined_groupset_idx: number
	lst: GroupSetEntry[]
}

export type EmptyGroupSetting = {
	inuse?: false
	disabled?: true
}

export type Term = {
	id: string
	name: string
	type: string
	child_types?: string[]
	hashtmldetail?: boolean
	included_types?: string[]
	isleaf?: boolean
	values?: TermValues
	groupsetting: PredefinedGroupSetting | CustomGroupSetting | EmptyGroupSetting
}

export type BaseQ = {
	mode?: string
	isAtomic?: true
	reuseId?: string
	name?: string
	hiddenValues?: {
		[key: string]: boolean | number
	}
}
