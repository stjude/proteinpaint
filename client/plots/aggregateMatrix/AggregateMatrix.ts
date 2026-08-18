import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '#plots/PlotBase.ts'
import { getCombinedTermFilter } from '#filter'
import { AggMatrixModel } from './model/AggMatrixModel'
import { getAggregateMatrixSettings } from './settings/defaults.ts'
import { AggMatrixViewModel } from './viewModel/AggMatrixViewModel.ts'
import { AggMatrixView } from './view/AggMatrixView.ts'
import { setControls } from './view/setControls.ts'
import { Menu } from '#dom'
import { availableAggregateMethods } from '#types'

/**** Plot in development ***
 * The aggregate matrix displays two aggregate values for two terms in a matrix format
 * by size and color gradient.*/
export class AggregateMatrix extends PlotBase implements RxComponent {
    static type = 'aggregateMatrix'

    type: string
    components: { controls: ComponentApi }
    dom: { [index: string]: any }
    model!: AggMatrixModel
    viewModel!: AggMatrixViewModel
    view!: AggMatrixView


    constructor(opts: any, api: ComponentApi) {
        super(opts, api)
        this.type = AggregateMatrix.type
        this.components = { controls: {} as ComponentApi }

        const dom = super.getStandardDomLayout(opts.holder)
        this.dom = {
            holder: opts.holder,
            controls: dom.controls.attr('data-testid', 'sjpp-ag-matrix-controls'),
            errorDiv: dom.errdiv.attr('data-testid', 'sjpp-ag-matrix-error'),
            loadingDiv: dom.loadingDiv.attr('data-testid', 'sjpp-ag-matrix-loading'),
            mainDiv: dom.charts.attr('data-testid', 'sjpp-ag-matrix-main').style('padding', '10px'),
            tip: new Menu({ padding: '3px' })
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

    async init(appState) {
        this.model = new AggMatrixModel(this)
        this.viewModel = new AggMatrixViewModel(this)
        this.view = new AggMatrixView(this)

        const config = this.getState(appState).config
        await setControls(this.dom.controls, this, config)
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
    const config = {
        hidePlotFilter: true,
        settings: {
            aggregateMatrix: getAggregateMatrixSettings(opts?.settings?.aggregateMatrix)
        }
    }

    const returnConfig = copyMerge(config, opts)
    validatePlotConfig(returnConfig)

    return returnConfig
}

export function validatePlotConfig(config: any) {
    if (!config || typeof config !== 'object') throw new Error(`Invalid config provided for aggregate matrix plot`)
    if (!config.rows || !Object.keys(config.rows).length) throw new Error(`No rows provided for aggregate matrix plot`)
    let rowCount = 0
    for (const section in config.rows) {
        rowCount = rowCount + config.rows[section].length
        if (rowCount > 2) break
    }
    if (rowCount < 2) throw new Error(`Aggregate matrix plot requires at least 2 rows`)
    if (!config.columns || !Object.keys(config.columns).length) throw new Error(`No columns provided for aggregate matrix plot`)
    let colCount = 0
    for (const member in config.columns) {
        colCount = colCount + config.columns[member].length
        if (colCount > 2) break
    }
    if (colCount < 2) throw new Error(`Aggregate matrix plot requires at least 2 columns`)

    const settings = config.settings?.aggregateMatrix || {}
    if (!availableAggregateMethods.includes(settings.sizeMethod)) {
        throw new Error(`Invalid aggregate method for dot size`)
    }
    if (!availableAggregateMethods.includes(settings.gradientMethod)) {
        throw new Error(`Invalid aggregate method for color gradient`)
    }
    if (settings.gradientMethod == settings.sizeMethod) throw new Error('Aggregate method for the color gradient cannot be the same as the aggregate method for the dot size.')
}