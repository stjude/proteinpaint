import type Data from '#plots/disco/data/Data.ts'

export default interface MutationTooltip {
	readonly mname: string
	readonly color: any
	readonly dataClass: any
	readonly chr: string
	readonly position: number
	readonly refCount?: Data['refCount']
	readonly altCount?: Data['altCount']
	readonly vafs?: Data['vafs']
}
