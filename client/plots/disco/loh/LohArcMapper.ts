import type Reference from '#plots/disco/chromosome/Reference.ts'
import type Data from '#plots/disco/data/Data.ts'
import type LohArc from './LohArc.ts'
import GradientColorProvider from './GradientColorProvider.ts'

export default class LohArcMapper {
	private sampleName: string
	private reference: Reference
	private lohInnerRadius: number
	private lohWidth: number

	constructor(lohInnerRadius: number, lohWidth: number, sampleName: string, reference: Reference) {
		this.lohInnerRadius = lohInnerRadius
		this.lohWidth = lohWidth
		this.sampleName = sampleName
		this.reference = reference
	}

	map(arcData: Array<Data>): Array<LohArc> {
		const arcs: Array<LohArc> = []

		arcData.forEach(data => {
			const startAngle = this.calculateStartAngle(data)
			const endAngle = this.calculateEndAngle(data)

			if (startAngle === null || endAngle === null) return

			const innerRadius = this.lohInnerRadius
			const outerRadius = innerRadius + this.lohWidth
			const color = GradientColorProvider.provide(data.segmean)

			const arc: LohArc = {
				startAngle: startAngle,
				endAngle: endAngle,
				innerRadius: innerRadius,
				outerRadius: outerRadius,
				color: color,
				text: data.gene,
				chr: data.chr,
				start: data.start,
				stop: data.stop,
				value: data.segmean
			}

			arcs.push(arc)
		})

		return arcs
	}

	private calculateStartAngle(data: Data) {
		const index = this.reference.chromosomesOrder.indexOf(data.chr)
		if (index === -1) return null
		const chromosome = this.reference.chromosomes[index]
		return (
			chromosome.startAngle + (chromosome.endAngle - chromosome.startAngle) * (Number(data.start) / chromosome.size)
		)
	}

	private calculateEndAngle(data: Data) {
		const index = this.reference.chromosomesOrder.indexOf(data.chr)
		const chromosome = this.reference.chromosomes[index]
		return chromosome.startAngle + (chromosome.endAngle - chromosome.startAngle) * (Number(data.stop) / chromosome.size)
	}
}
