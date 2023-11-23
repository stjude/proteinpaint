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
	filter?: any // trying to avoid circular dependency
}

export type TermValues = {
	[key: string | number]: BaseValue
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
}

export type BaseQ = {
	isAtomic?: true
	reuseId?: string
	name?: string
	hiddenValues?: {
		[key: string]: boolean | number
	}
}
