import { filterJoin, getFilterItemByTag } from '../filter/filter'
import { renderTable } from '#dom/table'
import { to_svg } from '#src/client'

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

		self.dom.violinDiv.selectAll('.sjpp-violin-plot').each(function() {
			to_svg(this, 'violin', { apply_dom_styles: true })
		})
	}

	self.displayLabelClickMenu = function(t1, t2, plot, event) {
		self.displayLabelClickMenu.called = true

		if (!t2 || self.data.plots.length === 1) {
			return
		}

		const label = t1.term.type === 'categorical' ? 'term1' : 'term2'
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
								q: getUpdatedQfromClick(plot, t2, isHidden)
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
		self.displayMenu(event, options)
	}

	self.displayBrushMenu = function(t1, t2, self, plot, selection, scale, isH) {
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
		self.displayMenu(event, options)
		// const brushValues = plot.values.filter(i => i > start && i < end)
	}

	self.displayMenu = function(event, options) {
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

		self.app.tip.show(event.clientX, event.clientY)
	}

	self.listSamples = async function(event, t1, t2, plot, start, end) {
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

	self.displaySampleIds = function(event, term, data) {
		self.app.tip.clear()
		if (!data?.samples) return
		const sampleIdArr = []
		for (const [c, k] of Object.entries(data.samples)) {
			const sampleIdObj = {}
			if (data.refs.bySampleId[c]) {
				sampleIdObj[data.refs.bySampleId[c]] = k[term.$id].value
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
			showLines: false,
			maxWidth: '30vw',
			maxHeight: '25vh',
			resize: true,
			showLines: true
		})

		self.app.tip.show(event.clientX, event.clientY)
	}

	self.labelHideLegendClicking = function(t2, plot) {
		self.dom.legendDiv.selectAll('.sjpp-htmlLegend').on('click', event => {
			event.stopPropagation()
			const d = event.target.__data__
			if (t2) {
				for (const key of Object.keys(t2?.q?.hiddenValues)) {
					if (d.text === key) {
						delete self.config.term2.q.hiddenValues[key]
					}
				}
				const termNum = self.config.term2 ? 'term2' : null
				const term = self.config[termNum]
				const isHidden = false
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config: {
						[termNum]: {
							isAtomic: true,
							id: term.id,
							term: term.term,
							q: getUpdatedQfromClick(plot, t2, isHidden)
						}
					}
				})
			}
		})
	}

	self.createTvsLstRanges = function(term, tvslst, rangeStart, rangeStop, lstIdx) {
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

	self.getTvsLst = function(t1, t2, plot, rangeStart, rangeStop) {
		const tvslst = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: []
		}

		if (t2) {
			if (t1.term.type === 'categorical') {
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
		if (t1.term.type === 'categorical') {
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
			key: plot.seriesId
		}
	]
}

function createTvsTerm(term, tvslst) {
	tvslst.lst.push({
		type: 'tvs',
		tvs: {
			term: term.term
		}
	})
}
