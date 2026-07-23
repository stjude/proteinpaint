import { importPlot } from '#plots/importPlot.js'
import { getCompInit, multiInit, type RxComponent, type ComponentApi } from '#rx'
import { filterRxCompInit } from '#filter'
import type { MassAppApi } from '#mass/types/mass'

/** Wrapper for subplot sanbdoxes created dynamically.
 * Builds out the expected dom structure and extra functionality (e.g. plot filter)
 *
 * Note: #mass/app.ts expects parent plots to manage plot init for all subplots,
 * which means plotInit() and summaryInit() are never called for subplots.
 * The functionality here is sligthly different from MassPlot && plotInit()
 * in #mass/plot.js to support dynamic creation and destory within the parent */

class DynamicSubplot implements RxComponent {
	static type = 'dynamicSubplot'

	type: string
	opts!: { [index: string]: any }
	app: MassAppApi
	id!: string
	state: any
	components!: { [name: string]: ComponentApi }
	dom: { [index: string]: any } = {}
	parentId?: string

	constructor(opts) {
		this.type = DynamicSubplot.type
		this.opts = opts
		this.app = opts.app
		this.parentId = opts?.parentId
	}

	async init() {
		this.opts.holder.app_div.attr('data-testid', 'sjpp-sc-subplot-sandbox-' + this.opts.chartType)

		/** Summary expects the entire sandbox. No need to create dom. */
		if (this.opts.chartType == 'summary') return

		this.dom = {
			holder: this.opts.holder,
			viz: this.opts.holder.body.append('div').style('position', 'relative'),
			paneTitleDiv: this.opts.holder.header.append('div').style('position', 'relative'),
			filterDiv: this.opts.holder.header.append('div').style('position', 'relative'),
			errorDiv: this.opts.holder.body.append('div').style('position', 'relative')
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config
		}
	}

	async main() {
		if (!this.components) await this.setComponents()
	}

	async setComponents() {
		const _ = await importPlot(this.opts.chartType)
		const chartOpts: { [index: string]: any } = {
			app: this.app,
			id: this.id,
			parentId: this.parentId
		}
		if (this.opts.chartType == 'summary') {
			chartOpts.holder = this.opts.holder
			chartOpts.hidePlotFilter = this.opts.isMetaResult
		} else {
			chartOpts.holder = this.dom.viz
			chartOpts.header = this.dom.paneTitleDiv
		}
		const promises: { [index: string]: any } = {
			chart: _.componentInit(chartOpts)
		}

		/** Summary inits its own plot filter */
		if (!this.state.config?.hidePlotFilter && this.opts.isMetaResult && this.opts.chartType != 'summary') {
			promises.filter = filterRxCompInit({
				app: this.app,
				vocabApi: this.app.vocabApi,
				parentId: this.id,
				holder: this.dom.filterDiv,
				hideLabel: true,
				emptyLabel: '+Add new filter',
				callback: filter => {
					this.app.dispatch({
						id: this.id,
						type: 'plot_edit',
						config: { filter }
					})
				}
			})
		}

		this.components = await multiInit(promises)
	}

	destroy() {
		const appDiv = this.dom?.holder?.app_div
		if (appDiv) {
			appDiv.selectAll('*').remove()
			appDiv.remove()
		}
		for (const key in this.dom) {
			delete this.dom[key]
		}
	}
}

export const dynamicSubplotInit = getCompInit(DynamicSubplot)
