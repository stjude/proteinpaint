import { filterJoin, getFilterItemByTag } from '#filter'
import { renderTable, niceNumLabels } from '#dom'
import { to_svg } from '#src/client'
import { roundValueAuto } from '#shared/roundValue.js'
import { rgb } from 'd3'
import { TermTypes } from '#shared/terms.js'
import { getSamplelstFilter } from '../mass/groups.js'

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
		const tvslst = self.getTvsLst(t1, t2, plot, start, end)
		const term = t1.q?.mode === 'continuous' ? t1 : t2
		const filter = {
			type: 'tvslst',
			join: 'and',
			lst: [self.state.termfilter.filter, tvslst],
			in: true
		}
		const opts = {
			terms: [term],
			filter,
			filter0: self.state.termfilter.filter0
		}
		//getAnnotatedSampleData is used to retrieve sample id's and values (see matrix.js).
		const data = await self.app.vocabApi.getAnnotatedSampleData(opts)
		self.displaySampleIds(event, term, data)
	}

	self.openSampleView = function (sampleId, sampleName) {
		self.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'sampleView',
				sample: { sampleId, sampleName }
			}
		})
		self.app.tip.hide()
	}

	self.displaySampleIds = function (event, term, data) {
		self.app.tip.clear()
		if (!data?.samples) return
		const sampleIdArr = []
		for (const [c, k] of Object.entries(data.samples)) {
			const sampleName = data.refs.bySampleId[c].label
			sampleIdArr.push([{ value: sampleName }, { value: roundValueAuto(k[term.$id].value) }])
		}

		const columnButton = {
			text: 'View',
			callback: async (event, i) => {
				const sample = data.lst[i]

				const sampleId = sample.sample
				const sampleName = sample._ref_.label
				self.openSampleView(sampleId, sampleName)
			}
		}
		const tableDiv = self.app.tip.d.append('div')
		const columns = [{ label: 'Sample' }, { label: 'Value' }]
		const rows = sampleIdArr

		renderTable({
			rows,
			columns,
			columnButtons: [columnButton],
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

	self.createTvsLstRanges = function (term, tvslst, rangeStart, rangeStop, lstIdx) {
		createTvsTerm(term, tvslst)

		tvslst.lst[lstIdx].tvs.ranges = [
			{
				//Only show integers for integer terms
				start: term.term.type == 'integer' ? Math.round(rangeStart) : rangeStart,
				stop: term.term.type == 'integer' ? Math.round(rangeStop) : rangeStop,
				startinclusive: true,
				stopinclusive: true,
				startunbounded: false,
				stopunbounded: false
			}
		]
	}

	self.getTvsLst = function (t1, t2, plot, rangeStart, rangeStop) {
		const tvslst = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: []
		}

		if (t2) {
			if (t1.term.type === 'categorical' || t1.term.type === 'condition') {
				createTvsLstValues(t1, plot, tvslst, 0)
				self.createTvsLstRanges(t2, tvslst, rangeStart, rangeStop, 1)
			} else if (
				t2.q?.mode === 'continuous' ||
				((t2.term?.type === 'float' || t2.term?.type === 'integer') && plot.divideTwBins != null)
			) {
				createTvsTerm(t2, tvslst)
				tvslst.lst[0].tvs.ranges = [
					{
						start: plot.divideTwBins?.start || null,
						stop: plot.divideTwBins?.stop || null,
						startinclusive: plot.divideTwBins?.startinclusive || true,
						stopinclusive: plot.divideTwBins?.stopinclusive || false,
						startunbounded: plot.divideTwBins?.startunbounded ? plot.divideTwBins?.startunbounded : null,
						stopunbounded: plot.divideTwBins?.stopunbounded ? plot.divideTwBins?.stopunbounded : null
					}
				]
				self.createTvsLstRanges(t1, tvslst, rangeStart, rangeStop, 1)
			} else {
				createTvsLstValues(t2, plot, tvslst, 0)
				self.createTvsLstRanges(t1, tvslst, rangeStart, rangeStop, 1)
			}
		} else self.createTvsLstRanges(t1, tvslst, rangeStart, rangeStop, 0)
		return tvslst
	}
}

function getAddFilterCallback(t1, t2, self, plot, rangeStart, rangeStop, isBrush) {
	const tvslst = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: []
	}

	if (t2) {
		if (t1.term.type === 'categorical' || t1.term.type === 'condition') {
			createTvsLstValues(t1, plot, tvslst, 0)

			if (isBrush) {
				self.createTvsLstRanges(t2, tvslst, rangeStart, rangeStop, 1)
			}
		} else if (
			t2.q?.mode === 'continuous' ||
			((t2.term?.type === 'float' || t2.term?.type === 'integer') && plot.divideTwBins != null)
		) {
			createTvsTerm(t2, tvslst)
			tvslst.lst[0].tvs.ranges = [
				{
					start: plot.divideTwBins?.start || null,
					stop: plot.divideTwBins?.stop || null,
					startinclusive: plot.divideTwBins?.startinclusive || true,
					stopinclusive: plot.divideTwBins?.stopinclusive || false,
					startunbounded: plot.divideTwBins?.startunbounded ? plot.divideTwBins?.startunbounded : null,
					stopunbounded: plot.divideTwBins?.stopunbounded ? plot.divideTwBins?.stopunbounded : null
				}
			]
			if (isBrush) {
				self.createTvsLstRanges(t1, tvslst, rangeStart, rangeStop, 1)
			}
		} else {
			createTvsLstValues(t2, plot, tvslst, 0)
			if (isBrush) {
				self.createTvsLstRanges(t1, tvslst, rangeStart, rangeStop, 1)
			}
		}
	} else {
		if (isBrush) {
			self.createTvsLstRanges(t1, tvslst, rangeStart, rangeStop, 0)
		}
	}

	return () => {
		const filterUiRoot = getFilterItemByTag(self.state.termfilter.filter, 'filterUiRoot')
		const filter = filterJoin([filterUiRoot, tvslst])
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

function createTvsLstValues(term, plot, tvslst, lstIdx) {
	createTvsTerm(term, tvslst)
	tvslst.lst[lstIdx].tvs.values = [
		{
			key: plot.seriesId,
			label: plot.label
		}
	]
	if (term.term.type === 'condition') {
		tvslst.lst[lstIdx].tvs.bar_by_grade = term.q.bar_by_grade
		tvslst.lst[lstIdx].tvs.value_by_max_grade = term.q.value_by_max_grade
	} else if (term.term.type === 'samplelst') {
		const ids = term.term.values[plot.label].list.map(s => s.sampleId)
		const tvs = getSamplelstFilter(ids).lst[0] // tvslst is an array of 1 tvs
		tvslst.lst[lstIdx] = tvs
	}
}

function createTvsTerm(term, tvslst) {
	tvslst.lst.push({
		type: 'tvs',
		tvs: {
			term: term.term
		}
	})
}
