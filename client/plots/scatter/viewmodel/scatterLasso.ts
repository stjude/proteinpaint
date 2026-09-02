import { getSamplelstTW, getFilter, addNewGroup } from '../../../mass/groups.js'
import { getId } from '#mass/nav'
import type { Scatter } from '../scatter'
import { buildSampleTableData } from './scatterSampleTable'
import { renderTable } from '#dom'

export class ScatterLasso {
	scatter: Scatter
	model: any
	view: any
	interactivity: any
	selectedItems!: any[]
	hasSampleView: boolean

	constructor(scatter: Scatter) {
		this.scatter = scatter
		this.model = scatter.model
		this.view = scatter.view
		this.interactivity = scatter.interactivity
		const supportedChartTypes = this.scatter.state.currentCohortChartTypes
		this.hasSampleView = supportedChartTypes && supportedChartTypes.includes('sampleView')
	}

	start(chart) {
		if (this.scatter.config.lassoOn) {
			chart.lasso
				.items()
				.attr('transform', c => this.model.transform(chart, c, 1 / 2))
				.style('fill-opacity', c => (this.model.getOpacity(c) != 0 ? 0.5 : 0))
				.classed('not_possible', true)
				.classed('selected', false)
		}
	}

	draw(chart) {
		if (this.scatter.config.lassoOn) {
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
		if (this.scatter.config.lassoOn) {
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
			const samples = this.selectedItems.map(item => item.__data__)
			this.showLassoMenu(dragEnd.sourceEvent, samples)
		}
	}

	showLassoMenu(event, samples) {
		this.view.dom.tip.clear().hide()
		if (samples.length == 0) return
		// hideSampleId marks cohort dots whose ids were anonymized because the request may not display
		// sample ids. Their surrogate ids cannot resolve to real samples, so listing, grouping, filtering
		// and sample view would all submit nonexistent ids or build empty filters — offer no menu.
		if (samples.some(s => s.hideSampleId)) return
		this.view.dom.tip.show(event.clientX, event.clientY)

		const labels = this.scatter.config.controlLabels
		const menuDiv = this.view.dom.tip.d.append('div')
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(`List ${samples.length} ${labels.samples}`)
			.on('click', event => {
				this.view.dom.tip.hide()
				this.showTable(
					{
						name: 'Group ' + (this.scatter.config.groups.length + 1),
						items: samples
					},
					event.clientX,
					event.clientY,
					this.scatter.app.getState().nav.header_mode === 'with_tabs'
				)
			})

		if (this.scatter.app.getState().nav.header_mode === 'with_tabs')
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Add to a group')
				.on('click', async () => {
					this.createGroup(samples)
					this.view.dom.tip.hide()
				})

		if (this.scatter.app.getState().nav.header_mode === 'with_tabs')
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Add to a group and filter')
				.on('click', () => {
					const tw = this.createGroup(samples)
					this.interactivity.addToFilter(tw)
					this.view.dom.tip.hide()
				})

		if ('sample' in samples[0] && this.hasSampleView)
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Open sample view')
				.on('click', async () => {
					const groupSamples: any[] = []
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

	createGroup(samples) {
		const group = {
			name: 'Group',
			items: samples
		}
		const tw = getSamplelstTW([group])
		const filter = getFilter(tw)
		addNewGroup(this.scatter.app, filter, this.scatter.state.groups)
		return tw
	}

	lassoReset(chart) {
		const mainG = chart.mainG

		if (this.scatter.config.lassoOn) {
			chart.lasso
				.items(mainG.select('.sjpcb-scatter-series').selectAll('path[name="serie"]'))
				.targetArea(mainG)
				.on('start', () => this.start(chart))
				.on('draw', () => this.draw(chart))
				.on('end', event => this.end(event, chart))
			// this seems to clear stale lasso data as sometimes seen
			// when the global filter is changed between lassoing
			// uncertain explanation: the svg and mainG is potentially different between rerenders,
			// so the previous mainG.call(chart.lasso) inside toggle_lasso is on a removed mainG????
			mainG.on('.zoom', null)
			mainG.on('mousedown.drag', null)
			mainG.call(chart.lasso)
		} else {
			chart.mainG.on('.dragstart', null)
			chart.mainG.on('.drag', null)
			chart.mainG.on('.dragend', null)
		}
	}

	showTable(group, x, y, addGroup) {
		// same samples and same columns as the hover/click table, so both come from one builder.
		// this also picks up value formatting (geneVariant mname, dates, rounding) that the
		// hand-rolled version here did not do, and pads the Info cell on rows that have none —
		// previously those rows came out one cell short and shifted under the header
		const { columns, rows } = buildSampleTableData(this.scatter.config, this.scatter.settings.itemLabel, group.items)
		const hasSampleName = 'sample' in group.items[0]

		this.view.dom.tip.clear()
		const div = this.view.dom.tip.d.append('div').style('padding', '5px')
		const headerDiv = div.append('div').style('margin-top', '5px')

		const groupDiv = headerDiv
			.append('div')
			.html('&nbsp;' + group.name)
			.style('font-size', '0.9rem')
			.on('click', () => {
				const isEdit = groupDiv.select('input').empty()
				if (!isEdit) return
				groupDiv.html('')
				const input = groupDiv
					.append('input')
					.attr('value', group.name)
					.on('change', async () => {
						const name = input.node().value
						if (name) group.name = name
						else input.node().value = group.name
						groupDiv.html('&nbsp;' + group.name)
					})
				input.node().focus()
				input.node().select()
			})
		const tableDiv = div.append('div')
		let buttons
		if (addGroup) {
			const addGroupCallback = {
				text: 'Add to a group',
				callback: indexes => {
					const items: any[] = []
					for (const i of indexes) items.push(this.selectedItems[i].__data__)
					const group = {
						name: `Group ${this.scatter.config.groups.length + 1}`,
						items,
						index: this.scatter.config.groups.length
					}
					const filter = getFilter(getSamplelstTW([group]))
					addNewGroup(this.scatter.app, filter, this.scatter.state.groups)
				}
			}
			buttons = [addGroupCallback]
		}

		const columnButton = {
			text: 'View',
			callback: async (event, i) => {
				const sample = group.items[i]
				this.interactivity.openSampleView(sample)
			}
		}
		const columnButtons: any[] = hasSampleName && this.hasSampleView ? [columnButton] : []
		renderTable({
			rows,
			columns,
			div: tableDiv,
			showLines: true,
			//maxWidth: columns.length * '15' + 'vw',
			maxHeight: '35vh',
			buttons,
			selectAll: true,
			columnButtons
		})

		this.view.dom.tip.show(x, y, false, false)
	}
}
