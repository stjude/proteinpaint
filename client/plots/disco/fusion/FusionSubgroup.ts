import { RibbonSubgroup } from 'd3'
import PositionInChromosome from './PositionInChromosome'

export default class FusionSubgroup implements RibbonSubgroup {
	startAngle: number
	endAngle: number
	radius: number

	gene: string
	value: number
	genes: Set<string>
	positionInChromosome: PositionInChromosome
	constructor(
		startAngle: number,
		endAngle: number,
		radius: number,
		gene: string,
		value: number,
		genes: Set<string>,
		positionInChromosome: PositionInChromosome
	) {
		this.startAngle = startAngle
		this.endAngle = endAngle
		this.radius = radius
		this.gene = gene
		this.value = value
		this.genes = genes
		this.positionInChromosome = positionInChromosome
	}
}
