import { getCompInit } from '../rx'
import { select } from 'd3-selection'
import { axisLeft, axisBottom } from 'd3-axis'
import { scaleLinear, scaleBand } from 'd3-scale'
import { extent } from 'd3-array'
import { area, curveBumpY } from 'd3-shape'

class ViolinPlot {
	constructor(opts) {
		this.type = 'violin'
		this.dom = opts.dom
		this.violinArg = opts.violinArg
	}

	async init() {
		try {
			this.data = await this.app.vocabApi.getViolinPlotData(this.violinArg)
			if (this.dom.header)
				this.dom.header.html(
					this.opts.violinArg.config.term.term.name +
						` <span style="opacity:.6;font-size:1em;margin-left:10px;">Violin Plot</span>`
				)
		} catch (e) {
			throw e
		}
	}

	async main() {
		setRenderers(this)
	}
}

export const compViolinInit = getCompInit(ViolinPlot)

async function setRenderers(self) {
	const groups = [],
		yScaleValues = []

	if (self.violinArg.term2 != null && Object.keys(self.violinArg.term2.term.values).length > 0) {
		//Return human readable labels from term2 if available
		for (const value of Object.values(self.violinArg.term2.term.values)) groups.push(value.label)
	}

	for (const key of self.data) {
		if (self.violinArg.term2 == null || Object.keys(self.violinArg.term2.term.values).length == 0) {
			//If human readable labels in term2 not available, use label from db
			groups.push(key.labelText)
		}
		yScaleValues.push(...key.yScaleValues)
	}

	// Render the violin plot
	const margin = { top: 50, right: 50, bottom: 50, left: 70 },
		width = groups.length * 300 - margin.left - margin.right,
		height = 700 - margin.top - margin.bottom

	// append the svg object to the body of the page
	select('.sjpp-violin-plot').remove()

	let svg = self.dom.violinDiv
		.append('svg')
		.attr('width', width + margin.left + margin.right)
		.attr('height', height + margin.top + margin.bottom)
		.classed('sjpp-violin-plot', true)
		.append('g')
		.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

	const boundsWidth = width - margin.right - margin.left,
		boundsHeight = height - margin.top - margin.bottom

	const xScale = scaleBand()
		.range([0, boundsWidth])
		.domain(groups)
		.padding(0.3)

	svg
		.append('g')
		.attr('transform', 'translate(0,' + 520 + ')')
		.call(axisBottom(xScale))

	svg.select('.domain').remove()
	svg.selectAll('line').remove()

	const yScale = scaleLinear()
		.domain(extent([...yScaleValues]))
		.range([boundsHeight, 0])

	svg.append('g').call(axisLeft(yScale))

	svg.selectAll('text').style('font-size', '18px')

	for (const key of self.data) {
		const label =
			self.violinArg.term2 != null && Object.keys(self.violinArg.term2.term.values).length > 0
				? self.violinArg.term2.term.values[key.label].label
				: key.labelText

		const wScale = scaleLinear()
			.domain([-key.biggestBin, key.biggestBin])
			.range([0, xScale.bandwidth()])

		const areaBuilder = area()
			.x0(d => wScale(-d.lst.length))
			.x1(d => wScale(d.lst.length))
			.y(d => yScale(d.x0))
			.curve(curveBumpY)

		svg
			.selectAll('myViolin')
			.data(self.data)
			.enter() // So now we are working group per group
			.append('g')
			.attr('transform', function(d) {
				return 'translate(' + xScale(label) + ' ,0)'
			}) // Translation on the right to be at the group position
			.append('path')
			.datum(function(d) {
				return d.lst
			}) // So now we are working bin per bin
			.style('stroke', 'navy')
			.style('fill', '#dfdef0')
			.style('padding', 5)
			.style('opacity', 0.7)
			.attr('d', areaBuilder(key.bins))
	}
}
