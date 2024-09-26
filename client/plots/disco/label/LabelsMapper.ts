import Data from '#plots/disco/data/Data.ts'
import Reference from '#plots/disco/chromosome/Reference.ts'
import Label from './Label.ts'
import LabelFactory from './LabelFactory.ts'
import MLabel from './MLabel.ts'
import MutationTooltip from '#plots/disco/label/MutationTooltip.ts'
import Settings from '#plots/disco/Settings.ts'
import FusionColorProvider from '#plots/disco/fusion/FusionColorProvider.ts'
import FusionTooltip from '#plots/disco/fusion/FusionTooltip.ts'
import CnvTooltip from '#plots/disco/cnv/CnvTooltip.ts'
import CnvColorProvider from '#plots/disco/cnv/CnvColorProvider.ts'
import { dtsnvindel, dtfusionrna } from '#shared/common.js'

export default class LabelsMapper {
	private settings: Settings
	private sampleName: string
	private reference: Reference

	private labelMap: Map<string, Label> = new Map()
	private cnvMaxPercentileAbs: number

	constructor(settings: Settings, sampleName: string, reference: Reference, cnvMaxPercentileAbs = 0) {
		this.settings = settings
		this.sampleName = sampleName
		this.reference = reference
		this.cnvMaxPercentileAbs = cnvMaxPercentileAbs
	}

	map(data: Array<Data>, cnvData: Array<Data> = []): Array<Label> {
		const innerRadius = this.settings.rings.labelLinesInnerRadius
		const outerRadius = innerRadius + this.settings.rings.labelsToLinesDistance

		data.forEach(data => {
			if (data.dt == dtsnvindel) {
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

			if (data.dt == dtfusionrna) {
				const color = FusionColorProvider.getColor(data.chrA, data.chrB)
				if (data.geneA) {
					const startAngleSource = this.calculateStartAngle(data.chrA, data.posA)
					const endAngleSource = this.calculateEndAngle(data.chrA, data.posA)

					this.addLabelOrFusion(
						data,
						data.geneA,
						data.posA,
						startAngleSource,
						endAngleSource,
						innerRadius,
						outerRadius,
						color
					)
				}

				if (data.geneB && data.geneA != data.geneB) {
					const startAngleTarget = this.calculateStartAngle(data.chrB, data.posB)
					const endAngleTarget = this.calculateEndAngle(data.chrB, data.posB)

					this.addLabelOrFusion(
						data,
						data.geneB,
						data.posB,
						startAngleTarget,
						endAngleTarget,
						innerRadius,
						outerRadius,
						color
					)
				}
			}
		})

		const labelsArray = Array.from(this.labelMap.values())
		labelsArray.forEach((label: Label) => {
			cnvData.forEach((cnv: Data) => {
				if (label.stop >= cnv.start && cnv.stop >= label.start && label.chr == cnv.chr) {
					const mutation: CnvTooltip = {
						value: cnv.value,
						color: CnvColorProvider.getColor(cnv.value, this.settings, this.cnvMaxPercentileAbs),
						chr: cnv.chr,
						start: cnv.start,
						stop: cnv.stop
					}
					if (label.cnvTooltip) {
						label.cnvTooltip.push(mutation)
					} else {
						label.cnvTooltip = []
						label.cnvTooltip.push(mutation)
					}
				}
			})
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
				label.start = Math.min(label.start, data.position)
				label.stop = Math.max(label.stop, data.position)
				label.mutationsTooltip.push(mutation)
			} else {
				label.mutationsTooltip = []
				label.start = Math.min(label.start, data.position)
				label.stop = Math.max(label.stop, data.position)
				label.mutationsTooltip.push(mutation)
			}
		}
	}

	private addLabelOrFusion(
		data: Data,
		gene: string,
		position: number,
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
				label.start = Math.min(label.start, position)
				label.stop = Math.max(label.stop, position)
				label.fusionTooltip.push(fusionTooltip)
			} else {
				label.fusionTooltip = []
				label.start = Math.min(label.start, position)
				label.stop = Math.max(label.stop, position)
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
