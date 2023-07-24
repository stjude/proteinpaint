import Arc from '../arc/Arc.ts'

export default interface CnvArc extends Arc {
	readonly chr: string
	readonly start: number
	readonly stop: number
	readonly value: number
	readonly unit: string
}
