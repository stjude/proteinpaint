import Arc from '#plots/disco/arc/Arc'

export default interface CnvArc extends Arc {
	readonly chr: string
	readonly start: number
	readonly stop: number
	readonly value: number
	readonly unit: string
}
