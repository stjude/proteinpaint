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

/**
 * TODO:
 * - Init plot filters:
 *     - Hide plot filters if !isMetaResult
 *     - Or consider, with server route changes, only allowing filters for certain term types
 * (i.e. scge since it's cell specific)
 */
class DynamicSubplot implements RxComponent {
	static type = 'dynamicSubplot'

	type: string
	opts!: { [index: string]: any }
	app!: MassAppApi
	id!: string
	state: any
	components: { [name: string]: ComponentApi } = {}
	dom: { [index: string]: any } = {}

	constructor(opts) {
		this.type = DynamicSubplot.type
		this.opts = opts
	}

	async init() {
		this.dom = {
			holder: this.opts.holder,
			viz: this.opts.holder.body.append('div').style('position', 'relative'),
			paneTitleDiv: this.opts.holder.header.append('div').style('position', 'relative'),
			filterDiv: this.opts.holder.header.append('div').style('position', 'relative')
		}
	}

	async main() {
		if (!this.components) await this.setComponents(this.opts)
	}

	async setComponents(opts) {
		const _ = await importPlot(opts.chartType)
		const promises: { [index: string]: any } = {
			chart: _.componentInit({
				app: this.app,
				holder: this.dom.viz,
				header: this.dom.paneTitleDiv,
				id: this.id,
				parentId: this.opts.parentId
			})
		}

		if (!this.state.config.hidePlotFilter)
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

		this.components = await multiInit(promises)
	}

	destroy() {
		this.dom.holder.app_div.selectAll('*').remove()
		this.dom.holder.app_div.remove()
		for (const key in this.dom) {
			delete this.dom[key]
		}
	}
}

export const dynamicSubplotInit = getCompInit(DynamicSubplot)
