import { PlotBase } from '../PlotBase.ts'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { sayerror, table2col, renderTable } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { first_genetrack_tolist } from '#common/1stGenetk'
import type { TermdbDmrResponse, DmrDiagnostic } from '#types'
import type { DmrConfig, DmrDom, BedItem } from './DmrTypes.ts'
import { getDefaultDMRSettings } from './settings/defaults.ts'

class DmrPlot extends PlotBase implements RxComponent {
	static type = 'dmr'
	type = DmrPlot.type
	declare dom: DmrDom
	blockInstance: InstanceType<any> | null = null
	analyzedRegion: { chr: string; start: number; stop: number } | null = null

	constructor(opts: any, api: any) {
		super(opts, api)
		this.dom = {
			header: opts?.header,
			holder: opts.holder.append('div'),
			rerunBar: opts.holder.append('div').style('display', 'none'),
			error: opts.holder.append('div'),
			loading: opts.holder.append('div').text('Running DMR analysis\u2026'),
			diagnosticPanel: opts.holder.append('div').style('display', 'none')
		}
	}

	getState(appState: { plots: DmrConfig[] }): { config: DmrConfig } {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw new Error(`No plot with id='${this.id}' found`)
		return { config }
	}

	async init() {}

	async main() {
		const config = this.state.config as DmrConfig
		if (this.dom.header) this.dom.header.text(config.headerText || 'DMR Analysis')

		validateConfig(config)

		this.dom.holder.selectAll('*').remove()
		this.dom.error.selectAll('*').remove()
		this.dom.rerunBar.style('display', 'none')
		this.dom.loading.style('display', 'block')

		try {
			const { geneName, settings } = config
			const { genome } = this.app.vocabApi.vocab

			const geneResult = await dofetch3('genelookup', {
				body: { deep: 1, input: geneName, genome }
			})
			if (geneResult.error || !geneResult.gmlst?.length) {
				throw new Error(`Could not find coordinates for gene "${geneName}"`)
			}
			const gm = geneResult.gmlst[0]
			const chr = gm.chr
			const start = Math.max(0, gm.start - settings.dmr.pad)
			const stop = gm.stop + settings.dmr.pad

			await this.runAnalysis(chr, start, stop)
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			sayerror(this.dom.error, msg)
			this.dom.loading.style('display', 'none')
		}
	}

	async runAnalysis(chr: string, start: number, stop: number) {
		const config = this.state.config as DmrConfig
		const { group1, group2, settings } = config
		const { genome, dslabel } = this.app.vocabApi.vocab

		this.dom.holder.selectAll('*').remove()
		this.dom.error.selectAll('*').remove()
		this.dom.diagnosticPanel.selectAll('*').remove()
		this.dom.diagnosticPanel.style('display', 'none')
		this.dom.rerunBar.style('display', 'none')
		this.dom.loading.style('display', 'block')
		this.blockInstance = null

		try {
			const dmrResult: TermdbDmrResponse = await dofetch3('termdb/dmr', {
				body: {
					genome,
					dslabel,
					chr,
					start,
					stop,
					group1,
					group2,
					width: settings.dmr.blockWidth,
					trackHeight: settings.dmr.trackHeight,
					nan_threshold: settings.dmr.nanThreshold,
					shoreSize: settings.dmr.shoreSize,
					colors: settings.dmr.colors,
					trackDpi: settings.dmr.trackDpi,
					trackYPad: settings.dmr.trackYPad,
					group1Name: config.group1Name,
					group2Name: config.group2Name
				}
			})
			if ('error' in dmrResult) {
				sayerror(this.dom.error, dmrResult.error)
				throw new Error(dmrResult.error)
			}

			this.analyzedRegion = { chr, start, stop }

			const genomeObj = this.app.opts.genome
			const tklst: { type: string; name: string; bedItems?: BedItem[]; __isgene?: boolean }[] = []
			first_genetrack_tolist(genomeObj, tklst)

			tklst.push({
				type: 'bedj',
				name: 'DMRs',
				bedItems: dmrResult.dmrs.map(dmr => {
					const alpha = Math.round(Math.min(255, (0.5 + dmr.probability * 0.5) * 255))
					const hex = alpha.toString(16).padStart(2, '0')
					const base = dmr.direction === 'hyper' ? '#e66101' : '#5e81f4'
					return { chr: dmr.chr, start: dmr.start, stop: dmr.stop, color: base + hex }
				})
			})

			if (dmrResult.annotations?.length) {
				tklst.push({
					type: 'bedj',
					name: 'cCREs',
					bedItems: dmrResult.annotations.map(a => ({
						chr: a.chr,
						start: a.start,
						stop: a.stop,
						color: settings.dmr.annotationColors[a.type] || '#94a3b8'
					}))
				})
			}

			// Add GP Model as a bigwig imgData track when the server returns a PNG
			if (dmrResult.trackImg) {
				tklst.push({
					type: 'bigwig',
					name: 'GP Model',
					height: settings.dmr.trackHeight,
					imgData: {
						minv: 0,
						maxv: 1,
						src: dmrResult.trackImg
					}
				} as any)
			}

			const { Block } = await import('#src/block')
			this.blockInstance = new Block({
				holder: this.dom.holder,
				genome: genomeObj,
				chr,
				start,
				stop,
				tklst,
				nobox: true,
				width: settings.dmr.blockWidth,
				onCoordinateChange: (rglst: { chr: string; start: number; stop: number }[]) =>
					this.onBlockCoordinateChange(rglst)
			})
			this.renderLegend(!!dmrResult.annotations?.length)
			if (dmrResult.diagnostic) this.renderDiagnosticStats(dmrResult.diagnostic, dmrResult.dmrs)
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			sayerror(this.dom.error, msg)
		}
		this.dom.loading.style('display', 'none')
	}

	onBlockCoordinateChange(rglst: { chr: string; start: number; stop: number }[]) {
		if (!this.analyzedRegion || !rglst.length) return
		const r = rglst[0]
		const a = this.analyzedRegion
		if (r.chr === a.chr && r.start === a.start && r.stop === a.stop) {
			this.dom.rerunBar.style('display', 'none')
			return
		}

		const coordStr = `${r.chr}:${r.start}-${r.stop}`
		this.dom.rerunBar.selectAll('*').remove()
		this.dom.rerunBar.style('display', 'block').style('padding', '4px 0')
		this.dom.rerunBar
			.append('button')
			.text(`Re-run DMR analysis (${coordStr})`)
			.on('click', () => this.runAnalysis(r.chr, r.start, r.stop))
	}

	renderDiagnosticStats(diag: DmrDiagnostic, dmrs: { start: number; stop: number; direction: string }[]) {
		const panel = this.dom.diagnosticPanel
		panel.selectAll('*').remove()
		panel.style('display', 'block')

		const { probes } = diag

		// Collapsible stats panel
		const toggle = panel.append('div').attr('style', 'cursor:pointer;font-size:12px;color:#888;padding:2px 0')
		const statsContent = panel.append('div').style('display', 'none')
		let expanded = false
		toggle.text('+ Diagnostic details').on('click', () => {
			expanded = !expanded
			toggle.text((expanded ? '\u2212 ' : '+ ') + 'Diagnostic details')
			statsContent.style('display', expanded ? 'block' : 'none')
		})

		const spacings = diag.probe_spacings
		const medianSpacing = spacings.length ? spacings.slice().sort((a, b) => a - b)[Math.floor(spacings.length / 2)] : 0
		const maxGap = spacings.length ? Math.max(...spacings) : 0
		const gapsOver1kb = spacings.filter(s => s > 1000).length
		const density =
			probes.positions.length > 1
				? probes.positions.length / ((probes.positions[probes.positions.length - 1] - probes.positions[0]) / 1000)
				: 0

		const t = table2col({ holder: statsContent, disableScroll: true })
		for (const [k, v] of [
			['Probes in region', String(probes.positions.length)],
			['Probe density', `${density.toFixed(1)} probes/kb`],
			['Median spacing', `${medianSpacing.toFixed(0)} bp`],
			['Max gap', `${maxGap.toFixed(0)} bp`],
			['Gaps > 1kb', String(gapsOver1kb)],
			['DMRs called', String(dmrs.length)]
		] as [string, string][]) {
			t.addRow(k, v)
		}

		const namedDomains = diag.domains.filter(d => d.type !== 'Intergenic')
		if (namedDomains.length) {
			statsContent
				.append('div')
				.attr('style', 'font-size:12px;font-weight:bold;margin-top:8px;color:#555')
				.text('Domain GP Parameters')
			renderTable({
				div: statsContent,
				header: { allowSort: true },
				columns: [
					{ label: 'Domain', sortable: true },
					{ label: 'Type', sortable: true },
					{ label: 'Prior Mean', sortable: true },
					{ label: 'Adaptive LS (bp)', sortable: true },
					{
						label: 'Learned LS (bp)',
						sortable: true,
						tooltip:
							'\u2014 means the optimizer had no probes in this domain or hit its bounds; the adaptive LS was used instead'
					}
				],
				rows: namedDomains.map(d => [
					{ value: d.name.length > 25 ? d.name.slice(0, 22) + '\u2026' : d.name },
					{ value: d.type },
					{ value: d.prior_mean.toFixed(2) },
					{ value: String(d.prior_ls) },
					{ value: d.learned_ls != null ? d.learned_ls.toFixed(0) : '\u2014' }
				]),
				noRadioBtn: true,
				showLines: false,
				striped: true,
				allowRestoreRowOrder: true,
				maxHeight: '30vh'
			})
		}
	}

	renderLegend(hasAnnotations: boolean) {
		const block = this.blockInstance as any
		if (!block?.legend?.holder) return
		const { legendcolor, vpad } = block.legend

		const addRow = (label: string, items: [string, string][]) => {
			const tr = block.legend.holder.append('tr')
			tr.append('td')
				.text(label)
				.attr('style', `padding-right:10px;text-align:right;color:#555;border-right:solid 1px ${legendcolor}`)
			const td = tr.append('td')
			for (const [text, color] of items) {
				const item = td
					.append('div')
					.attr('style', `display:inline-block;white-space:nowrap;padding:${vpad} 20px ${vpad} 0`)
				item
					.append('div')
					.attr(
						'style',
						`display:inline-block;width:12px;height:12px;background:${color};margin-right:5px;border-radius:2px;vertical-align:middle`
					)
				item.append('div').attr('style', 'display:inline-block;color:#555;font-size:.8em').text(text)
			}
		}

		const config = this.state.config as DmrConfig
		const { colors } = config.settings.dmr
		const g1 = config.group1Name || 'Group 1'
		const g2 = config.group2Name || 'Group 2'
		addRow('GP Model', [
			[`${g1} (case)`, colors.group1],
			[`${g2} (reference)`, colors.group2]
		])
		addRow('DMR', [
			['Hypermethylated', colors.hyper],
			['Hypomethylated', colors.hypo]
		])
		if (hasAnnotations) addRow('cCRE', Object.entries(config.settings.dmr.annotationColors) as [string, string][])
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
	if (!opts.geneName) throw new Error('geneName is required for DMR plot')
	if (!opts.group1) throw new Error('group1 is required for DMR plot')
	if (!opts.group2) throw new Error('group2 is required for DMR plot')
}
