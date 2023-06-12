import Rings from "./Rings";
import Legend from "./Legend";
import {RingType} from "./RingType";
import Arc from "./Arc";
import Settings from "./Settings";
import Fusion from "./Fusion";

export default class ViewModel {

    width: number
    height: number
    legendHeight: number

    rings: Rings
    legend: Legend;

    fusions: Array<Fusion>;

    settings: Settings;

    constructor(settings: Settings, rings: Rings, legend: Legend, fusions: Array<Fusion>) {
        this.settings = settings
        this.rings = rings
        this.legend = legend
        this.fusions = fusions

        this.width = 2 * (this.settings.rings.labelLinesInnerRadius + this.settings.rings.labelsToLinesDistance + this.settings.horizontalPadding)
        this.height = 2 * (this.settings.rings.labelLinesInnerRadius + this.settings.rings.labelsToLinesDistance + this.settings.verticalPadding)


        this.legendHeight = this.calculateLegendHeight(legend)
    }

    getElements(ringType: RingType): Array<Arc> {
        switch (ringType) {
            case RingType.CHROMOSOME:
                return this.rings.chromosomesRing.elements
            case RingType.LABEL:
                return this.rings.labelsRing.elementsToDisplay
            case RingType.NONEXONICSNV:
                return this.rings.nonExonicArcRing.elements
            case RingType.SNV:
                return this.rings.snvArcRing.elements
            case RingType.CNV:
                return this.rings.cnvArcRing.elements
            case RingType.LOH:
                return this.rings.lohArcRing.elements
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
        let rawHeight = 30

        return rawHeight * legend.legendCount()
    }
}