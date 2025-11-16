import type Arc from '#plots/disco/arc/Arc.ts'

export default interface MutationWaterfallPoint extends Arc {
	readonly chr: string
	readonly position: number
	readonly logDistance: number
	readonly ringInnerRadius: number
	readonly ringWidth: number
	readonly rangeMin: number
	readonly rangeMax: number
}
