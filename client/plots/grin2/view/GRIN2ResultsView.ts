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
				.style('flex-wrap', 'wrap')
				.style('margin', btnMargin)

			const headerH3 = headerDiv
				.append('h3')
				.style('margin', headerMargin)
				.style('font-size', `${headerFontSize}px`)
				.text(headerText)

			// Artifact-flag filter toggles. Each flag column produced by the Python
			// wrapper (Bidirectional Artifact, Blacklist/Segdup) gets a "Hide …"
			// checkbox; checking it drops rows flagged 'Yes' for that column. The
			// `columns` array (and each row) is prepended with the significance-circle
			// column, so colIndex here indexes into both directly.
			const flagLabels: Record<string, string> = {
				'Bidirectional Artifact': 'Hide bidirectional artifacts',
				'Blacklist/Segdup': 'Hide blacklist/segdup artifacts',
				'Gene Family': 'Hide gene-family artifacts'
			}
			const flagCols = Object.keys(flagLabels)
				.map(label => ({ label, colIndex: columns.findIndex(c => c.label === label) }))
				.filter(f => f.colIndex !== -1)
			const hidden = new Set<string>()
			// A cell counts as "flagged" when it is truthy and not the literal 'No'.
			// This covers both the Yes/No flag columns and the labeled Gene Family
			// column (where the value is a family acronym like 'OR' / 'HLA').
			const isFlagged = (v: any) => v && v !== 'No'

			const tableDiv = tableContainer.append('div')
			const renderGenes = () => {
				const keep = rows
					.map((_, i) => i)
					.filter(i => !flagCols.some(f => hidden.has(f.label) && isFlagged(rows[i][f.colIndex]?.value)))
				const fRows = keep.map(i => rows[i])
				const fData = keep.map(i => dataItems[i])
				headerH3.text(hidden.size ? `${headerText} — ${fRows.length} shown after filter` : headerText)
				tableDiv.selectAll('*').remove()
				showResultsTable({
					tableDiv: tableDiv.append('div'),
					app: this.app,
					columns,
					rows: fRows,
					dataItems: fData,
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

			if (flagCols.length) {
				const filterDiv = headerDiv
					.append('div')
					.style('display', 'inline-flex')
					.style('align-items', 'center')
					.style('gap', '12px')
					.style('margin-left', '12px')
				for (const f of flagCols) {
					const lbl = filterDiv
						.append('label')
						.style('display', 'inline-flex')
						.style('align-items', 'center')
						.style('font-size', '12px')
						.style('cursor', 'pointer')
					lbl
						.append('input')
						.attr('type', 'checkbox')
						.attr('data-testid', `sjpp-grin2-hide-${f.colIndex}`)
						.style('margin-right', '4px')
						.on('change', function (this: HTMLInputElement) {
							if (this.checked) hidden.add(f.label)
							else hidden.delete(f.label)
							renderGenes()
						})
					lbl.append('span').text(flagLabels[f.label])
				}
			}

			renderGenes()
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
