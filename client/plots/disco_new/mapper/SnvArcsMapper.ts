import Reference from "./Reference";
import Data from "./Data";
import SnvArc from "#plots/disco_new/viewmodel/SnvArc";
import MLabel from "./MLabel";
import SnvLegendElement from "#plots/disco_new/viewmodel/SnvLegendElement";

export default class SnvArcsMapper {

    snvClassMap: Map<string, SnvLegendElement> = new Map()

    private settings: any;
    private sampleName: string;
    private reference: Reference;

    private onePxArcAngle: number;
    private bpx: number;

    constructor(settings: any, sampleName: string, reference: Reference) {
        this.settings = settings
        this.sampleName = sampleName
        this.reference = reference

        // number of base pairs per pixel
        this.bpx = Math.floor(this.reference.totalSize / (this.reference.totalChromosomesAngle * settings.rings.svnInnerRadius))
        this.onePxArcAngle = 1 / (settings.rings.svnInnerRadius)
    }

    map(exonicSnvDataMap: Map<number, Array<Data>>): Array<SnvArc> {
        const snvArray: Array<SnvArc> = []
        for (const angle of exonicSnvDataMap.keys()) {
            const array = exonicSnvDataMap.get(angle)
            if (array) {
                const arraySize = array.length

                for (let i = 0; i < array.length; i++) {
                    const data = array[i]
                    const snvLegendElement = this.snvClassMap.get(data.mClass)
                    if (snvLegendElement) {
                        this.snvClassMap.set(data.mClass, this.createSnvLegend(data.mClass, ++snvLegendElement.count))
                    } else {
                        this.snvClassMap.set(data.mClass, this.createSnvLegend(data.mClass, 1))
                    }

                    const startAngle = angle
                    const endAngle = angle + this.onePxArcAngle

                    const arc = new SnvArc(startAngle,
                        endAngle,
                        this.settings.rings.svnInnerRadius + (i * this.settings.rings.svnWidth / arraySize),
                        this.settings.rings.svnInnerRadius + ((i + 1) * this.settings.rings.svnWidth / arraySize),
                        MLabel.getInstance().mlabel ? MLabel.getInstance().mlabel[data.mClass].color : '#000',
                        data.gene,
                        data.mClass,
                        data.mname,
                        data.chr,
                        data.pos
                    )
                    snvArray.push(arc)
                }
            }
        }
        return snvArray
    }

    private createSnvLegend(dataClass: string, count: number) {
        const mClass = MLabel.getInstance().mlabel[dataClass]
        return new SnvLegendElement(mClass.label, mClass.color, count)
    }
}