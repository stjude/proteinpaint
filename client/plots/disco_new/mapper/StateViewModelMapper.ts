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

export class StateViewModelMapper {

    private hits = {classes: []} // used in legend

    private static dtNums = [
        2,
        5,
        4,
        10,
        1,
        'exonic',
        'non-exonic'
    ]

    private static dtAlias = {
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

    private static snvClassLayer = {
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

    processorClasses = {
        snv: Snv,
        cnv: Cnv,
        sv: Sv,
        loh: Loh
    } //console.log(this.processorClasses)

    private processors = {
        labels: new LabelProcessor(),
    }
    private settings: any;

    map(opts: any): ViewModel {
        this.settings = discoDefaults(opts.settings)

        const chrSizes = opts.args.genome.majorchr

        const chromosomes = new Reference(this.settings, chrSizes)

        const rings = [new Ring(this.settings.innerRadius, 30, chromosomes.chromosomes)]

        const data : Array<Data> = this.mapData(opts.args.data, opts.args.sampleName)

        data.forEach(data => {

            if (!StateViewModelMapper.dtNums.includes(data.dt)) return
            const alias = data.dt == 1 && this.settings.snv.byClassWidth ? StateViewModelMapper.snvClassLayer[data.class] : StateViewModelMapper.dtAlias[data.dt]
            if (!this.processors[alias]) {
                this.processors[alias] = new this.processorClasses[data.dt == 1 ? 'snv' : alias](this.settings, alias, chromosomes)
            }
            const cls = this.processors[alias].main(data)
            if (!this.hits.classes.includes(cls)) {
                this.hits.classes.push(cls)
            }
            //this.labels.track(s[data.dt==1 ? 'snv' : alias], data.gene, response.length, '')
        })

        const plot = {
            title: '', //sampleName,
            sample: opts.args.sampleName,
            lastRadius: this.settings.innerRadius,
            layers: []
        }

        StateViewModelMapper.dtNums.forEach(dt => {
            const alias = dt in StateViewModelMapper.dtAlias ? StateViewModelMapper.dtAlias[dt] : dt
            if (!this.processors[alias]) return
            const geneArcs = this.processors[alias].setLayer(plot, plot.sample)
            this.processors.labels.setGeneArcs(geneArcs, alias)
        })

        return new ViewModel(rings)
    }


     mapData(data, sampleName) {
         const dataArray : Array<Data> = []

         data.forEach(dObject => {
             const instance = new Data()

             instance.alt = dObject.alt
             instance.chr = dObject.chr
             instance.class = dObject.class
             instance.dt = dObject.dt
             instance.gene = dObject.gene
             instance.mname = dObject.mname
             instance.pos = dObject.pos
             instance.position = dObject.position
             instance.ref = dObject.ref
             instance.sample = sampleName
             instance.posbins = dObject.posbins
             instance.poschr = dObject.poschr
             instance.poslabel = dObject.poslabel

             instance.ssm_id = dObject.ssm_id
             instance.start = dObject.start
             instance.stop = dObject.stop
             instance.value = dObject.value

             dataArray.push(instance)
         })

         return dataArray
    }
}