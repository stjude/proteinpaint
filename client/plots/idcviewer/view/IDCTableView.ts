import type { Selection } from 'd3-selection'
import type { IDCViewerRow, Pagination } from '../IDCTypes'

// Styling constants used only by the table view
const borderColor = '#4c4c4c'
const mainHeaderBgColor = '#f5f5f5'
const mainHeaderHoverBgColor = '#e6e6e6'
const detailsHeaderBgColor = '#e0e0e0'
const pageSizeOptions = [10, 20, 50, 100]

/** Renders the IDC studies table with expandable rows and page-size control. */
export class IDCTableView {
	private holder: Selection<HTMLDivElement, unknown, any, any>

	constructor(holder: Selection<HTMLDivElement, unknown, any, any>) {
		this.holder = holder
	}

	clear() {
		this.holder.selectAll('*').remove()
	}

	render(tableData: ReadonlyArray<IDCViewerRow>, pagination: Pagination): void {
		this.clear()

		if (tableData.length === 0) {
			this.holder.append('div').text('No IDC studies found for the current cohort.')
			return
		}

		const table = this.holder
			.style('font-family', 'Noto Sans, sans-serif')
			.append('table')
			.style('width', '100%')
			.style('border-collapse', 'collapse')
			.style('font-size', '14px')
			.style('border', `1px solid ${borderColor}`)

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
			th.append('button')
				.style('font-family', 'Montserrat, sans-serif')
				.style('font-weight', '600')
				.style('cursor', 'pointer')
				.style('background', 'transparent')
				.style('border', 'none')
				.style('padding', '0')
				.style('margin', '0')
				.style('appearance', 'none')
				.text(header)
		})

		const tbody = table.append('tbody')
		let selectedPageSize = pageSizeOptions[0]

		const renderRows = () => {
			tbody.selectAll('*').remove()
			tableData.slice(0, selectedPageSize).forEach((row, rowIdx) => {
				const bgColor = rowIdx % 2 === 0 ? '#ffffff' : '#f9f9f9'
				const tr = tbody
					.append('tr')
					.style('background-color', bgColor)
					.style('border-bottom', `1px solid ${borderColor}`)
				tr.append('td').style('padding', '10px').text(row.caseId)
				tr.append('td').style('padding', '10px').text(row.programName)
				tr.append('td').style('padding', '10px').text(row.project)

				const studyCellButton = tr
					.append('td')
					.style('padding', '10px')
					.append('button')
					.style('cursor', 'pointer')
					.style('background', 'transparent')
					.style('border', 'none')
					.style('padding', '0')
					.style('margin', '0')
					.style('appearance', 'none')
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
		this.renderPagination(pagination, selectedPageSize, pageSizeOptions, renderRows, newSize => {
			selectedPageSize = newSize
		})
	}

	private renderPagination(
		pagination: Pagination,
		initialPageSize: number,
		options: number[],
		onPageSizeChange: () => void,
		setPageSize: (n: number) => void
	): void {
		let selectedPageSize = initialPageSize

		const paginationDiv = this.holder
			.append('div')
			.style('margin-top', '1rem')
			.style('display', 'flex')
			.style('justify-content', 'space-between')
			.style('align-items', 'center')
			.style('flex-wrap', 'wrap')

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
			.style('min-width', '68px')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('justify-content', 'space-between')
			.style('gap', '0.5rem')
			.style('padding', '0.35rem 0.5rem')
			.style('border-radius', '4px')
			.style('border', `1px solid ${borderColor}`)
			.style('background-color', '#ffffff')
			.style('cursor', 'pointer')

		const pageSizeText = pageSizeButton.append('span').text(String(selectedPageSize))
		const pageSizeChevron = pageSizeButton.append('span').text('▾').style('font-size', '12px')

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
			options.forEach(option => {
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
						selectedPageSize = option
						setPageSize(option)
						pageSizeText.text(String(option))
						onPageSizeChange()
						renderOptions()
						optionsPanel.style('display', 'none')
						pageSizeChevron.text('▾')
					})
			})
		}

		renderOptions()

		pageSizeButton.on('click', () => {
			const isOpen = optionsPanel.style('display') !== 'none'
			optionsPanel.style('display', isOpen ? 'none' : 'block')
			pageSizeChevron.text(isOpen ? '▾' : '▴')
		})

		pageSizeSelection.append('span').text('entries')

		paginationDiv
			.append('div')
			.style('font-size', '12px')
			.text(
				`Showing ${pagination.from + 1} to ${Math.min(pagination.from + selectedPageSize, pagination.total)} of ${
					pagination.total
				} entries`
			)
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
			cell
				.append('svg')
				.attr('xmlns', 'http://www.w3.org/2000/svg')
				.attr('viewBox', '0 0 16 16')
				.attr('width', '16')
				.attr('height', '16')
				.append('path')
				.attr(
					'd',
					'M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z'
				)
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
