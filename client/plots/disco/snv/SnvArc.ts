import type Arc from '#plots/disco/arc/Arc.ts'

export default interface SnvArc extends Arc {
	readonly dataClass: string
	readonly mname: string
	readonly chr: string
	readonly pos: number
	readonly sampleName: string[]
}
