import Data from './Data'
import Reference from './Reference'
import Label from '#plots/disco/viewmodel/Label'
import LabelFactory from '#plots/disco/viewmodel/LabelFactory'
import MLabel from '#plots/disco/mapper/MLabel'

export default class LabelsMapper {
	private settings: any
	private sampleName: string
	private reference: Reference

	constructor(settings: any, sampleName: string, reference: Reference) {
		this.settings = settings
		this.sampleName = sampleName
		this.reference = reference
	}

	map(data: Array<Data>): Array<Label> {
		const innerRadius = this.settings.rings.labelLinesInnerRadius
		const outerRadius = innerRadius + this.settings.rings.labelsToLinesDistance

		const labels: Array<Label> = []

		data.forEach((data) => {
			const startAngle = this.calculateStartAngle(data)
			const endAngle = this.calculateEndAngle(data)

			const mLabel = MLabel.getInstance().mlabel ? MLabel.getInstance().mlabel[data.mClass] : undefined

			const label = LabelFactory.createLabel(
				startAngle,
				endAngle,
				innerRadius,
				outerRadius,
				data.value,
				data.gene,
				data.mname,
				mLabel.color,
				mLabel.label,
				data.chr,
				data.position,
				data.isCancerGene,
				this.settings.rings.labelsToLinesGap
			)

			labels.push(label)
		})

		return labels
	}

	private calculateStartAngle(data: Data) {
		const index = this.reference.chromosomesOrder.findIndex((element) => element == data.chr)
		const chromosome = this.reference.chromosomes[index]

		return (
			chromosome.startAngle + (chromosome.endAngle - chromosome.startAngle) * (Number(data.position) / chromosome.size)
		)
	}

	private calculateEndAngle(data: Data) {
		const index = this.reference.chromosomesOrder.indexOf(data.chr)
		const chromosome = this.reference.chromosomes[index]

		return (
			chromosome.startAngle + (chromosome.endAngle - chromosome.startAngle) * (Number(data.position) / chromosome.size)
		)
	}
}
