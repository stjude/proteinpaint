import Reference from "./Reference";
import Data from "./Data";
import MLabel from "./MLabel";
import SnvArc from "../viewmodel/SnvArc";

// TODO check if we need this?
export default class NonExonicSnvArcsMapper {

    private settings: any;
    private sampleName: string;
    private reference: Reference;

    constructor(settings: any, sampleName: string, reference: Reference) {
        this.settings = settings
        this.sampleName = sampleName
        this.reference = reference
    }

    map(arcData: Array<Data>): Array<SnvArc> {
        const innerRadius = this.settings.rings.nonExonicInnerRadius
        const outerRadius = innerRadius + this.settings.rings.nonExonicWidht


        const arcs: Array<SnvArc> = []

        arcData.forEach(data => {
            const startAngle = this.calculateStartAngle(data)
            const endAngle = this.calculateEndAngle(data)
            const arc = new SnvArc(startAngle,
                endAngle,
                innerRadius,
                outerRadius,
                MLabel.getInstance().mlabel ? MLabel.getInstance().mlabel[data.mClass].color : '#000',
                data.gene,
                -1,
                data.mClass,
                data.mname,
                data.chr,
                data.pos
            )

            arcs.push(arc)
        })

        return arcs
    }

    calculateStartAngle(data: Data) {
        const index = this.reference.chromosomesOrder.indexOf(data.chr)
        const chromosome = this.reference.chromosomes[index]
        // TODO calculate 0.005 base on BPs
        return chromosome.startAngle + ((chromosome.endAngle - chromosome.startAngle) * (Number(data.position) / chromosome.size)) - 0.005;
    }

    private calculateEndAngle(data: Data) {
        const index = this.reference.chromosomesOrder.indexOf(data.chr)
        const chromosome = this.reference.chromosomes[index]
        // TODO calculate 0.005 base on BPs
        return 0.005 + chromosome.startAngle + ((chromosome.endAngle - chromosome.startAngle) * (Number(data.position) / chromosome.size));
    }
}