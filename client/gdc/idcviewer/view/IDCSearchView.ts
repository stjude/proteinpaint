import { type Selection } from 'd3-selection'
import type { IDCViewerOpts, Pagination } from '../IDCTypes'
import type { IDCViewer } from '../IDCViewer'
import { sayerror } from '#dom/sayerror'
import { applyStyles, idcSearchStyles } from '../styling'

export class IDCSearchView {
	private holder: Selection<HTMLDivElement, unknown, any, any>
	private viewer: IDCViewer
	private args: IDCViewerOpts

	constructor(holder: Selection<HTMLDivElement, unknown, any, any>, viewer: IDCViewer, args: IDCViewerOpts) {
		this.holder = holder
		this.viewer = viewer
		this.args = args
	}
	setArgs(args: IDCViewerOpts): void {
		this.args = args
	}
	render(
		pagination: Pagination,
		actualCaseTotal: number | undefined = undefined,
		dataVersion: string | undefined = undefined
	): void {
		this.holder.selectAll('*').remove()
		const search = () => {
			const searchValue = (inputDiv.select('input').node() as HTMLInputElement).value.trim()
			this.args.searchFilter = searchValue
			this.args.action = 'search'
			this.viewer.main(this.args).catch(e => {
				sayerror(this.viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
			})
		}
		// titleDiv
		const titleDiv = this.holder.append('div').attr('class', 'idcviewer-search-title')
		titleDiv.append('span').text('IDC Viewer ')
		applyStyles(titleDiv.append('span'), idcSearchStyles.releaseText).text(`Release: ${dataVersion || 'current'}`)
		const searchDiv = applyStyles(
			this.holder.append('div').attr('class', 'idcviewer-search-input-holder'),
			idcSearchStyles.searchInputHolder
		)

		// caseCountDiv
		actualCaseTotal = actualCaseTotal === undefined ? pagination.total : actualCaseTotal
		applyStyles(searchDiv.append('div').attr('class', 'idcviewer-search-case-count'), idcSearchStyles.caseCount).html(
			`TOTAL OF&nbsp;<b>${actualCaseTotal}</b>&nbsp;CASES`
		)
		const inputDiv = applyStyles(searchDiv.append('div'), idcSearchStyles.inputDiv)

		// SearchInput
		applyStyles(inputDiv.append('input').attr('type', 'search'), idcSearchStyles.searchInput)
			.attr('placeholder', 'Press Enter to Search')
			.property('value', this.args.searchFilter || '')
			.attr('class', 'idcviewer-search-input')
			.on('keydown', event => {
				if (event.key === 'Enter') {
					search()
				}
			})
	}
}
