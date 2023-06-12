import Data from "./Data";
import Reference from "./Reference";
import CnvArc from "../viewmodel/CnvArc";
import CnvLegend from "../viewmodel/CnvLegend";
import {CnvType} from "../viewmodel/CnvType";

export default class CnvArcsMapper {

    cnvClassMap: Map<CnvType, CnvLegend> = new Map()

    private settings: any;
    private sampleName: string;
    private reference: Reference;
    private cnvMaxValue: number;
    private cnvMinValue: number;
    private bpx: number;
    private onePxArcAngle: number;

    constructor(settings: any, sampleName: string, reference: Reference, cnvMaxValue: number = 0, cnvMinValue: number = 0) {
        this.settings = settings
        this.sampleName = sampleName
        this.reference = reference
        this.cnvMaxValue = cnvMaxValue
        this.cnvMinValue = cnvMinValue

        this.bpx = Math.floor(this.reference.totalSize / (this.reference.totalChromosomesAngle * settings.rings.cnvInnerRadius))
        this.onePxArcAngle = 1 / (settings.rings.cnvInnerRadius)

        const gain = new CnvLegend(CnvType.Gain, this.getColor(cnvMaxValue), cnvMaxValue)
        const loss = new CnvLegend(CnvType.Loss, this.getColor(cnvMinValue), cnvMinValue)

        this.cnvClassMap.set(CnvType.Gain, gain)
        this.cnvClassMap.set(CnvType.Loss, loss)
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

            const innerRadius = this.settings.rings.cnvInnerRadius
            const cnvWidth = this.settings.rings.cnvWidth
            const color = this.getColor(data.value)

            const maxMinDiff = this.cnvMaxValue - this.cnvMinValue

            let outerRadius = innerRadius + ((data.value / maxMinDiff)) * (cnvWidth / 2)

            outerRadius = Math.abs(outerRadius - innerRadius) < 1 ? innerRadius + Math.sign(outerRadius - innerRadius) : outerRadius;

            const arc = new CnvArc(startAngle,
                endAngle,
                innerRadius,
                outerRadius,
                color,
                data.gene,
                data.chr,
                data.start,
                data.stop,
                data.value
            )

            arcs.push(arc)
        })

        return arcs
    }

    calculateStartAngle(data: Data) {
        const index = this.reference.chromosomesOrder.indexOf(data.chr)
        const chromosome = this.reference.chromosomes[index]
        return chromosome.startAngle + ((chromosome.endAngle - chromosome.startAngle) * (Number(data.start) / chromosome.size));
    }

    private calculateEndAngle(data: Data) {
        const index = this.reference.chromosomesOrder.indexOf(data.chr)
        const chromosome = this.reference.chromosomes[index]
        return chromosome.startAngle + ((chromosome.endAngle - chromosome.startAngle) * (Number(data.stop) / chromosome.size));
    }

    getColor(value) {
        const lossCapped = this.settings.cnv.lossCapped
        const ampCapped = this.settings.cnv.ampCapped

        const lossColor = this.settings.cnv.lossColor
        const ampColor = this.settings.cnv.ampColor
        const cappedLossColor = this.settings.cnv.cappedLossColor
        const cappedAmpColor = this.settings.cnv.cappedAmpColor


        if (value < lossCapped) {
            return cappedLossColor
        } else if (value <= 0) {
            return lossColor
        } else if (value <= ampCapped) {
            return ampColor
        } else if (value > ampCapped) {
            return cappedAmpColor
        }
    }

}