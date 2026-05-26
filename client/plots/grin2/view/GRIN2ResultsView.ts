import { table2col, showResultsTable } from '#dom'
import { plotManhattan } from '#plots/manhattan/manhattan.ts'
import type { GRIN2ViewData } from '../GRIN2Types'

// Styling constants used only by the results view
const sectionMargin = '20px 0'
const btnMargin = '10px'
const headerMargin = '0 10px 0 0'
const headerFontSize = 14
const statsTableFontWeight = 'bold'
const backgroundColor = '#f8f8f8'

/** Renders Manhattan plot + top genes table + run stats from precomputed ViewData. */
export class GRIN2ResultsView {
	private holder: any
	private app: any

	constructor(holder: any, app: any) {
		this.holder = holder
		this.app = app
	}

	clear() {
		this.holder.selectAll('*').remove()
	}

	render(viewData: GRIN2ViewData) {
		if (viewData.manhattan) {
			plotManhattan(this.holder, viewData.manhattan.plotData, viewData.manhattan.settings, this.app)
		}

		if (viewData.topGenes) {
			const { headerText, columns, rows, dataItems } = viewData.topGenes
			const tableContainer = this.holder.append('div').style('margin', sectionMargin)

			const headerDiv = tableContainer
				.append('div')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('margin', btnMargin)

			headerDiv.append('h3').style('margin', headerMargin).style('font-size', `${headerFontSize}px`).text(headerText)

			showResultsTable({
				tableDiv: tableContainer.append('div'),
				app: this.app,
				columns,
				rows,
				dataItems,
				getRowKey: (row: any) => row[0]?.value,
				matrixButtonFormat: 'Matrix ({n} genes selected)',
				maxHeight: '400px',
				maxWidth: '100%',
				dataTestId: 'sjpp-grin2-top-genes-table',
				resize: 'both',
				selectAll: false,
				allowRestoreRowOrder: true,
				restoreButtonInFooter: true,
				download: {
					fileName: `grin2_top_genes_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.tsv`
				},
				header: {
					allowSort: true,
					style: {
						'font-weight': statsTableFontWeight,
						'background-color': backgroundColor
					}
				}
			})
		}

		if (viewData.statsSections.length > 0) {
			const tablesContainer = this.holder.append('div').style('margin-top', '50px')
			for (const section of viewData.statsSections) {
				tablesContainer
					.append('h4')
					.style('margin', headerMargin)
					.style('margin-top', '15px')
					.style('font-size', `${headerFontSize - 2}px`)
					.text(section.name)

				const table = table2col({ holder: tablesContainer.append('div'), margin: '2px 8px' })
				for (const [k, v] of section.rows) {
					table.addRow(k, v)
				}
			}
		}
	}
}
