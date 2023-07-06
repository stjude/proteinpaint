import Arc from './Arc'
import Line from './Line'
import Mutation from '#plots/disco/viewmodel/Mutation.ts'

export default class Label extends Arc {
	constructor(
		readonly startAngle: number,
		readonly endAngle: number,
		readonly innerRadius: number,
		readonly outerRadius: number,
		readonly angle: number,
		readonly value: number,
		readonly gene: string,
		readonly transform: string,
		readonly textAnchor: string,
		readonly ccAngle: number,
		readonly line: Line,
		readonly isCancerGene: boolean,
		readonly mutations: Array<Mutation> = []
	) {
		super(startAngle, endAngle, innerRadius, outerRadius, mutations[0].color, gene)
	}
}
