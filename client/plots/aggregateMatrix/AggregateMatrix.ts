import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '#plots/PlotBase.ts'
import { getCombinedTermFilter } from '#filter'
import { AggMatrixModel } from './model/AggMatrixModel'
import { getAggregateMatrixSettings } from './settings/defaults.ts'
import { AggMatrixViewModel } from './viewModel/AggMatrixViewModel.ts'
import { AggMatrixView } from './view/AggMatrixView.ts'
import { setControls } from './view/setControls.ts'

/**** Plot in development ***
 * The aggregate matrix displays two aggregate values for two terms in a matrix format
 * by size and color gradient.*/
export class AggregateMatrix extends PlotBase implements RxComponent {
    static type = 'aggregateMatrix'

    type: string
    components: { controls: any }
    dom: { [name: string]: any }
    model!: AggMatrixModel
    viewModel!: AggMatrixViewModel
    view!: AggMatrixView


    constructor(opts: any, api: ComponentApi) {
        super(opts, api)
        this.type = AggregateMatrix.type
        this.components = { controls: {} }

        const dom = super.getStandardDomLayout(opts.holder)
        this.dom = {
            holder: opts.holder,
            controls: dom.controls.attr('data-testid', 'sjpp-ag-matrix-controls'),
            errorDiv: dom.errdiv.attr('data-testid', 'sjpp-ag-matrix-error'),
            loadingDiv: dom.loadingDiv.attr('data-testid', 'sjpp-ag-matrix-loading'),
            mainDiv: dom.charts.attr('data-testid', 'sjpp-ag-matrix-main').style('padding', '10px')
        }

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
        this.viewModel = new AggMatrixViewModel(this)
        this.view = new AggMatrixView(this)
    }

    async main() {
        if (!this.model) throw new Error(`Model not initialized`)
        if (!this.viewModel) throw new Error(`ViewModel not initialized`)
        if (!this.view) throw new Error(`View not initialized`)

        super.toggleLoadingDiv()

        try {
            const data = await this.model.getData()
            if (!data || data.error) {
                super.toggleLoadingDiv('none')
                super.printError(data?.error || 'No data returned from server')
                return
            }
            this.dom.controls.selectAll('*').remove()
            await setControls(this.dom.controls, this)
            this.viewModel.processData(data)
        } catch (e: any) {
            if (e instanceof Error) console.error(`${e.message || e} [AggregateMatrix main()]`)
			else if (e.stack) console.log(e.stack)
			super.toggleLoadingDiv('none')
			super.printError(e.message || e)
			return
        }
        this.view.render(this.viewModel.viewData)
        super.toggleLoadingDiv('none') 
    }
}

export const aggMatrixInit = getCompInit(AggregateMatrix)
export const componentInit = aggMatrixInit

export function getPlotConfig(opts: any) {
    validatePlotConfig(opts)

    const config = {
        hidePlotFilter: true,
        settings: {
            aggregateMatrix: getAggregateMatrixSettings(opts?.settings?.aggregateMatrix)
        }
    }

    return copyMerge(config, opts)
}

export function validatePlotConfig(config: any) {
    if (!config || typeof config !== 'object') throw new Error(`Invalid config provided for AggregateMatrix plot`)
    if (!config.rows || !Object.keys(config.rows).length) throw new Error(`No rows provided for AggregateMatrix plot`)
    if (!config.columns || !Object.keys(config.columns).length) throw new Error(`No columns provided for AggregateMatrix plot`)
}