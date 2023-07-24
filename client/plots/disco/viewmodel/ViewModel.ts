import Rings from '../ring/Rings.ts'
import Legend from '../legend/Legend.ts'
import { RingType } from '../ring/RingType.ts'
import Arc from '../arc/Arc.ts'
import Settings from '../Settings.ts'
import Fusion from '../fusion/Fusion.ts'

export default class ViewModel {
	width: number
	height: number
	legendHeight: number

	rings: Rings
	legend: Legend

	fusions: Array<Fusion>

	settings: Settings

	constructor(settings: Settings, rings: Rings, legend: Legend, fusions: Array<Fusion>) {
		this.settings = settings
		this.rings = rings
		this.legend = legend
		this.fusions = fusions

		this.width =
			2 *
			(this.settings.horizontalPadding +
				this.settings.rings.labelLinesInnerRadius +
				this.settings.rings.labelsToLinesDistance)
		this.height =
			2 *
			(this.settings.rings.labelLinesInnerRadius +
				this.settings.rings.labelsToLinesDistance +
				this.settings.verticalPadding)

		this.legendHeight = this.calculateLegendHeight(legend)
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
