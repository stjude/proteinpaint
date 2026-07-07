import { type Selection } from 'd3-selection'
import type { IDCViewerOpts, Pagination } from '../IDCTypes'
import type { IDCViewer } from '../IDCViewer'
import { sayerror } from '#dom/sayerror'
import { applyStyles, idcSearchStyles } from '../styling'
import { addSvg } from '../utils'
// https://icons.getbootstrap.com/icons/search/
const magnifyingGlassPath = [
	'M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0'
]
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
	render(pagination: Pagination, actualCaseTotal: number | undefined = undefined): void {
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
		titleDiv.append('span').text('IDC Image Viewer')
		const searchDiv = applyStyles(
			this.holder.append('div').attr('class', 'idcviewer-search-input-holder'),
			idcSearchStyles.searchInputHolder
		)

		// caseCountDiv
		actualCaseTotal = pagination.total !== undefined ? pagination.total : actualCaseTotal
		applyStyles(searchDiv.append('div').attr('class', 'idcviewer-search-case-count'), idcSearchStyles.caseCount).html(
			`<b>${actualCaseTotal}</b>&nbsp;Cases w/ IDC images`
		)
		const inputDiv = applyStyles(searchDiv.append('div'), idcSearchStyles.inputDiv)
		addSvg(inputDiv, magnifyingGlassPath)
		const searchTooltip = applyStyles(inputDiv.append('div'), idcSearchStyles.searchTooltip)
			.attr('class', 'idcviewer-search-tooltip')
			.attr('role', 'tooltip')
			.text('Press Enter to Search.')
		// SearchInput
		applyStyles(inputDiv.append('input').attr('type', 'search'), idcSearchStyles.searchInput)
			.attr('placeholder', 'e.g. C3L,TCGA,01BR001')
			.attr('aria-label', 'IDC case search')
			.property('value', this.args.searchFilter || '')
			.attr('class', 'idcviewer-search-input')
			.on('focus', () => {
				searchTooltip.style('display', 'flex')
			})
			.on('blur', () => {
				searchTooltip.style('display', 'none')
			})
			.on('keydown', event => {
				if (event.key === 'Enter') {
					search()
				}
			})
			.on('input', event => {
				const value = (event.currentTarget as HTMLInputElement).value
				if (value === '') {
					search() // user clicked clear x (or manually deleted everything)
				}
			})
	}
}
