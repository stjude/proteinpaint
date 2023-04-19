import Chromosome from "#plots/disco_new/viewmodel/Chromosome";

export default class Reference {

    chromosomes: Array<Chromosome>;
    totalSize: number;

    private settings: any;

    constructor(settings: any, chrSizes: any) {
        this.settings = settings
        const chromosomes: Array<Chromosome> = []
        let totalSize = 0
        for (const chr in chrSizes) {
            const key = chr.slice(0, 3) === 'chr' ? chr.slice(3) : chr
            const chromosome = new Chromosome(key, totalSize, chrSizes[chr], 1)
            chromosomes.push(chromosome)
            totalSize += chrSizes[chr]
        }

        this.chromosomes = chromosomes
        this.totalSize = totalSize

        // number of base pairs per pixel
        const bpx = Math.floor(this.totalSize / (2 * Math.PI * settings.innerRadius))

        for (const chr in chromosomes) {
            const length = chromosomes[chr].size
            const posbins = [] // positional bins
            let bptotal = 0
            while (bptotal < length) {
                posbins.push({
                    chr: chr,
                    start: bptotal,
                    stop: bptotal + bpx - 1
                })
                bptotal += bpx
            }
            chromosomes[chr].posbins = posbins
        }

    }

    getChrBin(data) {
        const chrKey = typeof data.chr == 'string' ? data.chr.replace('chr', '') : data.chr
        const chr = this.chromosomes.find(c => c.key == chrKey)
        const start = data.position ? data.position : data.start ? data.start : 0
        let bin = chr.posbins.find(p => p.stop > start)
        return [chr, bin]
    }
}