import Reference from './Reference'
import Data from './Data'
import LohArc from '#plots/disco/viewmodel/LohArc'
import GradientColorProvider from './GradientColorProvider'

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

		arcData.forEach((data) => {
			const startAngle = this.calculateStartAngle(data)
			const endAngle = this.calculateEndAngle(data)

			const innerRadius = this.lohInnerRadius
			const outerRadius = innerRadius + this.lohWidth
			const color = GradientColorProvider.provide(data.segmean)

			const arc = new LohArc(
				startAngle,
				endAngle,
				innerRadius,
				outerRadius,
				color,
				data.gene,
				data.chr,
				data.start,
				data.stop,
				data.segmean
			)

			arcs.push(arc)
		})

		return arcs
	}

	private calculateStartAngle(data: Data) {
		const index = this.reference.chromosomesOrder.indexOf(data.chr)
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
