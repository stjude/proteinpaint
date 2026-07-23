import { type Selection } from 'd3-selection'
import type { IDCViewerOpts, IDCViewerRow, Pagination, SortByField } from '../IDCTypes'
import type { IDCViewer } from '../IDCViewer'
import { makeTransparentButton, addSvg, makeCenteredFlex } from '../utils'
import { sayerror } from '#dom/sayerror'
import { IDCViewerDefaults } from '../settings/defaults'
import { applyStyles, idcTableStyleFns, idcTableStyles, sharedStyleFns, sharedColors } from '../styling'

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
const closedCircleChevron = [
	'M48 256c0 114.9 93.1 208 208 208s208-93.1 208-208S370.9 48 256 48 48 141.1 48 256zm289.1-43.4c7.5-7.5 19.8-7.5 27.3 0 3.8 3.8 5.6 8.7 5.6 13.6s-1.9 9.9-5.7 13.7l-94.3 94c-7.6 6.9-19.3 6.7-26.6-.6l-95.7-95.4c-7.5-7.5-7.6-19.7 0-27.3 7.5-7.5 19.7-7.6 27.3 0l81.1 81.9 81-79.9z'
]
const openCircleChevron = [
	'M256 464c114.9 0 208-93.1 208-208S370.9 48 256 48 48 141.1 48 256s93.1 208 208 208zm0-244.5l-81.1 81.9c-7.5 7.5-19.8 7.5-27.3 0s-7.5-19.8 0-27.3l95.7-95.4c7.3-7.3 19.1-7.5 26.6-.6l94.3 94c3.8 3.8 5.7 8.7 5.7 13.7 0 4.9-1.9 9.9-5.6 13.6-7.5 7.5-19.7 7.6-27.3 0l-81-79.9z'
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
			applyStyles(this.holder, idcTableStyles.holder)
			table = applyStyles(this.holder.append('table').attr('id', 'idc-table'), idcTableStyles.table)
			applyStyles(table, idcTableStyleFns.tableBorder(sharedColors.borderColor))
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
		const headerRow = applyStyles(thead.append('tr'), idcTableStyles.headerRow)
		applyStyles(headerRow, idcTableStyleFns.headerRowBorder(sharedColors.borderColor))
		const sortDirection = this.args.sortDirection === 'asc' ? 'ascending' : 'descending'
		Object.entries(headers).forEach(([header, sortKey]) => {
			const chosenKey = this.args.sortBy === sortKey
			const th = applyStyles(
				headerRow.append('th').attr('aria-sort', chosenKey ? sortDirection : 'none'),
				idcTableStyles.headCell
			)
			applyStyles(th, idcTableStyleFns.headCellCursor(sortKey !== undefined))
			const headerDiv = applyStyles(th.append('div'), idcTableStyles.headerLabelDiv)
			headerDiv.append('span').text(header)
			if (sortKey === undefined) return

			th.on('mouseenter', function () {
				;(this as HTMLTableCellElement).style.backgroundColor = sharedColors.mainHeaderHoverBgColor
			})
				.on('mouseleave', function () {
					;(this as HTMLTableCellElement).style.backgroundColor = sharedColors.mainHeaderBgColor
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
			if (chosenKey) applyStyles(th.select('svg'), idcTableStyles.activeSortIcon)
		})

		const tbody = table.append('tbody')
		const dataToRender = tableData.slice(0, this.args.pageSize)
		const renderRows = () => {
			tbody.selectAll('*').remove()
			dataToRender.forEach((row, rowIdx) => {
				const caseRowPadding = '10px'
				const bgColor = rowIdx % 2 === 0 ? sharedColors.fullWhiteBgColor : '#f9f9f9'
				const tr = applyStyles(tbody.append('tr'), idcTableStyleFns.bodyRowBg(bgColor))
				applyStyles(tr, idcTableStyleFns.rowBottomBorder(sharedColors.borderColor))
				applyStyles(tr.append('td'), idcTableStyleFns.paddingCell(caseRowPadding))
					.text(row.caseId)
					.attr('data-testid', `case-id-${row.caseId}`)
				applyStyles(tr.append('td'), idcTableStyleFns.paddingCell(caseRowPadding)).text(row.programName)
				applyStyles(tr.append('td'), idcTableStyleFns.paddingCell(caseRowPadding)).text(row.project)
				const studyCellDiv = applyStyles(tr.append('td'), idcTableStyleFns.paddingCell(caseRowPadding)).append('div')
				applyStyles(studyCellDiv, idcTableStyles.studyCellDiv)
				addSvg(studyCellDiv, closedCircleChevron)
				const studyCellButton = applyStyles(
					makeTransparentButton(studyCellDiv.append('button')),
					idcTableStyleFns.cellColor('#4272a5')
				)
				applyStyles(studyCellButton, idcTableStyles.studyCellButton)
				studyCellDiv.select('svg').attr('viewBox', '0 0 512 512')
				studyCellDiv.on('click', () => {
					const expanded = studyCellButton.attr('aria-expanded') === 'true'
					studyCellButton.attr('aria-expanded', String(!expanded))
					studyCellDiv.select('path').attr('d', !expanded ? openCircleChevron : closedCircleChevron)
					const detailsRowID = 'study-details' + row.caseId.replace(/\./g, '')
					if (!expanded) {
						const detailsRow = tbody
							.insert('tr', function (this: HTMLTableSectionElement) {
								const index = Array.from(this.children).indexOf(tr.node()!)
								return this.children[index + 1] || null
							})
							.attr('id', detailsRowID)

						const detailsTable = detailsRow.append('td').attr('colspan', '4').append('div').append('table')
						applyStyles(detailsTable, idcTableStyles.detailsTable)

						const detailsHeaderRow = applyStyles(
							detailsTable.append('thead').append('tr'),
							idcTableStyles.detailsHeaderRow
						)
						applyStyles(detailsHeaderRow, idcTableStyleFns.rowBottomBorder(sharedColors.borderColor))

						expandableHeaders.forEach(header => {
							applyStyles(detailsHeaderRow.append('th'), idcTableStyles.detailsHeaderCell).text(header)
						})

						const detailsTbody = detailsTable.append('tbody')
						const studyRowPadding = '8px'

						row.studiesList.forEach(study => {
							const studyRow = applyStyles(
								detailsTbody.append('tr'),
								idcTableStyleFns.rowBottomBorder(sharedColors.borderColor)
							)
							studyRow
								.append('td')
								.call(sel => applyStyles(sel, idcTableStyleFns.paddingCell(studyRowPadding)))
								.text(study.StudyInstanceUID || 'N/A')
							studyRow
								.append('td')
								.call(sel => applyStyles(sel, idcTableStyleFns.paddingCell(studyRowPadding)))
								.text(study.collectionId || 'N/A')
							studyRow
								.append('td')
								.call(sel => applyStyles(sel, idcTableStyleFns.paddingCell(studyRowPadding)))
								.text(study.StudyDate || 'N/A')
							studyRow
								.append('td')
								.call(sel => applyStyles(sel, idcTableStyleFns.paddingCell(studyRowPadding)))
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
				const pathologyText = row.wsiCount > 0 ? `${row.wsiCount} Histopathology` : ''
				const radiologyText = row.radiologyCount > 0 ? `${row.radiologyCount} Radiology` : ''
				studyCellButton.text(
					`${row.studiesCount} IDC study (${[pathologyText, radiologyText].filter(Boolean).join(' + ')})`
				)
			})
		}

		renderRows()
		this.renderPagination(pagination, dataToRender.length)
	}

	private renderPagination(pagination: Pagination, dataLength: number): void {
		const selectedPageSize = this.args.pageSize || this.args.pageSizeOptions[0]

		const paginationDiv = applyStyles(
			this.holder.append('div').attr('class', 'idcviewer-pagination'),
			idcTableStyles.paginationWrapper
		)
		applyStyles(paginationDiv, idcTableStyleFns.paginationBorder(sharedColors.borderColor))

		const pageSizeSelection = applyStyles(paginationDiv.append('div'), idcTableStyles.pageSizeSelection)

		pageSizeSelection.append('span').text('Show')

		const pageSizeDropdown = applyStyles(pageSizeSelection.append('div'), idcTableStyles.pageSizeDropdown)
		const pageSizeButton = applyStyles(
			pageSizeDropdown.append('button').attr('type', 'button'),
			idcTableStyles.pageSizeButton
		)
		applyStyles(pageSizeButton, idcTableStyleFns.pageSizeButtonBorder(sharedColors.borderColor))
		makeCenteredFlex(pageSizeButton)
		const pageSizeChevron = applyStyles(pageSizeButton.append('span'), idcTableStyles.pageSizeChevron)
		const changePageSizeText = (isOpen: boolean) => {
			pageSizeChevron.text((!isOpen ? '▾ ' : '▴ ') + this.args.pageSize)
		}
		changePageSizeText(false)
		const optionsPanel = applyStyles(pageSizeDropdown.append('div'), idcTableStyles.pageSizeOptionsPanel)
		applyStyles(optionsPanel, idcTableStyleFns.optionsPanelBorder(sharedColors.borderColor))

		const renderOptions = () => {
			optionsPanel.selectAll('*').remove()
			this.args.pageSizeOptions.forEach(option => {
				const btn = applyStyles(
					optionsPanel.append('button').attr('type', 'button'),
					idcTableStyles.pageSizeOptionButton
				)

				btn.append('span').text(String(option))
				btn
					.append('span')
					.text(option === selectedPageSize ? '✓' : '')
					.call(sel => applyStyles(sel, idcTableStyles.selectedOptionCheck))
				btn
					.on('mouseenter', function () {
						;(this as HTMLButtonElement).style.backgroundColor = '#f5f5f5'
					})
					.on('mouseleave', function () {
						;(this as HTMLButtonElement).style.backgroundColor = sharedColors.fullWhiteBgColor
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
			applyStyles(optionsPanel, sharedStyleFns.display(isOpen ? 'none' : 'block'))
			changePageSizeText(!isOpen)
		})

		pageSizeSelection.append('span').text('entries')

		applyStyles(
			paginationDiv.append('div').attr('data-testid', 'pagination-summary'),
			idcTableStyles.paginationSummary
		).html(
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
			const pageControlsDiv = applyStyles(paginationDiv.append('div'), idcTableStyles.pageControlsDiv)
			const buttonsToDisable: Selection<HTMLButtonElement, unknown, any, any>[] = []
			const beginningButton = makeTransparentButton(pageControlsDiv.append('button')).attr('class', 'beginning-button')
			makeCenteredFlex(
				addSvg(beginningButton, doubleLeftChevronPath).on('click', () => {
					if (this.args.currentPage === 1) return
					this.viewer.main({ ...this.args, currentPage: 1 }).catch(e => {
						sayerror(this.viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
					})
				})
			)
			const singlePageTurnBack = makeTransparentButton(pageControlsDiv.append('button')).attr(
				'class',
				'single-page-turn-back'
			)
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
				const pageButton = makeTransparentButton(pageControlsDiv.append('button'))
					.text(page)
					.attr('data-testid', `page-button-${page}`)
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
					applyStyles(pageButton, idcTableStyles.activePageButton)
				} else {
					pageButton.on('click', () => {
						if (Number(page) === this.args.currentPage) return
						this.viewer.main({ ...this.args, currentPage: Number(page) }).catch(e => {
							sayerror(this.viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
						})
					})
				}
			}
			const singlePageTurnForward = makeTransparentButton(pageControlsDiv.append('button')).attr(
				'class',
				'single-page-turn-forward'
			)
			makeCenteredFlex(
				addSvg(singlePageTurnForward, rightChevronPath).on('click', () => {
					if (this.args.currentPage === totalPages) return
					this.viewer.main({ ...this.args, currentPage: this.args.currentPage + 1 }).catch(e => {
						sayerror(this.viewer.dom.errorDiv, `Error running IDCViewer: ${e.message || e}`)
					})
				})
			)
			const endButton = makeTransparentButton(pageControlsDiv.append('button')).attr('class', 'end-button')
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
				applyStyles(button, idcTableStyles.disabledPaginationButton)
				button.attr('disabled', true)
			})
		}
		renderPageControls()
	}

	private addCellLinkToRow(
		row: Selection<HTMLTableRowElement, unknown, any, any>,
		url: string,
		text: string,
		hasStudy: boolean
	): void {
		const cell = applyStyles(row.append('td'), idcTableStyleFns.paddingCell('8px'))
			.append('span')
			.call(sel => applyStyles(sel, idcTableStyles.cellLinkContainer))
		if (hasStudy) {
			makeCenteredFlex(addSvg(cell, externalLinkPath))
			cell
				.append('a')
				.text(text)
				.attr('href', url)
				.attr('rel', 'noopener noreferrer')
				.attr('target', '_blank')
				.call(sel => applyStyles(sel, idcTableStyles.studyLink))
		} else {
			applyStyles(cell.append('span').text('-'), idcTableStyles.missingStudyMark)
		}
	}
}
