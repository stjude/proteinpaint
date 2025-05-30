import { renderTable } from '#dom'
import type { ViewData } from '../viewModel/ViewModel'
import type { Elem, Div } from '../../../types/d3'
import type { WSIViewerInteractions } from '../interactions/WSIViewerInteractions'

export class WSImageRenderer {
	holder: Elem
	viewData: ViewData
	tablesWrapper: Div
	buffers: any
	interactions: WSIViewerInteractions

	constructor(holder: Elem, viewData: ViewData, buffers: any, wsiinteractions: any, activeImageExtent, map) {
		this.holder = holder
		this.viewData = viewData
		this.buffers = buffers
		this.interactions = wsiinteractions

		this.holder.select('div[id="annotations-table-wrapper"]').remove()
		this.tablesWrapper = this.holder
			.append('div')
			.attr('id', 'annotations-table-wrapper')
			.style('display', 'block')
			.style('padding', '20px')

		this.renderAnnotationsTable(activeImageExtent, map)
		this.renderClassesTable()
	}

	renderAnnotationsTable(activeImageExtent, map) {
		if (!this.viewData.annotations) return

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
				const origColor = tr.style('background-color')
				this.buffers.annotationsIdx.addListener((index: number) => {
					if (index === row[0].value) {
						tr.style('background-color', '#fcfcca')
					} else {
						tr.style('background-color', origColor)
					}
				})
				tr.on('click', () => {
					this.buffers.annotationsIdx.set(row[0].value)
					const coords = [this.viewData.annotations!.rows[row[0].value!][1].value] as [number, number][]
					this.interactions.addZoomInEffect(activeImageExtent, coords, map)
					map.getTargetElement().focus()
				})
			}
		})
	}

	renderClassesTable() {
		if (!this.viewData.classes) return

		renderTable({
			columns: this.viewData.classes.columns,
			rows: this.viewData.classes.rows,
			div: this.tablesWrapper
				.append('div')
				.attr('id', 'annotations-legend')
				.style('display', 'inline-block')
				.style('vertical-align', 'top')
				.style('margin-left', '20px'),
			showLines: false
		})
	}
}
