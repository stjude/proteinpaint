import { axisLeft, axisTop } from 'd3-axis'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { area, curveBumpX, curveBumpY } from 'd3-shape'
import { schemeCategory10 } from 'd3-scale-chromatic'
import { brushX, brushY } from 'd3-brush'
import { renderTable } from '#dom/table'
import { filterJoin, getFilterItemByTag } from '../filter/filter'
// import { drag as d3drag } from 'd3-drag'

export default function violinRenderer(self) {
	const k2c = scaleOrdinal(schemeCategory10)
	self.render = function() {
		const settings = self.config.settings.violin
		const isH = settings.orientation === 'horizontal'
		const imageOffset = settings.datasymbol === 'bean' ? settings.radius * window.devicePixelRatio : settings.radius
		const t1 = self.config.term
		const t2 = self.config.term2

		//filter out hidden values and only keep plots which are not hidden in term2.q.hiddenvalues
		self.data.plots = self.data.plots.filter(p => !t2?.q?.hiddenValues?.[p.label || p.seriesId])

		self.legendRenderer(getLegendGrps(self))

		if (self.data.plots.length === 0) {
			self.dom.violinDiv.html(
				` <span style="opacity:.6;font-size:1em;margin-left:90px;">No data to render Violin Plot</span>`
			)
			self.dom.tableHolder.selectAll('*').remove()
			self.dom.legendDiv.selectAll('*').remove()
			return
		} else self.dom.violinDiv.select('*').remove()

		// append the svg object to the body of the page
		self.dom.violinDiv.select('.sjpp-violin-plot').remove()

		const svg = renderSvg(t1, self, isH, settings)
		renderScale(t1, t2, settings, isH, svg)

		for (const [plotIdx, plot] of self.data.plots.entries()) {
			const violinG = createViolinG(svg, plot, plotIdx, isH)
			renderLabels(t1, t2, violinG, plot, isH, settings)
			renderViolinPlot(plot, self, isH, svg, plotIdx, violinG, imageOffset)
			renderBrushing(t1, t2, violinG, settings, plot, isH, svg)
			labelHideLegendClicking(t2, plot, self)
		}
	}

	self.displayLabelClickMenu = function(t1, t2, plot, event) {
		self.displayLabelClickMenu.called = true
		displayMenu(t1, t2, self, plot, event, null, null)
	}

	self.renderPvalueTable = function() {
		self.dom.tableHolder.selectAll('*').remove()

		const t2 = self.config.term2

		if (t2 === undefined || t2 === null) {
			// no term2, no table to show
			self.dom.tableHolder.style('display', 'none')
			return
		}

		self.dom.tableHolder
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.append('div')
			.style('font-weight', 'bold')
			.text(self.data.pvalues.length > 0 ? "Group comparisons (Wilcoxon'settings rank sum test)" : '')

		const columns = [{ label: 'Group 1' }, { label: 'Group 2' }, { label: 'P-value' }]
		const rows = self.data.pvalues

		renderTable({
			columns,
			rows,
			div: self.dom.tableHolder,
			showLines: false,
			maxWidth: '27vw',
			maxHeight: '20vh',
			resize: true
		})
	}

	function maxLabelSize(self, svg) {
		// render all labels to get max label width
		let maxLabelSize = 0
		for (const p of self.data.plots) {
			const l = svg.append('text').text(p.label)
			maxLabelSize = Math.max(maxLabelSize, l.node().getBBox().width)
			l.remove()
		}
		return maxLabelSize
	}

	function createMargins(labelsize, settings, isH) {
		let margins
		if (isH) {
			margins = { left: labelsize + 5, top: settings.axisHeight, right: settings.rightMargin, bottom: 10 }
		} else {
			margins = { left: settings.axisHeight, top: 50, right: settings.rightMargin, bottom: labelsize }
		}
		return margins
	}

	function renderSvg(t1, self, isH, settings) {
		const violinDiv = self.dom.violinDiv
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '5px')
			.style('overflow', 'auto')
			.style('scrollbar-width', 'none')

		const violinSvg = violinDiv.append('svg')

		const labelsize = maxLabelSize(self, violinSvg)

		const margin = createMargins(labelsize, settings, isH)

		violinSvg
			.attr(
				'width',
				margin.left +
					margin.top +
					(isH ? settings.svgw : self.data.plotThickness * self.data.plots.length + t1.term.name.length)
			)
			.attr(
				'height',
				margin.bottom +
					margin.top +
					(isH ? self.data.plotThickness * self.data.plots.length : settings.svgw + t1.term.name.length)
			)
			.classed('sjpp-violin-plot', true)

		// a <g> in which everything is rendered into
		const svgG = violinSvg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

		return { margin: margin, svgG: svgG, axisScale: createNumericScale(self, settings, isH), violinSvg: violinSvg }
	}

	function renderScale(t1, t2, settings, isH, svg) {
		// <g>: holder of numeric axis
		const g = svg.svgG
			.append('g')
			.transition()
			.duration(1000)
			.delay(200)
		g.call((isH ? axisTop : axisLeft)().scale(svg.axisScale))

		let lab

		// TODO need to add term2 label onto the svg
		if (t2?.q?.mode === 'continuous')
			lab = svg.svgG
				.append('text')
				.text(`${t2.term.name}`)
				.classed('sjpp-numeric-term-label', true)
				.style('font-weight', 600)
				.attr('text-anchor', 'middle')
		else
			lab = svg.svgG
				.append('text')
				.text(t1.term.name)
				.classed('sjpp-numeric-term-label', true)
				.style('font-weight', 600)
				.attr('text-anchor', 'middle')

		if (isH) {
			lab
				.attr('x', settings.svgw / 2)
				.attr('y', -30)
				.style('opacity', 0)
				.transition()
				.delay(200)
				.duration(300)
				.style('opacity', 1)
		} else {
			lab
				.attr('y', -45)
				.attr('x', -settings.svgw / 2)
				.attr('transform', 'rotate(-90)')
				.style('opacity', 0)
				.transition()
				.delay(200)
				.duration(300)
				.style('opacity', 1)
		}
	}

	function createViolinG(svg, plot, plotIdx, isH) {
		// <g> of one plot
		// adding .5 to plotIdx allows to anchor each plot <g> to the middle point

		const violinG = svg.svgG
			.append('g')
			.datum(plot)
			.attr(
				'transform',
				isH
					? 'translate(0,' + self.data.plotThickness * (plotIdx + 0.5) + ')'
					: 'translate(' + self.data.plotThickness * (plotIdx + 0.5) + ',0)'
			)
			.attr('class', 'sjpp-violinG')

		return violinG
	}

	function renderLabels(t1, t2, violinG, plot, isH, settings) {
		// create scale label
		const label = violinG
			.append('text')
			.classed('sjpp-axislabel', true)
			.text(plot.label)
			.style('cursor', 'pointer')
			.on('click', function(event) {
				if (!event) return
				self.displayLabelClickMenu(t1, t2, plot, event)
			})
			.style('opacity', 0)
			.transition()
			.delay(100)
			.duration(100)
			.style('opacity', 1)

		if (isH) {
			label
				.attr('x', -5)
				.attr('y', 0)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'central')
		} else {
			label
				.attr('x', 0 - settings.svgw - 5)
				.attr('y', 0)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'central')
				.attr('transform', 'rotate(-90)')
		}
	}

	function renderViolinPlot(plot, self, isH, svg, plotIdx, violinG, imageOffset) {
		// times 0.45 will leave out 10% as spacing between plots
		const wScale = scaleLinear()
			.domain([-plot.biggestBin, plot.biggestBin])
			.range([-self.data.plotThickness * 0.45, self.data.plotThickness * 0.45])

		let areaBuilder
		if (isH) {
			areaBuilder = area()
				.y0(d => wScale(-d.binValueCount))
				.y1(d => wScale(d.binValueCount))
				.x(d => svg.axisScale(d.x0))
				.curve(curveBumpX)
		} else {
			areaBuilder = area()
				.x0(d => wScale(-d.binValueCount))
				.x1(d => wScale(d.binValueCount))
				.y(d => svg.axisScale(d.x0))
				.curve(curveBumpY)
		}

		violinG
			.append('path')
			.attr('class', 'sjpp-vp-path')
			.style('fill', plot.color ? plot.color : k2c(plotIdx))
			.style('opacity', 0)
			.transition()
			.delay(400)
			.duration(800)
			.style('opacity', '0.8')
			.attr('d', areaBuilder(plot.plotValueCount > 3 ? plot.bins : 0)) //do not build violin plots for values 3 or less than 3.

		renderSymbolImage(violinG, plot, isH, imageOffset)
		renderMedian(violinG, isH, plot, svg)
	}

	function renderSymbolImage(violinG, plot, isH, imageOffset) {
		violinG
			.append('image')
			.style('opacity', 0)
			.transition()
			.delay(800)
			.duration(100)
			.style('opacity', 1)
			.attr('xlink:href', plot.src)
			.attr('transform', isH ? `translate(0, -${imageOffset})` : `translate(-${imageOffset}, 0)`)
	}

	function renderMedian(violinG, isH, plot, svg) {
		//render median values on plots
		if (plot.plotValueCount >= 2) {
			violinG
				.append('line')
				.transition()
				.delay(800)
				.duration(30)
				.style('opacity', 1)
				.attr('class', 'sjpp-median-line')
				.style('stroke-width', '3')
				.style('stroke', 'red')
				.style('opacity', '1')
				.attr('y1', isH ? -7 : svg.axisScale(plot.median))
				.attr('y2', isH ? 7 : svg.axisScale(plot.median))
				.attr('x1', isH ? svg.axisScale(plot.median) : -7)
				.attr('x2', isH ? svg.axisScale(plot.median) : 7)
		} else return
	}

	function renderBrushing(t1, t2, violinG, settings, plot, isH, svg) {
		//brushing on data points
		violinG
			.append('g')
			.classed('sjpp-brush', true)
			.call(
				isH
					? brushX()
							.extent([[0, -20], [settings.svgw, 20]])
							.on('end', async event => {
								const selection = event.selection

								if (!selection) return

								await displayBrushMenu(t1, t2, self, plot, selection, svg.axisScale, isH)
							})
					: brushY()
							.extent([[-20, 0], [20, settings.svgw]])
							.on('end', async event => {
								const selection = event.selection

								if (!selection) return

								await displayBrushMenu(t1, t2, self, plot, selection, svg.axisScale, isH)
							})
			)
	}

	self.toggleLoadingDiv = function(display = '') {
		if (display != 'none') {
			self.dom.loadingDiv
				.style('opacity', 0)
				.style('display', display)
				.transition()
				.duration('loadingWait' in self ? self.loadingWait : 100000)
				.style('opacity', 1)
		} else {
			self.dom.loadingDiv.style('display', display)
		}
		self.loadingWait = 1000
	}
}

export async function displayBrushMenu(t1, t2, self, plot, selection, scale, isH) {
	const start = isH ? scale.invert(selection[0]) : scale.invert(selection[1])
	const end = isH ? scale.invert(selection[1]) : scale.invert(selection[0])
	displayBrushMenu.called = true
	displayMenu(t1, t2, self, plot, event, start, end)
	// const brushValues = plot.values.filter(i => i > start && i < end)
}

export function displayMenu(t1, t2, self, plot, event, start, end) {
	self.app.tip.d.selectAll('*').remove()

	const options = []

	if (self.displayLabelClickMenu.called === true) {
		if (t2) {
			if (t1.term.type === 'categorical') {
				options.push({
					label: `Add filter: ${plot.label.split(',')[0]}`,
					callback: getAddFilterCallback(t1, t2, self, plot, 'term1')
				})
			} else {
				options.push({
					label: `Add filter: ${plot.label.split(',')[0]}`,
					callback: getAddFilterCallback(t1, t2, self, plot, 'term2')
				})
			}
			//On label clicking, display 'Hide' option to hide plot.
			options.push({
				label: `Hide: ${plot.label}`,
				callback: () => {
					const termNum = t2 ? 'term2' : null
					const term = self.config[termNum]
					const isHidden = true
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
		//show median values as text above menu options
		self.app.tip.d
			.append('div')
			.text(`Median Value: ${plot.median}`)
			.style('padding-left', '10px')
			.style('font-size', '15px')

		self.displayLabelClickMenu.called = false
	} else if (displayBrushMenu.called === true) {
		options.push({
			label: `Add filter: ${start.toFixed(1)} < x < ${end.toFixed(1)}`,
			callback: getAddFilterCallback(t1, t2, self, plot, start, end)
		})
		displayBrushMenu.called = false
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

	self.app.tip.show(event.clientX, event.clientY)
}

// creates numeric axis
export function createNumericScale(self, settings, isH) {
	const axisScale = scaleLinear()
		.domain([self.data.min, self.data.max + self.data.max / (settings.radius * 4)])
		.range(isH ? [0, settings.svgw] : [settings.svgw, 0])
	return axisScale
}

export function createTvsLstValues(term, plot, tvslst, lstIdx) {
	createTvsTerm(term, tvslst)
	tvslst.lst[lstIdx].tvs.values = [
		{
			key: plot.seriesId
		}
	]
}

export function createTvsLstRanges(term, tvslst, rangeStart, rangeStop, lstIdx) {
	createTvsTerm(term, tvslst)

	tvslst.lst[lstIdx].tvs.ranges = [
		{
			start: rangeStart,
			stop: rangeStop
		}
	]
}

export function createTvsTerm(term, tvslst) {
	tvslst.lst.push({
		type: 'tvs',
		tvs: {
			term: term.term
		}
	})
}

export function getAddFilterCallback(t1, t2, self, plot, rangeStart, rangeStop) {
	const tvslst = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: []
	}

	if (t2) {
		if (t1.term.type === 'categorical') {
			createTvsLstValues(t1, plot, tvslst, 0)

			if (displayBrushMenu.called === true) {
				createTvsLstRanges(t2, tvslst, rangeStart, rangeStop, 1)
			}
		} else if (
			t2.q?.mode === 'continuous' ||
			((t2.term?.type === 'float' || t2.term?.type === 'integer') && plot.divideTwBins != null)
		) {
			createTvsTerm(t2, tvslst)
			tvslst.lst[0].tvs.ranges = [
				{
					start: structuredClone(plot.divideTwBins?.start) || null,
					stop: structuredClone(plot.divideTwBins?.stop) || null,
					startinclusive: structuredClone(plot.divideTwBins?.startinclusive) || null,
					stopinclusive: structuredClone(plot.divideTwBins?.stopinclusive) || null,
					startunbounded: structuredClone(plot.divideTwBins?.startunbounded)
						? structuredClone(plot.divideTwBins?.startunbounded)
						: null,
					stopunbounded: structuredClone(plot.divideTwBins?.stopunbounded)
						? structuredClone(plot.divideTwBins?.stopunbounded)
						: null
				}
			]
			if (displayBrushMenu.called === true) {
				createTvsLstRanges(t1, tvslst, rangeStart, rangeStop, 1)
			}
		} else {
			createTvsLstValues(t2, plot, tvslst, 0)
			if (displayBrushMenu.called === true) {
				createTvsLstRanges(t1, tvslst, rangeStart, rangeStop, 1)
			}
		}
	} else {
		if (displayBrushMenu.called === true) {
			createTvsLstRanges(t1, tvslst, rangeStart, rangeStop, 0)
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
	const q = structuredClone(term.q)
	if (!q.hiddenValues) q.hiddenValues = {}
	if (isHidden) q.hiddenValues[id] = 1
	else delete q.hiddenValues[id]
	return q
}

function getLegendGrps(self) {
	// TODO: add excluded categories to legend (see barchart.js)
	const legendGrps = []
	const t1 = self.config.term
	const t2 = self.config.term2
	const headingStyle = 'color: #aaa; font-weight: 400'

	// descriptive statistics
	if (t1.q.descrStats) {
		// term1 has descriptive stats
		const items = t1.q.descrStats.map(stat => {
			return {
				text: `${stat.label}: ${stat.value}`,
				noIcon: true
			}
		})
		// title of descriptive stats should include the term1 name if term2 is present
		const title = t2 ? `Descriptive statistics: ${t1.term.name}` : 'Descriptive statistics'
		const name = `<span style="${headingStyle}">${title}</span>`
		legendGrps.push({ name, items })
	}
	if (t2?.q.descrStats) {
		// term2 has descriptive stats
		const items = t2.q.descrStats.map(stat => {
			return {
				text: `${stat.label}: ${stat.value}`,
				noIcon: true
			}
		})
		// title of descriptive stats will include the term2 name
		// because two terms are present
		const title = `Descriptive statistics: ${t2.term.name}`
		const name = `<span style="${headingStyle}">${title}</span>`
		legendGrps.push({ name, items })
	}

	if (t2) {
		if (t2.q.hiddenValues && Object.entries(t2.q.hiddenValues).length != 0) {
			const items = []
			for (const key of Object.keys(t2.q.hiddenValues)) {
				items.push({
					text: `${key}`,
					noIcon: true,
					isHidden: true,
					hiddenOpacity: 1
				})
			}
			const title = `${t2.term.name}`
			const name = `<span style="${headingStyle}">${title}</span>`
			legendGrps.push({ name, items })
		}
	}

	return legendGrps
}

function labelHideLegendClicking(t2, plot, self) {
	self.dom.legendDiv.selectAll('.sjpp-htmlLegend').on('click', event => {
		event.stopPropagation()
		const d = event.target.__data__
		for (const key of Object.keys(t2.q.hiddenValues)) {
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
	})
}
