import { axisLeft, axisTop } from 'd3-axis'
import { scaleLinear, scaleLog } from 'd3-scale'
import { curveBasis, line } from 'd3-shape'
import { brushX, brushY } from 'd3-brush'
import { renderTable, getMaxLabelWidth, table2col } from '#dom'
import { rgb } from 'd3-color'
import { format as d3format } from 'd3-format'
import { SINGLECELL_GENE_EXPRESSION } from '#types'
import type { TermWrapper } from '#types'
import { getValueConversionFactor, toUserUnit } from '#shared/helpers.js'

// const minSampleSize = 5 // a group below cutoff will not render a violin plot

type ViolinDensityBin = {
	x0: number
	density: number
}

type LegendItem = {
	text: string
	noIcon: boolean
	isHidden?: boolean
	isClickable?: boolean
	hiddenOpacity?: number
}

type LegendGroup = {
	name: string
	items: LegendItem[]
}

// const minSampleSize = 5 // a group below cutoff will not render a violin plot

/* the term whose values the numeric axis is of. a term with valueConversion{} stores its values in
one unit (e.g. day) and is read by users in another (e.g. year), so everything a user reads off this
axis is converted. the scale that maps a value to a pixel is not: the violin marks, the median line
and the range a brush turns into a filter all stay in the stored unit */
function getNumericTerm(t1: TermWrapper, t2?: TermWrapper) {
	return (t2 as any)?.q?.mode === 'continuous' ? (t2 as any).term : (t1 as any)?.term
}

export default function setViolinRenderer(self: any) {
	self.render = function () {
		const settings = self.config.settings.violin
		const isH = settings.orientation === 'horizontal'
		const t1 = self.config.term
		const t2 = self.config.term2

		//termsetting.js 'set_hiddenvalues()' adds uncomputable values from term.values to q.hiddenValues object. Since it will show up on the legend, delete that key-value pair from t2.q.hiddenValues object.
		const termNum: TermWrapper =
			t2?.term.type === 'condition' ||
			t2?.term.type === 'samplelst' ||
			t2?.term.type === 'categorical' ||
			((t2?.term.type === 'float' || t2?.term.type === 'integer') && t1.q.mode === 'continuous')
				? t2
				: t1
		if (!(termNum as any)?.q.hiddenValues) (termNum as any).q.hiddenValues = {}

		if ((termNum as any)?.term?.values) {
			for (const [k, val] of Object.entries((termNum as any).term.values)) {
				const v = val as { label: string; uncomputable?: boolean }
				if (v.uncomputable) {
					if ((termNum as any).q.hiddenValues[k]) {
						(termNum as any).q.hiddenValues[v.label] = 1
						delete (termNum as any).q.hiddenValues[k]
					}
				}
			}
		}

		//filter out hidden values and only keep plots which are not hidden in term2.q.hiddenvalues
		self.dom.violinDiv.selectAll('*').remove()
		const chartKeys = Object.keys(self.data.charts)
		if (!chartKeys?.length) {
			self.dom.banner.html(`<span>No visible violin plot data to render</span>`).style('display', 'block')
			self.dom.legendDiv.selectAll('*').remove()
			return
		}
		for (const chartKey of chartKeys) {
			const chart = self.data.charts[chartKey]
			const plots = chart.plots.filter(p => !termNum?.q?.hiddenValues?.[p.label || p.seriesId])
			if (settings.orderByMedian == true) {
				plots.sort(
					(a, b) =>
						a.summaryStats.find(x => x.id === 'median').value - b.summaryStats.find(x => x.id === 'median').value
				)
			}
			if (self.legendRenderer) self.legendRenderer(getLegendGrps(termNum, self))

			const chartDiv = self.dom.violinDiv
				.append('div')
				.attr('class', 'sjpp-vp-chartDiv')
				.style('padding', Object.keys(self.data.charts).length > 1 ? '20px 20px 0px 0px' : '0px')
			chart.chartDiv = chartDiv
			if (plots.length === 0) {
				chartDiv.html(
					` <span style="opacity:.6;font-size:1em;margin-left:90px;">No visible violin plot data to render</span>`
				)
				return
			}

			// append the svg object to the body of the page
			chartDiv.select('.sjpp-violin-plot').remove()

			//Fix for centering the chart title over the chart,
			//not the entire div.
			const chartWrapper = chartDiv.append('div').style('display', 'inline-block')
			// render chart title
			if (chart.chartId) {
				const totalCount = chart.plots.reduce((acc, plot) => acc + plot.plotValueCount, 0)
				chartWrapper
					.append('div')
					.attr('class', 'pp-chart-title')
					.style('display', 'block')
					.style('text-align', 'center')
					.style('font-size', '1.1em')
					.style('margin-bottom', '5px')
					.html(`${self.getChartTitle(chart.chartId)} (n=${totalCount})`)
			}

			// render chart data
			const svgData = renderSvg(t1, plots, chartWrapper, self, isH, settings)
			renderScale(t1, t2, settings, isH, svgData, self)
			let y = 0
			const thickness = self.settings.plotThickness || self.getAutoThickness()
			for (const plot of plots) {
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
					areaBuilder = line<ViolinDensityBin>()
						.curve(curveBasis)
						.x(d => svgData.axisScale(d.x0))
						.y(d => wScale(d.density))
				} else {
					areaBuilder = line<ViolinDensityBin>()
						.curve(curveBasis)
						.x(d => wScale(d.density))
						.y(d => svgData.axisScale(d.x0))
				}
				//if only one plot pass area builder to calculate the exact height of the plot
				const { violinG, height } = renderViolinPlot(svgData, plot, isH, wScale, areaBuilder, y)
				y += height
				if (self.opts.mode != 'minimal') renderLabels(t1, t2, violinG, plot, isH, settings)

				if (self.config.term.term.type == SINGLECELL_GENE_EXPRESSION) {
					// is sc data, disable brushing for now because 1) no use 2) avoid bug of listing cells
				} else {
					// enable brushing
					if (self.opts.mode != 'minimal') renderBrushing(t1, t2, violinG, settings, plot, isH, svgData)
				}

				self.labelHideLegendClicking(t2, plot) // FIXME
			}

			// render p-value table
			if (self.settings.showAssociationTests) self.renderPvalueTable(chartDiv, chart)
		}
	}

	self.displaySummaryStats = function (
		data: { summaryStats: { key: string; label: string; value: number }[] },
		event: MouseEvent
	) {
		const d = data as { summaryStats: { key: string; label: string; value: number }[] }
		if (!d.summaryStats) return
		self.dom.hovertip.clear().show(event.clientX, event.clientY)
		const table = table2col({ holder: self.dom.hovertip.d.append('div') })
		/* stats are computed on the stored values, so read them in the term's user-facing unit.
		every stat getDescrStats() reports scales with the unit (min, quartiles, median, max, mean,
		standard deviation) except the sample count, which is not a value of the term at all */
		const term = getNumericTerm(self.config.term, self.config.term2)
		for (const { key, label, value } of Object.values(d.summaryStats))
			table.addRow(label, key == 'total' ? value : toUserUnit(value, term))
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

	self.renderPvalueTable = function (chartDiv: any, chart: any) {
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

	self.getChartTitle = function (chartId: string) {
		if (!self.config.term0) return chartId
		return self.config.term0.term.values && chartId in self.config.term0.term.values
			? self.config.term0.term.values[chartId].label
			: chartId
	}

	function createMargins(labelsize: number, settings: any, isH: boolean, isMinimal: boolean) {
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

	function renderSvg(t1: TermWrapper, plots: any[], chartDiv: any, self: any, isH: boolean, settings: any) {
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

		return { margin: margin, svgG: svgG, axisScale: createNumericScale(self, settings, isH), violinSvg: violinSvg }
	}

	function renderScale(
		t1: TermWrapper,
		t2: TermWrapper | undefined,
		settings: any,
		isH: boolean,
		svg: any,
		self: any
	) {
		// <g>: holder of numeric axis
		const g = svg.svgG
			.append('g')
			.style('font-size', '12')
			.classed(settings.isLogScale ? 'sjpp-logscale' : 'sjpp-linearscale', true)

		/* tick labels are read by the user, so they are in the term's user-facing unit. the scale is a
		copy with a converted domain over the same pixel range, so a tick still lands where its value does */
		const f = getValueConversionFactor(getNumericTerm(t1, t2))
		const uiScale = f == 1 ? svg.axisScale : svg.axisScale.copy().domain(svg.axisScale.domain().map(v => v * f))

		const ticks = settings.isLogScale
			? uiScale.ticks(15)
			: // svg.axisScale.ticks().filter(tick => tick > 0 || tick < 0)
			  uiScale.ticks()

		g.call(
			(isH ? axisTop : axisLeft)(uiScale)
				.scale(uiScale)
				.tickFormat((d, i) => {
					const value = Number(d)
					if (settings.isLogScale) {
						if (self.app.vocabApi.termdbConfig.logscaleBase2) {
							if (ticks.length > 10 && i % 2 !== 0) return ''
							if (value < 0.1) return d3format('.3f')(value)
							return d3format('.1f')(value)
						} else {
							if (ticks.length >= 12 && i % 5 !== 0) return ''
							if (value < 50) return String(value)
							return d3format('.1s')(value)
						}
					}
					if (ticks.length >= 12 && i % 2 !== 0) return ''
					return String(value)
				})
				.tickValues(ticks)
		)

		if (self.opts.mode != 'minimal') {
			// TODO need to add term2 label onto the svg
			const numTerm = getNumericTerm(t1, t2)
			// name the unit the ticks are in, when it is not the one the values are stored in
			const n = numTerm.valueConversion ? `${numTerm.name} (${numTerm.valueConversion.toUnit}s)` : numTerm.name
			/*const lab = */svg.svgG
				.append('text')
				.text(n)
				.classed('sjpp-numeric-term-label', true)
				.attr('data-testid', `sjpp-violin-label-${n}`)
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

	function renderViolinPlot(svgData: any, plot: any, isH: boolean, wScale: any, areaBuilder: any, y: number) {
		const label = plot.label?.split(',')[0]
		const catTerm = self.config.term.q.mode == 'discrete' ? self.config.term : self.config.term2
		const category = catTerm?.term.values
			? ((Object.values(catTerm.term.values as Record<string, { label: string; color?: string }>).find(
					o => o.label == label
			  ) as { label: string; color?: string } | undefined) ?? null)
			: null
		let color
		if (catTerm) {
			if (catTerm.q.type == 'predefined-groupset' || catTerm.q.type == 'custom-groupset') {
				const groupset =
					catTerm.q.type == 'predefined-groupset'
						? catTerm.term.groupsetting.lst[catTerm.q.predefined_groupset_idx]
						: catTerm.q.customset
				if (!groupset) throw 'groupset is missing'
				const group = groupset.groups.find(g => g.name == label)
				if (group?.color) color = group.color
			} else {
				color = category?.color
			}
		}

		if (!color) color = self.config.settings.violin.defaultColor

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
		const height = self.getPlotThicknessWithPadding()
		const translate = isH ? `translate(0, ${y + height / 2}) ` : `translate(${y + height / 2}, 0)`
		violinG.attr('transform', translate)

		return { violinG, height }
	}

	// label for each violin (on left when horizontal)
	function renderLabels(t1: any, t2: any, violinG: any, plot: any, isH: boolean, settings: any) {
		violinG
			.append('text')
			.attr('data-testid', 'sjpp-violin-label')
			.text(`${plot.label}, n=${plot.plotValueCount}`)
			.style('cursor', 'pointer')
			.on('click', function (event: MouseEvent) {
				if (!event) return
				self.displayLabelClickMenu(t1, t2, plot, event)
			})
			.on('mouseover', function (event: MouseEvent, d: any) {
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

	function renderArea(violinG: any, plot: any, areaBuilder: any) {
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

	function renderSymbolImage(self: any, violinG: any, plot: any, isH: boolean) {
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

	function renderMedian(violinG: any, isH: boolean, plot: any, svgData: any, self: any) {
		const s = self.config.settings.violin
		//render median values on plots
		const median = svgData.axisScale(plot.summaryStats.median.value)
		if (plot.plotValueCount >= 2) {
			violinG
				.append('line')
				.attr('class', 'sjpp-median-line')
				.style('stroke-width', s.medianThickness)
				.style('stroke', s.medianColor)
				.style('opacity', '0.5')
				.attr('y1', isH ? -s.medianLength : median)
				.attr('y2', isH ? s.medianLength : median)
				.attr('x1', isH ? median : -s.medianLength)
				.attr('x2', isH ? median : s.medianLength)
		} else return
	}

	function renderLines(violinG: any, isH: boolean, lines: number[] | undefined, svgData: any) {
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

	function renderBrushing(t1: any, t2: any, violinG: any, settings: any, plot: any, isH: boolean, svgData: any) {
		//brushing on data points
		if (settings.datasymbol === 'rug' || settings.datasymbol === 'bean') {
			const br = isH
				? brushX()
						.extent([
							[0, -20],
							[settings.svgw, 20]
						])
						.on('end', event => {
							if (!event.selection) return
							self.displayBrushMenu(t1, t2, self, plot, event, svgData.axisScale, isH)
							document.body.addEventListener('pointerdown', onClickOut, true)
						})
				: brushY()
						.extent([
							[-20, 0],
							[20, settings.svgw]
						])
						.on('end', event => {
							if (!event.selection) return
							self.displayBrushMenu(t1, t2, self, plot, event, svgData.axisScale, isH)
							document.body.addEventListener('pointerdown', onClickOut, true)
						})

			const brushG = violinG.append('g').classed('sjpp-brush', true).call(br)

			// clear brush when clicking outside of it
			const onClickOut = (e: PointerEvent) => {
				if (!brushG || !br) return
				if (!brushG.node().contains(e.target)) br.clear(brushG)
				document.body.removeEventListener('pointerdown', onClickOut, true)
			}
		}
	}
}

// creates numeric axis
export function createNumericScale(self, settings, isH) {
	let axisScale
	if (settings.isLogScale) {
		axisScale = scaleLog()
				.base(self.app.vocabApi.termdbConfig.logscaleBase2 ? 2 : 10)
				.domain([self.data.min, self.data.max])
				.range(isH ? [0, settings.svgw] : [settings.svgw, 0])
	} else {
		axisScale = scaleLinear()
				.domain([self.data.min, self.data.max])
				.range(isH ? [0, settings.svgw] : [settings.svgw, 0])
	}
	return axisScale
}

function getLegendGrps(termNum: TermWrapper, self: any) {
	const legendGrps: LegendGroup[] = [],
		t1 = self.config.term,
		t2 = self.config.term2,
		// changed color from #aaa to address Section 508 contrast issue
		headingStyle = 'color: #555; font-weight: 400'
	if (self.settings.showStats) addDescriptiveStats(t1, legendGrps, headingStyle, self)
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

function addDescriptiveStats(term: TermWrapper, legendGrps: LegendGroup[], headingStyle: string, self: any) {
	const descrStats = (term as any)?.q?.descrStats as Record<string, { label: string; value: number | string }> | undefined
	if (descrStats) {
		const items: LegendItem[] = Object.values(descrStats).map(stat => {
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

function addUncomputableValues(
	term: TermWrapper | null,
	legendGrps: LegendGroup[],
	headingStyle: string,
	self: any
) {
	if (term?.term.values) {
		const items: LegendItem[] = []
		const values = term.term.values as Record<string, { label?: string }>
		for (const k in values) {
			const label = values[k]?.label
			if (!label) continue
			if (self.data.uncomputableValues?.[label]) {
				items.push({
					text: `${label}, n = ${self.data.uncomputableValues[label]}`,
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

function addHiddenValues(term: TermWrapper, legendGrps: LegendGroup[], headingStyle: string) {
	const items: LegendItem[] = []
	for (const key of Object.keys(term.q.hiddenValues || {})) {
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
