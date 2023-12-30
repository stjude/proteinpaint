import Rings from '#plots/disco/ring/Rings.ts'
import Legend from '#plots/disco/legend/Legend.ts'
import { RingType } from '#plots/disco/ring/RingType.ts'
import Arc from '#plots/disco/arc/Arc.ts'
import Settings from '#plots/disco/Settings.ts'
import Fusion from '#plots/disco/fusion/Fusion.ts'

export default class ViewModel {
	width: number
	height: number
	legendHeight: number

	rings: Rings
	legend: Legend

	fusions: Array<Fusion>

	settings: Settings
	svnDataLength: number
	filteredSnvDataLength: number
	snvDataLength
	genesetName: string

	constructor(
		settings: Settings,
		rings: Rings,
		legend: Legend,
		fusions: Array<Fusion>,
		filteredSnvDataLength: number,
		svnDataLength: number,
		genesetName: string,
		snvDataLength: number
	) {
		this.settings = settings
		this.rings = rings
		this.legend = legend
		this.fusions = fusions
		this.genesetName = genesetName

		this.width =
			1.2 *
			(this.settings.horizontalPadding +
				this.settings.rings.labelLinesInnerRadius +
				this.settings.rings.labelsToLinesDistance)
		this.height =
			2 *
			(this.settings.rings.labelLinesInnerRadius +
				this.settings.rings.labelsToLinesDistance +
				this.settings.verticalPadding)

		this.legendHeight = this.calculateLegendHeight(legend)
		this.svnDataLength = svnDataLength
		this.filteredSnvDataLength = filteredSnvDataLength
		this.snvDataLength = snvDataLength
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
