import { renderTable } from '#dom'
import type { WSIViewerInteractions } from '../interactions/WSIViewerInteractions'
import type { ImageViewData } from '#plots/wsiviewer/viewModel/ImageViewData.ts'
import type Settings from '#plots/wsiviewer/Settings.ts'

export class WSIAnnotationsRenderer {
	settings: Settings
	interactions: WSIViewerInteractions
	wsiApp: any

	constructor(wsiApp: any, settings: Settings, wsiinteractions: WSIViewerInteractions) {
		this.wsiApp = wsiApp
		this.settings = settings
		this.interactions = wsiinteractions
	}

	render(holder: any, imageViewData: ImageViewData) {
		holder.select('div[id="annotations-table"]').remove()
		if (!imageViewData.tilesTable) return
		const selectedColor = '#fcfc8b'

		renderTable({
			columns: imageViewData.tilesTable.columns,
			rows: imageViewData.tilesTable.rows,
			div: holder
				.append('div')
				.attr('id', 'annotations-table')
				.style('margins', '20px')
				.style('display', 'inline-block'),
			header: { allowSort: true },
			showLines: false,
			hoverEffects: (tr, row) => {
				console.log('called')
				const selectedIdx = this.settings.activeAnnotation
				const rowIdx = row[0].value as number
				const isSelected = selectedIdx === rowIdx
				const origColor = tr.style('background-color') || 'transparent'

				tr.style('cursor', 'pointer')
				//Show selected row in yellow on render
				tr.style('background-color', isSelected ? selectedColor : origColor)

				tr.style('outline', 'none') //Remove the default outline on click

				tr.on('click', () => {
					this.wsiApp.app.dispatch({
						type: 'plot_edit',
						id: this.wsiApp.id,
						config: {
							settings: {
								renderWSIViewer: false,
								renderAnnotationTable: true,
								activeAnnotation: rowIdx
							}
						}
					})
				})
			}
		})

		// Ensure the selected row is visible after the table is rendered.
		// Use requestAnimationFrame to run after DOM paint.
		const selectedIdx = this.settings.activeAnnotation
		if (Number.isInteger(selectedIdx)) {
			const tableDiv = holder.select('div#annotations-table')
			if (!tableDiv.empty()) {
				requestAnimationFrame(() => {
					const container = tableDiv.node() as HTMLElement | null
					if (!container) return
					const rows = Array.from(container.querySelectorAll('tr'))
					for (const tr of rows) {
						const firstTd = tr.querySelector('td:first-child')
						if (!firstTd) continue
						const idx = Number.parseInt(firstTd.textContent?.trim() ?? '', 10)
						if (Number.isNaN(idx)) continue
						if (idx === selectedIdx) {
							// scrollIntoView to ensure the selected row is visible
							;(tr as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' })
							break
						}
					}
				})
			}
		}

		return holder
	}
}
