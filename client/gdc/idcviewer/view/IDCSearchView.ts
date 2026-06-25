import { type Selection } from 'd3-selection'
import type { IDCViewerOpts, Pagination } from '../IDCTypes'
import type { IDCViewer } from '../IDCViewer'
import { sayerror } from '#dom/sayerror'
import { addSvg } from './IDCTableView'
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
	render(pagination: Pagination): void {
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
		this.holder.append('div').attr('class', 'idcviewer-search-title').text('IDC Image Viewer')
		const searchDiv = this.holder
			.append('div')
			.attr('class', 'idcviewer-search-input-holder')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('flex-wrap', 'wrap')
			.style('flex-direction', 'row')
			.style('gap', '10px')
		// caseCountDiv
		searchDiv
			.append('div')
			.attr('class', 'idcviewer-search-case-count')
			.style('font-size', '18px')
			.style('font-family', 'Noto Sans, sans-serif')
			.html(`Total Cases:&nbsp;<b>${pagination.total}<b/>`)
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
		addSvg(inputDiv.append('button'), magnifyingGlassPath)
			.attr('class', 'idcviewer-search-button')
			.style('height', '100%')
			.style('aspect-ratio', '1 / 1')
			.on('click', search)
			.style('cursor', 'pointer')

		inputDiv
			.append('input')
			.style('border-radius', '4px')
			.style('min-width', '200px')
			.style('height', '100%')
			.attr('type', 'text')
			.attr('placeholder', 'Search')
			.attr('class', 'idcviewer-search-input')
			.on('keypress', search)
	}
}
