import type Rings from '#plots/disco/ring/Rings.ts'
import type Legend from '#plots/disco/legend/Legend.ts'
import { RingType } from '#plots/disco/ring/RingType.ts'
import type Arc from '#plots/disco/arc/Arc.ts'
import type Settings from '#plots/disco/Settings.ts'
import { select } from 'd3-selection'
import { getMaxLabelWidth } from '#dom/maxLabelWidth'
import type Fusion from '#plots/disco/fusion/Fusion.ts'
import type { DataHolder } from '#plots/disco/data/DataHolder.ts'
import type { InvalidDataInfo } from '#dom'

export default class ViewModel {
	public appState: any
	public svgDiv: any

	width: number
	height: number
	legendHeight: number

	rings: Rings
	legend: Legend

	fusions: Array<Fusion>

	settings: Settings
	snvDataLength: number
	filteredSnvDataLength: number
	snvDataLengthAll: number
	genesetName: string
	cnvMaxValue?: number
	cnvMinValue?: number
	cappedCnvMaxAbsValue?: number
	negativePercentile?: number
	positivePercentile?: number
	invalidDataInfo?: InvalidDataInfo

	constructor(
		settings: Settings,
		rings: Rings,
		legend: Legend,
		fusions: Array<Fusion>,
		dataHolder: DataHolder,
		genesetName: string,
		// TODO do we need this?
		snvDataLengthAll: number
	) {
		this.settings = settings
		this.rings = rings
		this.legend = legend
		this.fusions = fusions
		this.genesetName = genesetName

		const tempHolder = select('body').append('div').style('position', 'absolute').style('visibility', 'hidden')
		const tempSvg = tempHolder.append('svg')
		const labels = rings.labelsRing?.elementsToDisplay?.map(l => l.text) || []
		const maxLabelSpace = getMaxLabelWidth(tempSvg as any, labels)
		tempHolder.remove()

		//Diameter of the disco and labels usedd to calculate height and with of canvas
		this.width =
			2 *
			(this.settings.horizontalPadding +
				this.settings.rings.labelLinesInnerRadius +
				this.settings.rings.labelsToLinesDistance +
				maxLabelSpace)
		this.height =
			2 *
			(this.settings.rings.labelLinesInnerRadius +
				this.settings.rings.labelsToLinesDistance +
				this.settings.verticalPadding +
				this.settings.label.fontSize * 2 +
				maxLabelSpace)

		this.legendHeight = this.calculateLegendHeight(legend)
		this.snvDataLength = dataHolder.snvData.length
		this.filteredSnvDataLength = dataHolder.filteredSnvData.length
		this.snvDataLengthAll = snvDataLengthAll

		this.cnvMaxValue = dataHolder.cnvGainMaxValue
		this.cnvMinValue = dataHolder.cnvLossMaxValue
		this.cappedCnvMaxAbsValue = dataHolder.cappedCnvMaxAbsValue
		this.negativePercentile = dataHolder.percentileNegative
		this.positivePercentile = dataHolder.percentilePositive
		this.invalidDataInfo = dataHolder.invalidDataInfo
	}

	getElements(ringType: RingType): Array<Arc> {
		switch (ringType) {
			case RingType.CHROMOSOME:
				return this.rings.chromosomesRing ? this.rings.chromosomesRing.elements : []
			case RingType.LABEL:
				return this.rings.labelsRing.elementsToDisplay
			case RingType.NONEXONICSNV:
				return this.rings.nonExonicArcRing ? this.rings.nonExonicArcRing.elements : []
			case RingType.SNV:
				return this.rings.snvArcRing ? this.rings.snvArcRing.elements : []
			case RingType.CNV:
				return this.rings.cnvArcRing ? this.rings.cnvArcRing.elements : []
			case RingType.LOH:
				return this.rings.lohArcRing ? this.rings.lohArcRing.elements : []
			default:
				throw new Error(`ringType ${ringType} not defined`)
		}
	}

	getCollisions(ringType: RingType): Array<Arc> | undefined {
		if (ringType == RingType.LABEL) {
			return this.rings.labelsRing.collisions
		} else {
			return undefined
		}
	}

	private calculateLegendHeight(legend: Legend): number {
		const rawHeight = this.settings.legend.rowHeight
		return rawHeight * legend.legendCount()
	}
}
