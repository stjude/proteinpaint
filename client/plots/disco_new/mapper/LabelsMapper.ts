import Data from "./Data";
import Reference from "./Reference";
import Label from "../viewmodel/Label";
import LabelFactory from "../viewmodel/LabelFactory";
import MLabel from "../mapper/MLabel";

export default class LabelsMapper {

    private settings: any;
    private sampleName: string;
    private reference: Reference;

    constructor(settings: any, sampleName: string, reference: Reference) {
        this.settings = settings
        this.sampleName = sampleName
        this.reference = reference
    }

    map(data: Array<Data>): Array<Label> {
        const innerRadius = this.settings.rings.labelLinesInnerRadius
        const outerRadius = innerRadius + this.settings.rings.labelsToLinesDistance

        const labels: Array<Label> = []

        data.forEach(data => {
            const startAngle = this.calculateStartAngle(data)
            const endAngle = this.calculateEndAngle(data)

            const label = LabelFactory.createLabel(startAngle,
                endAngle,
                innerRadius,
                outerRadius,
                data.value,
                data.gene,
                MLabel.getInstance().mlabel ? MLabel.getInstance().mlabel[data.mClass].color : '#000',
                data.isCancerGene,
                this.settings.rings.labelsToLinesGap)

            labels.push(label)
        })

        return labels
    }

    calculateStartAngle(data: Data) {
        const index = this.reference.chromosomesOrder.findIndex(element => element == data.chr)
        const chromosome = this.reference.chromosomes[index]

        return chromosome.startAngle + ((chromosome.endAngle - chromosome.startAngle) * (Number(data.position) / chromosome.size));
    }

    private calculateEndAngle(data: Data) {
        const index = this.reference.chromosomesOrder.indexOf(data.chr)
        const chromosome = this.reference.chromosomes[index]

        return chromosome.startAngle + ((chromosome.endAngle - chromosome.startAngle) * (Number(data.position) / chromosome.size));
    }
}