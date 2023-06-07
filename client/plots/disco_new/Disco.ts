import {getCompInit} from "#rx"
import {DiscoRenderer} from "./renderer/DiscoRenderer";
import {DiscoInteractions} from "./viewmodel/DiscoInteractions";
import {ViewModelMapper} from "./mapper/ViewModelMapper"
import LegendRenderer from "./renderer/LegendRenderer";
import ChromosomesRenderer from "./renderer/ChromosomesRenderer";
import LabelsRenderer from "./renderer/LabelsRenderer";
import discoDefaults from "./viewmodel/defaults";
import Settings from "./viewmodel/Settings";
import NonExonicSnvRenderer from "./renderer/NonExonicSnvRenderer";
import SnvRenderer from "./renderer/SnvRenderer";
import LohRenderer from "./renderer/LohRenderer";
import CnvRenderer from "./renderer/CnvRenderer";
import IRenderer from "./renderer/IRenderer";
import {RingType} from "./viewmodel/RingType";

export default class Disco {

    private type: string;
    private discoRenderer: DiscoRenderer;
    private discoInteractions: DiscoInteractions;
    private opts: any;
    private stateViewModelMapper: ViewModelMapper
    private settings: Settings

    constructor(opts: any) {
        this.type = 'Disco'
        this.opts = opts

        this.settings = discoDefaults({
            "showControls": false,
            "selectedSamples": []
        })

        const legendRenderer = new LegendRenderer()
        this.discoRenderer = new DiscoRenderer(this.getRingRenderers(), legendRenderer)
        this.discoInteractions = new DiscoInteractions()
        this.stateViewModelMapper = new ViewModelMapper(this.settings)
    }

    async init(appState: any): Promise<void> {
        const viewModel = this.stateViewModelMapper.map(appState)
        const holder = this.opts.holder.append('div')
        this.discoRenderer.render(holder, viewModel)
    }

    getRingRenderers() {
        const chromosomesRenderer = new ChromosomesRenderer(this.settings.padAngle, this.settings.rings.chromosomeInnerRadius, this.settings.rings.chromosomeInnerRadius +  this.settings.rings.chromosomeWidth)
        const labelsRenderer = new LabelsRenderer()
        const nonExonicSnvRenderer = new NonExonicSnvRenderer()
        const snvRenderer = new SnvRenderer(this.settings.rings.svnInnerRadius, this.settings.rings.svnWidth)
        const cnvRenderer = new CnvRenderer()
        const lohRenderer = new LohRenderer()

        const renderersMap: Map<RingType, IRenderer> = new Map()
        renderersMap.set(RingType.CHROMOSOME,chromosomesRenderer )
        renderersMap.set(RingType.LABEL,labelsRenderer )
        renderersMap.set(RingType.NONEXONICSNV, nonExonicSnvRenderer)
        renderersMap.set(RingType.SNV, snvRenderer)
        renderersMap.set(RingType.CNV, cnvRenderer)
        renderersMap.set(RingType.LOH, lohRenderer)

        return renderersMap;
    }
}

export const discoInit = getCompInit(Disco)
// this alias will allow abstracted dynamic imports
export const componentInit = discoInit

export async function getPlotConfig(opts, app) {
    return {
        chartType: 'Disco',
        subfolder: 'disco_new',
        extension: 'ts'
    }
}