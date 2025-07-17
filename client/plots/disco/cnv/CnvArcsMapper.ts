import type Data from '#plots/disco/data/Data.ts'
import type Reference from '#plots/disco/chromosome/Reference.ts'
import type CnvArc from './CnvArc.ts'
import CnvLegend from './CnvLegend.ts'
import { CnvType } from './CnvType.ts'
import type Settings from '#plots/disco/Settings.ts'
import CnvColorProvider from '#plots/disco/cnv/CnvColorProvider.ts'
import { CnvRenderingType } from '#plots/disco/cnv/CnvRenderingType.ts'
import DataMapper from '#plots/disco/data/DataMapper.ts'

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
	private cnvMaxAbsValue: number
	private cnvInnerRadius: number
	private cnvWidth: number
	private cnvRenderingType: string
	private cnvAbsPercentile: number

	constructor(
		cnvInnerRadius: number,
		cnvWidth: number,
		settings: Settings,
		sampleName: string,
		reference: Reference,
		cnvMaxValue = 0,
		cnvMinValue = 0,
		cnvMaxAbsValue = 0,
		cnvAbsPercentile = 0,
		cnvUnit = '',
		cnvRenderingType: string
	) {
		this.cnvInnerRadius = cnvInnerRadius
		this.cnvWidth = cnvWidth
		this.settings = settings
		this.sampleName = sampleName
		this.reference = reference
		this.cnvMaxValue = cnvMaxValue
		this.cnvMinValue = cnvMinValue
		this.cnvMaxAbsValue = cnvMaxAbsValue
		this.cnvAbsPercentile = cnvAbsPercentile
		this.cnvUnit = cnvUnit
		this.cnvRenderingType = cnvRenderingType

		this.gainCapped = Math.min(cnvAbsPercentile, this.settings.Disco.cnvCapping)
		this.lossCapped = -1 * Math.min(cnvAbsPercentile, this.settings.Disco.cnvCapping)

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
			this.settings.Disco.cnvCapping
		)

		this.cnvClassMap.set(CnvType.Gain, gain)
		this.cnvClassMap.set(CnvType.Loss, loss)
		this.cnvClassMap.set(CnvType.Cap, cap)
	}

	map(arcData: Array<Data>): Array<CnvArc> {
		const arcs: Array<CnvArc> = []

		arcData.forEach(data => {
			let startAngle = this.calculateStartAngle(data)
			let endAngle = this.calculateEndAngle(data)

			if (startAngle === null || endAngle === null) return

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
				unit: this.cnvUnit,
				sampleName: [this.sampleName]
			}
			

			arcs.push(arc)
		})

		return arcs
	}

	calculateStartAngle(data: Data) {
		const index = this.reference.chromosomesOrder.indexOf(data.chr)
		if (index == -1) return null
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
		return CnvColorProvider.getColor(value, this.settings, this.cnvAbsPercentile)
	}

	private calculateInnerRadius(data: Data) {
		if (this.cnvRenderingType == CnvRenderingType.heatmap) {
			return this.cnvInnerRadius
		}

		if (this.gainOnly) {
			return this.cnvInnerRadius
		}

		if (this.lossOnly) {
			const outerRadius = this.cnvInnerRadius + this.cnvWidth

			return (
				outerRadius +
				DataMapper.capMinValue(
					(this.cnvWidth * DataMapper.capMaxValue(data.value, this.gainCapped, this.lossCapped)) / this.cnvAbsPercentile
				)
			)
		}

		const centerRadius = this.cnvInnerRadius + this.cnvWidth / 2

		if (Math.sign(data.value) == 1) {
			return centerRadius
		}

		if (Math.sign(data.value) == -1) {
			return (
				centerRadius +
				DataMapper.capMinValue(
					(DataMapper.capMaxValue(data.value, this.gainCapped, this.lossCapped) / this.cnvAbsPercentile) *
						(this.cnvWidth / 2)
				)
			)
		}

		return 1
	}

	private calculateOuterRadius(data: Data) {
		const maxOuterRadius = this.cnvInnerRadius + this.cnvWidth

		if (this.cnvRenderingType == CnvRenderingType.heatmap) {
			return maxOuterRadius
		}

		if (this.gainOnly) {
			return (
				this.cnvInnerRadius +
				DataMapper.capMinValue(
					(this.cnvWidth * DataMapper.capMaxValue(data.value, this.gainCapped, this.lossCapped)) / this.cnvAbsPercentile
				)
			)
		}

		if (this.lossOnly) {
			return maxOuterRadius
		}

		const centerRadius = this.cnvInnerRadius + this.cnvWidth / 2

		if (Math.sign(data.value) == 1) {
			return (
				centerRadius +
				DataMapper.capMinValue(
					(DataMapper.capMaxValue(data.value, this.gainCapped, this.lossCapped) / this.cnvMaxAbsValue) *
						(this.cnvWidth / 2)
				)
			)
		}

		if (Math.sign(data.value) == -1) {
			return centerRadius
		}
		return 1
	}
}
