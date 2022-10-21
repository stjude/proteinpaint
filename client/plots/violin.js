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
		getLegendGrps(this)
	}
}

export const compViolinInit = getCompInit(ViolinPlot)

async function setRenderers(self) {
	const t2 = self.violinArg.term2
	const termName = self.violinArg.config.term.term.name

	if (self.data.length == 0) {
		self.dom.violinDiv.html(
			` <span style="opacity:.6;font-size:1em;margin-left:90px;">No data to render Violin Plot</span>`
		)
		return
	}

	const groups = [],
		yScaleValues = []

	for (const key of self.data) {
		let label =
			t2 != null && t2.term.values != undefined && Object.keys(t2.term.values).length > 0
				? t2.term.values[key.label].label
				: key.label

		if (key.yScaleValues) {
			label = `${label} (${key.yScaleValues.length})`
		}
		groups.push(label)

		yScaleValues.push(...key.yScaleValues)
	}

	// Render the violin plot
	const margin = { top: 50, right: 100, bottom: 50, left: 110 },
		height = 700 - margin.top - margin.bottom,
		width =
			(groups.length < 2
				? groups.length * 600
				: groups.length >= 2 && groups.length < 4
				? groups.length * 400
				: groups.length * 300) -
			margin.left -
			margin.right

	// append the svg object to the body of the page
	select('.sjpp-violin-plot').remove()
	self.dom.violinDiv.text('')

	let svg = self.dom.violinDiv
		.append('svg')
		.attr('width', width + margin.left + margin.right)
		.attr('height', height)
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

	svg.selectAll('text').style('font-size', '15px')

	//create y axis label
	svg
		.append('text')
		.attr('transform', 'rotate(-90)')
		.attr('y', 0 - margin.left)
		.attr('x', 0 - height / 2.2)
		.attr('dy', '1em')
		.style('text-anchor', 'middle')
		.text(termName)

	// // Add x axis label
	// if(t2 != null && t2.term.name != null && t2.term.name != undefined) {
	// 	svg.append("text")
	// 	.attr("class", "x label")
	// 	.attr("text-anchor", "front")
	// 	.attr('dy', '1em')
	// 	.attr("x", -110)
	// 	.attr("y", boundsHeight + 20)
	// 	.text(`${t2.term.name}`);
	// }

	for (const key of self.data) {
		let label =
			t2 != null && t2.term.values != undefined && Object.keys(t2.term.values).length > 0
				? t2.term.values[key.label].label
				: key.label

		if (key.yScaleValues) {
			label = `${label} (${key.yScaleValues.length})`
		}

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
			// .style("fill",function() {
			// 	return "hsl(" + Math.random() * 360 + ",100%,90%)";
			// 	})
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

async function getLegendGrps(self) {
	const t2 = self.violinArg.term2
	// const headingStyle = 'color: #aaa; font-weight: 400'

	//add header to the legend div
	if (t2 != null && t2 != undefined) {
		const legendTitle = self.violinArg.term2.term.name

		self.opts.dom.violinLegendDiv.selectAll('*').remove()

		const violinLegendDiv = self.opts.dom.violinLegendDiv
			.append('div')
			.classed('sjpp-legend-div', true)
			.style('display', 'block')

		violinLegendDiv
			.append('span')
			.style('color', '#aaa')
			.style('font-weight', '400')
			.text(legendTitle)

		for (const key of self.data) {
			let label =
				t2 != null && t2.term.values != undefined && Object.keys(t2.term.values).length > 0
					? t2.term.values[key.label].label
					: key.label

			if (key.yScaleValues) {
				label = `${label}, n = ${key.yScaleValues.length}`
			}

			violinLegendDiv
				.append('div')
				.style('display', 'block')
				.append('span')
				.text(label)
		}
	} else {
		self.opts.dom.violinLegendDiv.selectAll('*').remove()
	}
	return
}
