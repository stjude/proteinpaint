import { dtcnv } from '#shared/common.js'
import type { MatrixControls } from './matrix.controls'

// Mutation button for selecting mutations to display on the matrix
export function setMutationBtn(self: MatrixControls) {
	self.opts.holder
		.append('button')
		.style('margin', '2px 0')
		.datum({
			label: 'Mutation',
			updateBtn: (btn: any) => {
				const s = self.parent.config.settings.matrix
				btn
					.style('text-decoration', s.allMatrixMutationHidden ? 'line-through' : '')
					.style('text-decoration-thickness', s.allMatrixMutationHidden ? '2px' : '')
			},
			rows: [
				{
					title: `Show mutation options`,
					type: 'radio',
					chartType: 'matrix',
					settingsKey: 'showMatrixMutation',
					options: [
						{ label: 'Show all mutations', value: 'all' },
						{ label: `Show only truncating mutations`, value: 'onlyTruncating' },
						{ label: `Show only protein-changing mutations`, value: 'onlyPC' },
						{ label: `Do not show mutations`, value: 'none' },
						{ label: `Show selected mutation`, value: 'bySelection' }
					],
					labelDisplay: 'block',
					getDisplayStyle(plot: any) {
						return plot.chartType == 'hierCluster' ? 'none' : 'table-row'
					},
					callback: self.parent.mutationControlCallback
				}
			],
			customInputs: generateMutationItems
		})
		.html((d: any) => d.label)
		.style('margin', '2px 0')
		.on('click', (event: any, d: any) => self.callback(event, d))
}

export function generateMutationItems(self: MatrixControls, app: any, parent: any, table: any) {
	table.attr('class', null) // remove the hoverover background for CNV button
	const m = parent.config.settings.matrix
	const cnvLegendGrp = parent.legendData.find((l: any) => l.dt?.includes(dtcnv))
	if (
		m.showMatrixMutation !== 'none' &&
		(m.allMatrixCNVHidden ||
			!cnvLegendGrp ||
			cnvLegendGrp.crossedOut ||
			!cnvLegendGrp.items.find((i: any) => !i.greyedOut && !i.crossedOut))
	) {
		// when all CNV items in the current matrix are hidden or there is no CNV data
		table.select("input[type='radio'][value='none']").property('disabled', true)

		table.select("input[type='radio'][value='none'] + span").style('opacity', '0.5').on('mouseup', null)
	}
	if (m.addMutationCNVButtons && parent.chartType !== 'hierCluster' && m.showMatrixMutation == 'bySelection')
		parent.mutationControlCallback('bySelection')
}
