import ViewModel from "../viewmodel/ViewModel";
import discoDefaults from "../viewmodel/defaults";
import Reference from "./Reference";
import DataMapper from "./DataMapper";
import LabelsMapper from "./LabelsMapper";
import Ring from "../viewmodel/Ring";
import Labels from "../viewmodel/Labels";
import NonExonicSnvArcsMapper from "./NonExonicSnvArcsMapper";
import SnvArc from "../viewmodel/SnvArc";
import SnvArcsMapper from "./SnvArcsMapper";
import LohArcMapper from "./LohArcMapper";
import LohArc from "../viewmodel/LohArc";
import CnvArcsMapper from "./CnvArcsMapper";
import CnvArc from "../viewmodel/CnvArc";
import LohLegend from "../viewmodel/LohLegend";
import Legend from "../viewmodel/Legend";
import Rings from "../viewmodel/Rings";
import Settings from "../viewmodel/Settings";
import Data from "./Data";
import FusionMapper from "./FusionMapper";

export class ViewModelMapper {

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


    private settings: Settings;

    constructor(settings: Settings) {
        this.settings = settings
    }

    map(opts: any): ViewModel {
        this.settings = discoDefaults(opts.settings)

        const chrSizes = opts.args.genome.majorchr

        const sampleName = opts.args.sampleName

        const cancerGenes = opts.args.cancerGenes? opts.args.cancerGenes: []

        const data: Array<Data> = opts.args.data

        const reference = new Reference(this.settings, chrSizes)

        const exonicFilter = (data: Data) => ViewModelMapper.snvClassLayer[data.mClass] == 'exonic';

        const dataMapper = new DataMapper(this.settings, reference, sampleName, exonicFilter, cancerGenes)


        dataMapper.map(data)

        const labelsMapper = new LabelsMapper(this.settings, sampleName, reference)

        const labelsData = labelsMapper.map(dataMapper.filteredSnvData)

        const chromosomesRing = new Ring(this.settings.rings.chromosomeInnerRadius, this.settings.rings.chromosomeWidth, reference.chromosomes)

        const labelsRing = new Labels(this.settings, labelsData, dataMapper.hasCancerGenes)

        const arcsMapper = new NonExonicSnvArcsMapper(this.settings, sampleName, reference)

        const nonExonicArcRing: Ring<SnvArc> = new Ring(this.settings.rings.nonExonicInnerRadius, this.settings.rings.nonExonicWidht, arcsMapper.map(dataMapper.nonExonicSnvData))

        const exonicSnvArcsMapper = new SnvArcsMapper(this.settings, sampleName, reference)

        const exonicArcRing: Ring<SnvArc> = new Ring(this.settings.rings.svnInnerRadius, this.settings.rings.svnWidth, exonicSnvArcsMapper.map(dataMapper.snvRingDataMap))

        const lohMapper = new LohArcMapper(this.settings, sampleName, reference)

        const lohArcRing: Ring<LohArc> = new Ring(120, 20, lohMapper.map(dataMapper.lohData))

        const cnvArcsMapper = new CnvArcsMapper(this.settings, sampleName, reference, dataMapper.cnvMaxValue, dataMapper.cnvMinValue)

        const cnvArcRing: Ring<CnvArc> = new Ring(100, 20, cnvArcsMapper.map(dataMapper.cnvData))

        const fusionMapper = new FusionMapper(this.settings, sampleName, reference)

        const fusions = fusionMapper.map(dataMapper.fusionData)

        const lohLegend = new LohLegend(0, 0, "", "")

        const legend = new Legend("SNV-Indel", exonicSnvArcsMapper.snvClassMap, "Copy Number (log2 ratio)", cnvArcsMapper.cnvClassMap, "LOH seg. mean", lohLegend)

        const rings = new Rings(labelsRing, chromosomesRing, nonExonicArcRing, exonicArcRing, cnvArcRing, lohArcRing)

        return new ViewModel(this.settings, rings, legend, fusions)
    }
}