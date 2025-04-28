import type { RibbonSubgroup } from 'd3'
import type PositionInChromosome from './PositionInChromosome.ts'

export default class FusionSubgroup implements RibbonSubgroup {
	startAngle: number
	endAngle: number
	radius: number

	gene: string
	value: number
	genes: Set<string>
	positionInChromosome: PositionInChromosome
	strand: string

	constructor(
		startAngle: number,
		endAngle: number,
		radius: number,
		gene: string,
		value: number,
		genes: Set<string>,
		positionInChromosome: PositionInChromosome,
		strand: string
	) {
		this.startAngle = startAngle
		this.endAngle = endAngle
		this.radius = radius
		this.gene = gene
		this.value = value
		this.genes = genes
		this.positionInChromosome = positionInChromosome
		this.strand = strand
	}
}
