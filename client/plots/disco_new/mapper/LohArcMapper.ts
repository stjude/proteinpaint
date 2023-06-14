import Reference from "./Reference";
import Data from "./Data";
import LohArc from "../viewmodel/LohArc";
import GradientColorProvider from "./GradientColorProvider";

export default class LohArcMapper {
    private settings: any;
    private sampleName: string;
    private reference: Reference;

    constructor(settings: any, sampleName: string, reference: Reference) {
        this.settings = settings
        this.sampleName = sampleName
        this.reference = reference
    }

    map(arcData: Array<Data>): Array<LohArc> {
        const arcs: Array<LohArc> = []

        arcData.forEach(data => {
            let startAngle = this.calculateStartAngle(data)
            let endAngle = this.calculateEndAngle(data)

            const innerRadius = this.settings.rings.lohInnerRadius
            const outerRadius = innerRadius + this.settings.rings.lohWidth
            const color = GradientColorProvider.provide(data.segmean)

            const arc = new LohArc(startAngle,
                endAngle,
                innerRadius,
                outerRadius,
                color,
                data.gene,
                data.chr,
                data.start,
                data.stop,
                data.segmean
            )

            arcs.push(arc)
        })

        return arcs
    }

    private calculateStartAngle(data: Data) {
        const index = this.reference.chromosomesOrder.indexOf(data.chr)
        const chromosome = this.reference.chromosomes[index]
        return chromosome.startAngle + ((chromosome.endAngle - chromosome.startAngle) * (Number(data.start) / chromosome.size));
    }

    private calculateEndAngle(data: Data) {
        const index = this.reference.chromosomesOrder.indexOf(data.chr)
        const chromosome = this.reference.chromosomes[index]
        return chromosome.startAngle + ((chromosome.endAngle - chromosome.startAngle) * (Number(data.stop) / chromosome.size));
    }

}