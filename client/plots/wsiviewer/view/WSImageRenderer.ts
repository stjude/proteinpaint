import { renderTable, getMaxLabelWidth, ColorScale, table2col } from '#dom'
import type { Elem, Div } from '../../../types/d3'
import type { WSIViewerInteractions } from '../interactions/WSIViewerInteractions'
import type OLMap from 'ol/Map.js'
import type { ImageViewData } from '../viewModel/ViewModel'
import type { Extent } from 'ol/extent'

export class WSImageRenderer {
	holder: Elem
	imageViewData: ImageViewData
	tablesWrapper: Div
	buffers: any
	interactions: WSIViewerInteractions
	legend: Div

	constructor(
		holder: Elem,
		imageViewData: ImageViewData,
		buffers: any,
		wsiinteractions: WSIViewerInteractions,
		activeImageExtent: Extent,
		map: OLMap
	) {
		this.holder = holder
		this.imageViewData = imageViewData
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

	private renderAnnotationsTable(activeImageExtent, map: OLMap) {
		if (!this.imageViewData.annotations) return
		const selectedColor = '#fcfc8b'

		renderTable({
			columns: this.imageViewData.annotations.columns,
			rows: this.imageViewData.annotations.rows,
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

				tr.style('outline', 'none') //Remove the default outline on click

				this.buffers.tmpClass.addListener((tmpClass: { label: string; color: string }) => {
					if (this.buffers.annotationsIdx.get() === rowIdx) {
						const spanHtml = `<span style="display:inline-block;width:12px;height:18px;background-color:${tmpClass.color};border:grey 1px solid;"></span>`

						/** Need to update the data source. Otherwise user changes
						 * disappear on sort. */
						this.imageViewData.annotations!.rows[rowIdx][4].html = spanHtml
						this.imageViewData.annotations!.rows[rowIdx][5].value = tmpClass.label

						const predictedClassTd = tr.select('td:nth-child(4)')
						const colorTd = tr.select('td:nth-child(5)')
						const annotationTd = tr.select('td:nth-child(6)')

						if (tmpClass.label != 'Confirmed') {
							predictedClassTd.style('text-decoration', 'line-through').style('color', 'grey')
						} else {
							predictedClassTd.style('text-decoration', 'none').style('color', 'black')
						}
						colorTd.select('span').remove()
						colorTd.html(spanHtml)
						//Padding overrides the default padding
						annotationTd.style('padding', '0px').text(tmpClass.label)
					}
				})

				tr.on('click', () => {
					this.buffers.annotationsIdx.set(rowIdx)
					const coords = [this.imageViewData.annotations!.rows[rowIdx][1].value] as unknown as [number, number][]
					this.interactions.addZoomInEffect(activeImageExtent, coords, map)
				})
			}
		})
	}

	private renderClassesTable() {
		if (!this.imageViewData.classes) return

		renderTable({
			columns: this.imageViewData.classes.columns,
			rows: this.imageViewData.classes.rows,
			div: this.legend
				.append('div')
				.attr('id', 'annotations-legend')
				.style('display', 'inline-block')
				.style('vertical-align', 'top'),
			showLines: false
		})
	}

	private renderUncertaintyLegend() {
		if (!this.imageViewData.uncertainty) return

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
			colors: this.imageViewData.uncertainty.map(u => u.color),
			position: '25, 25',
			ticks: 2,
			barwidth: width,
			labels: {
				left: this.imageViewData.uncertainty[0].label,
				right: this.imageViewData.uncertainty[this.imageViewData.uncertainty.length - 1].label
			}
		})
	}

	//TODO: Need an example for testing
	private renderMetadata() {
		if (!this.imageViewData.metadata) return
		const holderDiv = this.holder.append('div').attr('id', 'metadata')

		const table = table2col({ holder: holderDiv })

		// Create table rows for each key-value pair
		Object.entries(JSON.parse(this.imageViewData.metadata)).forEach(([key, value]) => {
			const [c1, c2] = table.addRow()
			c1.html(key)
			c2.html(value)
		})
	}
}
