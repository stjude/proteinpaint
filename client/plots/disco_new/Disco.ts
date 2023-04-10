import {getCompInit} from "#rx"
import {DiscoRenderer} from "#plots/disco_new/DiscoRenderer";
import {DiscoInteractions} from "#plots/disco_new/DiscoInteractions";
import  { select }  from 'd3-selection'

export default class Disco {
    private type: string;
    private discoRenderer: DiscoRenderer;
    private discoInteractions: DiscoInteractions;
    private opts: any;

    constructor(opts: any) {
        this.type = 'Disco'
        this.discoRenderer = new DiscoRenderer();
        this.discoInteractions = new DiscoInteractions();
        this.opts = opts
    }
    async init(appState: any): Promise<void> {
        const holder = this.opts.holder.append('div').text("Render plot here")
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
