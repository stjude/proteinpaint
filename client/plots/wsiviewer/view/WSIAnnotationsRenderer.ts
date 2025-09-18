import { renderTable } from '#dom'
import type { WSIViewerInteractions } from '../interactions/WSIViewerInteractions'
import type OLMap from 'ol/Map.js'
import type { Extent } from 'ol/extent'
import type { ImageViewData } from '#plots/wsiviewer/viewModel/ImageViewData.ts'

export class WSIAnnotationsRenderer {
	buffers: any
	interactions: WSIViewerInteractions

	constructor(buffers: any, wsiinteractions: WSIViewerInteractions) {
		this.buffers = buffers
		this.interactions = wsiinteractions
	}

	render(holder: any, imageViewData: ImageViewData, activeImageExtent: Extent, map: OLMap) {
		holder.select('div[id="annotations-table-wrapper"]').remove()

		const tablesWrapper = holder
			.append('div')
			.attr('id', 'annotations-table-wrapper')
			.style('display', 'inline-block')
			.style('padding', '20px')

		if (!imageViewData.tilesTable) return
		const selectedColor = '#fcfc8b'

		renderTable({
			columns: imageViewData.tilesTable.columns,
			rows: imageViewData.tilesTable.rows,
			div: tablesWrapper
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
					const rows = imageViewData.tilesTable?.rows
					if (!rows || !Number.isInteger(index) || index < 0 || index >= rows.length) {
						// Table not ready or index no longer valid (e.g., after delete)
						return
					}
					const coords = [imageViewData.tilesTable?.rows[index][1].value] as unknown as [number, number][]

					if (!coords || coords.length === 0) return

					this.interactions.zoomInEffectListener(activeImageExtent, coords, map, imageViewData.activePatchColor!)
				})

				tr.style('outline', 'none') //Remove the default outline on click

				this.buffers.tmpClass.addListener((tmpClass: { label: string; color: string }) => {
					if (this.buffers.annotationsIdx.get() === rowIdx) {
						const spanHtml = `<span style="display:inline-block;width:12px;height:18px;background-color:${tmpClass.color};border:grey 1px solid;"></span>`

						/** Need to update the data source. Otherwise user changes
						 * disappear on sort. */
						imageViewData.tilesTable!.rows[rowIdx][4].html = spanHtml
						imageViewData.tilesTable!.rows[rowIdx][5].value = tmpClass.label

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
				})
			}
		})
	}
}
