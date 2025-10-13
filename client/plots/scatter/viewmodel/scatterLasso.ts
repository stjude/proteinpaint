import { getSamplelstTW, getFilter, addNewGroup } from '../../../mass/groups.js'
import { getId } from '#mass/nav'
import { renderTable } from '../../../dom/table.ts'
import type { Scatter } from '../scatter.js'
import type { TableCell, TableColumn, TableRow } from '#dom'
export class ScatterLasso {
	scatter: Scatter
	model: any
	view: any
	interactivity: any
	selectedItems!: any[]

	constructor(scatter: Scatter) {
		this.scatter = scatter
		this.model = scatter.model
		this.view = scatter.view
		this.interactivity = scatter.interactivity
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
		this.view.dom.tip.show(event.clientX, event.clientY)

		const menuDiv = this.view.dom.tip.d.append('div')
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(`List ${samples.length} samples`)
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
				this.createGroup(samples)
				this.view.dom.tip.hide()
			})
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Add to a group and filter')
			.on('click', () => {
				const tw = this.createGroup(samples)
				this.interactivity.addToFilter(tw)
				this.view.dom.tip.hide()
			})
		if ('sample' in samples[0])
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

	getCategoryInfo(d, category) {
		if (!(category in d)) return ''
		return d[category]
	}

	showTable(group, x, y, addGroup) {
		const rows: TableRow[] = []
		const columns: TableColumn[] = []
		const first = group.items[0]
		if ('sample' in first) columns.push(formatCell('Sample', 'label'))
		if (this.scatter.config.term) columns.push(formatCell(this.scatter.config.colorTW.term.name, 'label'))
		if (this.scatter.config.term2) columns.push(formatCell(this.scatter.config.term2.term.name, 'label'))
		if (this.scatter.config.colorTW) columns.push(formatCell(this.scatter.config.colorTW.term.name, 'label'))
		if (this.scatter.config.shapeTW) columns.push(formatCell(this.scatter.config.shapeTW.term.name, 'label'))
		let info = false
		const hasSampleName = 'sample' in group.items[0]

		for (const item of group.items) {
			const row: TableCell[] = []
			if (hasSampleName) row.push(formatCell(item.sample))
			if (this.scatter.config.term) row.push(formatCell(this.getCategoryInfo(item, 'x')))
			if (this.scatter.config.term2) row.push(formatCell(this.getCategoryInfo(item, 'y')))
			if (this.scatter.config.colorTW) row.push(formatCell(this.getCategoryInfo(item, 'category')))
			if (this.scatter.config.shapeTW) row.push(formatCell(this.getCategoryInfo(item, 'shape')))
			if ('info' in item) {
				info = true
				const values: any = []
				for (const [k, v] of Object.entries(item.info)) values.push(`${k}: ${v}`)
				row.push(formatCell(values.join(', ')))
			}
			rows.push(row)
		}
		if (info) columns.push(formatCell('Info', 'label'))

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
		const buttons: any[] = []
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
			buttons.push(addGroupCallback)
		}

		const columnButton = {
			text: 'View',
			callback: async (event, i) => {
				const sample = group.items[i]
				this.interactivity.openSampleView(sample)
			}
		}
		const columnButtons: any[] = hasSampleName ? [columnButton] : []
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

		function formatCell(column: string, name = 'value'): any {
			const dict = {}
			dict[name] = column
			return dict
		}
	}
}
