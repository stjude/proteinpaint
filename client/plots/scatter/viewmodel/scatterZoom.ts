import { zoom as d3zoom } from 'd3-zoom'
import { icons as icon_functions } from '#dom'
import type { Scatter } from '../scatter.js'
export class ScatterZoom {
	scatter: Scatter
	zoomD3: any
	dragD3: any

	constructor(scatter: Scatter) {
		this.scatter = scatter
		this.zoomD3 = d3zoom()
			.scaleExtent([0.1, 10])
			.on('zoom', event => this.handleZoom(event))
			.filter(event => {
				if (event.type === 'wheel') return event.ctrlKey
				return true
			})
			.on('end', () => {
				this.scatter.app.dispatch({
					type: 'plot_edit',
					id: this.scatter.id,
					config: this.scatter.config
				})
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
		for (const chart of this.scatter.model.charts) {
			chart.mainG.call(this.zoomD3)
		}

		if (this.scatter.config.scaleDotTW && this.scatter.model.getZoom() > 4) this.resetToIdentity()
	}

	handleZoom(event) {
		this.scatter.config.zoom = event.transform.scale(1).k
		this.scatter.config.transform = event.transform.toString()
		for (const chart of this.scatter.model.charts) {
			// create new scale ojects based on event
			const new_xScale = event.transform.rescaleX(chart.xAxisScale)
			const new_yScale = event.transform.rescaleY(chart.yAxisScale)
			chart.serie.attr('transform', event.transform)
			chart.xAxis.call(chart.axisBottom.scale(new_xScale))
			chart.yAxis.call(chart.axisLeft.scale(new_yScale))
			if (this.scatter.config.lassoOn)
				chart.lasso.selectedItems().attr('transform', c => this.scatter.model.transform(chart, c, 1.2))
			if (this.scatter.config.scaleDotTW) this.scatter.vm.legendvm.drawScaleDotLegend(chart)
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
		this.updateZoom(this.scatter.model.getZoom() + 0.25)
	}

	zoomOut() {
		this.updateZoom(this.scatter.model.getZoom() - 0.25)
	}

	resetToIdentity() {
		this.updateZoom(1)
	}
}
