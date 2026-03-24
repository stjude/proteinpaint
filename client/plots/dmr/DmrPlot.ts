import { PlotBase } from '../PlotBase.ts'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { sayerror } from '#dom'
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

	constructor(opts: any, api: any) {
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

		// First render: fetch data and build the block
		this.dom.loading.style('display', 'block')
		try {
			const pad = config.settings.dmr.pad
			const chr = config.coordinateOverride!.chr
			const start = Math.max(0, Number(config.coordinateOverride!.start) - pad)
			const stop = Number(config.coordinateOverride!.stop) + pad

			const dmrResult = await this.model.fetchDmr(chr, start, stop, this.api?.getAbortSignal())
			if ('error' in dmrResult) {
				sayerror(this.dom.error, dmrResult.error)
				throw new Error(dmrResult.error)
			}

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
			this.view.showLoessNote(!vm.viewData.showLoess && !!vm.viewData.diagnostic?.loess)
			if (vm.viewData.diagnostic)
				this.view.renderDiagnostics(vm.viewData.diagnostic, vm.viewData.dmrs!, config.settings.dmr.fdr_cutoff)
		} catch (e: unknown) {
			if (this.app.isAbortError(e)) return
			const msg = e instanceof Error ? e.message : String(e)
			sayerror(this.dom.error, msg)
		}
		this.dom.loading.style('display', 'none')
	}

	async main() {
		// Skip the first main() call — init() already rendered
		if (!this.analyzedRegion) return

		const config = this.state.config as DmrConfig
		this.model = new DmrModel(config, this.app.vocabApi.vocab)

		const c = config.coordinateOverride
		if (!c) return
		const pad = config.settings.dmr.pad
		const chr = c.chr
		const start = Math.max(0, Number(c.start) - pad)
		const stop = Number(c.stop) + pad

		const a = this.analyzedRegion
		const coordsChanged = chr !== a.chr || start !== a.start || stop !== a.stop

		if (coordsChanged) {
			// New coordinates — re-fetch and update tracks in place
			this.view.showOverlay()
			this.view.clearErrors()

			try {
				const dmrResult = await this.model.fetchDmr(chr, start, stop, this.api?.getAbortSignal())
				if ('error' in dmrResult) {
					sayerror(this.dom.error, dmrResult.error)
					throw new Error(dmrResult.error)
				}

				this.analyzedRegion = { chr, start, stop }
				const blkRegion = this.blockInstance?.rglst?.[0]
				const viewStart = blkRegion?.start ?? start
				const viewStop = blkRegion?.stop ?? stop
				const vm = new DmrViewModel(dmrResult, config, this.genomeObj, chr, viewStart, viewStop)

				this.view.updateTracks(vm.viewData, this.blockInstance)
				this.view.updateLegend(this.blockInstance, vm.viewData.legendRows)
				this.view.showLoessNote(!vm.viewData.showLoess && !!vm.viewData.diagnostic?.loess)
				this.view.clearDiagnostics()
				if (vm.viewData.diagnostic)
					this.view.renderDiagnostics(vm.viewData.diagnostic, vm.viewData.dmrs!, config.settings.dmr.fdr_cutoff)
			} catch (e: unknown) {
				if (this.app.isAbortError(e)) return
				const msg = e instanceof Error ? e.message : String(e)
				sayerror(this.dom.error, msg)
			}
			this.view.hideOverlay()
		} else {
			// Same coordinates but settings changed (e.g. backend toggle) — full rebuild
			this.dom.holder.selectAll('*').remove()
			this.view.clearErrors()
			this.dom.loading.style('display', 'block')
			this.blockInstance = null

			try {
				const dmrResult = await this.model.fetchDmr(chr, start, stop, this.api?.getAbortSignal())
				if ('error' in dmrResult) {
					sayerror(this.dom.error, dmrResult.error)
					throw new Error(dmrResult.error)
				}

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
				this.view.showLoessNote(!vm.viewData.showLoess && !!vm.viewData.diagnostic?.loess)
				if (vm.viewData.diagnostic)
					this.view.renderDiagnostics(vm.viewData.diagnostic, vm.viewData.dmrs!, config.settings.dmr.fdr_cutoff)
			} catch (e: unknown) {
				if (this.app.isAbortError(e)) return
				const msg = e instanceof Error ? e.message : String(e)
				sayerror(this.dom.error, msg)
			}
			this.dom.loading.style('display', 'none')
		}
	}

	onBlockCoordinateChange(rglst: { chr: string; start: number; stop: number }[]) {
		if (!this.analyzedRegion || !rglst.length) return
		const r = rglst[0]
		if (r.start >= r.stop || r.start < 0) return
		if (r.stop - r.start > 500_000) {
			this.view.clearErrors()
			sayerror(this.dom.error, 'Region too large for DMR analysis (>500kb). Zoom in to re-run.')
			return
		}
		this.view.clearErrors()
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

export function getPlotConfig(opts: Partial<DmrConfig>): DmrConfig {
	validateConfig(opts)

	const config = {
		settings: {
			dmr: getDefaultDMRSettings(opts)
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
