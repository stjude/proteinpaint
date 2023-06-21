import Arc from './Arc'

export default class SnvArc extends Arc {
	constructor(
		startAngle: number,
		endAngle: number,
		innerRadius: number,
		outerRadius: number,
		color: string,
		gene: string,
		readonly dataClass: string,
		readonly mname: string,
		readonly chr: string,
		readonly pos: number
	) {
		super(startAngle, endAngle, innerRadius, outerRadius, color, gene)
	}
}
