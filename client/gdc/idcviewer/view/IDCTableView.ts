import { type BaseType, type Selection } from 'd3-selection'
import type { IDCViewerOpts, IDCViewerRow, Pagination } from '../IDCTypes'
import type { IDCViewer } from '../IDCViewer'
import { sayerror } from '#dom/sayerror'

const borderColor = '#4c4c4c'
const mainHeaderBgColor = '#f5f5f5'
const mainHeaderHoverBgColor = '#e6e6e6'
const detailsHeaderBgColor = '#e0e0e0'
// only make this an odd number greater than 1
const numPagesToShow = 7
// https://primer.style/octicons/icon/
const externalLinkPath = [
	'M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z'
]
// https://icons.getbootstrap.com/icons/
const leftChevronPath = [
	'M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0'
]
const rightChevronPath = [
	'M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708'
]
const doubleLeftChevronPath = [
	'M8.354 1.646a.5.5 0 0 1 0 .708L2.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0',
	'M12.354 1.646a.5.5 0 0 1 0 .708L6.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0'
]
const doubleRightChevronPath = [
	'M3.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L9.293 8 3.646 2.354a.5.5 0 0 1 0-.708',
	'M7.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L13.293 8 7.646 2.354a.5.5 0 0 1 0-.708'
]

function makeTransparentButton(
	button: Selection<HTMLButtonElement, unknown, any, any>
): Selection<HTMLButtonElement, unknown, any, any> {
	return button
		.style('cursor', 'pointer')
		.style('background', 'transparent')
		.style('border', 'none')
		.style('padding', '0')
		.style('margin', '0')
		.style('appearance', 'none')
}

export function addSvg<GElement extends BaseType, Datum, PElement extends BaseType, PDatum>(
	selection: Selection<GElement, Datum, PElement, PDatum>,
	paths: string[]
): Selection<GElement, Datum, PElement, PDatum> {
	const svg = selection
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('justify-content', 'center')
		.append('svg')
		.attr('xmlns', 'http://www.w3.org/2000/svg')
		.attr('viewBox', '0 0 16 16')
		.attr('width', '16')
		.attr('height', '16')
	paths.forEach(path => {
		svg.append('path').attr('d', path).attr('fill', 'currentColor')
	})
	return selection
}
/** Renders the IDC studies table with expandable row`s and page-size control. */
export class IDCTableView {
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

	clear() {
		this.holder.select('#idc-table').selectAll('*').remove()
		this.holder.selectAll('.idcviewer-pagination').remove()
	}

	render(tableData: ReadonlyArray<IDCViewerRow>, pagination: Pagination): void {
		this.clear()
		if (tableData.length === 0) {
			sayerror(this.viewer.dom.errorDiv, 'No data available for the current filter.')
			return
		}
		let table: Selection<HTMLTableElement, unknown, any, any> = this.holder.select('#idc-table')
		if (table.empty()) {
			table = this.holder
				.style('font-family', 'Noto Sans, sans-serif')
				.append('table')
				.attr('id', 'idc-table')
				.style('width', '100%')
				.style('border-collapse', 'collapse')
				.style('font-size', '14px')
				.style('border', `1px solid ${borderColor}`)
		}
		const headers = ['GDC Case ID', 'Program', 'Project', 'IDC Studies (Click to expand)']
		const expandableHeaders = [
			'IDC Study Instance UID',
			'Collection',
			'Study Date',
			'Study Description',
			'IDC Histopathology Viewer',
			'IDC Radiology Viewer'
		]

		const thead = table.append('thead')
		const headerRow = thead
			.append('tr')
			.style('background-color', mainHeaderBgColor)
			.style('border-bottom', `2px solid ${borderColor}`)
			.style('height', '3rem')

		headers.forEach(header => {
			const th = headerRow
				.append('th')
				.style('text-align', 'left')
				.style('padding', '10px')
				.style('background-color', mainHeaderBgColor)
				.on('mouseenter', function () {
					;(this as HTMLTableCellElement).style.backgroundColor = mainHeaderHoverBgColor
				})
				.on('mouseleave', function () {
					;(this as HTMLTableCellElement).style.backgroundColor = mainHeaderBgColor
				})
			makeTransparentButton(th.append('button'))
				.style('font-family', 'Montserrat, sans-serif')
				.style('font-weight', '600')
				.text(header)
		})

		const tbody = table.append('tbody')
		const dataToRender = tableData.slice(0, this.args.pageSize)
		const renderRows = () => {
			tbody.selectAll('*').remove()
			dataToRender.forEach((row, rowIdx) => {
				const bgColor = rowIdx % 2 === 0 ? '#ffffff' : '#f9f9f9'
				const tr = tbody
					.append('tr')
					.style('background-color', bgColor)
					.style('border-bottom', `1px solid ${borderColor}`)
				tr.append('td').style('padding', '10px').text(row.caseId)
				tr.append('td').style('padding', '10px').text(row.programName)
				tr.append('td').style('padding', '10px').text(row.project)

				const studyCellButton = makeTransparentButton(tr.append('td').style('padding', '10px').append('button'))
					.style('color', '#4272a5')
					.on('click', () => {
						const expanded = studyCellButton.attr('aria-expanded') === 'true'
						studyCellButton.attr('aria-expanded', String(!expanded))
						const detailsRowID = 'study-details' + row.caseId.replace('.', '')
						if (!expanded) {
							const detailsRow = tbody
								.insert('tr', function (this: HTMLTableSectionElement) {
									const index = Array.from(this.children).indexOf(tr.node()!)
									return this.children[index + 1] || null
								})
								.attr('id', detailsRowID)

							const detailsTable = detailsRow
								.append('td')
								.attr('colspan', '4')
								.append('div')
								.append('table')
								.style('width', '100%')
								.style('border-collapse', 'collapse')

							const detailsHeaderRow = detailsTable
								.append('thead')
								.append('tr')
								.style('background-color', detailsHeaderBgColor)
								.style('border-bottom', `1px solid ${borderColor}`)

							expandableHeaders.forEach(header => {
								detailsHeaderRow
									.append('th')
									.style('padding', '8px')
									.style('text-align', 'left')
									.style('font-weight', '500')
									.text(header)
							})

							const detailsTbody = detailsTable.append('tbody')
							row.studiesList.forEach(study => {
								const studyRow = detailsTbody.append('tr').style('border-bottom', `1px solid ${borderColor}`)
								studyRow
									.append('td')
									.style('padding', '8px')
									.text(study.StudyInstanceUID || 'N/A')
								studyRow
									.append('td')
									.style('padding', '8px')
									.text(study.collectionId || 'N/A')
								studyRow
									.append('td')
									.style('padding', '8px')
									.text(study.StudyDate || 'N/A')
								studyRow
									.append('td')
									.style('padding', '8px')
									.text(study.StudyDescription || 'N/A')
								this.addCellLinkToRow(
									studyRow,
									`https://viewer.imaging.datacommons.cancer.gov/slim/studies/${study.StudyInstanceUID}`,
									'Open Study',
									study.hasWSI
								)
								this.addCellLinkToRow(
									studyRow,
									`https://viewer.imaging.datacommons.cancer.gov/v3/viewer/?StudyInstanceUIDs=${study.StudyInstanceUID}`,
									'Open Study',
									study.hasRadiology
								)
							})
						} else {
							this.holder.select(`#${detailsRowID}`).remove()
						}
					})

				studyCellButton
					.append('div')
					.append('span')
					.text(`${row.studiesCount} IDC study (${row.wsiCount} Histopathology + ${row.radiologyCount} Radiology)`)
			})
		}

		renderRows()
		this.renderPagination(pagination, dataToRender.length)
	}

	private renderPagination(pagination: Pagination, dataLength: number): void {
		const selectedPageSize = this.args.pageSize || this.args.pageSizeOptions[0]

		const paginationDiv = this.holder
			.append('div')
			.attr('class', 'idcviewer-pagination')
			.style('display', 'flex')
			.style('justify-content', 'space-between')
			.style('align-items', 'center')
			.style('flex-wrap', 'wrap')
			.style('border', `1px solid ${borderColor}`)
			.style('padding', '0.5rem')

		const pageSizeSelection = paginationDiv
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '0.5rem')

		pageSizeSelection.append('span').text('Show')

		const pageSizeDropdown = pageSizeSelection.append('div').style('position', 'relative')
		const pageSizeButton = pageSizeDropdown
			.append('button')
			.attr('type', 'button')
			.style('min-width', '55px')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('justify-content', 'center')
			.style('gap', '0.5rem')
			.style('padding', '0.3rem 0.45rem')
			.style('border-radius', '4px')
			.style('border', `1px solid ${borderColor}`)
			.style('background-color', '#ffffff')
			.style('cursor', 'pointer')
		const pageSizeChevron = pageSizeButton.append('span').style('font-size', '15px')
		const changePageSizeText = (isOpen: boolean) => {
			pageSizeChevron.text((!isOpen ? '▾ ' : '▴ ') + this.args.pageSize)
		}
		changePageSizeText(false)
		const optionsPanel = pageSizeDropdown
			.append('div')
			.style('display', 'none')
			.style('position', 'absolute')
			.style('top', 'calc(100% + 4px)')
			.style('left', '0')
			.style('min-width', '100%')
			.style('border', `1px solid ${borderColor}`)
			.style('border-radius', '4px')
			.style('background-color', '#ffffff')
			.style('box-shadow', '0 4px 12px rgba(0,0,0,0.12)')
			.style('z-index', '1')

		const renderOptions = () => {
			optionsPanel.selectAll('*').remove()
			this.args.pageSizeOptions.forEach(option => {
				const btn = optionsPanel
					.append('button')
					.attr('type', 'button')
					.style('width', '100%')
					.style('padding', '0.35rem 0.5rem')
					.style('display', 'flex')
					.style('justify-content', 'space-between')
					.style('align-items', 'center')
					.style('border', 'none')
					.style('background-color', '#ffffff')
					.style('cursor', 'pointer')

				btn.append('span').text(String(option))
				btn
					.append('span')
					.text(option === selectedPageSize ? '✓' : '')
					.style('color', '#2a6f2a')
				btn
					.on('mouseenter', function () {
						;(this as HTMLButtonElement).style.backgroundColor = '#f5f5f5'
					})
					.on('mouseleave', function () {
						;(this as HTMLButtonElement).style.backgroundColor = '#ffffff'
					})
					.on('click', () => {
						this.viewer.main({ ...this.args, pageSize: option }).catch(e => {
							sayerror(this.viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
						})
					})
			})
		}

		renderOptions()

		pageSizeButton.on('click', () => {
			const isOpen = optionsPanel.style('display') !== 'none'
			optionsPanel.style('display', isOpen ? 'none' : 'block')
			changePageSizeText(isOpen)
		})

		pageSizeSelection.append('span').text('entries')

		paginationDiv
			.append('div')
			.style('font-size', '18px')
			.html(
				`Showing <b>${pagination.from + 1}</b> - <b>${Math.min(
					pagination.from + dataLength,
					pagination.total
				)}</b> of <b>${pagination.total}</b> entries`
			)
		const renderPageControls = () => {
			// Source - https://stackoverflow.com/a/36963945
			// Posted by Aditya Singh, modified by community. See post 'Timeline' for change history
			// Retrieved 2026-06-24, License - CC BY-SA 3.0
			// const range = (start, end) => Array.from({ length: end - start }, (_, k) => k + start)
			const pagePlaceHolder = '...'
			const totalPages = Math.ceil(pagination.total / selectedPageSize)
			const pageControlsDiv = paginationDiv
				.append('div')
				.style('display', 'flex')
				.style('gap', '0.5rem')
				.style('flex-wrap', 'wrap')
				.style('align-items', 'center')
				.style('justify-content', 'center')
			const buttonsToDisable: Selection<HTMLButtonElement, unknown, any, any>[] = []
			const beginningButton = makeTransparentButton(pageControlsDiv.append('button'))
			addSvg(beginningButton, doubleLeftChevronPath).on('click', () => {
				if (this.args.currentPage === 1) return
				this.viewer.main({ ...this.args, currentPage: 1 }).catch(e => {
					sayerror(this.viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
				})
			})
			const singlePageTurnBack = makeTransparentButton(pageControlsDiv.append('button'))
			addSvg(singlePageTurnBack, leftChevronPath).on('click', () => {
				if (this.args.currentPage === 1) return
				this.viewer.main({ ...this.args, currentPage: this.args.currentPage - 1 }).catch(e => {
					sayerror(this.viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
				})
			})
			const setofPages = new Set([1])
			let startPage = Math.max(2, this.args.currentPage - Math.floor((numPagesToShow - 2) / 2))
			startPage = Math.min(startPage, totalPages - (numPagesToShow - 2))
			console.log('startPage:', startPage, Math.floor((numPagesToShow - 2) / 2), 'currentPage:', this.args.currentPage)
			for (let i = startPage; i < totalPages && setofPages.size <= numPagesToShow - 2; i++) {
				setofPages.add(i)
			}
			setofPages.add(totalPages)
			const listOfPages: string[] = Array.from(setofPages).map(String)
			if (this.args.currentPage === 1) {
				buttonsToDisable.push(beginningButton, singlePageTurnBack)
			}

			if (totalPages > numPagesToShow) {
				const secondLowestPage = 2
				const secondHighestPage = totalPages - 1
				const secondLowestPageIncluded = listOfPages.includes(secondLowestPage.toString())
				const secondHighestPageIncluded = listOfPages.includes(secondHighestPage.toString())
				if (!secondHighestPageIncluded) {
					listOfPages.splice(listOfPages.length - 2, 1, pagePlaceHolder)
				}
				if (!secondLowestPageIncluded) {
					listOfPages.splice(1, 1, pagePlaceHolder)
				}
			}

			for (const page of listOfPages) {
				const pageButton = makeTransparentButton(pageControlsDiv.append('button')).text(page)
				if (page === pagePlaceHolder) {
					buttonsToDisable.push(pageButton)
				} else if (Number(page) === this.args.currentPage) {
					pageButton
						.style('font-weight', 'bold')
						.style('background-color', '#c7501a')
						.style('min-width', '20px')
						.style('min-height', '20px')
				} else {
					pageButton.on('click', () => {
						if (Number(page) === this.args.currentPage) return
						this.viewer.main({ ...this.args, currentPage: Number(page) }).catch(e => {
							sayerror(this.viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
						})
					})
				}
			}
			const singlePageTurnForward = makeTransparentButton(pageControlsDiv.append('button'))
			addSvg(singlePageTurnForward, rightChevronPath).on('click', () => {
				if (this.args.currentPage === totalPages) return
				this.viewer.main({ ...this.args, currentPage: this.args.currentPage + 1 }).catch(e => {
					sayerror(this.viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
				})
			})
			const endButton = makeTransparentButton(pageControlsDiv.append('button'))
			addSvg(endButton, doubleRightChevronPath).on('click', () => {
				if (this.args.currentPage === totalPages) return
				this.viewer.main({ ...this.args, currentPage: totalPages }).catch(e => {
					sayerror(this.viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
				})
			})
			if (this.args.currentPage === totalPages) {
				buttonsToDisable.push(singlePageTurnForward, endButton)
			}
			buttonsToDisable.forEach(button => {
				button.style('cursor', 'not-allowed')
				button.attr('disabled', true)
			})
		}

		renderPageControls()
	}

	private addCellLinkToRow(
		row: Selection<HTMLTableRowElement, unknown, any, any>,
		url: string,
		_text: string,
		hasStudy: boolean
	): void {
		const cell = row
			.append('td')
			.style('padding', '8px')
			.append('span')
			.style('display', 'flex')
			.style('align-items', 'center')
		if (hasStudy) {
			addSvg(cell, externalLinkPath)
			cell
				.append('a')
				.text('Open Study')
				.attr('href', url)
				.attr('target', '_blank')
				.style('color', 'black')
				.style('font-size', '16px')
		} else {
			cell.append('span').text('\u2717').style('color', 'red').style('font-size', '16px')
		}
	}
}
