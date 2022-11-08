import { axisLeft, axisTop } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { area, curveBumpX, curveBumpY } from 'd3-shape'

export default function violinRenderer(self) {
	const plotColor = '#c6c4f2'

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
					? 100
					: self.data.plots.length >= 2 && self.data.plots.length < 5
					? 80
					: self.data.plots.length >= 5 && self.data.plots.length < 8
					? 60
					: self.data.plots.length >= 8 && self.data.plots.length < 11
					? 50
					: 40

		svg
			.attr(
				'width',
				margin.left +
					margin.right +
					(isH ? plotLength : plotThickness * self.data.plots.length + self.config.term.term.name.length)
			)
			.attr(
				'height',
				margin.bottom +
					margin.top +
					(isH ? plotThickness * self.data.plots.length : plotLength + self.config.term.term.name.length)
			)
			.classed('sjpp-violin-plot', true)

		const svgWidth = margin.left + margin.right + plotThickness * self.data.plots.length

		// a <g> in which everything is rendered into
		const svgG = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

		// creates numeric axis
		const axisScale = scaleLinear()
			.domain([self.data.min, self.data.max])
			.range(isH ? [0, plotLength] : [plotLength, 0])

		{
			// <g>: holder of numeric axis
			const g = svgG.append('g')
			g.call((isH ? axisTop : axisLeft)().scale(axisScale))

			const lab = svgG.append('text').text(self.config.term.term.name)

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
				.style('fill', plotColor)
				.attr('d', areaBuilder(plot.bins))
		}

		self.getLegendGrps()
	}
}
