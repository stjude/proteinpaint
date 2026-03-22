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
	private computingPollId: any = null

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
		// Backend toggle button
		const toggleDiv = opts.holder.append('div').style('padding', '2px 0')
		const toggleBtn = toggleDiv
			.append('button')
			.style('font-size', '11px')
			.text('Backend: Rust')
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

	async init() {
		const { config } = this.getState(this.app.getState())
		validateConfig(config)
		if (this.dom.header) this.dom.header.text(config.headerText || 'DMR Analysis')
		this.genomeObj = this.app.opts.genome
		this.model = new DmrModel(config, this.app.vocabApi.vocab)
	}

	async main() {
		const config = this.state.config as DmrConfig
		// Clear any active polling interval from previous computing state
		if (this.computingPollId) {
			clearInterval(this.computingPollId)
			this.computingPollId = null
		}
		// Update model with latest config (settings may have changed, e.g. backend toggle)
		this.model = new DmrModel(config, this.app.vocabApi.vocab)
		const isRerun = config.coordinateOverride && this.blockInstance && this.analyzedRegion

		if (isRerun) {
			const c = config.coordinateOverride!
			const a = this.analyzedRegion!
			const pad = config.settings.dmr.pad
			const paddedStart = Math.max(0, Number(c.start) - pad)
			const paddedStop = Number(c.stop) + pad
			const coordsChanged = c.chr !== a.chr || paddedStart !== a.start || paddedStop !== a.stop
			if (coordsChanged) {
				// User panned/zoomed — update tracks in-place
				await this.rerun(c.chr, paddedStart, paddedStop)
				return
			}
			// Coordinates unchanged (e.g. backend toggle) — fall through to full rebuild
			// using the existing analyzed region coordinates
		}

		// Full initial load
		this.dom.holder.selectAll('*').remove()
		this.view.clearErrors()
		this.dom.loading.style('display', 'block')
		this.blockInstance = null

		try {
			let chr: string, start: number, stop: number
			if (config.coordinateOverride) {
				// Prefer promoter coordinates from diffMeth (tight region) over
				// gene lookup (full gene body — too large for DMRCate probe density)
				const pad = config.settings.dmr.pad
				chr = config.coordinateOverride.chr
				start = Math.max(0, config.coordinateOverride.start - pad)
				stop = config.coordinateOverride.stop + pad
			} else if (config.geneName) {
				;({ chr, start, stop } = await this.model.lookupGene(config.geneName))
			} else {
				throw new Error('Either geneName or coordinateOverride is required')
			}

			const dmrResult = await this.model.fetchDmr(chr, start, stop)
			if ('error' in dmrResult) {
				sayerror(this.dom.error, dmrResult.error)
				throw new Error(dmrResult.error)
			}
			console.log('DMR result:', JSON.stringify(dmrResult).slice(0, 200))
			if ('status' in dmrResult && (dmrResult as any).status === 'computing') {
				this.dom.loading.text(
					'R backend: genome-wide probe-level analysis in progress. This runs once per group comparison…'
				)
				// Poll every 10s until cache is ready
				if (this.computingPollId) clearInterval(this.computingPollId)
				const pollModel = this.model
				const pollChr = chr,
					pollStart = start,
					pollStop = stop
				const pollApp = this.app,
					pollId = this.id,
					pollSettings = config.settings.dmr
				this.computingPollId = setInterval(async () => {
					console.log('Polling R backend cache status...')
					try {
						const retry = await pollModel.fetchDmr(pollChr, pollStart, pollStop)
						console.log('Poll result:', JSON.stringify(retry).slice(0, 100))
						if ('status' in retry && (retry as any).status === 'computing') return
						clearInterval(this.computingPollId)
						this.computingPollId = null
						pollApp.dispatch({
							type: 'plot_edit',
							id: pollId,
							config: { settings: { dmr: { ...pollSettings } } }
						})
					} catch (e) {
						console.error('Poll error:', e)
					}
				}, 10000)
				console.log('Started polling interval:', this.computingPollId)
				return
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
			if (vm.viewData.diagnostic)
				this.view.renderDiagnostics(vm.viewData.diagnostic, vm.viewData.dmrs!, config.settings.dmr.fdr_cutoff)
		} catch (e: unknown) {
			if (this.app.isAbortError(e)) return
			const msg = e instanceof Error ? e.message : String(e)
			sayerror(this.dom.error, msg)
		}
		this.dom.loading.style('display', 'none')
	}

	private async rerun(chr: string, start: number, stop: number) {
		const config = this.state.config as DmrConfig
		this.view.showOverlay()
		this.view.clearErrors()

		try {
			let dmrResult = await this.model.fetchDmr(chr, start, stop)
			if ('error' in dmrResult) {
				sayerror(this.dom.error, dmrResult.error)
				throw new Error(dmrResult.error)
			}
			while ('status' in dmrResult && (dmrResult as any).status === 'computing') {
				await new Promise(r => setTimeout(r, 5000))
				dmrResult = await this.model.fetchDmr(chr, start, stop)
				if ('error' in dmrResult) {
					sayerror(this.dom.error, dmrResult.error)
					throw new Error(dmrResult.error)
				}
			}

			this.analyzedRegion = { chr, start, stop }
			const vm = new DmrViewModel(dmrResult, config, this.genomeObj, chr, start, stop)

			this.view.updateTracks(vm.viewData, this.blockInstance)
			this.view.updateLegend(this.blockInstance, vm.viewData.legendRows)
			this.view.clearDiagnostics()
			if (vm.viewData.diagnostic)
				this.view.renderDiagnostics(vm.viewData.diagnostic, vm.viewData.dmrs!, config.settings.dmr.fdr_cutoff)
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			sayerror(this.dom.error, msg)
		}
		this.view.hideOverlay()
	}

	onBlockCoordinateChange(rglst: { chr: string; start: number; stop: number }[]) {
		if (!this.analyzedRegion || !rglst.length) return
		const r = rglst[0]
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
	if (!opts.geneName && !opts.coordinateOverride)
		throw new Error('geneName or coordinateOverride is required for DMR plot')
	if (!opts.group1) throw new Error('group1 is required for DMR plot')
	if (!opts.group2) throw new Error('group2 is required for DMR plot')
}
