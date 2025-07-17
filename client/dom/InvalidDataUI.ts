import { renderTable } from '#dom'
import { select } from 'd3-selection'
import type { Div } from '../types/d3'

export default class InvalidDataUI {
	static defaults = {
		backgroundColor: '#f8f9fa',
		borderColor: '#dee2e6',
		borderRadius: '4px',
		color: '#dc3545', //punch red
		fontSize: 12, //use px, adjusted
		padding: 8, // use px, adjusted
		margin: '12px'
	}

	static render(container: Div, invalidInfo: { count: number; entries: { dataType: string; reason: string }[] }) {
		const expandableContainer = container.append('div').style('margin-top', InvalidDataUI.defaults.margin)

		const expandableHeader = expandableContainer
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '8px')
			.style('cursor', 'pointer')
			.style('padding', `${InvalidDataUI.defaults.padding}px`)
			.style('border-radius', InvalidDataUI.defaults.borderRadius)
			.style('transition', 'background-color 0.2s')
			.style('background-color', 'rgba(220, 53, 69, 0.1)')
			.style('border', '1px solid rgba(220, 53, 69, 0.2)')
			.on('mouseenter', function (this: HTMLElement) {
				select(this).style('background-color', 'rgba(220, 53, 69, 0.15)')
			})
			.on('mouseleave', function (this: HTMLElement) {
				select(this).style('background-color', 'rgba(220, 53, 69, 0.1)')
			})

		const expandIcon = expandableHeader
			.append('span')
			.style('font-size', `${InvalidDataUI.defaults.fontSize}px`)
			.style('color', InvalidDataUI.defaults.color)
			.style('transition', 'transform 0.2s')
			.text('▶')

		expandableHeader
			.append('span')
			.style('color', InvalidDataUI.defaults.color)
			.style('text-decoration', 'underline')
			.style('font-size', `${InvalidDataUI.defaults.fontSize + 1}px`)
			.style('font-weight', '500')
			.text(`View ${invalidInfo.count} invalid entries`)

		const expandableContent = expandableContainer
			.append('div')
			.style('display', 'none')
			.style('margin-top', InvalidDataUI.defaults.margin)
			.style('padding', `${InvalidDataUI.defaults.padding + 4}px`)
			.style('background-color', '#fff')
			.style('border', '1px solid #f5c6cb')
			.style('border-radius', `${InvalidDataUI.defaults.borderRadius}`)
			.style('box-shadow', 'inset 0 1px 3px rgba(0, 0, 0, 0.1)')

		const tableContainer = expandableContent
			.append('div')
			.style('max-height', '300px')
			.style('overflow-y', 'auto')
			.style('border', `1px solid ${InvalidDataUI.defaults.borderColor}`)
			.style('border-radius', InvalidDataUI.defaults.borderRadius)

		renderTable({
			div: tableContainer,
			columns: [
				{ label: 'Data Type', sortable: true },
				{ label: 'Reason', sortable: true }
			],
			rows: invalidInfo.entries.map(e => [{ value: e.dataType }, { value: e.reason }]),
			showLines: true,
			striped: true,
			showHeader: true,
			maxHeight: '280px',
			resize: false,
			header: {
				allowSort: true,
				style: {
					'background-color': InvalidDataUI.defaults.backgroundColor,
					'font-weight': 'bold',
					'border-bottom': `2px solid ${InvalidDataUI.defaults.borderColor}`
				}
			}
		})

		expandableContent
			.append('div')
			.style('margin-top', InvalidDataUI.defaults.margin)
			.style('padding', `${InvalidDataUI.defaults.padding}px`)
			.style('background-color', InvalidDataUI.defaults.backgroundColor)
			.style('border-radius', InvalidDataUI.defaults.borderRadius)
			.style('font-size', `${InvalidDataUI.defaults.fontSize}px`)
			.style('color', '#495057')
			.style('line-height', '1.4')
			.text('Entries listed above were skipped due to invalid or unsupported chromosome information.')

		let isExpanded = false
		expandableHeader.on('click', function () {
			isExpanded = !isExpanded
			if (isExpanded) {
				expandableContent.style('display', 'block')
				expandIcon.style('transform', 'rotate(90deg)').text('▼')
			} else {
				expandableContent.style('display', 'none')
				expandIcon.style('transform', 'rotate(0deg)').text('▶')
			}
		})
	}
}
