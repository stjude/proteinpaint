import Reference from "./Reference";
import Data from "./Data";
import SnvArc from "../viewmodel/SnvArc";
import MLabel from "./MLabel";
import SnvLegendElement from "../viewmodel/SnvLegendElement";

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
        // TODO check if this is correct?
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
                    this.snvClassMap.set(data.mClass, this.createSnvLegend(data.mClass))
                    const startAngle = angle
                    const endAngle = angle + this.onePxArcAngle

                    const arc = new SnvArc(startAngle,
                        endAngle,
                        this.settings.rings.svnInnerRadius + (i * this.settings.rings.svnWidth / arraySize),
                        this.settings.rings.svnInnerRadius + ((i + 1) * this.settings.rings.svnWidth / arraySize),
                        MLabel.getInstance().mlabel ? MLabel.getInstance().mlabel[data.mClass].color : '#000',
                        data.gene,
                        -1,
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

    getChrBin(data) {
        const chrKey = typeof data.chr == 'string' ? data.chr.replace('chr', '') : data.chr
        const chr = this.reference.chromosomes.find(c => c.label == chrKey)
        const start = data.position ? data.position : data.start ? data.start : 0
        // TODO fix this
        // @ts-ignore
        let bin = chr.posbins.find(p => p.stop > start)
        return [chr, bin]
    }

    private createSnvLegend(dataClass: string) {
        const mClass = MLabel.getInstance().mlabel[dataClass]
        return new SnvLegendElement(mClass.label, mClass.color)
    }
}

// const length = this.chrSizesArray[i]
// const posbins: Array<any> = [] // positional bins
// let bptotal = 0
// while (bptotal < length) {
//     posbins.push({
//         chr: this.chromosomesOrder[i],
//         start: bptotal,
//         stop: bptotal + bpx - 1
//     })
//     bptotal += bpx
// }
//
//
// chromosome.posbins = posbins