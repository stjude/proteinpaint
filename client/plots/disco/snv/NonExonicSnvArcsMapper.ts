import type Reference from '#plots/disco/chromosome/Reference.ts'
import type Data from '#plots/disco/data/Data.ts'
import MLabel from '#plots/disco/label/MLabel.ts'
import type SnvArc from './SnvArc.ts'

export default class NonExonicSnvArcsMapper {
	private sampleName: string
	private reference: Reference
	private onePxArcAngle: number
	private nonExonicInnerRadius: number
	private nonExonicWidht: number

	constructor(nonExonicInnerRadius: number, nonExonicWidht: number, sampleName: string, reference: Reference) {
		this.nonExonicInnerRadius = nonExonicInnerRadius
		this.nonExonicWidht = nonExonicWidht
		this.sampleName = sampleName
		this.reference = reference

		this.onePxArcAngle = 1 / nonExonicInnerRadius
	}

	map(arcData: Array<Data>): Array<SnvArc> {
		const innerRadius = this.nonExonicInnerRadius
		const outerRadius = innerRadius + this.nonExonicWidht

		const arcs: Array<SnvArc> = []

		arcData.forEach(data => {
			const mLabel = MLabel.getInstance().mlabel ? MLabel.getInstance().mlabel[data.mClass] : undefined

			const startAngle = this.calculateStartAngle(data)
			const endAngle = this.calculateEndAngle(data)
			const arc: SnvArc = {
				startAngle: startAngle,
				endAngle: endAngle,
				innerRadius: innerRadius,
				outerRadius: outerRadius,
				color: mLabel.color,
				text: data.gene,
				dataClass: mLabel.label,
				mname: data.mname,
				chr: data.chr,
				pos: data.position,
				sampleName: [data.sampleName]
			}

			arcs.push(arc)
		})

		return arcs
	}

	calculateStartAngle(data: Data) {
		const index = this.reference.chromosomesOrder.indexOf(data.chr)
		const chromosome = this.reference.chromosomes[index]
		return (
			chromosome.startAngle +
			(chromosome.endAngle - chromosome.startAngle) * (Number(data.position) / chromosome.size) -
			this.onePxArcAngle
		)
	}

	private calculateEndAngle(data: Data) {
		const index = this.reference.chromosomesOrder.indexOf(data.chr)
		const chromosome = this.reference.chromosomes[index]
		return (
			this.onePxArcAngle +
			chromosome.startAngle +
			(chromosome.endAngle - chromosome.startAngle) * (Number(data.position) / chromosome.size)
		)
	}
}
