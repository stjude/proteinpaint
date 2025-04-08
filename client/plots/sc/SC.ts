import { RxComponentInner } from '../../types/rx.d'
import type { BasePlotConfig, MassAppActions, MassState } from '#mass/types/mass'
import type { Div } from '../../types/d3'
import { getCompInit, copyMerge } from '#rx'
import type { SCConfig, SCConfigOpts, SCViewerOpts } from './SCTypes'
import { SCRenderer } from './SCRenderer'
import { getDefaultSCSampleTableSettings } from '../scSampleTable'

class SCViewer extends RxComponentInner {
	readonly type = 'sc'
	components: {
		plots: { [key: string]: any }
	}
	plotsDiv: { [key: string]: Div }
	// plotsControlsDiv: { [key: string]: Div }
	renderer?: SCRenderer

	constructor(opts: SCViewerOpts) {
		super()
		this.components = {
			plots: {}
		}
		const div = opts.holder
			.classed('sjpp-sc-main', true)
			.append('div')
			.style('padding', '5px')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
		const tabsDiv = div.append('div').attr('id', 'sjpp-sc-tabs').style('display', 'inline-block')
		const plots = div.append('div').attr('id', 'sjpp-sc-tabs-content')
		this.dom = {
			div,
			tabsDiv,
			plots
		}
		// this.plotsControlsDiv = {}
		this.plotsDiv = {}

		if (opts.header) this.dom.header = opts.header.html(`SINGLE CELL`).style('font-size', '0.9em')
	}

	getState(appState: MassState) {
		const config = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			termfilter: appState.termfilter,
			termdbConfig: appState.termdbConfig
		}
	}

	reactsTo(action: MassAppActions) {
		if (action.type.includes('cache_termq')) return true
		if (action.type.startsWith('plot_')) {
			return action.id === this.id
		}
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
	}

	async init(appState: MassState) {
		const state = this.getState(appState)
		this.renderer = new SCRenderer(this.app, this.dom, state)
	}

	async setComponent(config: SCConfig) {
		let _
		if (config.childType == 'scSampleTable') _ = await import(`#plots/scSampleTable.ts`)
		if (config.childType == 'differentialAnalysis') _ = await import(`#plots/diffAnalysis/DifferentialAnalysis.ts`)
		if (config.childType == 'violin') _ = await import(`#plots/violin.js`)

		// this.plotsControlsDiv[config.childType] = this.dom.controls.append('div')
		this.plotsDiv[config.childType] = this.dom.plots.append('div')

		const opts = {
			app: this.app,
			holder: this.plotsDiv[config.childType],
			id: this.id,
			parent: this.api
			// controls: this.plotsControlsDiv[config.childType]
		}
		this.components.plots[config.childType] = await _.componentInit(opts)
	}

	async main() {
		const config = structuredClone(this.state.config)
		if (config.chartType != this.type) return

		if (!this.renderer) throw `Renderer not initialized [SC main()]`

		if (!this.components.plots[config.childType]) await this.setComponent(config)

		for (const childType in this.components.plots) {
			const chart = this.components.plots[childType]
			if (chart.type != config.childType) {
				this.plotsDiv[chart.type].style('display', 'none')
				// this.plotsControlsDiv[chart.type].style('display', 'none')
			}
		}
		this.plotsDiv[config.childType].style('display', '')
		// this.plotsControlsDiv[config.childType].style('display', '')

		this.renderer.update(config)
	}
}

export const SCInit = getCompInit(SCViewer)
export const componentInit = SCInit

export function getPlotConfig(opts: SCConfigOpts) {
	const config = {
		chartType: 'sc',
		childType: 'scSampleTable',
		settings: {
			controls: { isOpen: false },
			scSampleTable: getDefaultSCSampleTableSettings(opts.overrides || {})
		}
	} as any

	return copyMerge(config, opts)
}
