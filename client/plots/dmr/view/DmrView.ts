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
		for (const tk of blockInstance.tklst) {
			const updated = viewData.tklst.find((t: any) => t.name === tk.name)
			if (!updated) continue
			if (tk.type === 'bedj' && updated.bedItems) {
				tk.bedItems = updated.bedItems
				blockInstance.tk_load(tk)
			} else if (tk.type === 'bigwig' && updated.imgData) {
				tk.imgData = updated.imgData
				blockInstance.tk_load(tk)
			}
		}
	}

	updateLegend(blockInstance: any, legendRows: LegendRow[]) {
		if (!blockInstance?.legend?.holder) return
		const labels = ['Per-CpG Means', 'DMR', 'Sig. CpGs', 'cCRE']
		blockInstance.legend.holder
			.selectAll('tr')
			.filter((_d: any, i: number, nodes: any) => {
				const td = nodes[i].querySelector('td')
				return td && labels.includes(td.textContent)
			})
			.remove()
		this.renderLegend(blockInstance, legendRows)
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
		dmrs: { start: number; stop: number; direction: string }[],
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
		const sigFdrCount = probes.fdr.filter(f => f < fdr_cutoff).length
		const minDeltaBeta = 0.05
		const sigDualCount = probes.fdr.filter((f, i) => {
			if (f >= fdr_cutoff) return false
			const delta = probes.mean_group2[i] - probes.mean_group1[i]
			return Math.abs(delta) >= minDeltaBeta
		}).length

		const t = table2col({ holder: statsContent, disableScroll: true })
		for (const [k, v] of [
			['Probes in region', String(probes.positions.length)],
			['FDR significant', `${sigFdrCount} (FDR < ${fdr_cutoff})`],
			['FDR + effect size', `${sigDualCount} (FDR < ${fdr_cutoff} & |\u0394\u03B2| \u2265 ${minDeltaBeta})`],
			['Probe density', `${density.toFixed(1)} probes/kb`],
			['Median spacing', `${medianSpacing.toFixed(0)} bp`],
			['Max gap', `${maxGap.toFixed(0)} bp`],
			['Gaps > 1kb', String(gapsOver1kb)],
			['DMRs called', String(dmrs.length)]
		] as [string, string][]) {
			t.addRow(k, v)
		}
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
