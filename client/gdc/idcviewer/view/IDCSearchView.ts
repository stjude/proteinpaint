import { type Selection } from 'd3-selection'
import type { IDCViewerOpts, Pagination } from '../IDCTypes'
import type { IDCViewer } from '../IDCViewer'
import { sayerror } from '#dom/sayerror'
import { addSvg, makeCenteredFlex, makeTransparentButton } from '../utils'
// https://icons.getbootstrap.com/icons/search/
const magnifyingGlassPath = [
	'M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0'
]
const cancelXPath = [
	'M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708'
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
		titleDiv
			.append('span')
			.style('font-size', '6px')
			.text(`Release: ${dataVersion || 'current'}`)
		const searchDiv = this.holder
			.append('div')
			.attr('class', 'idcviewer-search-input-holder')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('flex-wrap', 'wrap')
			.style('flex-direction', 'row')
			.style('gap', '10px')

		// caseCountDiv
		actualCaseTotal = actualCaseTotal === undefined ? pagination.total : actualCaseTotal
		searchDiv
			.append('div')
			.attr('class', 'idcviewer-search-case-count')
			.style('font-size', '18px')
			.style('font-family', 'Noto Sans, sans-serif')
			.html(`Total Cohort Cases:&nbsp;<b>${actualCaseTotal}</b>&nbsp(<b>${pagination.total}</b>&nbsp w/ Studies)`)
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('padding', '5px 10px')
		const inputDiv = searchDiv
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('justify-content', 'right')
			.style('min-height', '30px')
			.style('min-width', '300px')

		//Search Button
		makeCenteredFlex(addSvg(inputDiv.append('button'), magnifyingGlassPath))
			.attr('class', 'idcviewer-search-button')
			.style('height', '100%')
			.style('aspect-ratio', '1 / 1')
			.on('click', search)
			.style('cursor', 'pointer')

		// Div containing search bar and clear button
		const searchBar = inputDiv
			.append('div')
			.style('border', '1px solid #ccc')
			.style('border-radius', '4px')
			.style('display', 'flex')
			.style('flex-direction', 'row')
			.style('align-items', 'center')
			.style('padding', '0 5px')

		// SearchInput
		searchBar
			.append('input')
			.style('border-radius', '4px')
			.style('min-width', '200px')
			.style('height', '100%')
			.attr('type', 'text')
			.style('border', 'none')
			.style('background-color', 'transparent')
			.attr('placeholder', 'Press Enter to Search')
			.property('value', this.args.searchFilter || '')
			.attr('class', 'idcviewer-search-input')
			.on('keypress', event => {
				if (event.key === 'Enter') {
					search()
				}
			})
		// ClearSearchBar Button
		makeCenteredFlex(
			addSvg(makeTransparentButton(searchBar.append('button')), cancelXPath).on('click', () => {
				;(searchBar.select('input').node() as HTMLInputElement).value = ''
				search()
			})
		)
	}
}
