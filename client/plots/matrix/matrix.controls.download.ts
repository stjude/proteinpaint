import { to_svg } from '#src/client'
import { Menu } from '#dom'
import { mclass, dt2label, dtsnvindel, dtcnv, dtfusionrna, dtsv } from '#shared/common.js'
import { TermTypes } from '#shared/terms.js'
import type { MatrixControls } from './matrix.controls'

export function setDownloadBtn(self: MatrixControls) {
	self.opts.holder
		.append('button')
		.style('margin', '2px 0')
		//.property('disabled', d => d.disabled)
		.text('Download')
		.on('focus', () => self.parent.app.tip.hide())
		.on('click.sjpp-matrix-download', (event: any) => {
			const p = self.parent
			if (!p.dom.downloadMenu) p.dom.downloadMenu = new Menu({ padding: '' })
			const downloadMenu = p.dom.downloadMenu.clear()
			const div = downloadMenu.d.append('div')
			div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(`SVG image`)
				.on('click.sjpp-matrix-download', () => {
					to_svg(self.opts.getSvg(), 'matrix', { apply_dom_styles: true })
					p.dom.downloadMenu.destroy()
				})

			div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(`TSV data`)
				.on('click.sjpp-matrix-download', () => {
					const lst = p.data.lst
					const allTerms = p.termOrder.map((t: any) => t.tw)
					const assayAvailability = p.state.termdbConfig.assayAvailability
					const controlLabels = p.settings.matrix.controlLabels
					if (p.config.divideBy?.id && !allTerms.find((a: any) => a.id == p.config.divideBy.id)) {
						// when divideBy term is not in the matrix terms
						allTerms.push(p.config.divideBy)
					}

					const activeSamples: any[] = []
					for (const d of lst) {
						for (const tw of allTerms) {
							if (tw.$id in d) {
								activeSamples.push(d)
								break
							}
						}
					}

					const header = [controlLabels.Sample]
					for (const tw of allTerms) header.push(tw.term.name)

					const rows = [header]
					for (const sample of activeSamples) {
						const row = [sample._ref_.label]
						for (const tw of allTerms) {
							if (!sample[tw.$id]) {
								row.push('')
							} else {
								if (tw.term.type == 'geneVariant') {
									const allVariant: string[] = []
									for (const v of sample[tw.$id].renderedValues) {
										// when assayAvailability presents, has WT and Blank
										const hasAssayAvailability = assayAvailability?.byDt?.[parseInt(v.dt)]
										if (v.dt == dtsnvindel) {
											allVariant.push(
												(v.origin ? `${v.origin} ` : '') +
													(hasAssayAvailability ? `${dt2label[v.dt]}:` : '') +
													`${mclass[v.class]?.label}` +
													(v.mname ? `,${v.mname}` : '')
											)
										} else if (v.dt == dtcnv) {
											const cnvValue = v.value
												? `${hasAssayAvailability ? '' : 'CNV:'}${v.value}` //show v.value for numerical CNV, otherwise show CNV gain/loss
												: v.class == 'CNV_amp'
												? 'CNV gain'
												: v.class == 'CNV_loss'
												? 'CNV loss'
												: v.class == 'CNV_homozygous_deletion'
												? 'CNV homozygous deletion'
												: v.class == 'CNV_amplification'
												? 'CNV amplification'
												: v.class == 'CNV_loh'
												? 'CNV loss of heterozygosity'
												: mclass[v.class]?.label

											allVariant.push(
												(v.origin ? `${v.origin} ` : '') + (hasAssayAvailability ? `${dt2label[v.dt]}:` : '') + cnvValue
											)
										} else if (v.dt == dtfusionrna || v.dt == dtsv) {
											allVariant.push(
												(v.origin ? `${v.origin} ` : '') +
													(hasAssayAvailability ? `${dt2label[v.dt]}:` : '') +
													`${mclass[v.class]?.label}` +
													(v.gene && v.mname ? `(${v.gene}::${v.mname})` : '')
											)
										} else {
											allVariant.push(`DO NOT SUPPORT dt='${v.dt}'`)
										}
									}
									row.push(allVariant.join('|'))
								} else if (
									tw.term.type == TermTypes.GENE_EXPRESSION ||
									tw.term.type == TermTypes.METABOLITE_INTENSITY ||
									tw.term.type == TermTypes.PROTEOME_ABUNDANCE
								) {
									row.push(sample[tw.$id]?.renderedValues?.[0]?.value || '')
								} else {
									row.push(sample[tw.$id]?.renderedValues?.[0] || sample[tw.$id]?.value || '')
								}
							}
						}
						rows.push(row)
					}

					const matrix = rows.map((row: any[]) => row.join('\t')).join('\n')
					const a = document.createElement('a')
					document.body.appendChild(a)
					a.addEventListener(
						'click',
						function () {
							const currentDate = new Date().toISOString().split('T')[0]
							a.download = p.config.settings?.hierCluster?.termGroupName?.startsWith('Gene Expression')
								? `GeneExpression.${currentDate}.tsv`
								: p.chartType == 'hierCluster'
								? `HierCluster.${currentDate}.tsv`
								: `${p.app.vocabApi.termdbConfig.matrix?.appName || 'Matrix'}.${currentDate}.tsv`
							a.href = URL.createObjectURL(new Blob([matrix], { type: 'text/tab-separated-values' }))
							document.body.removeChild(a)
						},
						false
					)
					a.click()
					p.dom.downloadMenu.destroy()
				})
			downloadMenu.showunder(event.target)
		})
}
