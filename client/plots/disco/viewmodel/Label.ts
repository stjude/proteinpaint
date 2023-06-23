import Arc from './Arc'
import Line from './Line'

export default class Label extends Arc {
	constructor(
		readonly startAngle: number,
		readonly endAngle: number,
		readonly innerRadius: number,
		readonly outerRadius: number,
		readonly angle: number,
		readonly value: number,
		readonly label: string,
		readonly mname: string,
		readonly color: any,
		readonly dataClass: any,
		readonly chr: string,
		readonly position: number,
		readonly transform: string,
		readonly textAnchor: string,
		readonly ccAngle: number,
		readonly line: Line,
		readonly isCancerGene: boolean
	) {
		super(startAngle, endAngle, innerRadius, outerRadius, color, label)
	}
}
