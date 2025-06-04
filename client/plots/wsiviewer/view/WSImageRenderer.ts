import { renderTable, getMaxLabelWidth, ColorScale } from '#dom'
import type { ViewData } from '../viewModel/ViewModel'
import type { Elem, Div } from '../../../types/d3'
import type { WSIViewerInteractions } from '../interactions/WSIViewerInteractions'

export class WSImageRenderer {
	holder: Elem
	viewData: ViewData
	tablesWrapper: Div
	buffers: any
	interactions: WSIViewerInteractions
	legend: Div

	constructor(
		holder: Elem,
		viewData: ViewData,
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
		this.renderUncertainityLegend()
	}

	renderAnnotationsTable(activeImageExtent, map) {
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
				tr.style('cursor', 'pointer')
				const origColor = tr.style('background-color')
				this.buffers.annotationsIdx.addListener((index: number) => {
					if (index === row[0].value) {
						tr.style('background-color', selectedColor)
					} else {
						tr.style('background-color', origColor)
					}
				})
				tr.on('click', () => {
					tr.style('background-color', selectedColor)
					this.buffers.annotationsIdx.set(row[0].value)
					const coords = [this.viewData.annotations!.rows[row[0].value!][1].value] as [number, number][]
					this.interactions.addZoomInEffect(activeImageExtent, coords, map)
					// map.getTargetElement().setAttribute('tabindex', '-1')
					// map.getTargetElement().focus()
				})
			}
		})
	}

	renderClassesTable() {
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

	renderUncertainityLegend() {
		//Hardcoded for prototyping
		//defined in ds file. Waiting to alter route code
		const uncertainty = [
			{ color: '#fde725', label: 'low' },
			{ color: '#440154', label: 'high' }
		]

		const svgHolder = this.legend.append('div').attr('id', 'uncertainty-legend').style('margin-top', '20px')
		const width = 300
		const height = 50
		const svg = svgHolder.append('svg').style('width', width).style('height', height)
		const title = 'Uncertainty'
		const titleLth = getMaxLabelWidth(svg as any, [title], 1)
		svg
			.append('text')
			.attr('x', (width - titleLth) / 2) //Center the title
			.attr('y', 15)
			.text(title)

		new ColorScale({
			holder: svg,
			domain: [0, 1],
			colors: uncertainty.map(u => u.color),
			position: '0, 25',
			ticks: 2,
			barwidth: width
		})
	}
}
