import { axisLeft, axisTop } from 'd3-axis'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { area, curveBumpX, curveBumpY } from 'd3-shape'
import { getColors } from '#shared/common'
import { brushX, brushY } from 'd3-brush'
import { renderTable } from '#dom/table'
import { Menu } from '../dom/menu'
import { rgb } from 'd3'

export default function violinRenderer(self) {
	self.render = function() {
		const settings = self.config.settings.violin
		const isH = settings.orientation === 'horizontal'
		const imageOffset = settings.datasymbol === 'bean' ? settings.radius * window.devicePixelRatio : settings.radius
		const t1 = self.config.term
		const t2 = self.config.term2
		const tip = new Menu({ padding: '5px' })
		self.dom.tip = tip

		//termsetting.js 'set_hiddenvalues()' adds uncomputable values from term.values to q.hiddenValues object. Since it will show up on the legend, delete that key-value pair from t2.q.hiddenValues object.
		//hiddenValues are only subject to term2 when there are more than 1 categories in violin plot so safe to only delete uncomputable values from t2.q.hiddenValues and leave t1.q.hiddenValues as is.
		const termNum = t2 ? t2 : t1
		if (termNum && termNum.term?.values) {
			for (const [k, v] of Object.entries(termNum.term.values)) {
				if (v.uncomputable) {
					if (termNum.q.hiddenValues[k]) delete termNum.q.hiddenValues[k]
				}
			}
		}
		//filter out hidden values and only keep plots which are not hidden in term2.q.hiddenvalues
		self.data.plots = self.data.plots.filter(p => !t2?.q?.hiddenValues?.[p.label || p.seriesId])
		this.k2c = getColors(self.data.plots.length)
		if (self.legendRenderer) self.legendRenderer(getLegendGrps(self))

		if (self.data.plots.length === 0) {
			self.dom.violinDiv.html(
				` <span style="opacity:.6;font-size:1em;margin-left:90px;">No data to render Violin Plot</span>`
			)
			self.dom.legendDiv.selectAll('*').remove()
			self.dom.tableHolder.selectAll('.sjpp-tableHolder')._parents[0].remove()
			return
		} else self.dom.violinDiv.select('*').remove()

		//if only one plot is rendered then remove p-value table.
		if (self.data.plots.length === 1) self.dom.tableHolder.selectAll('.sjpp-tableHolder')._parents[0].remove()

		// append the svg object to the body of the page
		self.dom.violinDiv.select('.sjpp-violin-plot').remove()

		const svg = renderSvg(t1, self, isH, settings)
		renderScale(t1, t2, settings, isH, svg)

		for (const [plotIdx, plot] of self.data.plots.entries()) {
			const violinG = createViolinG(svg, plot, plotIdx, isH)
			if (self.opts.mode != 'minimal') renderLabels(t1, t2, violinG, plot, isH, settings, tip)
			renderViolinPlot(plot, self, isH, svg, plotIdx, violinG, imageOffset)
			if (self.opts.mode != 'minimal') renderBrushing(t1, t2, violinG, settings, plot, isH, svg)
			self.labelHideLegendClicking(t2, plot)
		}
	}

	self.displaySummaryStats = function(d, event, tip) {
		const rows = [`<tr><td colspan=2 style='padding:3px; text-align:center'>${d.label.split(',')[0]}</td></tr>`]
		if (d.summaryStats) {
			rows.push(`<tr>
							<td style='padding:3px; color:#aaa'>${d.summaryStats.values.find(x => x.id === 'total').label}</td>
							<td style='padding:3px; text-align:center'>n=${d.summaryStats.values.find(x => x.id === 'total').value}
							<tr>
							<td style='padding:3px; color:#aaa'>${d.summaryStats.values.find(x => x.id === 'min').label}</td>
							<td style='padding:3px; text-align:center'>${d.summaryStats.values.find(x => x.id === 'min').value}
							<tr>
							<td style='padding:3px; color:#aaa'>${d.summaryStats.values.find(x => x.id === 'p25').label}</td>
							<td style='padding:3px; text-align:center'>${d.summaryStats.values.find(x => x.id === 'p25').value}
							<tr>
							<td style='padding:3px; color:#aaa'>${d.summaryStats.values.find(x => x.id === 'mean').label}</td>
							<td style='padding:3px; text-align:center'>${d.summaryStats.values.find(x => x.id === 'mean').value}
							<tr>
							<td style='padding:3px; color:#aaa'>${d.summaryStats.values.find(x => x.id === 'median').label}</td>
							<td style='padding:3px; text-align:center'>${d.summaryStats.values.find(x => x.id === 'median').value}
							<tr>
							<td style='padding:3px; color:#aaa'>${d.summaryStats.values.find(x => x.id === 'p75').label}</td>
							<td style='padding:3px; text-align:center'>${d.summaryStats.values.find(x => x.id === 'p75').value}
							<tr>
							<td style='padding:3px; color:#aaa'>${d.summaryStats.values.find(x => x.id === 'max').label}</td>
							<td style='padding:3px; text-align:center'>${d.summaryStats.values.find(x => x.id === 'max').value}
							<tr>
							<td style='padding:3px; color:#aaa'>${d.summaryStats.values.find(x => x.id === 'variance').label}</td>
							<td style='padding:3px; text-align:center'>${d.summaryStats.values.find(x => x.id === 'variance').value}
							<tr>
							<td style='padding:3px; color:#aaa'>${d.summaryStats.values.find(x => x.id === 'SD').label}</td>
							<td style='padding:3px; text-align:center'>${d.summaryStats.values.find(x => x.id === 'SD').value}
							`)
		}
		tip.show(event.clientX, event.clientY).d.html(`<table class='sja_simpletable'>${rows.join('\n')}</table>`)
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
			.text(self.data.pvalues.length > 0 ? "Group comparisons (Wilcoxon's rank sum test)" : '')

		const columns = [{ label: 'Group 1' }, { label: 'Group 2' }, { label: 'P-value' }]
		const rows = self.data.pvalues

		renderTable({
			rows,
			columns,
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

		const labelsize = maxLabelSize(self, violinSvg)

		const margin = createMargins(labelsize, settings, isH, self.opts.mode == 'minimal')

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
		const g = svg.svgG.append('g')
		// .transition()
		// .duration(self.opts.mode == 'minimal' ? 0 : 800)
		// .delay(self.opts.mode == 'minimal' ? 0 : 100)
		g.call((isH ? axisTop : axisLeft)().scale(svg.axisScale))

		if (self.opts.mode != 'minimal') {
			let lab

			// TODO need to add term2 label onto the svg
			lab = svg.svgG
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

	function renderLabels(t1, t2, violinG, plot, isH, settings, tip) {
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
			.on('mouseover', function(event, d) {
				event.stopPropagation()
				if (!event) return
				self.displaySummaryStats(d, event, tip)
			})
			.on('mouseout', function() {
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
		const label = plot.label.split(',')[0]
		const catTerm = self.config.term.q.mode == 'discrete' ? self.config.term : self.config.term2
		console.log(catTerm)
		const category = catTerm?.term.values ? Object.values(catTerm.term.values).find(o => o.label == label) : null
		console.log(category)
		const color = category?.color ? category.color : plot.divideTwBins ? plot.divideTwBins.color : self.k2c(plotIdx)
		violinG
			.append('path')
			.attr('class', 'sjpp-vp-path')
			.style('fill', self.opts.mode === 'minimal' ? rgb(221, 221, 221) : plot.color ? plot.color : color)
			.style('opacity', 0)
			// .transition()
			// .delay(self.opts.mode == 'minimal' ? 0 : 300)
			// .duration(self.opts.mode == 'minimal' ? 0 : 600)
			.style('opacity', '0.8')
			.attr('d', areaBuilder(plot.plotValueCount > 3 ? plot.bins : 0)) //do not build violin plots for values 3 or less than 3.

		renderSymbolImage(violinG, plot, isH, imageOffset)
		if (self.opts.mode != 'minimal') renderMedian(violinG, isH, plot, svg)
		renderLines(violinG, isH, self.config.settings.violin.lines, svg)
	}

	function renderSymbolImage(violinG, plot, isH, imageOffset) {
		violinG
			.append('image')
			.style('opacity', 0)
			// .transition()
			// .delay(self.opts.mode == 'minimal' ? 0 : 400)
			// .duration(self.opts.mode == 'minimal' ? 0 : 100)
			.style('opacity', 1)
			.attr('xlink:href', plot.src)
			.attr('transform', isH ? `translate(0, -${imageOffset})` : `translate(-${imageOffset}, 0)`)
	}

	function renderMedian(violinG, isH, plot, svg) {
		//render median values on plots
		if (plot.plotValueCount >= 2) {
			violinG
				.append('line')
				// .transition()
				// .delay(600)
				// .duration(30)
				.style('opacity', 1)
				.attr('class', 'sjpp-median-line')
				.style('stroke-width', '3')
				.style('stroke', 'red')
				.style('opacity', '1')
				.attr('y1', isH ? -7 : svg.axisScale(plot.summaryStats.values.find(x => x.id === 'median').value))
				.attr('y2', isH ? 7 : svg.axisScale(plot.summaryStats.values.find(x => x.id === 'median').value))
				.attr('x1', isH ? svg.axisScale(plot.summaryStats.values.find(x => x.id === 'median').value) : -7)
				.attr('x2', isH ? svg.axisScale(plot.summaryStats.values.find(x => x.id === 'median').value) : 7)
		} else return
	}

	function renderLines(violinG, isH, lines, svg) {
		// render straight lines on plot
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
				.attr('y1', isH ? -(self.data.plotThickness / 2) : svg.axisScale(line))
				.attr('y2', isH ? self.data.plotThickness / 2 : svg.axisScale(line))
				.attr('x1', isH ? svg.axisScale(line) : -(self.data.plotThickness / 2))
				.attr('x2', isH ? svg.axisScale(line) : self.data.plotThickness / 2)
		}
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

								self.displayBrushMenu(t1, t2, self, plot, selection, svg.axisScale, isH)
							})
					: brushY()
							.extent([[-20, 0], [20, settings.svgw]])
							.on('end', async event => {
								const selection = event.selection

								if (!selection) return

								self.displayBrushMenu(t1, t2, self, plot, selection, svg.axisScale, isH)
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

// creates numeric axis
export function createNumericScale(self, settings, isH) {
	const axisScale = scaleLinear()
		.domain([self.data.min, self.data.max + self.data.max / (settings.radius * 4)])
		.range(isH ? [0, settings.svgw] : [settings.svgw, 0])
	return axisScale
}

function getLegendGrps(self) {
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

	if (self.data.uncomputableValueObj != null) {
		const items = []
		for (const [k, v] of Object.entries(self.data.uncomputableValueObj)) {
			items.push({
				text: `${k}, n = ${v}`,
				noIcon: true
			})
		}
		const title = t1.q.mode && t1.q.mode === 'continuous' ? `${t1.term.name}` : `${t2.term.name}`
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
