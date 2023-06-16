import Chromosome from "#plots/disco_new/viewmodel/Chromosome";

export default class Reference {

    chromosomes: Array<Chromosome> = []
    chromosomesOrder: Array<string> = []
    totalSize: number;

    totalPadAngle: number;
    totalChromosomesAngle: number;

    private keysArray: Array<string> = []
    private totalSizeArray: Array<number> = []
    private chrSizesArray: Array<number> = []

    private settings: any;

    constructor(settings: any, chrSizes: any) {
        this.settings = settings

        this.chromosomesOrder = []
        let totalSize = 0
        this.totalPadAngle = Object.keys(chrSizes).length * this.settings.padAngle
        this.totalChromosomesAngle = 2 * Math.PI - this.totalPadAngle


        for (const chr in chrSizes) {
            const key = chr.slice(0, 3) === 'chr' ? chr.slice(3) : chr
            this.chromosomesOrder.push(chr)
            this.keysArray.push(key)
            this.totalSizeArray.push(totalSize)
            this.chrSizesArray.push(chrSizes[chr])

            totalSize += chrSizes[chr]
        }

        this.totalSize = totalSize

        let lastAngle = 0

        for (let i = 0; i < this.keysArray.length; i++) {
            const chromosomeAngle = this.totalChromosomesAngle * (this.chrSizesArray[i] / totalSize)

            const startAngle = (i == 0) ? this.settings.padAngle / 2 : lastAngle + this.settings.padAngle
            const endAngle = (i == 0) ? this.settings.padAngle / 2 + chromosomeAngle : lastAngle + this.settings.padAngle + chromosomeAngle
            const chromosome = new Chromosome(this.totalSizeArray[i],
                this.chrSizesArray[i],
                1,
                startAngle,
                endAngle,
                this.settings.chromosomeInnerRadius,
                this.settings.chromosomeInnerRadius + this.settings.chromosomeWidth,
                "#AAA",
                this.keysArray[i])

            this.chromosomes.push(chromosome)

            if (chromosome.endAngle != null) {
                lastAngle = chromosome.endAngle
            }

        }

    }
}
