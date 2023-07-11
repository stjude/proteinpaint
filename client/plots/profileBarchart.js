import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisTop } from 'd3-axis'
class profileBarchart {
	constructor() {
		this.type = 'profileBarchart'
	}
	async init(opts) {
		const holder = this.opts.holder.append('div')
		this.dom = {
			holder
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config
		}
	}

	async main() {
		const twLst = []
		for (const group of this.state.config.groups)
			for (const row of group.rows) {
				for (const tw of row.twlst) {
					if (tw.id) twLst.push(tw)
				}
			}
		this.data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: twLst
		})
		if (!this.sample) this.sample = this.state.config.sampleName
		this.plot()
	}

	plot() {
		this.dom.holder.selectAll('*').remove()
		let data
		const samples = []
		for (const k in this.data.samples) {
			if (this.data.samples[k].sampleName == this.sample) data = this.data.samples[k]
			samples.push(this.data.samples[k].sampleName)
		}
		if (!data) throw 'no data returned for sample'
		const holder = this.dom.holder.append('div')
		const select = holder
			.append('div')
			.style('margin-left', '50px')
			.style('margin-top', '20px')
			.append('label')
			.html('Site ID:')
			.style('font-weight', 'bold')
			.append('select')
			.style('margin-left', '5px')
		select
			.selectAll('option')
			.data(samples)
			.enter()
			.append('option')
			.property('selected', d => d == this.sample)
			.html((d, i) => d)
		select.on('change', () => {
			this.sample = select.node().value
			this.plot()
		})
		const config = this.state.config
		const color = '#2381c3'
		const svg = holder.append('svg').attr('width', config.svgw).attr('height', config.svgh)

		const path = svg
			.append('defs')
			.append('pattern')
			.attr('id', 'diagonalHatch')
			.attr('patternUnits', 'userSpaceOnUse')
			.attr('width', 4)
			.attr('height', 4)
			.append('path')
			.attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
			.attr('stroke-width', 1)

		let x
		let y
		let stepx = 500
		let step = 30
		const barwidth = 400
		for (const [i, c] of config.columnNames.entries()) {
			x = i % 2 == 0 ? 400 : 900
			x += 10
			y = 50
			svg
				.append('text')
				.attr('transform', `translate(${x}, ${y})`)
				.attr('text-anchor', 'start')
				.style('font-weight', 'bold')
				.text(`${c}%`)
			drawAxes(x, y + 50)

			x += stepx
		}
		y = 75
		for (const group of config.groups) {
			svg
				.append('text')
				.attr('transform', `translate(${50}, ${y + 20})`)
				.attr('text-anchor', 'start')
				.text(`${group.label}`)
				.style('font-weight', 'bold')

			y += step + 20
			for (const row of group.rows) {
				x = 400
				for (const [i, tw] of row.twlst.entries()) {
					drawRect(x, y, color, row.twlst, i)
					x += stepx
				}
				y += step
			}
		}
		y += 40
		x = 50
		drawLegendRect(x, y, 'and')
		x += 300
		drawLegendRect(x, y, 'or')

		function drawRect(x, y, color, twlist, i) {
			const tw = twlist[i]
			path.attr('stroke', color)

			const value = data[tw.$id]?.value
			const isFirst = i % 2 == 0
			const pairValue = isFirst ? data[twlist[1]?.$id]?.value : data[twlist[0]?.$id]?.value
			if (value) {
				const width = (value / 100) * barwidth
				const rect = svg
					.append('g')
					.attr('transform', `translate(${x + 10}, ${y})`)
					.append('rect')
					.attr('x', 0)
					.attr('y', 0)
					.attr('width', width)
					.attr('height', 20)
				if (pairValue) rect.attr('fill', color)
				else rect.attr('fill', 'url(#diagonalHatch)')
				svg
					.append('text')
					.attr('transform', `translate(${x + width + 55}, ${y + 15})`)
					.attr('text-anchor', 'end')
					.text(`${value}%`)
			}
			if (isFirst)
				svg
					.append('text')
					.attr('transform', `translate(${x}, ${y + 15})`)
					.attr('text-anchor', 'end')
					.text(tw.term.name)
		}

		function drawAxes(x, y) {
			const xAxisScale = d3Linear().domain([0, 100]).range([0, barwidth])

			svg.append('g').attr('transform', `translate(${x}, ${y})`).call(axisTop(xAxisScale))
		}

		function drawLegendRect(x, y, operator) {
			const rect = svg
				.append('g')
				.attr('transform', `translate(${x}, ${y})`)
				.append('rect')
				.attr('x', 0)
				.attr('y', 0)
				.attr('width', 20)
				.attr('height', 20)
			if (operator == 'and') rect.attr('fill', color)
			else rect.attr('fill', 'url(#diagonalHatch)')

			const text = svg
				.append('text')
				.attr('transform', `translate(${x + 25}, ${y + 15})`)
				.attr('text-anchor', 'start')
				.text('Objective ')
			text.append('tspan').attr('font-weight', 'bold').text(operator)
			text.append('tspan').text(' Subjective data')
		}
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const defaults = { svgw: 1400, svgh: 1200 }
		const config = copyMerge(defaults, opts)
		for (const group of config.groups)
			for (const row of group.rows) {
				for (const t of row.twlst) {
					if (t.id) await fillTermWrapper(t, app.vocabApi)
				}
			}
		return config
	} catch (e) {
		throw `${e} [profileBarchart getPlotConfig()]`
	}
}

export const profileBarchartInit = getCompInit(profileBarchart)
// this alias will allow abstracted dynamic imports
export const componentInit = profileBarchartInit
