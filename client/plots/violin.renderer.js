import { axisLeft, axisTop } from 'd3-axis'
import { scaleLinear, scaleLog } from 'd3-scale'
import { curveBasis, line } from 'd3-shape'
import { getColors } from '#shared/common.js'
import { brushX, brushY } from 'd3-brush'
import { renderTable, Menu, getMaxLabelWidth, table2col } from '#dom'
import { rgb } from 'd3'
import { format as d3format } from 'd3-format'
import { TermTypes } from '#shared/terms.js'

const minSampleSize = 5 // a group below cutoff will not render a violin plot

export default function setViolinRenderer(self) {
	self.render = function () {
		const settings = self.config.settings.violin
		const isH = settings.orientation === 'horizontal'
		const imageOffset = settings.datasymbol === 'bean' ? settings.radius * window.devicePixelRatio : settings.radius
		const t1 = self.config.term
		const t2 = self.config.term2
		const tip = new Menu({ padding: '5px' })
		self.dom.tip = tip

		//termsetting.js 'set_hiddenvalues()' adds uncomputable values from term.values to q.hiddenValues object. Since it will show up on the legend, delete that key-value pair from t2.q.hiddenValues object.
		const termNum =
			t2?.term.type === 'condition' ||
			t2?.term.type === 'samplelst' ||
			t2?.term.type === 'categorical' ||
			((t2?.term.type === 'float' || t2?.term.type === 'integer') && t1.q.mode === 'continuous')
				? t2
				: t1

		if (termNum && termNum.term?.values) {
			for (const [k, v] of Object.entries(termNum.term.values)) {
				if (v.uncomputable) {
					if (termNum.q.hiddenValues[k]) {
						termNum.q.hiddenValues[v.label] = 1
						delete termNum.q.hiddenValues[k]
					}
				}
			}
		}

		//filter out hidden values and only keep plots which are not hidden in term2.q.hiddenvalues
		self.data.plots = self.data.plots.filter(p => !termNum?.q?.hiddenValues?.[p.label || p.seriesId])
		if (settings.orderByMedian == true) {
			self.data.plots.sort(
				(a, b) => a.summaryStats.find(x => x.id === 'median').value - b.summaryStats.find(x => x.id === 'median').value
			)
		}
		this.k2c = getColors(self.data.plots.length)
		if (self.legendRenderer) self.legendRenderer(getLegendGrps(termNum, self))

		if (self.data.plots.length === 0) {
			self.dom.violinDiv.html(
				` <span style="opacity:.6;font-size:1em;margin-left:90px;">No data to render Violin Plot</span>`
			)
			self.dom.legendDiv.selectAll('*').remove()
			self.dom.tableHolder.selectAll('.sjpp-tableHolder')._parents[0].remove()
			return
		} else self.dom.violinDiv.select('*').remove()

		// append the svg object to the body of the page
		self.dom.violinDiv.select('.sjpp-violin-plot').remove()

		const svgData = renderSvg(t1, self, isH, settings)
		renderScale(t1, t2, settings, isH, svgData, self)
		let y = 0
		const thickness = self.settings.plotThickness || self.getAutoThickness()
		for (const [plotIdx, plot] of self.data.plots.entries()) {
			//R x values are not the same as the plot values, so we need to use a scale to map them to the plot values
			// The scale uses half of the plotThickness as the maximum value as the image is symmetrical
			// Only one half of the image is computed and the other half is mirrored
			const wScale = scaleLinear()
				.domain([plot.density.densityMax, plot.density.densityMin])
				.range([thickness / 2, 0])
			let areaBuilder
			//when doing this interpolation, the violin plot will be smoother and some padding may be added
			//between the plot and the axis
			if (isH) {
				areaBuilder = line()
					.curve(curveBasis)
					.x(d => svgData.axisScale(d.x0))
					.y(d => wScale(d.density))
			} else {
				areaBuilder = line()
					.curve(curveBasis)
					.x(d => wScale(d.density))
					.y(d => svgData.axisScale(d.x0))
			}
			//if only one plot pass area builder to calculate the exact height of the plot
			const { violinG, height } = renderViolinPlot(svgData, plot, isH, wScale, areaBuilder, y, imageOffset)
			y += height
			if (self.opts.mode != 'minimal') renderLabels(t1, t2, violinG, plot, isH, settings, tip)

			if (self.config.term.term.type == TermTypes.SINGLECELL_GENE_EXPRESSION) {
				// is sc data, disable brushing for now because 1) no use 2) avoid bug of listing cells
			} else {
				// enable brushing
				if (self.opts.mode != 'minimal') renderBrushing(t1, t2, violinG, settings, plot, isH, svgData)
			}
			self.labelHideLegendClicking(t2, plot)
		}
	}

	self.displaySummaryStats = function (d, event, tip) {
		if (!d.summaryStats) return
		tip.clear().show(event.clientX, event.clientY)

		const table = table2col({ holder: tip.d.append('div') })
		//Sample label
		const [th1, _] = table.addRow()
		th1.attr('colspan', '2').style('color', 'black').style('text-align', 'center').text(d.label)
		//Summary stat rows
		for (const stat of d.summaryStats) {
			const [td1, td2] = table.addRow()
			td1.text(stat.label)
			td2.style('text-align', 'center').text(stat.value ?? 0)
		}
	}
	self.getAutoThickness = function () {
		if (self.data.plots.length === 1) return 150
		const count = self.data.plots.length
		return Math.min(130, Math.max(60, 600 / count)) //clamp between 60 and 130
	}

	self.getPlotThicknessWithPadding = function () {
		const plotThickness = self.settings.plotThickness || self.getAutoThickness()
		return plotThickness + self.settings.rowSpace
	}

	self.renderPvalueTable = function () {
		self.dom.tableHolder.selectAll('*').remove()
		if (self.data.plots.length === 1) return

		const t1 = self.config.term
		const t2 = self.config.term2

		if (!t2) {
			// no term2, no table to show
			self.dom.tableHolder.style('display', 'none')
			return
		}

		const termNum =
			t2?.term.type === 'condition' ||
			t2?.term.type === 'samplelst' ||
			t2?.term.type === 'categorical' ||
			((t2?.term.type === 'float' || t2?.term.type === 'integer') && t1.q.mode === 'continuous')
				? t2
				: t1

		//hide p-values for categories that are hidden
		self.data.pvalues = self.data.pvalues.filter(arr => {
			for (let i = 0; i < arr.length; i++) {
				if (typeof arr[i].value === 'string') {
					if (termNum.q?.hiddenValues && arr[i].value in termNum.q.hiddenValues) {
						return false
					}
				}
			}
			return true
		})

		self.dom.tableHolder
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.append('div')
			.style('font-weight', 'bold')
			.text(self.data.pvalues.length > 0 ? "Group comparisons (Wilcoxon's rank sum test)" : '')

		const columns = [{ label: 'Group 1' }, { label: 'Group 2' }, { label: 'P-value' }]
		const rows = self.data.pvalues
		const isH = this.settings.orientation === 'horizontal'
		const maxHeight = isH
			? self.getPlotThicknessWithPadding() * this.data.plots.length + 10 //add axes height
			: this.settings.svgw + this.config.term.term.name.length
		renderTable({
			rows,
			columns,
			div: self.dom.tableHolder,
			showLines: false,
			maxWidth: '27vw',
			maxHeight: `${maxHeight}px`,
			resize: true
		})
	}

	function createMargins(labelsize, settings, isH, isMinimal) {
		let margins

		if (isMinimal) {
			margins = isH
				? { left: 5, top: settings.axisHeight, right: settings.rightMargin, bottom: 10 }
				: { left: settings.axisHeight, top: 30, right: settings.rightMargin, bottom: 10 }
		} else {
			margins = isH
				? { left: labelsize + 5, top: settings.axisHeight, right: settings.rightMargin, bottom: 10 }
				: { left: settings.axisHeight, top: 50, right: settings.rightMargin, bottom: labelsize }
		}
		return margins
	}

	function renderSvg(t1, self, isH, settings) {
		const violinDiv = self.dom.violinDiv
			.append('div')
			.style('display', 'inline-block')
			.style('padding', self.opts.mode != 'minimal' ? '5px' : '0px')
			.style('overflow', 'auto')
			.style('scrollbar-width', 'none')

		const violinSvg = violinDiv.append('svg')

		const labelsize = getMaxLabelWidth(
			violinSvg,
			self.data.plots.map(plot => `${plot.label}, n=${plot.plotValueCount}`)
		)

		const margin = createMargins(labelsize, settings, isH, self.opts.mode == 'minimal')
		const plotThickness = self.getPlotThicknessWithPadding()
		const width =
			margin.left + margin.top + (isH ? settings.svgw : plotThickness * self.data.plots.length + t1.term.name.length)
		const height =
			margin.bottom + margin.top + (isH ? plotThickness * self.data.plots.length : settings.svgw + t1.term.name.length)

		violinSvg
			.attr('width', width)
			.attr('height', height)
			.classed('sjpp-violin-plot', true)
			.attr('data-testid', 'sja_violin_plot')

		// a <g> in which everything is rendered into
		const svgG = violinSvg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

		return { margin: margin, svgG: svgG, axisScale: createNumericScale(self, settings, isH), violinSvg: violinSvg }
	}

	function renderScale(t1, t2, settings, isH, svg, self) {
		// <g>: holder of numeric axis
		const g = svg.svgG
			.append('g')
			.style('font-size', '12')
			.classed(settings.unit === 'log' ? 'sjpp-logscale' : 'sjpp-linearscale', true)

		const ticks =
			settings.unit === 'log'
				? svg.axisScale.ticks(15)
				: // svg.axisScale.ticks().filter(tick => tick > 0 || tick < 0)
				  svg.axisScale.ticks()

		g.call(
			(isH ? axisTop : axisLeft)()
				.scale(svg.axisScale)
				.tickFormat((d, i) => {
					if (settings.unit === 'log') {
						if (self.app.vocabApi.termdbConfig.logscaleBase2) {
							if (ticks.length > 10 && i % 2 !== 0) return ''
							if (d < 0.1) return d3format('.3f')(d)
							return d3format('.1f')(d)
						} else {
							if (ticks.length >= 12 && i % 5 !== 0) return ''
							if (d < 50) return d
							return d3format('.1s')(d)
						}
					}
					if (ticks.length >= 12 && i % 2 !== 0) return ''
					return d
				})
				.tickValues(ticks)
		)

		if (self.opts.mode != 'minimal') {
			// TODO need to add term2 label onto the svg
			const lab = svg.svgG
				.append('text')
				.text(t2?.q?.mode === 'continuous' ? t2.term.name : t1.term.name)
				.classed('sjpp-numeric-term-label', true)
				.style('font-weight', 600)
				.attr('text-anchor', 'middle')
				.attr('x', isH ? settings.svgw / 2 : -settings.svgw / 2)
				.attr('y', isH ? -30 : -45)
				.style('opacity', 0)
				.attr('transform', isH ? null : 'rotate(-90)')
				// .transition()
				// .delay(self.opts.mode == 'minimal' ? 0 : 100)
				// .duration(self.opts.mode == 'minimal' ? 0 : 200)
				.style('opacity', 1)
		}
	}

	function renderViolinPlot(svgData, plot, isH, wScale, areaBuilder, y, imageOffset) {
		const label = plot.label?.split(',')[0]
		const catTerm = self.config.term.q.mode == 'discrete' ? self.config.term : self.config.term2
		const category = catTerm?.term.values ? Object.values(catTerm.term.values).find(o => o.label == label) : null

		const color = category?.color ? category.color : self.config.settings.violin.defaultColor
		// : plot.divideTwBins
		// ? plot.divideTwBins.color
		// : self.config.term2
		// ? self.k2c(plotIdx)
		// : self.config.settings.violin.defaultColor
		if (!plot.color) plot.color = color
		if (category && !category.color) category.color = color
		// <g> of one plot
		// adding .5 to plotIdx allows to anchor each plot <g> to the middle point
		const svg = svgData.svgG
		const violinG = svg.append('g').datum(plot).attr('class', 'sjpp-violinG')
		renderArea(violinG, plot, areaBuilder)
		//render symmetrical violin plot
		renderArea(violinG, plot, isH ? areaBuilder.y(d => -wScale(d.density)) : areaBuilder.x(d => -wScale(d.density)))

		renderSymbolImage(self, violinG, plot, isH, imageOffset)
		if (self.opts.mode != 'minimal') renderMedian(violinG, isH, plot, svgData, self)
		renderLines(violinG, isH, self.config.settings.violin.lines, svgData)
		if ('value' in self.state.config) {
			const value = svgData.axisScale(self.state.config.value)
			const s = self.config.settings.violin
			violinG
				.append('line')
				.style('stroke', 'black')
				.style('stroke-width', s.medianThickness)
				.attr('x1', 200)
				.attr('x2', 200)
				.attr('x1', isH ? value : -s.medianLength)
				.attr('x2', isH ? value : s.medianLength)
				.attr('y1', isH ? -s.medianLength : value)
				.attr('y2', isH ? s.medianLength : value)
		}
		let height = self.getPlotThicknessWithPadding()
		const translate = isH ? `translate(0, ${y + height / 2}) ` : `translate(${y + height / 2}, 0)`
		violinG.attr('transform', translate)

		return { violinG, height }
	}

	function renderLabels(t1, t2, violinG, plot, isH, settings, tip) {
		// create scale label
		violinG
			.append('text')
			.classed('sjpp-axislabel', true)
			.text(`${plot.label}, n=${plot.plotValueCount}`)
			.style('cursor', 'pointer')
			.on('click', function (event) {
				if (!event) return
				self.displayLabelClickMenu(t1, t2, plot, event)
			})
			.on('mouseover', function (event, d) {
				event.stopPropagation()
				if (!event) return
				self.displaySummaryStats(d, event, tip)
			})
			.on('mouseout', function () {
				tip.hide()
			})
			.style('opacity', 0)
			// .transition()
			// .delay(self.opts.mode == 'minimal' ? 0 : 100)
			// .duration(self.opts.mode == 'minimal' ? 0 : 100)
			.style('opacity', 1)
			.attr('x', isH ? -5 : 0 - settings.svgw - 5)
			.attr('y', 0)
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'central')
			.attr('transform', isH ? null : 'rotate(-90)')
	}

	function renderArea(violinG, plot, areaBuilder) {
		if (plot.density.densityMax == 0) return
		violinG
			.append('path')
			.attr('class', 'sjpp-vp-path')
			.style('fill', self.opts.mode === 'minimal' ? rgb(221, 221, 221) : plot.color)
			.style('opacity', 0)
			.attr('stroke', rgb(plot.color).darker())
			.attr('stroke-width', 1)
			.attr('stroke-linejoin', 'round')
			// .transition()
			// .delay(self.opts.mode == 'minimal' ? 0 : 300)
			// .duration(self.opts.mode == 'minimal' ? 0 : 600)
			.style('opacity', '0.8')
			.attr('d', areaBuilder(plot.density.bins))
	}

	function renderSymbolImage(self, violinG, plot, isH, imageOffset) {
		violinG
			.append('image')
			.style('opacity', 0)
			.classed(self.config.settings.violin.datasymbol === 'rug' ? 'sjpp-rug-img' : 'sjpp-beans-img', true)
			// .transition()
			// .delay(self.opts.mode == 'minimal' ? 0 : 400)
			// .duration(self.opts.mode == 'minimal' ? 0 : 100)
			.style('opacity', 1)
			.attr('xlink:href', plot.src)
			.attr('transform', isH ? `translate(0, -${imageOffset})` : `translate(-${imageOffset}, 0)`)
	}

	function renderMedian(violinG, isH, plot, svgData, self) {
		const s = self.config.settings.violin
		//render median values on plots
		const median = svgData.axisScale(plot.summaryStats.find(x => x.id === 'median').value)
		if (plot.plotValueCount >= 2) {
			violinG
				.append('line')
				// .transition()
				// .delay(600)
				// .duration(30)
				.attr('class', 'sjpp-median-line')
				.style('stroke-width', s.medianThickness)
				.style('stroke', 'red')
				.style('opacity', '0.5')
				.attr('y1', isH ? -s.medianLength : median)
				.attr('y2', isH ? s.medianLength : median)
				.attr('x1', isH ? median : -s.medianLength)
				.attr('x2', isH ? median : s.medianLength)
		} else return
	}

	function renderLines(violinG, isH, lines, svgData) {
		// render straight lines on plot
		const plotThickness = self.settings.plotThickness

		violinG.selectAll('.sjpp-vp-line').remove()
		if (!lines?.length) return
		for (const line of lines) {
			violinG
				.append('line')
				// .transition()
				// .delay(self.opts.mode == 'minimal' ? 0 : 600)
				// .duration(self.opts.mode == 'minimal' ? 0 : 30)
				.attr('class', 'sjpp-vp-line')
				.style('stroke', self.opts.mode == 'minimal' ? 'red' : 'black') // if not minimal, then red median line will also appear
				.attr('y1', isH ? -(plotThickness / 2) : svgData.axisScale(line))
				.attr('y2', isH ? plotThickness / 2 : svgData.axisScale(line))
				.attr('x1', isH ? svgData.axisScale(line) : -(plotThickness / 2))
				.attr('x2', isH ? svgData.axisScale(line) : plotThickness / 2)
		}
	}

	function renderBrushing(t1, t2, violinG, settings, plot, isH, svgData) {
		//brushing on data points
		if (settings.datasymbol === 'rug' || settings.datasymbol === 'bean') {
			violinG
				.append('g')
				.classed('sjpp-brush', true)
				.call(
					isH
						? brushX()
								.extent([
									[0, -20],
									[settings.svgw, 20]
								])
								.on('end', async event => {
									const selection = event.selection

									if (!selection) return

									self.displayBrushMenu(t1, t2, self, plot, selection, svgData.axisScale, isH)
								})
						: brushY()
								.extent([
									[-20, 0],
									[20, settings.svgw]
								])
								.on('end', async event => {
									const selection = event.selection

									if (!selection) return

									self.displayBrushMenu(t1, t2, self, plot, selection, svgData.axisScale, isH)
								})
				)
		} else return
	}

	self.toggleLoadingDiv = function (display = '') {
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

// creates numeric axis
export function createNumericScale(self, settings, isH) {
	let axisScale
	settings.unit == 'log'
		? (axisScale = scaleLog()
				.base(self.app.vocabApi.termdbConfig.logscaleBase2 ? 2 : 10)
				.domain([self.data.min, self.data.max])
				.range(isH ? [0, settings.svgw] : [settings.svgw, 0]))
		: (axisScale = scaleLinear()
				.domain([self.data.min, self.data.max])
				.range(isH ? [0, settings.svgw] : [settings.svgw, 0]))
	return axisScale
}

function getLegendGrps(termNum, self) {
	const legendGrps = [],
		t1 = self.config.term,
		t2 = self.config.term2,
		headingStyle = 'color: #aaa; font-weight: 400'

	addDescriptiveStats(t1, legendGrps, headingStyle, self)
	if (t2?.term.type === 'float' || t2?.q.mode === 'continuous' || t2?.term.type === 'integer')
		addDescriptiveStats(t2, legendGrps, headingStyle, self)

	addUncomputableValues(
		t1?.q.mode === 'continuous' && t1?.q.hiddenValues && Object.keys(t1?.q.hiddenValues).length > 0
			? t1
			: t2?.q.mode === 'continuous' && t2?.q.hiddenValues && Object.keys(t2?.q.hiddenValues).length > 0
			? t2
			: null,
		legendGrps,
		headingStyle,
		self
	)

	if (t2) {
		if (termNum.q.hiddenValues && Object.entries(termNum.q.hiddenValues).length != 0) {
			addHiddenValues(termNum, legendGrps, headingStyle)
		}
	}
	return legendGrps
}

function addDescriptiveStats(term, legendGrps, headingStyle, self) {
	if (term?.q.descrStats) {
		const items = term.q.descrStats.map(stat => {
			return {
				text: `${stat.label}: ${stat.value}`,
				noIcon: true
			}
		})

		const title =
			self.config.term2?.term.type === 'float' || self.config.term2?.term.type === 'integer'
				? `Descriptive statistics: ${term.term.name}`
				: `Descriptive statistics`
		const name = `<span style="${headingStyle}">${title}</span>`
		legendGrps.push({ name, items })
	}
}

function addUncomputableValues(term, legendGrps, headingStyle, self) {
	if (term?.term.values) {
		const items = []
		for (const k in term.term.values) {
			if (self.data.uncomputableValues?.[term.term.values[k]?.label]) {
				items.push({
					text: `${term.term.values[k].label}, n = ${self.data.uncomputableValues[term.term.values[k].label]}`,
					noIcon: true,
					/** Need to specify that this is a hidden value for
					 * text styling in the legend but not a plot to avoid
					 * rendering a tooltip or click events.
					 */
					isHidden: true,
					isClickable: false,
					hiddenOpacity: 1
				})
			}
		}
		if (items.length) {
			const name =
				self.config.term2?.term.type === 'float' || self.config.term2?.term.type === 'integer'
					? `<span style="${headingStyle}">${term.term.name}</span>`
					: `<span style="${headingStyle}">Other categories</span>`
			legendGrps.push({ name, items })
		}
	}
}

function addHiddenValues(term, legendGrps, headingStyle) {
	const items = []
	for (const key of Object.keys(term.q.hiddenValues)) {
		items.push({
			text: `${key}`,
			noIcon: true,
			/** Need to specify that this is a hidden value for
			 * text styling in the legend and  a plot for
			 * rendering a tooltip or click events.
			 */
			isHidden: true,
			isClickable: true,
			hiddenOpacity: 1
		})
	}
	const title = `${term.term.name}`
	const name = `<span style="${headingStyle}">${title}</span>`
	legendGrps.push({ name, items })
}
