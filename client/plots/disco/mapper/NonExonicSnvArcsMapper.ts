import Reference from './Reference'
import Data from './Data'
import MLabel from './MLabel'
import SnvArc from '#plots/disco/viewmodel/SnvArc'
import Settings from '#plots/disco/viewmodel/Settings'

export default class NonExonicSnvArcsMapper {
	private settings: Settings
	private sampleName: string
	private reference: Reference
	private onePxArcAngle: number

	constructor(settings: Settings, sampleName: string, reference: Reference) {
		this.settings = settings
		this.sampleName = sampleName
		this.reference = reference

		this.onePxArcAngle = 1 / settings.rings.nonExonicInnerRadius
	}

	map(arcData: Array<Data>): Array<SnvArc> {
		const innerRadius = this.settings.rings.nonExonicInnerRadius
		const outerRadius = innerRadius + this.settings.rings.nonExonicWidht

		const arcs: Array<SnvArc> = []

		arcData.forEach((data) => {
			const mLabel = MLabel.getInstance().mlabel ? MLabel.getInstance().mlabel[data.mClass] : undefined

			const startAngle = this.calculateStartAngle(data)
			const endAngle = this.calculateEndAngle(data)
			const arc = new SnvArc(
				startAngle,
				endAngle,
				innerRadius,
				outerRadius,
				mLabel.color,
				data.gene,
				mLabel.label,
				data.mname,
				data.chr,
				data.pos
			)

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
