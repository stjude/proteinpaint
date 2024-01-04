import { filterJoin, getFilterItemByTag } from '#filter'
import { renderTable } from '#dom/table'
import { to_svg } from '#src/client'
import roundValue from '../../server/shared/roundValue'

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
			to_svg(this, 'violin', { apply_dom_styles: true })
		})
	}

	self.displayLabelClickMenu = function (t1, t2, plot, event) {
		self.displayLabelClickMenu.called = true

		if (!t2 || self.data.plots.length === 1) {
			return
		}

		const label = t1.q.mode === 'continuous' ? 'term2' : 'term'
		const options = [
			{
				label: `Add filter: ${plot.label.split(',')[0]}`,
				callback: getAddFilterCallback(t1, t2, self, plot, label)
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
								id: term.id,
								term: term.term,
								q: getUpdatedQfromClick(plot, term, isHidden)
							}
						}
					})
				}
			}
		]

		if (self.config.settings.violin.displaySampleIds && self.state.hasVerifiedToken) {
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
		self.displayBrushMenu.called = true
		const [start, end] = isH
			? [scale.invert(selection[0]), scale.invert(selection[1])]
			: [scale.invert(selection[1]), scale.invert(selection[0])]

		const options = [
			{
				label: `Add filter: ${start.toFixed(1)} < x < ${end.toFixed(1)}`,
				callback: getAddFilterCallback(t1, t2, self, plot, start, end)
			}
		]

		if (self.config.settings.violin.displaySampleIds && self.state.hasVerifiedToken) {
			options.push({
				label: `List samples`,
				callback: async () => self.listSamples(event, t1, t2, plot, start, end)
			})
		}
		self.displayMenu(event, options, plot)
		// const brushValues = plot.values.filter(i => i > start && i < end)
	}

	self.displayMenu = function (event, options, plot) {
		self.app.tip.d.selectAll('*').remove()

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
		const color = plot.color
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
				console.log(term2)
				if (!term2.term.values[plot.label]) term2.term.values = { [plot.label]: { label: plot.label, color: newColor } }
				else {
					const value = Object.values(term2.term.values).find(v => v.label == plot.label || v.key == plot.label)
					value.color = newColor
				}
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config: {
						term2: {
							isAtomic: true,
							id: self.config.term2.id,
							term: self.config.term2.term,
							q: getUpdatedQfromClick(plot, self.config.term2, false)
						}
					}
				})

				self.app.tip.hide()
			})
		self.app.tip.show(event.clientX, event.clientY)
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
			filter
		}
		//getAnnotatedSampleData is used to retrieve sample id's and values (see matrix.js).
		const data = await self.app.vocabApi.getAnnotatedSampleData(opts)
		self.displaySampleIds(event, term, data)
	}

	self.displaySampleIds = function (event, term, data) {
		self.app.tip.clear()
		if (!data?.samples) return
		const sampleIdArr = []
		for (const [c, k] of Object.entries(data.samples)) {
			const sampleIdObj = {}
			if (data.refs.bySampleId[c]) {
				sampleIdObj[data.refs.bySampleId[c]] = roundValue(k[term.$id].value, 1)
			}
			sampleIdArr.push([{ value: Object.keys(sampleIdObj) }, { value: Object.values(sampleIdObj) }])
		}
		const tableDiv = self.app.tip.d.append('div')
		const columns = [{ label: 'Sample Id' }, { label: 'Value' }]
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
								id: term.id,
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
				if (q.isHidden === true) {
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
				start: rangeStart,
				stop: rangeStop,
				startinclusive: true,
				stopinclusive: true,
				startunbounded: self.displayLabelClickMenu.called == false ? true : false,
				stopunbounded: self.displayLabelClickMenu.called == false ? true : false
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

function getAddFilterCallback(t1, t2, self, plot, rangeStart, rangeStop) {
	const tvslst = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: []
	}

	if (t2) {
		if (t1.term.type === 'categorical' || t1.term.type === 'condition') {
			createTvsLstValues(t1, plot, tvslst, 0)

			if (self.displayBrushMenu.called === true) {
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
			if (self.displayBrushMenu.called === true) {
				self.createTvsLstRanges(t1, tvslst, rangeStart, rangeStop, 1)
			}
		} else {
			createTvsLstValues(t2, plot, tvslst, 0)
			if (self.displayBrushMenu.called === true) {
				self.createTvsLstRanges(t1, tvslst, rangeStart, rangeStop, 1)
			}
		}
	} else {
		if (self.displayBrushMenu.called === true) {
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
	}
	if (term.term.type === 'samplelst') {
		tvslst.lst[lstIdx].tvs.values = term.term.values[plot.label].list
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
