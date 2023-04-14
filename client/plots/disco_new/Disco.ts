import {getCompInit} from "#rx"
import {DiscoRenderer} from "#plots/disco_new/renderer/DiscoRenderer";
import {DiscoInteractions} from "#plots/disco_new/viewmodel/DiscoInteractions";
import { StateViewModelMapper } from "#plots/disco_new/viewmodel/StateViewModelMapper"

export default class Disco {
    private type: string;
    private discoRenderer: DiscoRenderer;
    private discoInteractions: DiscoInteractions;
    private opts: any;
    private stateViewModelMapper: StateViewModelMapper

    constructor(opts: any) {
        this.type = 'Disco'
        this.opts = opts
        this.discoRenderer = new DiscoRenderer()
        this.discoInteractions = new DiscoInteractions()
        this.stateViewModelMapper = new StateViewModelMapper()
    }
    async init(appState: any): Promise<void> {
        const viewModel = this.stateViewModelMapper.map(appState)
        const holder = this.opts.holder.append('div')
        this.discoRenderer.render(holder, viewModel)
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
