import Ring from "#plots/disco_new/viewmodel/Ring";
import ViewModel from "#plots/disco_new/viewmodel/ViewModel";
import Chromosome from "#plots/disco_new/viewmodel/Chromosome";

export class StateViewModelMapper {
    map(opts: any): ViewModel {
        const chrSizes = opts.args.genome.majorchr

        const chromosomes: Array<Chromosome> = []
        let totalSize = 0
        for (const chr in chrSizes) {
            const key = chr.slice(0, 3) === 'chr' ? chr.slice(3) : chr
            const chromosome = new Chromosome(key, totalSize, chrSizes[chr],1   )
            chromosomes.push(chromosome)
            totalSize += chrSizes[chr]
        }

        const rings = [new Ring(250, 30, chromosomes)]
        return new ViewModel(rings)
    }
}