import type Reference from '#plots/disco/chromosome/Reference.ts'
import type Data from '#plots/disco/data/Data.ts'
import Fusion from './Fusion.ts'
import FusionSubgroup from './FusionSubgroup.ts'

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

		fusionData.forEach(data => {
			const genes = new Set<string>()
			genes.add(data.geneA)
			genes.add(data.geneB)

			/** skip any null (i.e. from isoforms or minor chrs) fusions */
			const startAngle = this.calculateStartAngle(data.chrA, data.posA)
			const endAngle = this.calculateEndAngle(data.chrA, data.posA)
			if (startAngle === null || endAngle === null) return

			const source = new FusionSubgroup(
				startAngle,
				endAngle,
				this.radius,
				data.geneA,
				data.value,
				genes,
				{
					chromosome: data.chrA,
					position: data.posA
				},
				data.strandA
			)

			let target
			if (data.chrB && data.posB) {
				/** skip any null (i.e. from isoforms or minor chrs) fusions */
				const startAngle = this.calculateStartAngle(data.chrB, data.posB)
				const endAngle = this.calculateEndAngle(data.chrB, data.posB)
				if (startAngle === null || endAngle === null) return
				target = new FusionSubgroup(
					startAngle,
					endAngle,
					this.radius,
					data.geneB,
					data.value,
					genes,
					{
						chromosome: data.chrB,
						position: data.posB
					},
					data.strandB
				)
			}
			const fusion = new Fusion(source, target, 'genes', -1, 'Endpoints')

			fusions.push(fusion)
		})

		return fusions
	}

	calculateStartAngle(chr: string, pos: number) {
		const index = this.reference.chromosomesOrder.indexOf(chr)
		/** Return null for isforms or minor chr */
		if (index === -1) return null
		const chromosome = this.reference.chromosomes[index]
		// TODO calculate 0.01 base on BPs
		return (
			chromosome.startAngle + (chromosome.endAngle - chromosome.startAngle) * (Number(pos) / chromosome.size) - 0.01
		)
	}

	private calculateEndAngle(chr: string, pos: number) {
		const index = this.reference.chromosomesOrder.indexOf(chr)
		/** Return null for isforms or minor chr*/
		if (index === -1) return null
		const chromosome = this.reference.chromosomes[index]
		// TODO calculate 0.01 base on BPs
		return (
			0.01 + chromosome.startAngle + (chromosome.endAngle - chromosome.startAngle) * (Number(pos) / chromosome.size)
		)
	}
}
