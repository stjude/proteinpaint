import Reference from './Reference'
import Data from './Data'
import Fusion from '#plots/disco/viewmodel/Fusion'
import FusionSubgroup from '#plots/disco/viewmodel/FusionSubgroup'
import PositionInChromosome from '#plots/disco/viewmodel/PositionInChromosome'

export default class FusionMapper {
	private radius: number
	private sampleName: string
	private reference: Reference

	constructor(radius: number, sampleName: string, reference: Reference) {
		this.radius = radius
		this.sampleName = sampleName
		this.reference = reference
	}

	map(fusionData: Array<Data>): Array<Fusion> {
		const fusions: Array<Fusion> = []

		fusionData.forEach((data) => {
			const genes = new Set<string>()
			genes.add(data.geneA)
			genes.add(data.geneB)

			const source = new FusionSubgroup(
				this.calculateStartAngle(data.chrA, data.posA),
				this.calculateEndAngle(data.chrA, data.posA),
				this.radius,
				data.geneA,
				data.value,
				genes,
				new PositionInChromosome(data.chrA, data.posA)
			)

			const target = new FusionSubgroup(
				this.calculateStartAngle(data.chrB, data.posB),
				this.calculateEndAngle(data.chrB, data.posB),
				this.radius,
				data.geneB,
				data.value,
				genes,
				new PositionInChromosome(data.chrB, data.posB)
			)

			const fusion = new Fusion(source, target, 'genes', -1, 'Endpoints')

			fusions.push(fusion)
		})

		return fusions
	}

	calculateStartAngle(chr: string, pos: number) {
		const index = this.reference.chromosomesOrder.indexOf(chr)
		const chromosome = this.reference.chromosomes[index]
		// TODO calculate 0.01 base on BPs
		return (
			chromosome.startAngle + (chromosome.endAngle - chromosome.startAngle) * (Number(pos) / chromosome.size) - 0.01
		)
	}

	private calculateEndAngle(chr: string, pos: number) {
		const index = this.reference.chromosomesOrder.indexOf(chr)
		const chromosome = this.reference.chromosomes[index]
		// TODO calculate 0.01 base on BPs
		return (
			0.01 + chromosome.startAngle + (chromosome.endAngle - chromosome.startAngle) * (Number(pos) / chromosome.size)
		)
	}
}
