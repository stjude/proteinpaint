import Arc from '#plots/disco/arc/Arc'

export default interface Chromosome extends Arc {
	readonly angle: number
	readonly start: number
	readonly size: number
	readonly factor: number
}
