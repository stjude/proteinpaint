import Arc from './Arc'

export default interface LohArc extends Arc {
	readonly chr: string
	readonly start: number
	readonly stop: number
	readonly value: number
}
