import { PlotBase } from '../PlotBase.ts'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { sayerror } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { first_genetrack_tolist } from '#common/1stGenetk'
import type { TermdbDmrResponse, DmrDiagnostic } from '#types'
import type { DmrConfig, DmrDom, BedItem } from './DmrTypes.ts'
import { getDefaultDMRSettings } from './settings/defaults.ts'

/** Colors for regulatory annotation types, matching GPDM core.py ANNOTATION_COLORS */
const ANNOTATION_COLORS: Record<string, string> = {
	CGI: '#06b6d4',
	Shore: '#22d3ee',
	Promoter: '#8b5cf6',
	Enhancer: '#f59e0b',
	CTCF: '#ef4444'
}

class DmrPlot extends PlotBase implements RxComponent {
	static type = 'dmr'
	type = DmrPlot.type
	declare dom: DmrDom
	blockInstance: InstanceType<any> | null = null

	constructor(opts: any, api: any) {
		super(opts, api)
		this.dom = {
			header: opts?.header,
			holder: opts.holder.append('div'),
			error: opts.holder.append('div'),
			loading: opts.holder.append('div').text('Running DMR analysis…'),
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
		this.dom.loading.style('display', 'block')

		try {
			const { geneName, group1, group2, settings } = config
			const { genome, dslabel } = this.app.vocabApi.vocab

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

			const dmrResult: TermdbDmrResponse = await dofetch3('termdb/dmr', {
				body: { genome, dslabel, chr, start, stop, group1, group2 }
			})
			if ('error' in dmrResult) {
				sayerror(this.dom.error, dmrResult.error)
				throw new Error(dmrResult.error)
			}

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
						color: ANNOTATION_COLORS[a.type] || '#94a3b8'
					}))
				})
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
				width: settings.dmr.blockWidth
			})
			this.renderLegend(!!dmrResult.annotations?.length)
			if (dmrResult.diagnostic) this.renderDiagnostic(dmrResult.diagnostic, dmrResult.dmrs, chr, start, stop)
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			sayerror(this.dom.error, msg)
		}
		this.dom.loading.style('display', 'none')
	}

	renderDiagnostic(
		diag: DmrDiagnostic,
		dmrs: { start: number; stop: number; direction: string }[],
		_chr: string,
		viewStart: number,
		viewStop: number
	) {
		const panel = this.dom.diagnosticPanel
		panel.selectAll('*').remove()
		panel.style('display', 'block')

		const block = this.blockInstance as any
		if (!block) return

		const trackH = 150
		const { probes, gp_posterior: gp } = diag

		const tk: any = {
			name: 'GP Model',
			hidden: false,
			toppad: 5,
			bottompad: 0,
			height_main: trackH,
			height: trackH,
			yoff: 0,
			subpanels: []
		}

		tk.g = block.gbase.append('g')
		tk.gmiddle = tk.g.append('g').attr('transform', `translate(${block.leftheadw + block.lpad},0)`)
		tk.tkbodybgrect = tk.gmiddle
			.append('rect')
			.attr('fill', 'white')
			.attr('fill-opacity', 0)
			.attr('width', block.width)
			.attr('height', trackH)
		tk.glider = tk.gmiddle.append('g').style('cursor', 'default')

		tk.gleft = tk.g.append('g').attr('transform', `translate(${block.leftheadw},0)`)
		tk.gleft
			.append('text')
			.attr('x', -5)
			.attr('y', trackH / 2)
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'middle')
			.attr('font-size', '12px')
			.attr('font-weight', 'bold')
			.attr('fill', '#333')
			.text('GP Model')

		tk.gright = tk.g
			.append('g')
			.attr('transform', `translate(${block.leftheadw + block.lpad + block.width + block.rpad},0)`)

		block.tklst.push(tk)
		block.block_setheight()

		const xScale = (pos: number) => ((pos - viewStart) / (viewStop - viewStart)) * block.width
		const yPad = 12
		const yScale = (beta: number) => yPad + (1 - beta) * (trackH - 2 * yPad)
		const glider = tk.glider

		// DMR shading
		for (const dmr of dmrs) {
			glider
				.append('rect')
				.attr('x', xScale(dmr.start))
				.attr('y', 0)
				.attr('width', Math.max(1, xScale(dmr.stop) - xScale(dmr.start)))
				.attr('height', trackH)
				.attr('fill', dmr.direction === 'hyper' ? '#e66101' : '#5e81f4')
				.attr('opacity', 0.06)
		}

		// Y-axis gridlines and labels
		for (const tick of [0, 0.25, 0.5, 0.75, 1.0]) {
			const y = yScale(tick)
			glider
				.append('line')
				.attr('x1', 0)
				.attr('x2', block.width)
				.attr('y1', y)
				.attr('y2', y)
				.attr('stroke', '#e5e7eb')
				.attr('stroke-width', 0.5)
			tk.gright
				.append('text')
				.attr('x', 5)
				.attr('y', y + 3)
				.attr('font-size', '9px')
				.attr('fill', '#999')
				.text(tick.toFixed(2))
		}

		// GP credible bands
		for (const [pred, std, color] of [
			[gp.pred_group1, gp.std_group1, '#5e81f4'],
			[gp.pred_group2, gp.std_group2, '#e66101']
		] as [number[], number[], string][]) {
			const points = gp.grid.map((x, i) => ({
				x: xScale(x),
				lo: yScale(Math.max(0, pred[i] - 1.96 * std[i])),
				hi: yScale(Math.min(1, pred[i] + 1.96 * std[i]))
			}))
			const d =
				'M' +
				points.map(p => `${p.x},${p.hi}`).join('L') +
				'L' +
				[...points]
					.reverse()
					.map(p => `${p.x},${p.lo}`)
					.join('L') +
				'Z'
			glider.append('path').attr('d', d).attr('fill', color).attr('opacity', 0.1)
		}

		// GP posterior lines
		const mkLine = (xs: number[], ys: number[]) => 'M' + xs.map((x, i) => `${xScale(x)},${yScale(ys[i])}`).join('L')
		glider
			.append('path')
			.attr('d', mkLine(gp.grid, gp.pred_group1))
			.attr('stroke', '#3b5ee6')
			.attr('stroke-width', 1.5)
			.attr('fill', 'none')
		glider
			.append('path')
			.attr('d', mkLine(gp.grid, gp.pred_group2))
			.attr('stroke', '#c04e00')
			.attr('stroke-width', 1.5)
			.attr('fill', 'none')

		// Raw probe dots
		for (let i = 0; i < probes.positions.length; i++) {
			const cx = xScale(probes.positions[i])
			for (const [y, color] of [
				[probes.mean_group1[i], '#5e81f4'],
				[probes.mean_group2[i], '#e66101']
			] as [number, string][]) {
				glider
					.append('circle')
					.attr('cx', cx)
					.attr('cy', yScale(y))
					.attr('r', 2.5)
					.attr('fill', color)
					.attr('opacity', 0.6)
			}
		}

		// Inline legend — use actual group names from volcano if available
		const cfg = this.state.config as DmrConfig
		const g1Label = cfg.group1Name || 'Group1 (ref)'
		const g2Label = cfg.group2Name || 'Group2 (comp)'
		for (const [i, label, color] of [
			[0, g1Label, '#5e81f4'],
			[1, g2Label, '#e66101']
		] as [number, string, string][]) {
			glider
				.append('circle')
				.attr('cx', block.width - 8)
				.attr('cy', 8 + i * 14)
				.attr('r', 3)
				.attr('fill', color)
			glider
				.append('text')
				.attr('x', block.width - 14)
				.attr('y', 11 + i * 14)
				.attr('font-size', '9px')
				.attr('fill', '#555')
				.attr('text-anchor', 'end')
				.text(label)
		}

		// Collapsible stats panel
		const toggle = panel.append('div').attr('style', 'cursor:pointer;font-size:12px;color:#888;padding:2px 0')
		const statsContent = panel.append('div').style('display', 'none')
		let expanded = false
		toggle.text('+ Diagnostic details').on('click', () => {
			expanded = !expanded
			toggle.text((expanded ? '− ' : '+ ') + 'Diagnostic details')
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

		const table = statsContent.append('table').attr('style', 'border-collapse:collapse;font-size:12px')
		for (const [label, value] of [
			['Probes in region', String(probes.positions.length)],
			['Probe density', `${density.toFixed(1)} probes/kb`],
			['Median spacing', `${medianSpacing.toFixed(0)} bp`],
			['Max gap', `${maxGap.toFixed(0)} bp`],
			['Gaps > 1kb', String(gapsOver1kb)],
			['DMRs called', String(dmrs.length)]
		] as [string, string][]) {
			const tr = table.append('tr')
			tr.append('td').attr('style', 'padding:2px 12px 2px 0;color:#666').text(label)
			tr.append('td').attr('style', 'padding:2px 0;font-weight:bold').text(value)
		}

		const namedDomains = diag.domains.filter(d => d.type !== 'Intergenic')
		if (namedDomains.length) {
			statsContent
				.append('div')
				.attr('style', 'font-size:12px;font-weight:bold;margin-top:8px;color:#555')
				.text('Domain GP Parameters')
			const dtable = statsContent.append('table').attr('style', 'border-collapse:collapse;font-size:11px')
			const dhead = dtable.append('tr')
			for (const h of ['Domain', 'Type', 'Prior Mean', 'Adaptive LS (bp)', 'Learned LS (bp)'])
				dhead
					.append('th')
					.attr('style', 'padding:2px 8px;text-align:left;border-bottom:1px solid #ddd;color:#666')
					.text(h)
			for (const d of namedDomains) {
				const tr = dtable.append('tr')
				const cells = [
					d.name.length > 25 ? d.name.slice(0, 22) + '…' : d.name,
					d.type,
					d.prior_mean.toFixed(2),
					String(d.prior_ls)
				]
				for (const text of cells) tr.append('td').attr('style', 'padding:2px 8px').text(text)
				tr.append('td')
					.attr('style', 'padding:2px 8px;font-weight:bold')
					.text(d.learned_ls != null ? d.learned_ls.toFixed(0) : '—')
			}
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

		addRow('DMR', [
			['Hypermethylated', '#e66101'],
			['Hypomethylated', '#5e81f4']
		])
		if (hasAnnotations) addRow('cCRE', Object.entries(ANNOTATION_COLORS) as [string, string][])
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
