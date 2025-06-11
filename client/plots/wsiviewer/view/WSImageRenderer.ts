import { renderTable, getMaxLabelWidth, ColorScale, table2col } from '#dom'
import type { Elem, Div } from '../../../types/d3'
import type { WSIViewerInteractions } from '../interactions/WSIViewerInteractions'

export class WSImageRenderer {
	holder: Elem
	viewData: any
	tablesWrapper: Div
	buffers: any
	interactions: WSIViewerInteractions
	legend: Div

	constructor(
		holder: Elem,
		viewData: any,
		buffers: any,
		wsiinteractions: WSIViewerInteractions,
		activeImageExtent: any,
		map: any
	) {
		this.holder = holder
		this.viewData = viewData
		this.buffers = buffers
		this.interactions = wsiinteractions

		holder.select('div[id="annotations-table-wrapper"]').remove()
		holder.select('div[id="legend-wrapper"]').remove()
		holder.select('div[id="metadata"]').remove()

		this.tablesWrapper = holder
			.append('div')
			.attr('id', 'annotations-table-wrapper')
			.style('display', 'inline-block')
			.style('padding', '20px')

		this.legend = holder
			.append('div')
			.attr('id', 'legend-wrapper')
			.style('display', 'inline-block')
			.style('padding', '20px')
			.style('vertical-align', 'top')

		this.renderAnnotationsTable(activeImageExtent, map)
		this.renderClassesTable()
		this.renderUncertaintyLegend()
		this.renderMetadata()
	}

	private renderAnnotationsTable(activeImageExtent, map) {
		if (!this.viewData.annotations) return
		const selectedColor = '#fcfc8b'

		renderTable({
			columns: this.viewData.annotations.columns,
			rows: this.viewData.annotations.rows,
			div: this.tablesWrapper
				.append('div')
				.attr('id', 'annotations-table')
				.style('margins', '20px')
				.style('display', 'inline-block'),
			header: { allowSort: true },
			showLines: false,
			hoverEffects: (tr, row) => {
				const selectedIdx = this.buffers.annotationsIdx.get()
				const rowIdx = row[0].value as number
				const isSelected = selectedIdx === rowIdx
				const origColor = tr.style('background-color') || 'transparent'

				tr.style('cursor', 'pointer')
				//Show selected row in yellow on render
				tr.style('background-color', isSelected ? selectedColor : origColor)

				this.buffers.annotationsIdx.addListener((index: number) => {
					tr.style('background-color', index === rowIdx ? selectedColor : origColor)
				})

				tr.on('click', () => {
					this.buffers.annotationsIdx.set(rowIdx)
					const coords = [this.viewData.annotations!.rows[rowIdx][1].value] as [number, number][]
					this.interactions.addZoomInEffect(activeImageExtent, coords, map)
				})
			}
		})
	}

	private renderClassesTable() {
		if (!this.viewData.classes) return

		renderTable({
			columns: this.viewData.classes.columns,
			rows: this.viewData.classes.rows,
			div: this.legend
				.append('div')
				.attr('id', 'annotations-legend')
				.style('display', 'inline-block')
				.style('vertical-align', 'top'),
			showLines: false
		})
	}

	private renderUncertaintyLegend() {
		if (!this.viewData.uncertainty) return

		const svgHolder = this.legend.append('div').attr('id', 'uncertainty-legend').style('margin-top', '20px')
		const width = 200
		const height = 50
		const svg = svgHolder
			.append('svg')
			.style('width', width * 1.5)
			.style('height', height)
		const title = 'Uncertainty'
		const titleLth = getMaxLabelWidth(svg as any, [title], 1)
		svg
			.append('text')
			.attr('x', (width * 1.5 - titleLth) / 2) //Center the title
			.attr('y', 15)
			.text(title)

		new ColorScale({
			holder: svg,
			domain: [0, 1],
			colors: this.viewData.uncertainty.map(u => u.color),
			position: '25, 25',
			ticks: 2,
			barwidth: width,
			labels: {
				left: this.viewData.uncertainty[0].label,
				right: this.viewData.uncertainty[this.viewData.uncertainty.length - 1].label
			}
		})
	}

	//TODO: Need an example for testing
	private renderMetadata() {
		if (!this.viewData.metadata) return
		const holderDiv = this.holder.append('div').attr('id', 'metadata')

		const table = table2col({ holder: holderDiv })

		// Create table rows for each key-value pair
		Object.entries(JSON.parse(this.viewData.metadata)).forEach(([key, value]) => {
			const [c1, c2] = table.addRow()
			c1.html(key)
			c2.html(value)
		})
	}
}
