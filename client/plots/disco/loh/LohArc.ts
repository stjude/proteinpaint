import type Arc from '#plots/disco/arc/Arc.ts'

export default interface LohArc extends Arc {
	readonly chr: string
	readonly start: number
	readonly stop: number
	readonly value: number
}
