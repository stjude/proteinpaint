import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '#plots/PlotBase.ts'
import { getCombinedTermFilter } from '#filter'
import { AggMatrixModel } from './model/AggMatrixModel'
import { getDefaultAggregateMatrixSettings } from './settings/defaults.ts'

/**** Plot in development ***
 * The aggregate matrix displays two aggregate values for two terms in a matrix format
 * by size and color gradient.*/
export class AggregateMatrix extends PlotBase implements RxComponent {
    static type = 'aggregateMatrix'

    type: string
    components: { controls: any }
    model!: AggMatrixModel


    constructor(opts: any, api: ComponentApi) {
        super(opts, api)
        this.type = AggregateMatrix.type
        this.components = { controls: {} }

        //opts.header is the sandbox header
		if (opts.header) opts.header.html(`AGGREGATE MATRIX`).style('font-size', '0.9em')
    }

    getState(appState: any) {
        const config = appState.plots.find((p: any) => p.id === this.id)
        if (!config) {
            throw new Error(
                `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
            )
        }
        const parentConfig = appState.plots.find(p => p.id === this.parentId)
        const termfilter = getCombinedTermFilter(appState, config.filter || parentConfig?.filter)
        return {
            termfilter,
            config
        }
    }

    async init() {
        this.model = new AggMatrixModel(this)
    }

    async main() {
         if (!this.model) throw new Error(`Model not initialized`)

        super.toggleLoadingDiv()

        try {
            const data = await this.model.getData()
            // if (!data || data.error) {
            //     super.toggleLoadingDiv('none')
            //     super.printError(data?.error || 'No data returned from server')
            //     return
            // }
            console.log(data)
        } catch (e: any) {
            if (e instanceof Error) console.error(`${e.message || e} [AggregateMatrix main()]`)
			else if (e.stack) console.log(e.stack)
			super.toggleLoadingDiv('none')
			super.printError(e.message || e)
			return
        }
        super.toggleLoadingDiv('none') 
    }
}

export const aggMatrixInit = getCompInit(AggregateMatrix)
export const componentInit = aggMatrixInit

export function getPlotConfig(opts: any) {
    const config = {
        hidePlotFilter: true,
        settings: getDefaultAggregateMatrixSettings()
    }

    validatePlotConfig(config)

    return copyMerge(config, opts)
}

export function validatePlotConfig(config: any) {
    if (!config || typeof config !== 'object') throw new Error(`Invalid config provided for AggregateMatrix plot`)
    if (!config.entries || !Object.keys(config.entries).length) throw new Error(`No entries provided for AggregateMatrix plot`)
    if (!config.categories || !Object.keys(config.categories).length) throw new Error(`No categories provided for AggregateMatrix plot`)
}