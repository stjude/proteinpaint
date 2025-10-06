import { axisLeft, axisTop } from 'd3-axis'
import { scaleLinear, scaleLog } from 'd3-scale'
import { curveBasis, line } from 'd3-shape'
import { brushX, brushY } from 'd3-brush'
import { renderTable, getMaxLabelWidth, table2col } from '#dom'
import { rgb } from 'd3'
import { format as d3format } from 'd3-format'
import { TermTypes } from '#shared/terms.js'

const minSampleSize = 5 // a group below cutoff will not render a violin plot

export default function setViolinRenderer(self) {
	self.render = async function () {
		const settings = self.config.settings.violin
		const isH = settings.orientation === 'horizontal'

		// violin tw, overlay tw. only one of them can be q.mode=continuous
		let vtw, otw
		if (self.config.term.q.mode == 'continuous') {
			vtw = self.config.term
			otw = self.config.term2 // could be missing
		} else {
			vtw = self.config.term2 // both must be present
			otw = self.config.term
		}

		if (otw?.term?.values) {
			//filter out hidden values and only keep plots which are not hidden in term2.q.hiddenvalues
			for (const [k, v] of Object.entries(otw.term.values)) {
				if (v.uncomputable) {
					if (otw.q.hiddenValues[k]) {
						otw.q.hiddenValues[v.label] = 1
						delete otw.q.hiddenValues[k]
					}
				}
			}
		}

		self.dom.violinDiv.selectAll('*').remove()

		for (const chartKey of Object.keys(self.data.charts)) {
			const chart = self.data.charts[chartKey]
			const plots = chart.plots.filter(p => !otw?.q?.hiddenValues?.[p.label || p.seriesId])
			if (settings.orderByMedian) {
				plots.sort(
					(a, b) =>
						a.summaryStats.find(x => x.id === 'median').value - b.summaryStats.find(x => x.id === 'median').value
				)
			}

			const chartDiv = self.dom.violinDiv
				.append('div')
				.attr('class', 'sjpp-vp-chartDiv')
				.style('padding', Object.keys(self.data.charts).length > 1 ? '20px 20px 0px 0px' : '0px')
			chart.chartDiv = chartDiv
			if (plots.length === 0) {
				chartDiv.html(` <span style="opacity:.6;font-size:1em;margin-left:90px;">No data to render Violin Plot</span>`)
				return
			}

			chartDiv.select('.sjpp-violin-plot').remove()

			// render chart title
			chartDiv
				.append('div')
				.attr('class', 'pp-chart-title')
				.style('display', chart.chartId ? 'block' : 'none')
				.style('text-align', 'center')
				.style('font-size', '1.1em')
				.style('margin-bottom', '20px')
				.html('xx' + self.getChartTitle(chart.chartId))

			// render chart data
			const svgData = renderSvg(vtw, plots, chartDiv, self, isH, settings)
			renderScale(vtw, settings, isH, svgData, self)
			let y = 0
			const thickness = self.settings.plotThickness || self.getAutoThickness()
			for (const [plotIdx, plot] of plots.entries()) {
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
				const { violinG, height } = renderViolinPlot(svgData, plot, isH, wScale, areaBuilder, y)
				y += height
				if (self.opts.mode != 'minimal') renderLabels(t1, t2, violinG, plot, isH, settings)

				if (self.config.term.term.type == TermTypes.SINGLECELL_GENE_EXPRESSION) {
					// is sc data, disable brushing for now because 1) no use 2) avoid bug of listing cells
				} else {
					// enable brushing
					if (self.opts.mode != 'minimal') renderBrushing(t1, t2, violinG, settings, plot, isH, svgData)
				}
			}
			self.renderPvalueTable(chartDiv, chart)
		}
		self.renderLegend(termNum) // create one legend even if there are multiple charts from divideby
	}

	self.renderLegend = function (termNum) {
		if (!self.legendRenderer) return
		const legendGrps = [],
			headingStyle = 'opacity:0.6;font-weight:normal'
		let tw1, tw2
		if (self.config.term.q.mode == 'continuous') {
			tw1 = self.config.term
			tw2 = self.config.term2
		} else {
			tw1 = self.config.term2
			tw2 = self.config.term1
		}
		if (self.settings.showStats) {
			addDescriptiveStats(tw1, legendGrps, headingStyle, self)
		}

		addUncomputableValues(
			tw1.q.hiddenValues && Object.keys(tw1?.q.hiddenValues).length > 0 ? tw1 : null,
			legendGrps,
			headingStyle,
			self
		)
		self.legendRenderer(legendGrps)

		if (0) {
			if (tw.q.hiddenValues && Object.entries(termNum.q.hiddenValues).length != 0) {
				const items = []
				for (const key of Object.keys(termNum.q.hiddenValues)) {
					items.push({
						text: key,
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
				self.hiddenRenderer([
					{
						name: `<span style="${headingStyle}">${termNum.term.name}</span>`,
						items
					}
				])
			}
		}
	}

	self.displaySummaryStats = function (d, event) {
		if (!d.summaryStats) return
		self.dom.hovertip.clear().show(event.clientX, event.clientY)
		const table = table2col({ holder: self.dom.hovertip.d.append('div') })
		for (const { label, value } of Object.values(d.summaryStats)) table.addRow(label, value)
	}
	self.getAutoThickness = function () {
		let maxPlotCount = 0
		for (const k of Object.keys(this.data.charts)) {
			const chart = this.data.charts[k]
			maxPlotCount = Math.max(maxPlotCount, chart.plots.length)
		}
		if (maxPlotCount == 1) return 150
		return Math.min(100, Math.max(40, 600 / maxPlotCount)) //clamp between 60 and 130
	}

	self.getPlotThicknessWithPadding = function () {
		const plotThickness = self.settings.plotThickness || self.getAutoThickness()
		return plotThickness + self.settings.rowSpace
	}

	self.renderPvalueTable = function (chartDiv, chart) {
		if (!self.settings.showAssociationTests) return
		if (!chart.pvalues) return
		const tableHolder = chartDiv
			.append('div')
			.classed('sjpp-tableHolder', true)
			.style('display', 'inline-block')
			.style('padding', '10px')
			.style('vertical-align', 'top')
			.style('margin-left', '0px')
			.style('margin-top', '30px')
			.style('margin-right', '30px')

		const t1 = self.config.term
		const t2 = self.config.term2

		if (!t2) {
			// no term2, no table to show
			tableHolder.style('display', 'none')
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
		const pvalues = chart.pvalues.filter(arr => {
			for (let i = 0; i < arr.length; i++) {
				if (typeof arr[i].value === 'string') {
					if (termNum.q?.hiddenValues && arr[i].value in termNum.q.hiddenValues) {
						return false
					}
				}
			}
			return true
		})

		tableHolder
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.append('div')
			.style('font-weight', 'bold')
			.text(pvalues.length > 0 ? "Group comparisons (Wilcoxon's rank sum test)" : '')

		const columns = [{ label: 'Group 1' }, { label: 'Group 2' }, { label: 'P-value' }]
		const rows = pvalues
		const isH = this.settings.orientation === 'horizontal'
		const maxHeight = isH
			? self.getPlotThicknessWithPadding() * chart.plots.length + 10 //add axes height
			: this.settings.svgw + this.config.term.term.name.length
		renderTable({
			rows,
			columns,
			div: tableHolder,
			showLines: false,
			maxWidth: '27vw',
			maxHeight: `${maxHeight}px`,
			resize: true
		})
	}

	self.getChartTitle = function (chartId) {
		if (!self.config.term0) return chartId
		return self.config.term0.term.values && chartId in self.config.term0.term.values
			? self.config.term0.term.values[chartId].label
			: chartId
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

	function renderSvg(t1, plots, chartDiv, self, isH, settings) {
		const violinDiv = chartDiv
			.append('div')
			.style('display', 'inline-block')
			.style('padding', self.opts.mode != 'minimal' ? '5px' : '0px')
			.style('overflow', 'auto')
			.style('scrollbar-width', 'none')

		const violinSvg = violinDiv.append('svg')

		const labelsize = getMaxLabelWidth(
			violinSvg,
			plots.map(plot => `${plot.label}, n=${plot.plotValueCount}`)
		)

		const margin = createMargins(labelsize, settings, isH, self.opts.mode == 'minimal')
		const plotThickness = self.getPlotThicknessWithPadding()
		const width = margin.left + margin.top + (isH ? settings.svgw : plotThickness * plots.length + t1.term.name.length)
		const height =
			margin.bottom + margin.top + (isH ? plotThickness * plots.length : settings.svgw + t1.term.name.length)

		violinSvg
			.attr('width', width)
			.attr('height', height)
			.classed('sjpp-violin-plot', true)
			.attr('data-testid', 'sja_violin_plot')

		// a <g> in which everything is rendered into
		const svgG = violinSvg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

		return { margin, svgG, axisScale: createNumericScale(self, settings, isH), violinSvg }
	}

	function renderScale(tw, settings, isH, svg, self) {
		// <g>: holder of numeric axis
		const g = svg.svgG
			.append('g')
			.style('font-size', '12')
			.classed(settings.unit === 'log' ? 'sjpp-logscale' : 'sjpp-linearscale', true)

		const ticks = settings.unit === 'log' ? svg.axisScale.ticks(15) : svg.axisScale.ticks()

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
			const lab = svg.svgG
				.append('text')
				.text(tw.term.name)
				.classed('sjpp-numeric-term-label', true)
				.style('font-weight', 600)
				.attr('text-anchor', 'middle')
				.attr('x', isH ? settings.svgw / 2 : -settings.svgw / 2)
				.attr('y', isH ? -30 : -45)
				.style('opacity', 0)
				.attr('transform', isH ? null : 'rotate(-90)')
				.style('opacity', 1)
		}
	}

	function renderViolinPlot(svgData, plot, isH, wScale, areaBuilder, y) {
		const label = plot.label?.split(',')[0]
		const catTerm = self.config.term.q.mode == 'discrete' ? self.config.term : self.config.term2
		const category = catTerm?.term.values ? Object.values(catTerm.term.values).find(o => o.label == label) : null

		const color = category?.color ? category.color : self.config.settings.violin.defaultColor
		if (!plot.color) plot.color = color
		if (category && !category.color) category.color = color
		// <g> of one plot
		// adding .5 to plotIdx allows to anchor each plot <g> to the middle point
		const svg = svgData.svgG
		const violinG = svg.append('g').datum(plot).attr('class', 'sjpp-violinG')
		renderArea(violinG, plot, areaBuilder)
		//render symmetrical violin plot
		renderArea(violinG, plot, isH ? areaBuilder.y(d => -wScale(d.density)) : areaBuilder.x(d => -wScale(d.density)))

		renderSymbolImage(self, violinG, plot, isH)
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

	// label for each violin (on left when horizontal)
	function renderLabels(t1, t2, violinG, plot, isH, settings) {
		violinG
			.append('text')
			.attr('data-testid', 'sjpp-violin-label')
			.text(`${plot.label}, n=${plot.plotValueCount}`)
			.style('cursor', 'pointer')
			.on('click', function (event) {
				if (!event) return
				self.displayLabelClickMenu(t1, t2, plot, event)
			})
			.on('mouseover', function (event, d) {
				event.stopPropagation()
				if (!event) return
				self.displaySummaryStats(d, event)
			})
			.on('mouseout', function () {
				self.dom.hovertip.hide()
			})
			.style('opacity', 0)
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
			.style('opacity', '0.8')
			.attr('d', areaBuilder(plot.density.bins))
	}

	function renderSymbolImage(self, violinG, plot, isH) {
		const i = violinG
			.append('image')
			.style('opacity', 0)
			.classed(self.config.settings.violin.datasymbol === 'rug' ? 'sjpp-rug-img' : 'sjpp-beans-img', true)
			.style('opacity', 1)
			.attr('xlink:href', plot.src)
			.attr(
				'transform',
				isH ? `translate(0, -${self.settings.radius / 2})` : `translate(-${self.settings.radius / 2}, 0)`
			)
		// set image dimension for crisp look
		if (self.settings.orientation == 'horizontal') {
			i.attr('width', self.settings.svgw)
		} else if (self.settings.orientation == 'vertical') {
			i.attr('height', self.settings.svgw)
		}
	}

	function renderMedian(violinG, isH, plot, svgData, self) {
		const s = self.config.settings.violin
		//render median values on plots
		const median = svgData.axisScale(plot.summaryStats.median.value)
		if (plot.plotValueCount >= 2) {
			violinG
				.append('line')
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

function addDescriptiveStats(term, legendGrps, headingStyle, self) {
	if (term?.q.descrStats) {
		const items = Object.values(term.q.descrStats).map(stat => {
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

function addHiddenValues(term, legendGrps, headingStyle) {}
