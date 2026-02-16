import { PlotBase } from '#plots/PlotBase.ts'
import { getCompInit, copyMerge, type RxComponent, type ComponentApi, type AppApi } from '#rx'
import { select2Terms, DownloadMenu, Menu } from '#dom'
import { fillTermWrapper } from 'termsetting/utils.ts'
import { getCombinedTermFilter } from '#filter/filter.utils'
import { getDefaultRunChart2Settings } from './defaults.ts'
import { getRunChart2Controls } from './RunChart2Controls.ts'
import { controlsInit } from '#plots/controls.js'
import { RunChart2Model } from './model/RunChart2Model.ts'
import { RunChart2ViewModel } from './viewModel/ViewModel.ts'
import { RunChart2View } from './view/View.ts'

export class RunChart2 extends PlotBase implements RxComponent {
	static type = 'runChart2'
	type: string
	components: { controls: ComponentApi }
	dom: any
	model!: RunChart2Model
	viewModel!: RunChart2ViewModel
	view!: RunChart2View
	configTermKeys = ['xtw', 'ytw']

	constructor(opts: any, api: any) {
		super(opts, api)
		this.opts = opts
		this.api = api
		this.type = RunChart2.type
		if (this.opts.parentId) this.parentId = this.opts.parentId

		this.components = {
			controls: {} as ComponentApi
		}
		const leftDiv = opts.holder.insert('div').style('display', 'inline-block')
		const controlsHolder = leftDiv.append('div').style('display', 'inline-block')
		const chartHolder = opts.holder
			.append('div')
			.attr('data-testId', 'sjpp-runChart2-chartHolder')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')

		this.dom = {
			controls: controlsHolder,
			chartHolder,
			error: chartHolder.append('div').attr('data-testId', 'sjpp-runChart2-error'),
			hovertip: new Menu({ padding: '3px' })
		}
		if (opts.header) {
			this.dom.headerLabel = opts.header
				.append('span')
				.attr('class', 'sja_runChart2_header')
				.attr('data-testId', 'sjpp-runChart2-header')
				.style('font-size', '0.8em')
				.style('opacity', 0.7)
				.text('RUN CHART')
		}
	}

	reactsTo(action: any) {
		if (action.type.includes('cache_termq')) return true
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
		if (action.type.startsWith('plot_')) {
			return (
				(action.id === this.id || action.id == this.parentId) &&
				(!action.config?.childType || action.config?.childType == this.type)
			)
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
		const termfilter = getCombinedTermFilter(appState, config.filter || parentConfig?.filter)

		return {
			termdbConfig: appState.termdbConfig,
			termfilter,
			vocab: appState.vocab,
			config: Object.assign({}, config, {
				settings: {
					runChart2: config.settings?.runChart2
				}
			})
		}
	}

	async setControls(viewModel: RunChart2ViewModel) {
		const range = { xMin: viewModel.xMin, xMax: viewModel.xMax, yMin: viewModel.yMin, yMax: viewModel.yMax }
		this.dom.controls.selectAll('*').remove()
		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.style('display', 'inline-block'),
			inputs: getRunChart2Controls(this.app, range, this)
		})
		this.components.controls.on('downloadClick.runChart2', async (event: any) => {
			await this.download(event)
		})
		const appState = this.app.getState()
		this.components.controls.update?.({ appState })
	}

	async download(event: any) {
		const chartImages = this.getChartImages()
		if (chartImages.length === 0) {
			console.warn('No chart images available for download')
			return
		}
		const filename = this.getDownloadFilename()
		const menu = new DownloadMenu(chartImages, filename)
		menu.show(event.clientX, event.clientY, event.target)
	}

	getChartImages() {
		const chartImages: any[] = []
		if (!this.view || !this.view.chartDom) return chartImages

		const svg = this.view.chartDom.svg
		if (svg && !svg.empty()) {
			const chartName = this.state?.config?.xtw?.term?.name || 'runChart2'
			chartImages.push({ name: chartName, svg })
		}
		return chartImages
	}

	getDownloadFilename() {
		const xTermName = this.state?.config?.xtw?.term?.name || 'runChart2'
		const yTermName = this.state?.config?.ytw?.term?.name || ''
		return yTermName ? `${xTermName}_${yTermName}` : xTermName
	}

	async main() {
		const c = this.state.config
		if (c.childType != this.type && c.chartType != this.type) return

		const config = await this.getMutableConfig()

		if (this.dom.headerLabel) {
			this.dom.headerLabel.text(config.ytw == null ? 'FREQUENCY CHART' : 'RUN CHART')
		}

		try {
			this.model = new RunChart2Model(this)
			const data = await this.model.fetchData(config)
			if (!data) {
				this.dom.error.text('No data available for the selected terms and filter.')
			}
			const settings = config.settings.runChart2
			this.viewModel = new RunChart2ViewModel(settings)
			const viewData = this.viewModel.map(data)

			await this.setControls(this.viewModel)

			if (!this.dom.chartHolder.empty()) {
				this.dom.chartHolder.selectAll('*').remove()
			}
			this.view = new RunChart2View(viewData, settings, this.dom.chartHolder, config, this)
		} catch (e) {
			console.error(e)
			throw new Error(`RunChart2.main() failed: ${e}`)
		}
	}
}

export const runChart2Init = getCompInit(RunChart2)
export const componentInit = runChart2Init

export async function getPlotConfig(opts: any, app: AppApi) {
	const xtw = opts.xtw
	const ytw = opts.ytw ?? null
	if (!xtw) throw new Error('runChart2 requires xtw (X term wrapper)')

	const settings = { ...(opts.settings || {}) }

	try {
		if (!xtw.q) xtw.q = {}
		xtw.q.mode = xtw.q.mode ?? 'continuous'
		await fillTermWrapper(xtw, app.vocabApi)
		if (ytw) {
			if (!ytw.q) ytw.q = {}
			ytw.q.mode = ytw.q.mode ?? 'continuous'
			await fillTermWrapper(ytw, app.vocabApi)
		}
	} catch (e) {
		console.error(e)
		throw new Error(`runChart2 getPlotConfig() failed: ${e}`)
	}

	const defaultConfig = app.vocabApi.termdbConfig?.plotConfigByCohort?.default?.[opts.chartType]

	const config: any = {
		xtw,
		...(ytw != null && { ytw }),
		settings: {
			controls: { isOpen: false },
			runChart2: getDefaultRunChart2Settings({ ...opts, settings })
		}
	}
	return copyMerge(config, defaultConfig, {
		...opts,
		xtw,
		...(ytw != null && { ytw }),
		settings: { ...settings, runChart2: settings.runChart2 ?? {} }
	})
}

export function makeChartBtnMenu(holder, chartsInstance) {
	const menuDiv = holder.append('div')

	const callback = (xterm: any, yterm: any) => {
		chartsInstance.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'runChart2',
				xtw: { term: xterm, q: { mode: 'continuous' } },
				ytw: { term: yterm, q: { mode: 'continuous' } },
				name: `${xterm.name} vs ${yterm.name}`
			}
		})
	}

	menuDiv
		.append('button')
		.style('margin', '5px')
		.style('padding', '10px 15px')
		.style('border-radius', '20px')
		.style('border-color', '#ededed')
		.style('display', 'block')
		.text('Select data to plot ...')
		.on('click', () => {
			chartsInstance.dom.tip.clear()
			select2Terms(chartsInstance.dom.tip, chartsInstance.app, 'runChart2', 'date', callback, 'numeric')
			chartsInstance.dom.tip.show()
		})

	const byDefault = chartsInstance.state.termdbConfig?.plotConfigByCohort?.default
	const runChart2Plots = byDefault?.runChart2?.plots ?? []
	for (const plot of runChart2Plots) {
		const config = structuredClone(plot)
		const dispatchPlot = () => {
			chartsInstance.app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'runChart2',
					...config
				}
			})
			chartsInstance.dom.tip.hide()
		}
		menuDiv
			.append('button')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.style('margin', '5px')
			.style('padding', '10px 15px')
			.style('border-radius', '20px')
			.style('border-color', '#ededed')
			.style('display', 'block')
			.text(plot.name)
			.on('mousedown', (event: any) => {
				event.preventDefault()
				event.stopPropagation()
				dispatchPlot()
			})
			.on('click', (event: any) => {
				event.preventDefault()
				event.stopPropagation()
				chartsInstance.dom.tip.hide()
			})
	}
}
