import Data from "./Data";
import {ViewModelMapper} from "./ViewModelMapper";
import Reference from "./Reference";
import DataObjectMapper from "./DataObjectMapper";

export default class DataMapper {

    snvData: Array<Data> = []
    filteredSnvData: Array<Data> = []
    nonExonicSnvData: Array<Data> = []
    lohData: Array<Data> = []
    fusionData: Array<Data> = []

    cnvData: Array<Data> = []

    snvRingDataMap: Map<number, Array<Data>> = new Map()

    hasCancerGenes: boolean = false

    cnvMaxValue?: number = undefined
    cnvMinValue?: number = undefined

    lohMaxValue?: number = undefined
    lohMinValue?: number = undefined

    private settings: any;
    private reference: Reference;
    private sample: string;
    private snvFilter = data => data.dt == 1
    private fusionFilter = data => data.dt == 2
    private cnvFilter = data => data.dt == 4

    private lohFilter = data => data.dt == 10
    // TODO rename or refactor?
    private nonExonicFilter = data => ViewModelMapper.snvClassLayer[data.class] == 'non-exonic';
    // TODO rename or refactor?
    private snvRingFilter: (data: any) => boolean;

    private bpx: number;
    private onePxArcAngle: number;
    private dataObjectMapper: DataObjectMapper;

    private compareData = (a, b) => {
        const chrDiff = this.reference.chromosomesOrder.indexOf(a.chr) - this.reference.chromosomesOrder.indexOf(b.chr)
        if (chrDiff != 0) {
            return chrDiff
        }

        const aPos = a.pos ? a.pos : a.start

        const bPos = b.pos ? b.pos : b.start

        return aPos - bPos
    }

    constructor(settings: any, reference: Reference, sample: string, snvRingFilter: (data:any) => boolean, cancerGenes: Array<string>) {
        this.settings = settings
        this.reference = reference
        this.sample = sample
        this.snvRingFilter = snvRingFilter
        this.dataObjectMapper = new DataObjectMapper(sample, cancerGenes)

        // number of base pairs per pixel
        this.bpx = Math.floor(this.reference.totalSize / (this.reference.totalChromosomesAngle * settings.rings.svnInnerRadius))
        // TODO check is this is Ok
        this.onePxArcAngle = 1 / (settings.rings.svnInnerRadius)
    }

    map(data) {
        const dataArray: Array<Data> = []

        data.forEach(dObject => {
            const instance = this.dataObjectMapper.map(dObject)

            if (instance.isCancerGene) {
                this.hasCancerGenes = true
            }

            dataArray.push(instance)
        })

        const sortedData = dataArray.sort(this.compareData)

        sortedData.forEach(data => {

            this.filterSnvs(data);
            this.filterCnvs(data);
            this.filterLohs(data);
            this.filterFusion(data);
        })
    }

    private filterSnvs(data: Data) {
        if (this.snvFilter(data)) {
            this.snvData.push(data)

            if (this.snvRingFilter(data)) {
                this.filteredSnvData.push(data)

                const arcAngle = this.calculateArcAngle(data);
                let dataArray = this.snvRingDataMap.get(arcAngle)
                if (!dataArray) {
                    dataArray = new Array<Data>()
                }
                dataArray.push(data)
                this.snvRingDataMap.set(arcAngle, dataArray)
            }

            if (this.nonExonicFilter(data)) {
                this.nonExonicSnvData.push(data)
            }
        }
    }

    private filterFusion(data: Data) {
        if (this.fusionFilter(data)) {
            this.fusionData.push(data)
        }
    }

    private filterLohs(data: Data) {
        if (this.lohFilter(data)) {
            if (this.lohMaxValue == undefined || this.lohMaxValue < data.value) {
                this.lohMaxValue = data.segmean
            }

            if (this.lohMinValue == undefined || this.lohMinValue > data.value) {
                this.lohMinValue = data.segmean
            }

            this.lohData.push(data)
        }
    }

    private filterCnvs(data: Data) {
        if (this.cnvFilter(data)) {
            if (this.cnvMaxValue == undefined || this.cnvMaxValue < data.value) {
                this.cnvMaxValue = data.value
            }

            if (this.cnvMinValue == undefined || this.cnvMinValue > data.value) {
                this.cnvMinValue = data.value
            }

            this.cnvData.push(data)
        }
    }

    private calculateArcAngle(data: Data) {
        const currentChromosome = this.reference.chromosomes[this.reference.chromosomesOrder.findIndex(chromosomeOrder => data.chr == chromosomeOrder)]

        const dataAnglePos = Math.floor((data.pos ) / this.bpx)

        return currentChromosome.startAngle + dataAnglePos * this.onePxArcAngle
    }
}