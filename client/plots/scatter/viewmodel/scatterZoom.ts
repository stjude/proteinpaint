import { zoom as d3zoom, zoomIdentity } from 'd3-zoom'
import { icons as icon_functions } from '#dom'
import type { Scatter } from '../scatter.js'
export class ScatterZoom {
	scatter: Scatter
	zoomD3: any

	constructor(scatter: Scatter) {
		this.scatter = scatter
		this.zoomD3 = d3zoom()
			.scaleExtent([0.1, 10])
			.on('zoom', event => this.handleZoom(event))
			.filter(event => {
				if (event.type === 'wheel') return event.ctrlKey
				return true
			})
	}

	initZoom(toolsDiv) {
		this.zoomD3.scaleExtent([0.1, this.scatter.config.scaleDotTW ? 4 : 10])

		toolsDiv.selectAll('*').remove()
		const display = 'block'
		const resetDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '15px 10px')
			.attr('name', 'sjpp-reset-btn') //For unit tests
		icon_functions['restart'](resetDiv, { handler: () => this.resetToIdentity(), title: 'Reset plot to defaults' })

		const zoomInDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '15px 10px')
			.attr('name', 'sjpp-zoom-in-btn') //For unit tests
		icon_functions['zoomIn'](zoomInDiv, {
			handler: () => this.zoomIn(),
			title: 'Zoom in. You can also zoom in pressing the Ctrl key and using the mouse wheel'
		})
		const zoomOutDiv = toolsDiv
			.insert('div')
			.style('display', display)
			.style('margin', '15px 10px')
			.attr('name', 'sjpp-zoom-out-btn') //For unit tests
		icon_functions['zoomOut'](zoomOutDiv, {
			handler: () => this.zoomOut(),
			title: 'Zoom out. You can also zoom out pressing the Ctrl key and using the mouse wheel'
		})
		const mainG = this.scatter.model.charts[0].mainG

		if (this.scatter.config.scaleDotTW && this.zoom > 4) this.resetToIdentity()
		mainG.call(this.zoomD3)
	}

	handleZoom(event) {
		for (const chart of this.scatter.model.charts) {
			// create new scale ojects based on event
			const new_xScale = event.transform.rescaleX(chart.xAxisScale)
			const new_yScale = event.transform.rescaleY(chart.yAxisScale)

			chart.xAxis.call(chart.axisBottom.scale(new_xScale))
			chart.yAxis.call(chart.axisLeft.scale(new_yScale))
			chart.serie.attr('transform', event.transform)
			const zoom = event.transform.scale(1).k
			//on zoom in the particle size is kept
			const symbols = chart.serie.selectAll('path[name="serie"')
			symbols.attr('transform', c => this.scatter.model.transform(chart, c, 1))
			if (this.scatter.config.lassoOn)
				chart.lasso.selectedItems().attr('transform', c => this.scatter.model.transform(chart, c, 1.2))
			if (this.scatter.config.scaleDotTW) this.scatter.vm.legendvm.drawScaleDotLegend(chart)
			this.scatter.app.dispatch({
				type: 'plot_edit',
				id: this.scatter.id,
				config: {
					zoom
				}
			})
		}
	}

	updateZoom(zoom) {
		this.scatter.app.dispatch({
			type: 'plot_edit',
			id: this.scatter.id,
			config: {
				zoom
			}
		})
	}

	zoomIn() {
		for (const chart of this.scatter.model.charts) {
			if (this.scatter.model.is2DLarge) this.updateZoom(this.scatter.state.config.zoom + 0.15)
			else this.zoomD3.scaleBy(chart.mainG.transition().duration(500), 1.2)
		}
	}

	zoomOut() {
		for (const chart of this.scatter.model.charts)
			if (this.scatter.model.is2DLarge) this.updateZoom(this.scatter.state.config.zoom - 0.15)
			else this.zoomD3.scaleBy(chart.mainG.transition().duration(500), 0.8)
	}

	resetToIdentity() {
		for (const chart of this.scatter.model.charts)
			if (this.scatter.model.is2DLarge) this.updateZoom(1)
			else chart.mainG.transition().duration(500).call(this.zoomD3.transform, zoomIdentity)
	}
}
