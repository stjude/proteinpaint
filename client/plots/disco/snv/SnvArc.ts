import Arc from '../arc/Arc.ts'

export default interface SnvArc extends Arc {
	readonly dataClass: string
	readonly mname: string
	readonly chr: string
	readonly pos: number
}
