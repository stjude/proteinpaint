import Data from './Data'
import Reference from './Reference'
import Label from '../viewmodel/Label'
import LabelFactory from '../viewmodel/LabelFactory'
import MLabel from './MLabel'
import Mutation from '#plots/disco/viewmodel/Mutation.ts'

export default class LabelsMapper {
	private settings: any
	private sampleName: string
	private reference: Reference

	private labelMap: Map<string, Label> = new Map()

	constructor(settings: any, sampleName: string, reference: Reference) {
		this.settings = settings
		this.sampleName = sampleName
		this.reference = reference
	}

	map(data: Array<Data>): Array<Label> {
		const innerRadius = this.settings.rings.labelLinesInnerRadius
		const outerRadius = innerRadius + this.settings.rings.labelsToLinesDistance

		data.forEach(data => {
			const startAngle = this.calculateStartAngle(data)
			const endAngle = this.calculateEndAngle(data)

			const label = this.labelMap.get(data.gene)
			const mLabel = MLabel.getInstance().mlabel ? MLabel.getInstance().mlabel[data.mClass] : undefined
			if (!label) {
				this.labelMap.set(
					data.gene,
					LabelFactory.createLabel(
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
				)
			} else {
				label.mutations.push(new Mutation(data.mname, mLabel.color, mLabel.label, data.chr, data.position))
			}
		})

		return Array.from(this.labelMap.values())
	}

	private calculateStartAngle(data: Data) {
		const index = this.reference.chromosomesOrder.findIndex(element => element == data.chr)
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
