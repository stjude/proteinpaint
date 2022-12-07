import { axisLeft, axisTop } from 'd3-axis'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { area, curveBumpX, curveBumpY } from 'd3-shape'
import { schemeCategory10 } from 'd3-scale-chromatic'
import { brushX } from 'd3'
import { renderTable } from '../dom/table'

export default function violinRenderer(self) {
	const k2c = scaleOrdinal(schemeCategory10)

	self.render = function() {
		if (self.data.plots.length == 0) {
			self.dom.holder.html(
				` <span style="opacity:.6;font-size:1em;margin-left:90px;">No data to render Violin Plot</span>`
			)
			self.dom.legendHolder.selectAll('*').remove()
			return
		} else self.dom.holder.select('*').remove()

		// append the svg object to the body of the page
		self.dom.holder.select('.sjpp-violin-plot').remove()

		const violinDiv = self.dom.holder
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '5px')
			.style('overflow', 'auto')
			.style('scrollbar-width', 'none')

		const svg = violinDiv.append('svg')

		// test render all labels to get max label width
		let maxLabelSize = 0
		for (const p of self.data.plots) {
			const l = svg.append('text').text(p.label)
			maxLabelSize = Math.max(maxLabelSize, l.node().getBBox().width)
			l.remove()
		}

		const isH = self.config.settings.violin.orientation == 'horizontal'
		const axisHeight = 80

		// Render the violin plot
		let margin
		if (isH) {
			margin = { left: maxLabelSize + 5, top: axisHeight, right: 50, bottom: 10 }
		} else {
			margin = { left: axisHeight, top: 50, right: 50, bottom: maxLabelSize }
		}

		const plotLength = 500, // span length of a plot, not including margin
			// thickness of a plot
			plotThickness =
				self.data.plots.length < 2
					? 150
					: self.data.plots.length >= 2 && self.data.plots.length < 5
					? 120
					: self.data.plots.length >= 5 && self.data.plots.length < 8
					? 90
					: self.data.plots.length >= 8 && self.data.plots.length < 11
					? 75
					: 60

		svg
			.attr(
				'width',
				margin.left +
					margin.top +
					(isH ? plotLength : plotThickness * self.data.plots.length + self.config.term.term.name.length)
			)
			.attr(
				'height',
				margin.bottom +
					margin.top +
					(isH ? plotThickness * self.data.plots.length : plotLength + self.config.term.term.name.length)
			)
			.classed('sjpp-violin-plot', true)

		// a <g> in which everything is rendered into
		const svgG = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

		// creates numeric axis
		const axisScale = scaleLinear()
			.domain([self.data.min - self.data.max / 10, self.data.max + self.data.max / 10])
			.range(isH ? [0, plotLength] : [plotLength, 0])

		{
			// <g>: holder of numeric axis
			const g = svgG.append('g')
			g.call((isH ? axisTop : axisLeft)().scale(axisScale))

			let lab

			// TODO need to add term2 label onto the svg
			if (self.config.term2?.q?.mode == 'continuous') lab = svgG.append('text').text(self.config.term2.term.name)
			else lab = svgG.append('text').text(self.config.term.term.name)

			if (isH) {
				lab
					.attr('x', plotLength / 2)
					.attr('y', -30)
					.attr('text-anchor', 'middle')
			} else {
				lab
					.attr('y', 0 - margin.top - 5)
					.attr('x', -plotLength / 2)
					.attr('text-anchor', 'middle')
					.attr('transform', 'rotate(-90)')
			}
		}

		for (const [plotIdx, plot] of self.data.plots.entries()) {
			// <g> of one plot
			// adding .5 to plotIdx allows to anchor each plot <g> to the middle point

			const violinG = svgG
				.append('g')
				.attr(
					'transform',
					isH
						? 'translate(0,' + plotThickness * (plotIdx + 0.5) + ')'
						: 'translate(' + plotThickness * (plotIdx + 0.5) + ',0)'
				)
				.attr('classed', 'sjpp-violinG')

			// create label
			const label = violinG.append('text').text(plot.label)
			if (isH) {
				label
					.attr('x', -5)
					.attr('y', 0)
					.attr('text-anchor', 'end')
					.attr('dominant-baseline', 'central')
			} else {
				label
					.attr('x', 0 - plotLength - 5)
					.attr('y', 0)
					.attr('text-anchor', 'end')
					.attr('dominant-baseline', 'central')
					.attr('transform', 'rotate(-90)')
			}

			// times 0.45 will leave out 10% as spacing between plots
			const wScale = scaleLinear()
				.domain([-plot.biggestBin, plot.biggestBin])
				.range([-plotThickness * 0.45, plotThickness * 0.45])

			let areaBuilder
			if (isH) {
				areaBuilder = area()
					.y0(d => wScale(-d.binValueCount))
					.y1(d => wScale(d.binValueCount))
					.x(d => axisScale(d.x0))
					.curve(curveBumpX)
			} else {
				areaBuilder = area()
					.x0(d => wScale(-d.binValueCount))
					.x1(d => wScale(d.binValueCount))
					.y(d => axisScale(d.x0))
					.curve(curveBumpY)
			}

			violinG
				.append('path')
				.style('fill', k2c(plotIdx))
				.style('opacity', '0.8')
				.attr('d', areaBuilder(plot.plotValueCount > 3 ? plot.bins : 0)) //do not build violin plots for values 3 or less than 3.

			violinG
				.append('image')
				.attr('xlink:href', plot.src)
				.attr('transform', isH ? 'translate(0, -9)' : 'translate(-9, 0)')

			//render median values on plots
			if (plot.plotValueCount >= 2) {
				violinG
					.append('line')
					.attr('class', 'sjpp-median-line')
					.style('stroke-width', '3')
					.style('stroke', 'red')
					.style('opacity', '1')
					.attr('y1', isH ? -7 : axisScale(plot.median))
					.attr('y2', isH ? 7 : axisScale(plot.median))
					.attr('x1', isH ? axisScale(plot.median) : -7)
					.attr('x2', isH ? axisScale(plot.median) : 7)
			} else return

			violinG
				.append('g')
				.attr('classed', 'sjpp-brush')
				.call(
					brushX()
						.extent([[0, -20], [plotLength, 20]])
						.on('', async event => {
							const selection = event.selection
							// console.log(187, selection);
							if (!selection) return
							const start = axisScale.invert(selection[0])
							const end = axisScale.invert(selection[1])
							self.app.dispatch({
								type: 'plot_edit',
								id: self.id,
								config: {
									settings: {
										violin: {
											brushRange: { start, end, plotIdx }
										}
									}
								}
							})
						})
				)
		}
	}

	self.renderBrushValues = function() {
		const range = self.config.settings.violin.brushRange
		if (!range) return //also delete the table
		const plot = self.data.plots[range.plotIdx]
		const values = plot.values.filter(v => v >= range.start && v <= range.end)
		// console.log(212, values);
	}

	self.renderPvalueTable = function() {
		this.dom.tableHolder
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.selectAll('*')
			.remove()

		const t2 = this.config.term2

		if (t2 == undefined || t2 == null) {
			// no term2, no table to show
			this.dom.tableHolder.style('display', 'none')
			return
		}

		const title = this.dom.tableHolder
			.append('div')
			.style('font-weight', 'bold')
			.html("Group comparisons (Wilcoxon's rank sum test)")

		const table = this.dom.tableHolder.append('div')

		const columns = [{ label: 'Group 1' }, { label: 'Group 2' }, { label: 'P-value' }]
		const rows = this.data.pvalues

		renderTable({ columns, rows, div: this.dom.tableHolder, showLines: false, maxWidth: '25vw', maxHeight: '20vh' })
	}
}
