import type Arc from '#plots/disco/arc/Arc.ts'

export default interface Chromosome extends Arc {
	readonly angle: number
	readonly start: number
	readonly size: number
	readonly factor: number
}
