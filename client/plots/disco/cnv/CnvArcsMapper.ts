import Data from '#plots/disco/data/Data.ts'
import Reference from '#plots/disco/chromosome/Reference.ts'
import CnvArc from './CnvArc.ts'
import CnvLegend from './CnvLegend.ts'
import { CnvType } from './CnvType.ts'
import Settings from '#plots/disco/Settings.ts'
import CnvColorProvider from '#plots/disco/cnv/CnvColorProvider.ts'

export default class CnvArcsMapper {
	cnvClassMap: Map<CnvType, CnvLegend> = new Map()

	private settings: Settings
	private sampleName: string
	private reference: Reference
	private cnvMaxValue: number
	private cnvMinValue: number
	private cnvUnit: string

	private onePxArcAngle: number
	private lossOnly: boolean
	private gainOnly: boolean
	private gainCapped: number
	private lossCapped: number
	private maxAbsValue: number
	private cnvInnerRadius: number
	private cnvWidth: number

	constructor(
		cnvInnerRadius: number,
		cnvWidth: number,
		settings: Settings,
		sampleName: string,
		reference: Reference,
		cnvMaxValue = 0,
		cnvMinValue = 0,
		cnvUnit = ''
	) {
		this.cnvInnerRadius = cnvInnerRadius
		this.cnvWidth = cnvWidth
		this.settings = settings
		this.sampleName = sampleName
		this.reference = reference
		this.cnvMaxValue = cnvMaxValue
		this.cnvMinValue = cnvMinValue
		this.cnvUnit = cnvUnit
		this.gainCapped = this.settings.cnv.capping
		this.lossCapped = -1 * this.settings.cnv.capping
		this.lossOnly = cnvMaxValue <= 0
		this.gainOnly = cnvMinValue >= 0

		this.onePxArcAngle = 1 / this.cnvInnerRadius

		const gain = new CnvLegend(
			'Max',
			cnvMaxValue > 0 ? CnvType.Gain : CnvType.Loss,
			this.getColor(cnvMaxValue),
			cnvMaxValue
		)
		const loss = new CnvLegend(
			'Min',
			cnvMinValue > 0 ? CnvType.Gain : CnvType.Loss,
			this.getColor(cnvMinValue),
			cnvMinValue
		)
		const cap = new CnvLegend(
			'Capping',
			CnvType.Loss,
			this.getColor(cnvMinValue > 0 ? cnvMinValue : cnvMaxValue),
			this.settings.cnv.capping
		)

		this.cnvClassMap.set(CnvType.Gain, gain)
		this.cnvClassMap.set(CnvType.Loss, loss)
		this.cnvClassMap.set(CnvType.Cap, cap)

		this.maxAbsValue = Math.max(Math.abs(this.capMaxValue(cnvMinValue)), Math.abs(this.capMaxValue(cnvMaxValue)))
	}

	map(arcData: Array<Data>): Array<CnvArc> {
		const arcs: Array<CnvArc> = []

		arcData.forEach(data => {
			let startAngle = this.calculateStartAngle(data)
			let endAngle = this.calculateEndAngle(data)

			if (endAngle - startAngle < this.onePxArcAngle) {
				const restAngle = this.onePxArcAngle - (endAngle - startAngle)
				startAngle = startAngle - restAngle / 2
				endAngle = startAngle + restAngle / 2
			}

			const innerRadius = this.calculateInnerRadius(data)

			const outerRadius = this.calculateOuterRadius(data)

			const color = this.getColor(data.value)

			const arc: CnvArc = {
				startAngle: startAngle,
				endAngle: endAngle,
				innerRadius: innerRadius,
				outerRadius: outerRadius,
				color: color,
				text: data.gene,
				chr: data.chr,
				start: data.start,
				stop: data.stop,
				value: data.value,
				unit: this.cnvUnit
			}

			arcs.push(arc)
		})

		return arcs
	}

	calculateStartAngle(data: Data) {
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

	getColor(value: number) {
		return CnvColorProvider.getColor(value, this.settings)
	}

	private calculateInnerRadius(data: Data) {
		if (this.gainOnly) {
			return this.cnvInnerRadius
		}

		if (this.lossOnly) {
			const outerRadius = this.cnvInnerRadius + this.cnvWidth
			return outerRadius + this.capMinValue((this.cnvWidth * this.capMaxValue(data.value)) / this.maxAbsValue)
		}

		const centerRadius = this.cnvInnerRadius + this.cnvWidth / 2

		if (Math.sign(data.value) == 1) {
			return centerRadius
		}

		if (Math.sign(data.value) == -1) {
			return centerRadius + this.capMinValue((this.capMaxValue(data.value) / this.maxAbsValue) * (this.cnvWidth / 2))
		}

		return 1
	}

	private calculateOuterRadius(data: Data) {
		const maxOuterRadius = this.cnvInnerRadius + this.cnvWidth
		if (this.gainOnly) {
			return this.cnvInnerRadius + this.capMinValue((this.cnvWidth * this.capMaxValue(data.value)) / this.maxAbsValue)
		}

		if (this.lossOnly) {
			return maxOuterRadius
		}

		const centerRadius = this.cnvInnerRadius + this.cnvWidth / 2

		if (Math.sign(data.value) == 1) {
			return centerRadius + this.capMinValue((this.capMaxValue(data.value) / this.maxAbsValue) * (this.cnvWidth / 2))
		}

		if (Math.sign(data.value) == -1) {
			return centerRadius
		}
		return 1
	}

	private capMaxValue(value: number) {
		if (Math.sign(value) == 1) {
			return value > this.gainCapped ? this.gainCapped : value
		}

		if (Math.sign(value) == -1) {
			return value < this.lossCapped ? this.lossCapped : value
		}

		return 0
	}

	private capMinValue(value: number, capMinValue = 1) {
		if (Math.sign(value) == 1) {
			return value > capMinValue ? value : capMinValue
		}

		if (Math.sign(value) == -1) {
			return value < -1 * capMinValue ? value : -1 * capMinValue
		}

		return 1
	}
}
