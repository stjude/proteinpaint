import { filterJoin, getFilterItemByTag } from '#filter'
import { DownloadMenu, niceNumLabels } from '#dom'
import { TermTypes } from '#shared/terms.js'
import { getSamplelstFilter } from '../mass/groups.js'
import { listSamples } from './barchart.events.js'

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
		dm.show(event.clientX, event.clientY)
	}

	self.displayLabelClickMenu = function (t1, t2, plot, event) {
		if (!t2) return // when no term 2 do not show options on the sole violin label
		if (self.config.term.term.type == TermTypes.SINGLECELL_GENE_EXPRESSION) return // is sc gene exp data, none of the options below work, thus disable

		const label = t1.q.mode === 'continuous' ? 'term2' : 'term'
		const options = [
			{
				label: `Add filter: ${plot.label.split(',')[0]}`,
				testid: 'sjpp-violinLabOpt-addf',
				callback: getAddFilterCallback(t1, t2, self, plot, label, false)
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
					const [start, end] = [self.data.min, self.data.max * 2]
					await self.callListSamples(event, t1, t2, plot, start, end)
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
				testid: 'sjpp-violinBrushOpt-addf',
				callback: getAddFilterCallback(t1, t2, self, plot, start, end, true)
			}
		]

		if (self.state.displaySampleIds && self.state.hasVerifiedToken) {
			options.push({
				label: `List samples`,
				testid: 'sjpp-violinBrushOpt-list',
				callback: async () => self.callListSamples(event, t1, t2, plot, start, end)
			})
		}
		self.displayMenu(event, options, plot, start, end)
	}

	self.displayMenu = function (event, options, plot, start, end) {
		const tip = self.dom.clicktip.clear().showunder(event.target)

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

	self.callListSamples = async function (event, t1, t2, plot, start, end) {
		let tvslst
		const geneVariant = {}
		if (t1.term.type == 'geneVariant' || t2?.term.type == 'geneVariant') {
			// geneVariant filtering will be handled separately by
			// mayFilterByGeneVariant() in client/plots/barchart.events.js
			let violinTw
			if (t1.term.type == 'geneVariant') {
				geneVariant.t1value = plot.seriesId
				violinTw = t2
			} else {
				geneVariant.t2value = plot.seriesId
				violinTw = t1
			}
			tvslst = self.getTvsLst(violinTw, null, plot, start, end)
		} else {
			tvslst = self.getTvsLst(t1, t2, plot, start, end)
		}
		const terms = [t1]
		if (t2) terms.push(t2)
		const arg = {
			event,
			self,
			terms,
			tvslst,
			geneVariant,
			tip: self.dom.sampletabletip
		}
		await listSamples(arg)
	}

	self.hideLegendItem = function (d) {
		let termNum, tw // find overlay term (aka term2)
		if (self.config.term.q.mode == 'continuous') {
			// whichever tw q.mode is continuous, is "term1"
			termNum = 'term2'
			tw = self.config.term2
		} else {
			termNum = 'term'
			tw = self.config.term
		}
		for (const key of Object.keys(tw.q?.hiddenValues)) {
			if (d.text === key) {
				delete tw.q.hiddenValues[key]
			}
		}
		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: {
				[termNum]: {
					isAtomic: true,
					term: tw.term,
					q: getUpdatedQfromClick({ label: d.text }, tw, false)
				}
			}
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
			if (
				t2.q?.mode === 'continuous' ||
				((t2.term?.type === 'float' || t2.term?.type === 'integer') && plot.overlayTwBins != null)
			) {
				createTvsLstValues(t1, plot, tvslst, 0)
				self.createTvsLstRanges(t2, tvslst, rangeStart, rangeStop, 1)
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
			((t2.term?.type === 'float' || t2.term?.type === 'integer') && plot.overlayTwBins != null)
		) {
			createTvsTerm(t2, tvslst)
			tvslst.lst[0].tvs.ranges = [
				{
					start: plot.overlayTwBins?.start || null,
					stop: plot.overlayTwBins?.stop || null,
					startinclusive: plot.overlayTwBins?.startinclusive || true,
					stopinclusive: plot.overlayTwBins?.stopinclusive || false,
					startunbounded: plot.overlayTwBins?.startunbounded ? plot.overlayTwBins?.startunbounded : null,
					stopunbounded: plot.overlayTwBins?.stopunbounded ? plot.overlayTwBins?.stopunbounded : null
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
