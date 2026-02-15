import type Arc from '#plots/disco/arc/Arc.ts'
import type Data from '#plots/disco/data/Data.ts'

export default interface SnvArc extends Arc {
	readonly dataClass: string
	readonly mname: string
	readonly chr: string
	readonly pos: number
	readonly refCount?: Data['refCount']
	readonly altCount?: Data['altCount']
	readonly sampleName: string[]
}
