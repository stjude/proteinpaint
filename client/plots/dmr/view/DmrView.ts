import { table2col, renderTable } from '#dom'
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

		const gpTk = blockInstance.tklst.find((t: any) => t.name === 'GP Model')
		if (gpTk && viewData.trackImg) {
			gpTk.imgData = viewData.trackImg
			blockInstance.tk_load(gpTk)
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

	renderDiagnostics(diagnostic: DmrDiagnostic, dmrs: { start: number; stop: number; direction: string }[]) {
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

		const namedDomains = diagnostic.domains.filter(d => d.type !== 'Intergenic')
		if (namedDomains.length) {
			statsContent
				.append('div')
				.attr('style', 'font-size:12px;font-weight:bold;margin-top:8px;color:#555')
				.text('Domain GP Parameters')
			renderTable({
				div: statsContent,
				header: { allowSort: true },
				columns: [
					{
						label: 'Domain',
						sortable: true,
						tooltip:
							'Regulatory annotation name in the format Type_chr_start (e.g. CGI_chr14_100824186). Intergenic segments are filled in automatically for regions not covered by any known annotation.'
					},
					{
						label: 'Type',
						sortable: true,
						tooltip:
							'Annotation type derived from the name prefix: CGI (CpG island), Shore (\u00b12kb flanking a CGI per Irizarry et al. 2009), Promoter, Enhancer, CTCF, or Intergenic. Each type uses its own dataset-derived priors.'
					},
					{
						label: 'Prior Mean',
						sortable: true,
						tooltip:
							'Dataset-derived mean beta value for this annotation type, computed across up to 50,000 probes of this type in the dataset.'
					},
					{
						label: 'Adaptive LS (bp)',
						sortable: true,
						tooltip:
							'Dataset-derived length-scale initialisation for this domain. The GP optimizer uses this as its starting point, bounded by the empirical p10\u2013p90 range. Reflects how spatially smooth methylation tends to be across this annotation type in this dataset.'
					},
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
