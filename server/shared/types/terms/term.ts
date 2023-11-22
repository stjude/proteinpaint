export type Term = {
	name: string
	type: string
	child_types?: string[]
	hashtmldetail?: boolean
	included_types?: string[]
	isleaf?: boolean
}

export type BaseValue = {
	key: string
	value: string
	label?: string
}

export type BaseQ = {
	isAtomic: true
}
