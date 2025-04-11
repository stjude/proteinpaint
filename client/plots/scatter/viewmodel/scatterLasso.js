import { getSamplelstTW, getFilter, addNewGroup } from '../../../mass/groups.js'
import { getId } from '#mass/nav'

export class ScatterLasso {
	constructor(scatter) {
		this.scatter = scatter
		this.model = scatter.model
		this.view = scatter.view
		this.lassoOn = false
		this.interactivity = scatter.interactivity
	}

	start(chart) {
		if (this.lassoOn) {
			chart.lasso
				.items()
				.attr('transform', c => this.model.transform(chart, c, 1 / 2))
				.style('fill-opacity', c => (this.model.getOpacity(c) != 0 ? 0.5 : 0))
				.classed('not_possible', true)
				.classed('selected', false)
		}
	}

	draw(chart) {
		if (this.lassoOn) {
			// Style the possible dots

			chart.lasso
				.possibleItems()
				.attr('transform', c => this.model.transform(chart, c, 1.2))
				.style('fill-opacity', c => this.model.getOpacity(c))
				.classed('not_possible', false)
				.classed('possible', true)

			//Style the not possible dot
			chart.lasso
				.notPossibleItems()
				.attr('transform', c => this.model.transform(chart, c, 1 / 2))
				.style('fill-opacity', c => (this.model.getOpacity(c) != 0 ? 0.5 : 0))
				.classed('not_possible', true)
				.classed('possible', false)
		}
	}

	end(dragEnd, chart) {
		if (this.lassoOn) {
			// Reset classes of all items (.possible and .not_possible are useful
			// only while drawing lasso. At end of drawing, only selectedItems()
			// should be used)
			chart.lasso.items().classed('not_possible', false).classed('possible', false)

			// Style the selected dots
			chart.lasso.selectedItems().attr('transform', c => this.model.transform(chart, c, 1.3))
			chart.lasso.items().style('fill-opacity', c => this.model.getOpacity(c))
			this.selectedItems = []
			for (const item of chart.lasso.selectedItems()) {
				const data = item.__data__
				if ('sampleId' in data && !(data.hidden['category'] || data.hidden['shape'])) this.selectedItems.push(item)
			}
			chart.lasso.notSelectedItems().attr('transform', c => this.model.transform(chart, c))

			this.showLassoMenu(dragEnd.sourceEvent)
		}
	}

	showLassoMenu(event) {
		const samples = this.selectedItems.map(item => item.__data__)
		this.view.dom.tip.clear().hide()
		if (this.selectedItems.length == 0) return
		this.view.dom.tip.show(event.clientX, event.clientY)

		const menuDiv = this.view.dom.tip.d.append('div')
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(`List ${this.selectedItems.length} samples`)
			.on('click', event => {
				this.view.dom.tip.hide()
				this.showTable(
					{
						name: 'Group ' + (this.scatter.config.groups.length + 1),
						items: samples
					},
					event.clientX,
					event.clientY,
					true
				)
			})

		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Add to a group')
			.on('click', async () => {
				const group = {
					name: 'Group',
					items: samples
				}
				const tw = getSamplelstTW([group])
				const filter = getFilter(tw)
				addNewGroup(this.scatter.app, filter, this.scatter.state.groups)
			})
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Add to a group and filter')
			.on('click', () => {
				const group = {
					name: 'Group',
					items: samples
				}
				const tw = getSamplelstTW([group])
				const filter = getFilter(tw)
				addNewGroup(this.scatter.app, filter, this.scatter.state.groups)
				this.interactivity.addToFilter(tw)
			})
		if ('sample' in samples[0])
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Show samples')
				.on('click', async () => {
					const groupSamples = []
					for (const sample of samples) groupSamples.push({ sampleId: sample.sampleId, sampleName: sample.sample })
					this.scatter.app.dispatch({
						type: 'plot_create',
						id: getId(),
						config: {
							chartType: 'sampleView',
							samples: groupSamples
						}
					})
					this.view.dom.tip.hide()
				})
	}

	lassoReset(chart) {
		const mainG = chart.chartDiv.select('.sjpcb-scatter-mainG')

		if (chart.lasso)
			chart.lasso
				.items(mainG.select('.sjpcb-scatter-series').selectAll('path[name="serie"]'))
				.targetArea(mainG)
				.on('start', () => this.start(chart))
				.on('draw', () => this.draw(chart))
				.on('end', event => this.end(event, chart))

		if (this.lassoOn) {
			// this seems to clear stale lasso data as sometimes seen
			// when the global filter is changed between lassoing
			// uncertain explanation: the svg and mainG is potentially different between rerenders,
			// so the previous mainG.call(chart.lasso) inside toggle_lasso is on a removed mainG????
			mainG.on('.zoom', null)
			mainG.on('mousedown.drag', null)
			mainG.call(chart.lasso)
		}
	}
}
