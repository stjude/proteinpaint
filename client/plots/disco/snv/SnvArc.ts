import Arc from '#plots/disco/arc/Arc'

export default interface SnvArc extends Arc {
	readonly dataClass: string
	readonly mname: string
	readonly chr: string
	readonly pos: number
}
