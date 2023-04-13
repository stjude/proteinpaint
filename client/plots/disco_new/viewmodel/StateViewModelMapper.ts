import Ring from "#plots/disco_new/Ring";
import ViewModel from "#plots/disco_new/viewmodel/ViewModel";

export class StateViewModelMapper {
    map(opts: any): ViewModel {
        const chrSizes = opts.args.genome.majorchr

        const chromosomes = {}
        let totalSize = 0
        for (const chr in chrSizes) {
            const key = chr.slice(0, 3) === 'chr' ? chr.slice(3) : chr
            chromosomes[key] = {chr: key, start: totalSize, size: chrSizes[chr], factor: 1}
            totalSize += chrSizes[chr]
        }

        const rings = [new Ring(250, 30, chromosomes)]
        return new ViewModel(rings)
    }
}