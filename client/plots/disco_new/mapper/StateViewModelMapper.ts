import Ring from "#plots/disco_new/viewmodel/Ring";
import ViewModel from "#plots/disco_new/viewmodel/ViewModel";
import Chromosome from "#plots/disco_new/viewmodel/Chromosome";
import Cnv from "#plots/disco_new/viewmodel/Cnv";
import LabelProcessor from "#plots/disco_new/mapper/LabelProcessor";
import Snv from "#plots/disco_new/viewmodel/Snv";
import Sv from "#plots/disco_new/viewmodel/Sv";
import Loh from "#plots/disco_new/viewmodel/Loh";
import discoDefaults from "#plots/disco_new/viewmodel/defaults";
import Reference from "#plots/disco_new/mapper/Reference";
import Data from "#plots/disco_new/mapper/Data";
import LabelsMapper from "#plots/disco_new/mapper/LabelsMapper";
import DataMapper from "#plots/disco_new/mapper/DataMapper";
import Label from "#plots/disco_new/viewmodel/Label";
import Rings from "#plots/disco_new/viewmodel/Rings";
import Labels from "#plots/disco_new/viewmodel/Labels";

export class StateViewModelMapper {

    private hits = {classes: []} // used in legend

    static dtNums = [
        2,
        5,
        4,
        10,
        1,
        'exonic',
        'non-exonic'
    ]

    static dtAlias = {
        1: 'snv', //
        2: 'sv', //'fusionrna',
        3: 'geneexpression',
        4: 'cnv',
        5: 'sv',
        6: 'snv', //'itd',
        7: 'snv', //'del',
        8: 'snv', //'nloss',
        9: 'snv', //'closs',
        10: 'loh'
    }

    static snvClassLayer = {
        M: 'exonic',
        E: 'exonic',
        F: 'exonic',
        N: 'exonic',
        S: 'exonic',
        D: 'exonic',
        I: 'exonic',
        P: 'exonic',
        L: 'exonic',
        Utr3: 'exonic',
        Utr5: 'exonic',
        mnv: 'non-exonic',
        ITD: 'non-exonic',
        insertion: 'non-exonic',
        deletion: 'non-exonic',
        Intron: 'non-exonic',
        X: 'non-exonic',
        noncoding: 'non-exonic'
    }

    static processorClasses = {
        snv: Snv,
        cnv: Cnv,
        sv: Sv,
        loh: Loh
    } //console.log(this.processorClasses)

    private settings: any;

    map(opts: any): ViewModel {
        this.settings = discoDefaults(opts.settings)

        const chrSizes = opts.args.genome.majorchr

        const chromosomes = new Reference(this.settings, chrSizes)

        const data: Array<Data> = new DataMapper().map(opts.args.data, opts.args.sampleName)

        const labelsMapper = new LabelsMapper(this.settings, opts.args.sampleName, chromosomes)

        const labels: Array<Label> = labelsMapper.map(data)

        const chromosomesRing = new Ring(this.settings.innerRadius + 90,this.settings.chr.width, chromosomes.chromosomes)

        const labelsRing = new Labels(this.settings.innerRadius + 110,this.settings.chr.width,  labels)

        const rings = new Rings(labelsRing, chromosomesRing)

        return new ViewModel(rings)
    }
}