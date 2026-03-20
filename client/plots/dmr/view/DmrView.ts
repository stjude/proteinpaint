import { table2col } from '#dom'
import type { DmrDiagnostic } from '#types'
import type { DmrDom, LegendRow, DmrViewData } from '../DmrTypes.ts'

export class DmrView {
	private dom: DmrDom

	constructor(dom: DmrDom) {
		this.dom = dom
	}

	async renderBlock(
		viewData: DmrViewData,
		genomeObj: any,
		settings: { blockWidth: number },
		chr: string,
		start: number,
		stop: number,
		onCoordinateChange: (rglst: { chr: string; start: number; stop: number }[]) => void
	) {
		const { Block } = await import('#src/block')
		return new Block({
			holder: this.dom.holder,
			genome: genomeObj,
			chr,
			start,
			stop,
			tklst: viewData.tklst,
			nobox: true,
			width: settings.blockWidth,
			onCoordinateChange
		})
	}

	updateTracks(viewData: DmrViewData, blockInstance: any) {
		const dmrTk = blockInstance.tklst.find((t: any) => t.name === 'DMRs')
		if (dmrTk) {
			dmrTk.bedItems = viewData.dmrBedItems
			blockInstance.tk_load(dmrTk)
		}

		const ccreTk = blockInstance.tklst.find((t: any) => t.name === 'cCREs')
		if (ccreTk) {
			ccreTk.bedItems = viewData.annotationBedItems
			blockInstance.tk_load(ccreTk)
		}
	}

	renderLegend(blockInstance: any, legendRows: LegendRow[]) {
		if (!blockInstance?.legend?.holder) return
		const { legendcolor, vpad } = blockInstance.legend

		for (const row of legendRows) {
			const tr = blockInstance.legend.holder.append('tr')
			tr.append('td')
				.text(row.label)
				.attr('style', `padding-right:10px;text-align:right;color:#555;border-right:solid 1px ${legendcolor}`)
			const td = tr.append('td')
			for (const [text, color] of row.items) {
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
	}

	renderDiagnostics(
		diagnostic: DmrDiagnostic,
		dmrs: { start: number; stop: number; direction: string; min_smoothed_fdr: number }[],
		colors: { group1: string; group2: string; hyper: string; hypo: string },
		fdr_cutoff: number
	) {
		const panel = this.dom.diagnosticPanel
		panel.selectAll('*').remove()
		panel.style('display', 'block')

		const { probes } = diagnostic

		const toggle = panel.append('div').attr('style', 'cursor:pointer;font-size:12px;color:#888;padding:2px 0')
		const statsContent = panel.append('div').style('display', 'none')
		let expanded = false
		toggle.text('+ Diagnostic details').on('click', () => {
			expanded = !expanded
			toggle.text((expanded ? '\u2212 ' : '+ ') + 'Diagnostic details')
			statsContent.style('display', expanded ? 'block' : 'none')
		})

		const spacings = diagnostic.probe_spacings
		const medianSpacing = spacings.length ? spacings.slice().sort((a, b) => a - b)[Math.floor(spacings.length / 2)] : 0
		const maxGap = spacings.length ? Math.max(...spacings) : 0
		const gapsOver1kb = spacings.filter(s => s > 1000).length
		const density =
			probes.positions.length > 1
				? probes.positions.length / ((probes.positions[probes.positions.length - 1] - probes.positions[0]) / 1000)
				: 0
		const sigCount = probes.fdr.filter(f => f < fdr_cutoff).length

		const t = table2col({ holder: statsContent, disableScroll: true })
		for (const [k, v] of [
			['Probes in region', String(probes.positions.length)],
			['Significant probes', `${sigCount} (FDR < ${fdr_cutoff})`],
			['Probe density', `${density.toFixed(1)} probes/kb`],
			['Median spacing', `${medianSpacing.toFixed(0)} bp`],
			['Max gap', `${maxGap.toFixed(0)} bp`],
			['Gaps > 1kb', String(gapsOver1kb)],
			['DMRs called', String(dmrs.length)]
		] as [string, string][]) {
			t.addRow(k, v)
		}

		// Per-CpG means scatter plot
		if (probes.positions.length > 0) {
			this.renderScatterPlot(statsContent, probes, dmrs, colors, fdr_cutoff)
		}
	}

	private renderScatterPlot(
		holder: any,
		probes: DmrDiagnostic['probes'],
		dmrs: { start: number; stop: number; direction: string }[],
		colors: { group1: string; group2: string; hyper: string; hypo: string },
		fdr_cutoff: number
	) {
		const width = 700
		const height = 250
		const margin = { top: 20, right: 20, bottom: 40, left: 50 }
		const plotW = width - margin.left - margin.right
		const plotH = height - margin.top - margin.bottom

		const svg = holder.append('svg').attr('width', width).attr('height', height).style('margin-top', '10px')

		const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

		// Scales
		const xMin = probes.positions[0]
		const xMax = probes.positions[probes.positions.length - 1]
		const xRange = xMax - xMin || 1
		const scaleX = (val: number) => ((val - xMin) / xRange) * plotW
		const scaleY = (val: number) => plotH - val * plotH

		// Draw DMR regions as shaded rectangles
		for (const dmr of dmrs) {
			const x1 = Math.max(0, scaleX(dmr.start))
			const x2 = Math.min(plotW, scaleX(dmr.stop))
			const color = dmr.direction === 'hyper' ? colors.hyper : colors.hypo
			g.append('rect')
				.attr('x', x1)
				.attr('y', 0)
				.attr('width', Math.max(1, x2 - x1))
				.attr('height', plotH)
				.attr('fill', color)
				.attr('opacity', 0.1)
		}

		// Draw dots: group1 (control) and group2 (case)
		for (let i = 0; i < probes.positions.length; i++) {
			const x = scaleX(probes.positions[i])
			const isSig = probes.fdr[i] < fdr_cutoff
			const opacity = isSig ? 0.8 : 0.25

			g.append('circle')
				.attr('cx', x)
				.attr('cy', scaleY(probes.mean_group1[i]))
				.attr('r', 3)
				.attr('fill', colors.group1)
				.attr('opacity', opacity)

			g.append('circle')
				.attr('cx', x)
				.attr('cy', scaleY(probes.mean_group2[i]))
				.attr('r', 3)
				.attr('fill', colors.group2)
				.attr('opacity', opacity)
		}

		// Y-axis
		g.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', plotH).attr('stroke', '#ccc')
		for (const tick of [0, 0.25, 0.5, 0.75, 1]) {
			const y = scaleY(tick)
			g.append('line').attr('x1', -4).attr('y1', y).attr('x2', 0).attr('y2', y).attr('stroke', '#999')
			g.append('text')
				.attr('x', -8)
				.attr('y', y)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'middle')
				.attr('font-size', '10px')
				.attr('fill', '#666')
				.text(tick.toFixed(2))
		}
		g.append('text')
			.attr('transform', `translate(-35,${plotH / 2}) rotate(-90)`)
			.attr('text-anchor', 'middle')
			.attr('font-size', '11px')
			.attr('fill', '#555')
			.text('Mean Beta')

		// X-axis
		g.append('line').attr('x1', 0).attr('y1', plotH).attr('x2', plotW).attr('y2', plotH).attr('stroke', '#ccc')
		const xTicks = 5
		for (let i = 0; i <= xTicks; i++) {
			const val = xMin + (xRange * i) / xTicks
			const x = scaleX(val)
			g.append('line')
				.attr('x1', x)
				.attr('y1', plotH)
				.attr('x2', x)
				.attr('y2', plotH + 4)
				.attr('stroke', '#999')
			g.append('text')
				.attr('x', x)
				.attr('y', plotH + 16)
				.attr('text-anchor', 'middle')
				.attr('font-size', '10px')
				.attr('fill', '#666')
				.text(Math.round(val).toLocaleString())
		}
		g.append('text')
			.attr('x', plotW / 2)
			.attr('y', plotH + 32)
			.attr('text-anchor', 'middle')
			.attr('font-size', '11px')
			.attr('fill', '#555')
			.text('Genomic Position')
	}

	showOverlay() {
		this.dom.loadingOverlay.style('display', '')
	}

	hideOverlay() {
		this.dom.loadingOverlay.style('display', 'none')
	}

	clearDiagnostics() {
		this.dom.diagnosticPanel.selectAll('*').remove()
		this.dom.diagnosticPanel.style('display', 'none')
	}

	clearErrors() {
		this.dom.error.selectAll('*').remove()
	}
}
