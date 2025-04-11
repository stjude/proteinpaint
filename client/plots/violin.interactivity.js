import { filterJoin, getFilterItemByTag } from '#filter'
import { renderTable, niceNumLabels } from '#dom'
import { to_svg } from '#src/client'
import { roundValueAuto } from '#shared/roundValue.js'
import { rgb } from 'd3'
import { TermTypes } from '#shared/terms.js'
import { ListSamples } from './boxplot/interactions/ListSamples'

export function setInteractivity(self) {
	self.download = () => {
		if (!self.state) return

		// has to be able to handle multichart view
		// const mainGs = []
		// const translate = { x: undefined, y: undefined }
		// const titles = []
		// let maxw = 0,
		// 	maxh = 0,
		// 	tboxh = 0
		// let prevY = 0,
		// 	numChartsPerRow = 0

		self.dom.violinDiv.selectAll('.sjpp-violin-plot').each(function () {
			to_svg(this, self.state.config.downloadFilename || 'violin', { apply_dom_styles: true })
		})
	}

	self.displayLabelClickMenu = function (t1, t2, plot, event) {
		if (!t2 || self.data.plots.length === 1) return // when no term 2 and just one violin, do not show options on the sole violin label
		if (self.config.term.term.type == TermTypes.SINGLECELL_GENE_EXPRESSION) return // is sc gene exp data, none of the options below work, thus disable

		const label = t1.q.mode === 'continuous' ? 'term2' : 'term'
		const options = [
			{
				label: `Add filter: ${plot.label.split(',')[0]}`,
				callback: getAddFilterCallback(t1, t2, self, plot, label, false)
			},
			{
				label: `Hide: ${plot.label}`,
				callback: () => {
					const term = self.config[label]

					const isHidden = true

					self.app.dispatch({
						type: 'plot_edit',
						id: self.id,
						config: {
							[label]: {
								isAtomic: true,
								term: term.term,
								q: getUpdatedQfromClick(plot, term, isHidden)
							}
						}
					})
				}
			}
		]
		if (self.state.displaySampleIds && self.state.hasVerifiedToken) {
			options.push({
				label: `List samples`,
				callback: async () => {
					const [start, end] = [self.data.min, self.data.max * 2]
					await self.listSamples(event, t1, t2, plot, start, end)
				}
			})
		}
		self.displayMenu(event, options, plot)
	}

	self.displayBrushMenu = function (t1, t2, self, plot, selection, scale, isH) {
		const [start, end] = isH
			? [scale.invert(selection[0]), scale.invert(selection[1])]
			: [scale.invert(selection[1]), scale.invert(selection[0])]

		const options = [
			{
				label: `Add filter`,
				callback: getAddFilterCallback(t1, t2, self, plot, start, end, true)
			}
		]

		if (self.state.displaySampleIds && self.state.hasVerifiedToken) {
			options.push({
				label: `List samples`,
				callback: async () => self.listSamples(event, t1, t2, plot, start, end)
			})
		}
		self.displayMenu(event, options, plot, start, end)
		// const brushValues = plot.values.filter(i => i > start && i < end)
	}

	self.displayMenu = function (event, options, plot, start, end) {
		self.app.tip.d.selectAll('*').remove()
		//For testing and debugging
		self.app.tip.d.classed('sjpp-violin-brush-tip', true)

		const isBrush = start != null && end != null

		if (isBrush) {
			const [niceStart, niceEnd] =
				self.config.term.term.type == 'integer' ? [Math.round(start), Math.round(end)] : niceNumLabels([start, end])

			self.app.tip.d.append('div').text(`From ${niceStart} to ${niceEnd}`)
		}

		//show menu options for label clicking and brush selection
		self.app.tip.d
			.append('div')
			.selectAll('div')
			.data(options)
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption')
			.text(d => d.label)
			.on('click', (event, d) => {
				self.app.tip.hide()
				d.callback()
				self.dom.tableHolder.style('display', 'none')
			})
		//Color picker available in the control panel
		// self.addEditColorToMenu(plot)
		self.app.tip.show(event.clientX, event.clientY)
	}

	self.addEditColorToMenu = function (plot) {
		const color = rgb(plot.color).formatHex()
		const input = self.app.tip.d
			.append('div')
			.attr('class', 'sja_sharp_border')
			.style('padding', '0px 10px')
			.text('Color:')
			.append('input')
			.attr('type', 'color')
			.attr('value', color)
			.on('change', () => {
				const newColor = input.node().value
				const term2 = self.config.term2
				let key
				for (const field in term2.term.values)
					if (term2.term.values[field].label == plot.label) {
						term2.term.values[field].color = newColor
						key = field
					}

				if (!key) term2.term.values = { [plot.label]: { label: plot.label, color: newColor } }
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config: {
						term2: {
							isAtomic: true,
							term: self.config.term2.term,
							q: getUpdatedQfromClick(plot, self.config.term2, false)
						}
					}
				})

				self.app.tip.hide()
			})
	}

	self.listSamples = async function (event, t1, t2, plot, start, end) {
		//this is workaround
		//The box plot (where the list sample code is copied from) has a plot.id
		plot.id = self.id
		const sampleList = new ListSamples(self.app, self.state, self.id, plot, false)
		const data = await sampleList.getData()
		self.displaySampleIds(event, term, data)
	}

	self.displaySampleIds = function (event, term, data) {
		self.app.tip.clear()
		if (!data?.samples) return
		const sampleIdArr = []
		for (const [c, k] of Object.entries(data.samples))
			sampleIdArr.push([{ value: data.refs.bySampleId[c].label }, { value: roundValueAuto(k[term.$id].value) }])

		const tableDiv = self.app.tip.d.append('div')
		const columns = [{ label: 'Sample' }, { label: 'Value' }]
		const rows = sampleIdArr

		renderTable({
			rows,
			columns,
			div: tableDiv,
			maxWidth: '30vw',
			maxHeight: '25vh',
			resize: true,
			showLines: true
		})

		self.app.tip.show(event.clientX, event.clientY)
	}

	self.labelHideLegendClicking = function (t2, plot) {
		self.dom.legendDiv
			.selectAll('.sjpp-htmlLegend')
			.on('click', event => {
				event.stopPropagation()
				const d = event.target.__data__
				const termNum =
					t2?.term.type === 'condition' ||
					t2?.term.type === 'samplelst' ||
					t2?.term.type === 'categorical' ||
					((t2?.term.type === 'float' || t2?.term.type === 'integer') && self.config.term?.q.mode === 'continuous')
						? 'term2'
						: 'term'
				const term = self.config[termNum]
				if (t2) {
					for (const key of Object.keys(term?.q?.hiddenValues)) {
						if (d.text === key) {
							delete term.q.hiddenValues[key]
						}
					}
					const isHidden = false
					self.app.dispatch({
						type: 'plot_edit',
						id: self.id,
						config: {
							[termNum]: {
								isAtomic: true,
								term: term.term,
								q: getUpdatedQfromClick(plot, term, isHidden)
							}
						}
					})
				}
			})
			.on('mouseover', event => {
				const q = event.target.__data__
				if (q === undefined) return
				if (q.isHidden === true && q.isClickable === true) {
					self.dom.tip.d.html('Click to unhide plot')
					self.dom.tip.show(event.clientX, event.clientY)
				}
			})
			.on('mouseout', function () {
				self.dom.tip.hide()
			})
	}
}

function getAddFilterCallback(t1, t2, self, plot, rangeStart, rangeStop, isBrush) {
	//This is workaround
	//The box plot (where the list sample code is copied from) has a plot.id
	plot.id = self.id
	//get latest state
	const state = self.app.getState()
	const sampleList = new ListSamples(self.app, state, self.id, plot, isBrush)

	return () => {
		const filterUiRoot = getFilterItemByTag(self.state.termfilter.filter, 'filterUiRoot')
		const filter = filterJoin([filterUiRoot, sampleList.tvslst])
		filter.tag = 'filterUiRoot'
		if (!sampleList.tvslst.in) filter.in = sampleList.tvslst.in
		self.app.dispatch({
			type: 'filter_replace',
			filter
		})
	}
}

function getUpdatedQfromClick(plot, term, isHidden = false) {
	const label = plot.label
	const valueId = term?.term?.values ? term?.term?.values?.[label]?.label : label
	const id = !valueId ? label : valueId
	const q = term.q
	if (!q.hiddenValues) q.hiddenValues = {}
	if (isHidden) q.hiddenValues[id] = 1
	else delete q.hiddenValues[id]
	return q
}
