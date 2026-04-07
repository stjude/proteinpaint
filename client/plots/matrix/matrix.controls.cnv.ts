import { dtsnvindel, dtcnv } from '#shared/common.js'

// CNV button for selecting the CNVs to display on the matrix
export function setCNVBtn(self: any) {
	self.opts.holder
		.append('button')
		.style('margin', '2px 0')
		.datum({
			label: 'CNV',
			updateBtn: (btn: any) => {
				const s = self.parent.config.settings.matrix
				const notRendered = s.allMatrixCNVHidden
				btn
					.style('text-decoration', notRendered ? 'line-through' : '')
					.style('text-decoration-thickness', notRendered ? '2px' : '')
			},
			rows: [
				{
					title: `Show CNV options`,
					type: 'radio',
					chartType: 'matrix',
					settingsKey: 'showMatrixCNV',
					options: [
						{ label: 'Show all CNV', value: 'all' },
						{ label: `Do not show CNV`, value: 'none' },
						{ label: `Show selected CNV`, value: 'bySelection' }
					],
					labelDisplay: 'block',
					getDisplayStyle(plot: any) {
						return plot.chartType == 'hierCluster' ? 'none' : 'table-row'
					},
					callback: self.parent.CNVControlCallback
				}
			],
			customInputs: generateCNVItems
		})
		.html((d: any) => d.label)
		.style('margin', '2px 0')
		.on('click', (event: any, d: any) => self.callback(event, d))
}

export function generateCNVItems(self: any, app: any, parent: any, table: any) {
	table.attr('class', null) // remove the hoverover background for CNV button
	const m = parent.config.settings.matrix
	const mutationLegendGrp = parent.legendData.find((l: any) => l.dt?.includes(dtsnvindel))
	if (
		m.showMatrixCNV !== 'none' &&
		(m.allMatrixMutationHidden ||
			!mutationLegendGrp ||
			mutationLegendGrp.crossedOut ||
			!mutationLegendGrp.items.find((i: any) => !i.greyedOut && !i.crossedOut))
	) {
		// when all mutation items in the current matrix are hidden or there is no mutation data
		table.select("input[type='radio'][value='none']").property('disabled', true)

		table.select("input[type='radio'][value='none'] + span").style('opacity', '0.5').on('mouseup', null)
	}
	if (m.addMutationCNVButtons && parent.chartType !== 'hierCluster' && m.showMatrixCNV == 'bySelection')
		parent.CNVControlCallback('bySelection')
}
