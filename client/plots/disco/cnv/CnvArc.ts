import type Arc from '#plots/disco/arc/Arc.ts'

export default interface CnvArc extends Arc {
	readonly dt: number
	readonly dataClass?: string
	readonly chr: string
	readonly start: number
	readonly stop: number
	readonly value: number
	readonly unit: string
	readonly sampleName: string[]
}
