import { getCompInit, type AppApi } from '#rx'
import { RunChart2 } from '../runChart2/RunChart2.ts'
import { getDefaultFrequencyChart2Settings } from './defaults.ts'
import { getFrequencyChart2Controls } from './FrequencyChart2Controls.ts'
import { controlsInit } from '#plots/controls.js'
import { FrequencyChart2Model } from './model/FrequencyChart2Model.ts'
import { RunChart2ViewModel } from '../runChart2/viewModel/ViewModel.ts'
import { FrequencyChart2View } from './view/View.ts'
import { getCombinedTermFilter, getWrappedTvslst } from '#filter'
import { fillTermWrapper } from 'termsetting/utils.ts'

export class FrequencyChart2 extends RunChart2 {
	static type = 'frequencyChart2'
	configTermKeys = ['tw'] // FrequencyChart2 uses single tw, not xtw/ytw

	constructor(opts: any, api: any) {
		super(opts, api)
		this.type = FrequencyChart2.type

		// Update header text
		if (opts.header) {
			opts.header.selectAll('*').remove()
			opts.header.append('span').style('font-size', '0.8em').style('opacity', 0.7).text('FREQUENCY CHART')
		}
	}

	getState(appState: any) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw new Error(
				`No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
			)
		}
		const parentConfig = appState.plots.find(p => p.id === this.parentId)
		// Use plot's local filter (or parent's) so getCombinedTermFilter returns global + local
		const plotFilter = config.filter ?? parentConfig?.filter
		const termfilter = getCombinedTermFilter(appState, plotFilter)

		return {
			termdbConfig: appState.termdbConfig,
			termfilter,
			vocab: appState.vocab,
			config: {
				...config,
				filter: plotFilter,
				settings: {
					...config.settings,
					frequencyChart2: config.settings?.frequencyChart2
				}
			}
		}
	}

	async setControls(viewModel: RunChart2ViewModel) {
		const range = { xMin: viewModel.xMin, xMax: viewModel.xMax, yMin: viewModel.yMin, yMax: viewModel.yMax }
		this.dom.controls.selectAll('*').remove()
		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.style('display', 'inline-block'),
			inputs: getFrequencyChart2Controls(this.app, range, this)
		})
		this.components.controls.on('downloadClick.frequencyChart2', async (event: any) => {
			await this.download(event)
		})
		const appState = this.app.getState()
		this.components.controls.update?.({ appState })
	}

	getDownloadFilename() {
		const termName = this.state?.config?.tw?.term?.name || 'frequencyChart2'
		return termName
	}

	async main() {
		const c = this.state.config
		if (c.childType != this.type && c.chartType != this.type) return

		const config = await this.getMutableConfig()

		// Ensure tw is present
		if (!config.tw) {
			//this.dom.error.text('FrequencyChart2 requires a date/time term (tw).')
			//return
		}

		try {
			const settings = getDefaultFrequencyChart2Settings(config.settings?.frequencyChart2)
			this.model = new FrequencyChart2Model(this)
			const data = await this.model.fetchData(config)
			if (!data) {
				this.dom.error.text('No data available for the selected terms and filter.')
				return
			}
			this.viewModel = new RunChart2ViewModel(settings)
			const viewData = this.viewModel.map(data)

			await this.setControls(this.viewModel)

			if (!this.dom.chartHolder.empty()) {
				this.dom.chartHolder.selectAll('*').remove()
			}
			// View expects config.xtw/ytw for axis labels; derive from tw so stored config stays { tw } only
			const viewConfig = { ...config, xtw: config.tw, ytw: config.tw }
			this.view = new FrequencyChart2View(viewData, settings, this.dom.chartHolder, viewConfig, this)
		} catch (e) {
			console.error(e)
			throw new Error(`FrequencyChart2.main() failed: ${e}`)
		}
	}
}

export const frequencyChart2Init = getCompInit(FrequencyChart2)
export const componentInit = frequencyChart2Init

export async function getPlotConfig(opts: any, app: AppApi) {
	const plot: any = {
		...(opts.tw && { tw: opts.tw }),
		settings: {
			frequencyChart2: getDefaultFrequencyChart2Settings()
		}
	}

	const defaultConfig = app.vocabApi.termdbConfig?.plotConfigByCohort?.default?.[opts.chartType]
	// New plot: start with empty local filter (no preselected values). Data still uses global filter via getCombinedTermFilter.
	if (opts.filter == null) opts.filter = getWrappedTvslst([])

	Object.assign(plot, defaultConfig, opts)

	// Chart menu uses detail: 'term', so selected term arrives as config.term — map to tw for FrequencyChart2
	if (!plot.tw && plot.term) plot.tw = plot.term
	// FrequencyChart2 config is { tw } only (no xtw/ytw like runChart2)
	delete plot.xtw
	delete plot.ytw
	// Ensure settings.frequencyChart2 exists so main() and model never see undefined
	plot.settings = plot.settings ?? {}
	plot.settings.frequencyChart2 = getDefaultFrequencyChart2Settings(plot.settings.frequencyChart2)
	if (plot.tw) await fillTermWrapper(plot.tw, app.vocabApi)

	return plot
}
