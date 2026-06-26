import { type Selection } from 'd3-selection'
import type { IDCViewerOpts, IDCViewerRow, Pagination, SortByField } from '../IDCTypes'
import type { IDCViewer } from '../IDCViewer'
import { makeTransparentButton, addSvg, makeCenteredFlex } from '../utils'
import { sayerror } from '#dom/sayerror'
import { IDCViewerDefaults } from '../settings/defaults'

const borderColor = '#4c4c4c'
const mainHeaderBgColor = '#f5f5f5'
const mainHeaderHoverBgColor = '#e6e6e6'
const detailsHeaderBgColor = '#e0e0e0'
const fullWhiteBgColor = '#ffffff'
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
const alphabetAscendingPath = [
	'M10.082 5.629 9.664 7H8.598l1.789-5.332h1.234L13.402 7h-1.12l-.419-1.371zm1.57-.785L11 2.687h-.047l-.652 2.157z',
	'M12.96 14H9.028v-.691l2.579-3.72v-.054H9.098v-.867h3.785v.691l-2.567 3.72v.054h2.645zM4.5 2.5a.5.5 0 0 0-1 0v9.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L4.5 12.293z'
]
const alphabetDescendingPath = [
	'M12.96 7H9.028v-.691l2.579-3.72v-.054H9.098v-.867h3.785v.691l-2.567 3.72v.054h2.645z',
	'M10.082 12.629 9.664 14H8.598l1.789-5.332h1.234L13.402 14h-1.12l-.419-1.371zm1.57-.785L11 9.688h-.047l-.652 2.156z',
	'M4.5 2.5a.5.5 0 0 0-1 0v9.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L4.5 12.293z'
]
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
	// aria-sort 'ascending' 'descending 'none'
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
		const headers = {
			'GDC Case ID': 'submitter_id',
			Program: 'project.program.name',
			Project: 'project.project_id',
			'IDC Studies (Click to expand)': undefined
		}
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
		const sortDirection = this.args.sortDirection === 'asc' ? 'ascending' : 'descending'
		Object.entries(headers).forEach(([header, sortKey]) => {
			const chosenKey = this.args.sortBy === sortKey
			const th = headerRow
				.append('th')
				.style('text-align', 'left')
				.style('align-items', 'center')
				.style('background-color', mainHeaderBgColor)
				.attr('aria-sort', chosenKey ? sortDirection : 'none')
				.style('font-family', 'Montserrat, sans-serif')
				.style('font-weight', '600')
				.style('padding', '10px')
				.style('gap', '5px')
				.style('cursor', sortKey === undefined ? 'default' : 'pointer')
			const headerDiv = th.append('div').style('display', 'flex').style('align-items', 'left').style('gap', '5px')
			headerDiv.append('span').text(header)
			if (sortKey === undefined) return

			th.on('mouseenter', function () {
				;(this as HTMLTableCellElement).style.backgroundColor = mainHeaderHoverBgColor
			})
				.on('mouseleave', function () {
					;(this as HTMLTableCellElement).style.backgroundColor = mainHeaderBgColor
				})
				.on('click', () => {
					switch (th.attr('aria-sort')) {
						case 'none':
							this.args.sortDirection = 'asc'
							this.args.sortBy = sortKey as SortByField
							break
						case 'ascending':
							this.args.sortDirection = 'desc'
							this.args.sortBy = sortKey as SortByField
							break
						case 'descending':
							this.args.sortBy = IDCViewerDefaults.sortBy
							this.args.sortDirection = IDCViewerDefaults.sortDirection
							break
					}
					this.viewer.main({ ...this.args }).catch(e => {
						sayerror(this.viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
					})
				})

			addSvg(
				headerDiv,
				chosenKey
					? this.args.sortDirection === 'asc'
						? alphabetAscendingPath
						: alphabetDescendingPath
					: alphabetAscendingPath
			)
			if (chosenKey) th.select('svg').style('color', '#c7501a')
		})

		const tbody = table.append('tbody')
		const dataToRender = tableData.slice(0, this.args.pageSize)
		const renderRows = () => {
			tbody.selectAll('*').remove()
			dataToRender.forEach((row, rowIdx) => {
				const caseRowPadding = '10px'
				const bgColor = rowIdx % 2 === 0 ? fullWhiteBgColor : '#f9f9f9'
				const tr = tbody
					.append('tr')
					.style('background-color', bgColor)
					.style('border-bottom', `1px solid ${borderColor}`)
				tr.append('td').style('padding', caseRowPadding).text(row.caseId)
				tr.append('td').style('padding', caseRowPadding).text(row.programName)
				tr.append('td').style('padding', caseRowPadding).text(row.project)

				const studyCellButton = makeTransparentButton(tr.append('td').style('padding', caseRowPadding).append('button'))
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
							const studyRowPadding = '8px'

							row.studiesList.forEach(study => {
								const studyRow = detailsTbody.append('tr').style('border-bottom', `1px solid ${borderColor}`)
								studyRow
									.append('td')
									.style('padding', studyRowPadding)
									.text(study.StudyInstanceUID || 'N/A')
								studyRow
									.append('td')
									.style('padding', studyRowPadding)
									.text(study.collectionId || 'N/A')
								studyRow
									.append('td')
									.style('padding', studyRowPadding)
									.text(study.StudyDate || 'N/A')
								studyRow
									.append('td')
									.style('padding', studyRowPadding)
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
			.style('gap', '0.5rem')
			.style('padding', '0.3rem 0.45rem')
			.style('border-radius', '4px')
			.style('border', `1px solid ${borderColor}`)
			.style('background-color', fullWhiteBgColor)
			.style('cursor', 'pointer')
		makeCenteredFlex(pageSizeButton)
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
			.style('background-color', fullWhiteBgColor)
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
					.style('background-color', fullWhiteBgColor)
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
						;(this as HTMLButtonElement).style.backgroundColor = fullWhiteBgColor
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
			makeCenteredFlex(
				addSvg(beginningButton, doubleLeftChevronPath).on('click', () => {
					if (this.args.currentPage === 1) return
					this.viewer.main({ ...this.args, currentPage: 1 }).catch(e => {
						sayerror(this.viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
					})
				})
			)
			const singlePageTurnBack = makeTransparentButton(pageControlsDiv.append('button'))
			makeCenteredFlex(
				addSvg(singlePageTurnBack, leftChevronPath).on('click', () => {
					if (this.args.currentPage === 1) return
					this.viewer.main({ ...this.args, currentPage: this.args.currentPage - 1 }).catch(e => {
						sayerror(this.viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
					})
				})
			)
			const setofPages = new Set([1])
			const actualShown = Math.min(numPagesToShow, totalPages)
			let startPage = Math.max(2, this.args.currentPage - Math.floor((actualShown - 2) / 2))
			startPage = Math.min(startPage, totalPages - (actualShown - 2))
			for (let i = startPage; i < totalPages && setofPages.size <= actualShown - 2; i++) {
				setofPages.add(i)
			}
			setofPages.add(totalPages)
			const listOfPages: string[] = Array.from(setofPages).map(String)
			if (this.args.currentPage === 1) {
				buttonsToDisable.push(beginningButton, singlePageTurnBack)
			}

			if (totalPages > actualShown) {
				const secondLowestPage = 2
				const secondHighestPage = totalPages - 1
				const secondLowestPageIncluded = listOfPages.includes(secondLowestPage.toString())
				const secondHighestPageIncluded = listOfPages.includes(secondHighestPage.toString())
				if (!secondHighestPageIncluded) {
					listOfPages.splice(listOfPages.length - 2, 1, 'secondHighestPage')
				}
				if (!secondLowestPageIncluded) {
					listOfPages.splice(1, 1, 'secondLowestPage')
				}
			}

			for (const page of listOfPages) {
				const pageButton = makeTransparentButton(pageControlsDiv.append('button')).text(page)
				if (page === 'secondLowestPage' || page === 'secondHighestPage') {
					pageButton.text(pagePlaceHolder)
					// I have set page buttons with ellipses to take you to the middle of the range of pages that are not being shown
					pageButton.on('click', () => {
						const middlePoint = Math.floor((this.args.currentPage + (page === 'secondLowestPage' ? 1 : totalPages)) / 2)
						this.viewer.main({ ...this.args, currentPage: middlePoint }).catch(e => {
							sayerror(this.viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
						})
					})
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
			makeCenteredFlex(
				addSvg(singlePageTurnForward, rightChevronPath).on('click', () => {
					if (this.args.currentPage === totalPages) return
					this.viewer.main({ ...this.args, currentPage: this.args.currentPage + 1 }).catch(e => {
						sayerror(this.viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
					})
				})
			)
			const endButton = makeTransparentButton(pageControlsDiv.append('button'))
			makeCenteredFlex(
				addSvg(endButton, doubleRightChevronPath).on('click', () => {
					if (this.args.currentPage === totalPages) return
					this.viewer.main({ ...this.args, currentPage: totalPages }).catch(e => {
						sayerror(this.viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
					})
				})
			)
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
			makeCenteredFlex(addSvg(cell, externalLinkPath))
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
