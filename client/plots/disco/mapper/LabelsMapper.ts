import Data from './Data'
import Reference from './Reference'
import Label from '../viewmodel/Label'
import LabelFactory from '../viewmodel/LabelFactory'
import MLabel from './MLabel'
import MutationTooltip from '#plots/disco/viewmodel/MutationTooltip.ts'
import Settings from '#plots/disco/Settings.ts'
import FusionColorProvider from '#plots/disco/renderer/FusionColorProvider.ts'
import { MutationTypes } from '#plots/disco/viewmodel/MutationTypes.ts'
import FusionTooltip from '#plots/disco/viewmodel/FusionTooltip.ts'

export default class LabelsMapper {
	private settings: any
	private sampleName: string
	private reference: Reference

	private labelMap: Map<string, Label> = new Map()

	constructor(settings: Settings, sampleName: string, reference: Reference) {
		this.settings = settings
		this.sampleName = sampleName
		this.reference = reference
	}

	map(data: Array<Data>): Array<Label> {
		const innerRadius = this.settings.rings.labelLinesInnerRadius
		const outerRadius = innerRadius + this.settings.rings.labelsToLinesDistance

		data.forEach(data => {
			if (data.dt == MutationTypes.SNV) {
				console.log('data', data)
				const startAngle = this.calculateStartAngle(data.chr, data.position)
				const endAngle = this.calculateEndAngle(data.chr, data.position)

				const mLabel = MLabel.getInstance().mlabel ? MLabel.getInstance().mlabel[data.mClass] : undefined

				this.addLabelOrMutation(
					data,
					data.gene,
					data.mname,
					startAngle,
					endAngle,
					innerRadius,
					outerRadius,
					mLabel.color,
					mLabel.label
				)
			}

			if (data.dt == MutationTypes.FUSION) {
				const startAngleSource = this.calculateStartAngle(data.chrA, data.posA)
				const endAngleSource = this.calculateEndAngle(data.chrA, data.posA)

				const color = FusionColorProvider.getColor(data.chrA, data.chrB)

				this.addLabelOrFusion(data, data.geneA, startAngleSource, endAngleSource, innerRadius, outerRadius, color)

				const startAngleTarget = this.calculateStartAngle(data.chrB, data.posB)
				const endAngleTarget = this.calculateEndAngle(data.chrB, data.posB)

				this.addLabelOrFusion(data, data.geneB, startAngleTarget, endAngleTarget, innerRadius, outerRadius, color)
			}
		})

		return Array.from(this.labelMap.values())
	}

	private addLabelOrMutation(
		data: Data,
		gene: string,
		mname: string,
		startAngle: number,
		endAngle: number,
		innerRadius,
		outerRadius,
		color,
		dataClass
	) {
		const label = this.labelMap.get(gene)
		const mutation: MutationTooltip = {
			mname: mname,
			color: color,
			dataClass: dataClass,
			chr: data.chr,
			position: data.position
		}
		if (!label) {
			this.labelMap.set(
				gene,
				LabelFactory.createLabel(
					startAngle,
					endAngle,
					innerRadius,
					outerRadius,
					data.value,
					gene,
					color,
					dataClass,
					data.chr,
					data.position,
					data.isPrioritized,
					this.settings.rings.labelsToLinesGap,
					mutation
				)
			)
		} else {
			if (label.mutationsTooltip) {
				label.mutationsTooltip.push(mutation)
			} else {
				label.mutationsTooltip = []
				label.mutationsTooltip.push(mutation)
			}
		}
	}

	private addLabelOrFusion(
		data: Data,
		gene: string,
		startAngle: number,
		endAngle: number,
		innerRadius,
		outerRadius,
		color
	) {
		const label = this.labelMap.get(gene)
		const fusionTooltip: FusionTooltip = {
			color: color,
			chrA: data.chrA,
			chrB: data.chrB,
			posA: data.posA,
			posB: data.posB,
			geneA: data.geneA,
			geneB: data.geneB,
			strandA: data.strandA,
			strandB: data.strandB
		}
		if (!label) {
			this.labelMap.set(
				gene,
				LabelFactory.createLabel(
					startAngle,
					endAngle,
					innerRadius,
					outerRadius,
					data.value,
					gene,
					color,
					'Fusion transcript',
					data.chr,
					data.position,
					data.isPrioritized,
					this.settings.rings.labelsToLinesGap,
					undefined,
					fusionTooltip
				)
			)
		} else {
			if (label.fusionTooltip) {
				label.fusionTooltip.push(fusionTooltip)
			} else {
				label.fusionTooltip = []
				label.fusionTooltip.push(fusionTooltip)
			}
		}
	}

	private calculateStartAngle(chr: string, position: number) {
		const index = this.reference.chromosomesOrder.findIndex(element => element == chr)
		const chromosome = this.reference.chromosomes[index]

		return chromosome.startAngle + (chromosome.endAngle - chromosome.startAngle) * (Number(position) / chromosome.size)
	}

	private calculateEndAngle(chr: string, position: number) {
		const index = this.reference.chromosomesOrder.findIndex(element => element == chr)
		const chromosome = this.reference.chromosomes[index]

		return chromosome.startAngle + (chromosome.endAngle - chromosome.startAngle) * (Number(position) / chromosome.size)
	}
}
