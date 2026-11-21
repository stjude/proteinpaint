import { table2col } from '#dom'
import { plotManhattan } from '#plots/manhattan/manhattan.ts'
import type { GRIN2ViewData } from '../GRIN2Types'
import { GRIN2TopGenesTable } from './GRIN2TopGenesTable'

// Styling constants used only by the results view
const sectionMargin = '20px 0'
const btnMargin = '10px'
const headerMargin = '0 10px 0 0'
const headerFontSize = 14

/** Renders Manhattan plot + top genes table + run stats from precomputed ViewData. */
export class GRIN2ResultsView {
	private holder: any
	private app: any
	/** Fetches the TSV text of the table of every gene for the displayed analysis; set by the controller */
	onDownloadAll?: () => Promise<string>

	constructor(holder: any, app: any) {
		this.holder = holder
		this.app = app
	}

	clear() {
		this.holder.selectAll('*').remove()
	}

	/** The second line of the download icon's menu: downloads the table of every gene of the analysis. The text comes
	 * from the server on click, so the browser never holds a table of every gene. Progress and errors show in status. */
	private downloadAllItem(status: any, totalGenes: string, fileName: string) {
		let busy = false
		return {
			text: `Download all ${totalGenes} genes in output (TSV)`,
			testId: 'sjpp-grin2-download-all-genes',
			callback: async () => {
				if (busy) return
				busy = true
				status.style('color', '#555').text('Preparing the table of all genes...')
				try {
					downloadTsv(fileName, await this.onDownloadAll!())
					status.text('')
				} catch (e: any) {
					status.style('color', '#c00').text(`Download failed: ${e?.message || e}`)
				}
				busy = false
			}
		}
	}

	render(viewData: GRIN2ViewData) {
		if (viewData.manhattan) {
			plotManhattan(this.holder, viewData.manhattan.plotData, viewData.manhattan.settings, this.app)
		}

		if (viewData.topGenes) {
			const { headerText, totalGenes, columns, rows, dataItems } = viewData.topGenes
			const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
			const tableContainer = this.holder.append('div').style('margin', sectionMargin)

			const headerDiv = tableContainer
				.append('div')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('margin', btnMargin)

			headerDiv.append('h3').style('margin', headerMargin).style('font-size', `${headerFontSize}px`).text(headerText)
			const status = headerDiv.append('span').style('font-size', '0.9em')

			new GRIN2TopGenesTable({
				holder: tableContainer.append('div'),
				app: this.app,
				columns,
				rows,
				dataItems,
				fileName: `grin2_top_genes_${stamp}.tsv`,
				downloadTitle: `Download top ${rows.length.toLocaleString()} genes (TSV)`,
				// a second line in the icon's menu for every gene, not only the top genes of the table
				moreDownloads: this.onDownloadAll
					? [this.downloadAllItem(status, totalGenes, `grin2_all_genes_${stamp}.tsv`)]
					: undefined
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

/** Downloads text as a TSV file. The leading BOM keeps Excel on Windows from decoding the file with the system
 * codepage, as in downloadTable() in dom/table.ts. */
function downloadTsv(fileName: string, text: string) {
	const url = URL.createObjectURL(new Blob(['\ufeff', text], { type: 'text/tab-separated-values;charset=utf-8' }))
	const a = document.createElement('a')
	a.href = url
	a.download = fileName
	document.body.appendChild(a)
	a.click()
	a.remove()
	URL.revokeObjectURL(url)
}
