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
        this.settings = discoDefaults(settings)
    }

    map(opts: any): ViewModel {
        const chrSizes = opts.args.genome.majorchr

        const sampleName = opts.args.sampleName

        const cancerGenes = opts.args.cancerGenes ? opts.args.cancerGenes : []

        const data: Array<Data> = opts.args.data

        const reference = new Reference(this.settings, chrSizes)

        const dataMapper = new DataMapper(this.settings, reference, sampleName, cancerGenes)

        dataMapper.map(data)

        const labelsMapper = new LabelsMapper(this.settings, sampleName, reference)

        const labelsData = labelsMapper.map(dataMapper.filteredSnvData)

        const chromosomesRing = new Ring(this.settings.rings.chromosomeInnerRadius, this.settings.rings.chromosomeWidth, reference.chromosomes)

        const labelsRing = new Labels(this.settings, labelsData, dataMapper.hasCancerGenes)

        const arcsMapper = new NonExonicSnvArcsMapper(this.settings, sampleName, reference)

        const nonExonicArcRing: Ring<SnvArc> = new Ring(this.settings.rings.nonExonicInnerRadius, this.settings.rings.nonExonicWidht, arcsMapper.map(dataMapper.nonExonicSnvData))

        const snvArcsMapper = new SnvArcsMapper(this.settings, sampleName, reference)

        const snvArcRing: Ring<SnvArc> = new Ring(this.settings.rings.svnInnerRadius, this.settings.rings.svnWidth, snvArcsMapper.map(dataMapper.snvRingDataMap))

        const lohMapper = new LohArcMapper(this.settings, sampleName, reference)

        const lohArcRing: Ring<LohArc> = new Ring(this.settings.rings.lohInnerRadius, this.settings.rings.lohWidth, lohMapper.map(dataMapper.lohData))

        const cnvArcsMapper = new CnvArcsMapper(this.settings, sampleName, reference, dataMapper.cnvMaxValue, dataMapper.cnvMinValue, this.settings.cnv.unit)

        const cnvArcRing: Ring<CnvArc> = new Ring(this.settings.rings.cnvInnerRadius, this.settings.rings.cnvWidth, cnvArcsMapper.map(dataMapper.cnvData))

        const fusionMapper = new FusionMapper(this.settings, sampleName, reference)

        const fusions = fusionMapper.map(dataMapper.fusionData)

        let lohLegend: LohLegend | undefined;

        if (this.settings.legend.lohLegendEnabled && dataMapper.lohMinValue && dataMapper.lohMaxValue) {
            lohLegend = new LohLegend(dataMapper.lohMinValue, dataMapper.lohMaxValue)
        }

        const legend = new Legend(this.settings.legend.snvTitle,
            this.settings.legend.cnvTitle,
            this.settings.legend.lohTitle,
            this.settings.legend.fusionTitle,
            snvArcsMapper.snvClassMap,
            cnvArcsMapper.cnvClassMap,
            fusions.length > 0,
            lohLegend)

        const rings = new Rings(labelsRing, chromosomesRing, nonExonicArcRing, snvArcRing, cnvArcRing, lohArcRing)

        return new ViewModel(this.settings, rings, legend, fusions)
    }
}