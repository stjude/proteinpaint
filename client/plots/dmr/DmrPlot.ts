import { PlotBase } from '../PlotBase.ts'
import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import type { DmrConfig, DmrDom } from './DmrTypes.ts'
import { getDefaultDMRSettings } from './settings/defaults.ts'
import { DmrModel } from './model/DmrModel.ts'
import { DmrViewModel } from './viewModel/DmrViewModel.ts'
import { DmrView } from './view/DmrView.ts'

class DmrPlot extends PlotBase implements RxComponent {
	static type = 'dmr'

	type = DmrPlot.type
	declare dom: DmrDom
	blockInstance: InstanceType<any> | null = null
	analyzedRegion: { chr: string; start: number; stop: number } | null = null
	view!: DmrView
	private model!: DmrModel
	private genomeObj: any

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		const wrapper = opts.holder.append('div').style('position', 'relative')
		const loadingOverlay = wrapper
			.append('div')
			.attr('class', 'sjpp-spinner')
			.style('display', 'none')
			.style('position', 'absolute')
			.style('z-index', '10')
			.style('background-color', 'rgba(255,255,255,0.65)')
		// Backend toggle button (temporary — for R vs Rust validation)
		const toggleDiv = opts.holder.append('div').style('padding', '2px 0')
		const initBackend = opts.state?.config?.settings?.dmr?.backend || 'rust'
		const toggleBtn = toggleDiv
			.append('button')
			.style('font-size', '11px')
			.text(`Backend: ${initBackend === 'rust' ? 'Rust' : 'R (DMRCate)'}`)
			.on('click', () => {
				const config = this.state.config as DmrConfig
				const curr = config.settings.dmr.backend || 'rust'
				const next = curr === 'rust' ? 'r' : 'rust'
				toggleBtn.text(`Backend: ${next === 'rust' ? 'Rust' : 'R (DMRCate)'}`)
				this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: { settings: { dmr: { ...config.settings.dmr, backend: next } } }
				})
			})

		this.dom = {
			header: opts?.header,
			holder: wrapper.append('div'),
			loadingOverlay,
			error: opts.holder.append('div'),
			note: opts.holder.append('div'),
			loading: opts.holder.append('div').text('Running DMR analysis\u2026'),
			diagnosticPanel: opts.holder.append('div').style('display', 'none')
		}
		this.view = new DmrView(this.dom)
	}

	getState(appState: { plots: DmrConfig[] }): { config: DmrConfig } {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw new Error(`No plot with id='${this.id}' found`)
		return { config }
	}

	async init(appState: any) {
		const { config } = this.getState(appState)
		validateConfig(config)
		if (this.dom.header) this.dom.header.text(config.headerText || 'DMR Analysis')
		this.genomeObj = this.app.opts.genome
		this.model = new DmrModel(config, this.app.vocabApi.vocab)

		/* No fetch here. main() runs right after init and its full-rebuild branch does the first
		render, so there is one code path for rendering and, more to the point, one for failing:
		an error thrown from main() is shown by the framework (PlotBase.printError) and re-shown on
		every update until it is resolved, where an error caught inside init and written into
		dom.error was wiped by the very next update() before anyone saw it. */
	}

	async main() {
		const config = this.state.config as DmrConfig
		this.model = new DmrModel(config, this.app.vocabApi.vocab)

		const c = config.coordinateOverride
		if (!c) return
		const pad = config.settings.dmr.pad
		const chr = c.chr
		const start = Math.max(0, Number(c.start) - pad)
		const stop = Number(c.stop) + pad

		const a = this.analyzedRegion
		const coordsChanged = a && (chr !== a.chr || start !== a.start || stop !== a.stop)

		if (a && coordsChanged) {
			// New coordinates — re-fetch and update tracks in place
			this.view.showOverlay()

			try {
				checkRegionSize(stop - start, config.settings.dmr.maxRegionSize)
				const dmrResult = await this.model.fetchDmr(chr, start, stop, this.api?.getAbortSignal())
				if ('error' in dmrResult) throw new Error(dmrResult.error)

				this.analyzedRegion = { chr, start, stop }
				const blkRegion = this.blockInstance?.rglst?.[0]
				const viewStart = blkRegion?.start ?? start
				const viewStop = blkRegion?.stop ?? stop
				const vm = new DmrViewModel(dmrResult, config, this.genomeObj, chr, viewStart, viewStop)

				this.view.updateTracks(vm.viewData, this.blockInstance)
				this.view.updateLegend(this.blockInstance, vm.viewData.legendRows)
				this.view.showLoessNote(!vm.viewData.showDots)
				this.view.clearDiagnostics()
				if (vm.viewData.diagnostic)
					this.view.renderDiagnostics(vm.viewData.diagnostic, vm.viewData.dmrs!, config.settings.dmr.fdr_cutoff)
			} catch (e: unknown) {
				if (this.app.isAbortError(e)) return
				this.view.hideOverlay()
				throw e
			}
			this.view.hideOverlay()
		} else {
			// First render, or same coordinates with changed settings (e.g. backend toggle) — full build
			this.dom.holder.selectAll('*').remove()
			this.dom.loading.style('display', 'block')
			this.blockInstance = null

			try {
				checkRegionSize(stop - start, config.settings.dmr.maxRegionSize)
				const dmrResult = await this.model.fetchDmr(chr, start, stop, this.api?.getAbortSignal())
				if ('error' in dmrResult) throw new Error(dmrResult.error)

				this.analyzedRegion = { chr, start, stop }
				const vm = new DmrViewModel(dmrResult, config, this.genomeObj, chr, start, stop)

				this.blockInstance = await this.view.renderBlock(
					vm.viewData,
					this.genomeObj,
					config.settings.dmr,
					chr,
					start,
					stop,
					rglst => this.onBlockCoordinateChange(rglst)
				)
				this.view.renderLegend(this.blockInstance, vm.viewData.legendRows)
				this.view.showLoessNote(!vm.viewData.showDots)
				if (vm.viewData.diagnostic)
					this.view.renderDiagnostics(vm.viewData.diagnostic, vm.viewData.dmrs!, config.settings.dmr.fdr_cutoff)
			} catch (e: unknown) {
				if (this.app.isAbortError(e)) return
				this.dom.loading.style('display', 'none')
				throw e
			}
			this.dom.loading.style('display', 'none')
		}
	}

	onBlockCoordinateChange(rglst: { chr: string; start: number; stop: number }[]) {
		if (!this.analyzedRegion || !rglst.length) return
		const r = rglst[0]
		if (r.start >= r.stop || r.start < 0) return
		const a = this.analyzedRegion
		if (r.chr === a.chr && r.start === a.start && r.stop === a.stop) return
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { coordinateOverride: { chr: r.chr, start: r.start, stop: r.stop } }
		})
	}
}

export const componentInit = getCompInit(DmrPlot)

export function getPlotConfig(opts: Partial<DmrConfig>, app?: any): DmrConfig {
	validateConfig(opts)

	const config = {
		settings: {
			// app is passed through so the defaults can tell a CpG-level dataset from an
			// element-level one; opts alone does not carry termdbConfig
			dmr: getDefaultDMRSettings({ ...opts, app })
		}
	}
	return copyMerge(config, opts)
}

/** Runs in both getPlotConfig and main() because will only run in main()
 * when plot is loaded from a saved state (e.g. mass session file).*/
function validateConfig(opts) {
	if (!opts.coordinateOverride) throw new Error('coordinateOverride (chr/start/stop) is required for DMR plot')
	if (!opts.group1) throw new Error('group1 is required for DMR plot')
	if (!opts.group2) throw new Error('group2 is required for DMR plot')
}

/** Client-side region size guard (configurable via settings.dmr.maxRegionSize, default 5 Mb).
 *  The server also enforces a hard safety cap (10 Mb) to catch direct API calls or buggy clients. */
function checkRegionSize(span: number, maxRegionSize: number) {
	if (span > maxRegionSize) {
		const mbLimit = (maxRegionSize / 1_000_000).toFixed(0)
		const mbSpan = (span / 1_000_000).toFixed(1)
		throw new Error(`Region too large for DMR analysis (${mbSpan} Mb). Maximum is ${mbLimit} Mb.`)
	}
}
