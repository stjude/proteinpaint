import { filterJoin, getFilterItemByTag } from '#filter'
import { DownloadMenu, niceNumLabels, ListSamples, renderTable } from '#dom'
import { TermTypes } from '#shared/terms.js'

export function setInteractivity(self) {
	self.getChartImages = function () {
		const charts = []

		for (const [key, chart] of Object.entries(self.data.charts)) {
			const title = self.getChartTitle(chart.chartId)
			const name = `${self.config.term.term.name}  ${title}`
			const chartDiv = chart.chartDiv
			charts.push({ name, svg: chartDiv.select('svg') })
		}
		return charts
	}

	self.download = function (event) {
		if (!self.state) return
		const name2svg = self.getChartImages()
		const dm = new DownloadMenu(name2svg, self.config.term.term.name)
		dm.show(event.clientX, event.clientY, event.target)
	}

	self.displayLabelClickMenu = function (t1, t2, plot, event) {
		if (!t2) return // when no term 2 do not show options on the sole violin label
		if (self.config.term.term.type == TermTypes.SINGLECELL_GENE_EXPRESSION) return // is sc gene exp data, none of the options below work, thus disable

		const label = t1.q.mode === 'continuous' ? 'term2' : 'term'
		const options = [
			{
				label: `Add filter: ${plot.label.split(',')[0]}`,
				testid: 'sjpp-violinLabOpt-addf',
				callback: getAddFilterCallback(self, plot)
			},
			{
				label: `Hide: ${plot.label}`,
				testid: 'sjpp-violinLabOpt-hide',
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
				testid: 'sjpp-violinLabOpt-list',
				callback: async () => {
					/** self.data.max * 2 appears to be a workaround for a
					 * previous bug in the list samples logic. Since that logic
					 * has been refined, this appears to be no longer necessary.
					 * Commenting out for now, but leaving in place in case.*/
					// const [start, end] = [self.data.min, self.data.max * 2]
					const [start, end] = [self.data.min, self.data.max]
					await self.callListSamples(event, plot, start, end)
				}
			})
		}
		self.displayMenu(event, options)
	}

	self.displayBrushMenu = function (t1, t2, self, plot, event, scale, isH) {
		const selection = event.selection
		const [start, end] = isH
			? [scale.invert(selection[0]), scale.invert(selection[1])]
			: [scale.invert(selection[1]), scale.invert(selection[0])]

		const options = [
			{
				label: `Add filter`,
				testid: 'sjpp-violinBrushOpt-addf',
				callback: getAddFilterCallback(self, plot, start, end)
			}
		]

		if (self.state.displaySampleIds && self.state.hasVerifiedToken) {
			options.push({
				label: `List samples`,
				testid: 'sjpp-violinBrushOpt-list',
				callback: async () => self.callListSamples(event.sourceEvent, plot, start, end)
			})
		}
		self.displayMenu(event.sourceEvent, options, start, end)
	}

	self.displayMenu = function (event, options, start, end) {
		const tip = self.dom.clicktip.clear().show(event.clientX, event.clientY)

		const isBrush = start != null && end != null

		if (isBrush) {
			const [niceStart, niceEnd] =
				self.config.term.term.type == 'integer' ? [Math.round(start), Math.round(end)] : niceNumLabels([start, end])

			tip.d.append('div').style('margin', '10px').text(`From ${niceStart} to ${niceEnd}`)
		}
		//show menu options for label clicking and brush selection
		tip.d
			.append('div')
			.selectAll('div')
			.data(options)
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.attr('data-testid', d => d.testid)
			.text(d => d.label)
			.on('click', async (event, d) => {
				if (event.target._clicked) return
				event.target._clicked = true
				event.target.textContent = 'Loading...'
				await d.callback()
				tip.hide()
			})
	}

	//get sample list for menu option callbacks
	self.getSampleList = function (plot, start, end) {
		const configCopy = self.config
		const bins = self.data.bins

		const rangeStart = start !== undefined ? start : null
		const rangeStop = end !== undefined ? end : null

		const ls = new ListSamples({
			app: self.app,
			termfilter: self.state.termfilter,
			config: configCopy,
			plot,
			bins,
			start: rangeStart,
			end: rangeStop
		})
		return ls
	}

	self.callListSamples = async function (event, plot, start, end) {
		const ls = self.getSampleList(plot, start, end)
		const data = await ls.getData()
		const [rows, columns] = ls.setTableData(data)

		const tip = self.dom.sampletabletip
		tip.clear().show(event.clientX, event.clientY, false)

		renderTable({
			rows,
			columns,
			div: tip.d,
			showLines: true,
			maxHeight: '40vh',
			resize: true,
			dataTestId: 'sjpp-listsampletable'
		})
	}

	self.labelHideLegendClicking = function (t2, plot) {
		// whoever wrote this tangled mess needs to be fired
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
					self.dom.hovertip.clear().show(event.clientX, event.clientY).d.append('span').text('Click to unhide plot')
				}
			})
			.on('mouseout', function () {
				self.dom.hovertip.hide()
			})
	}
}

function getAddFilterCallback(self, plot, rangeStart, rangeStop) {
	const ls = self.getSampleList(plot, rangeStart, rangeStop)

	return () => {
		const filterUiRoot = getFilterItemByTag(self.state.termfilter.filter, 'filterUiRoot')
		const filter = filterJoin([filterUiRoot, ls.tvslst])
		filter.tag = 'filterUiRoot'
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
