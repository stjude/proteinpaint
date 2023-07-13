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
		this.config = JSON.parse(JSON.stringify(this.state.config))
		const twLst = []
		this.component = this.config.plotByComponent[this.config.componentIndex || 0]
		this.component.hasSubjectiveData = false
		for (const group of this.component.groups)
			for (const row of group.rows) {
				for (const [i, tw] of row.twlst.entries()) {
					if (tw.id) {
						twLst.push(tw)
						if (i == 1) this.component.hasSubjectiveData = true
					}
				}
			}
		this.data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: twLst
		})
		this.plot()
	}

	plot() {
		const config = this.config
		const components = config.plotByComponent.map(comp => comp.component.name)
		let data
		this.dom.holder.selectAll('*').remove()
		const samples = []

		for (const k in this.data.samples) {
			if (!config.sampleName && k == 0) data = this.data.samples[k]
			if (config.sampleName && this.data.samples[k].sampleName == config.sampleName) data = this.data.samples[k]
			samples.push(this.data.samples[k].sampleName)
		}

		const holder = this.dom.holder.append('div')

		const div = holder.append('div').style('margin-left', '50px').style('margin-top', '20px')
		div.append('label').html('Component:').style('font-weight', 'bold')
		const selectComp = div.append('select').style('margin-left', '5px')
		selectComp
			.selectAll('option')
			.data(components)
			.enter()
			.append('option')
			.property('selected', (d, i) => i == config.componentIndex)
			.attr('value', (d, i) => i)
			.html((d, i) => d)
		selectComp.on('change', () => {
			config.componentIndex = selectComp.node().value
			this.app.dispatch({ type: 'plot_edit', id: this.id, config })
		})
		const svg = holder.append('svg').attr('width', config.svgw).attr('height', config.svgh)

		if (samples.length == 0) return
		div.append('label').style('margin-left', '5px').html('Site ID:').style('font-weight', 'bold')
		const select = div.append('select').style('margin-left', '5px')
		select
			.selectAll('option')
			.data(samples)
			.enter()
			.append('option')
			.property('selected', d => d == config.sampleName)
			.html((d, i) => d)

		select.on('change', () => {
			config.sampleName = select.node().value
			this.app.dispatch({ type: 'plot_edit', id: this.id, config })
		})
		const color = this.component.component.color
		svg
			.append('defs')
			.append('pattern')
			.attr('id', 'diagonalHatch')
			.attr('patternUnits', 'userSpaceOnUse')
			.attr('width', 4)
			.attr('height', 4)
			.append('path')
			.attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
			.attr('stroke-width', 1)
			.attr('stroke', color)

		let x
		let y
		let stepx = 500
		let step = 30
		const barwidth = 400
		const hasSubjectiveData = this.component.hasSubjectiveData
		for (const [i, c] of config.columnNames.entries()) {
			if (i == 1 && !hasSubjectiveData) break

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
		for (const group of this.component.groups) {
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
					drawRect(x, y, row, i)
					x += stepx
				}
				y += step
			}
		}

		drawLine(410, 120, 50, y, 'B')
		drawLine(410, 120, 75, y, 'A')

		if (!hasSubjectiveData) return
		drawLine(910, 120, 50, y, 'B')
		drawLine(910, 120, 75, y, 'A')
		y += 40
		x = 50
		drawLegendRect(x, y, 'and', color)
		x += 300
		drawLegendRect(x, y, 'or', color)

		function drawRect(x, y, row, i) {
			const tw = row.twlst[i]
			const termColor = tw?.term?.color

			const value = data[tw.$id]?.value
			const isFirst = i % 2 == 0
			const pairValue = isFirst ? data[row.twlst[1]?.$id]?.value : data[row.twlst[0]?.$id]?.value
			const width = value ? (value / 100) * barwidth : 0

			if (value) {
				const rect = svg
					.append('g')
					.attr('transform', `translate(${x + 10}, ${y})`)
					.append('rect')
					.attr('x', 0)
					.attr('y', 0)
					.attr('width', width)
					.attr('height', 20)
				if (pairValue || !hasSubjectiveData) rect.attr('fill', termColor)
				else {
					const id = tw.term.name.replace(/[^a-zA-Z0-9]/g, '')
					svg
						.append('defs')
						.append('pattern')
						.attr('id', id)
						.attr('patternUnits', 'userSpaceOnUse')
						.attr('width', 4)
						.attr('height', 4)
						.append('path')
						.attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
						.attr('stroke-width', 1)
						.attr('stroke', termColor)
					rect.attr('fill', `url(#${id})`)
				}
			}
			const text = svg
				.append('text')
				.attr('text-anchor', 'end')
				.text(`${value || 0}%`)
			if (width > 0) text.attr('transform', `translate(${x + width + 55}, ${y + 15})`)
			else if (!pairValue && !hasSubjectiveData && i == 0) text.attr('transform', `translate(${x + 35}, ${y + 15})`)

			if (isFirst)
				svg
					.append('text')
					.attr('transform', `translate(${x}, ${y + 15})`)
					.attr('text-anchor', 'end')
					.text(row.name)
		}

		function drawAxes(x, y) {
			const xAxisScale = d3Linear().domain([0, 100]).range([0, barwidth])

			svg.append('g').attr('transform', `translate(${x}, ${y})`).call(axisTop(xAxisScale))
		}

		function drawLegendRect(x, y, operator, color) {
			const rect = svg
				.append('g')
				.attr('transform', `translate(${x}, ${y})`)
				.append('rect')
				.attr('x', 0)
				.attr('y', 0)
				.attr('width', 20)
				.attr('height', 20)
			if (operator == 'and') rect.attr('fill', color)
			else {
				rect.attr('fill', 'url(#diagonalHatch)')
			}

			const text = svg
				.append('text')
				.attr('transform', `translate(${x + 25}, ${y + 15})`)
				.attr('text-anchor', 'start')
				.text('Objective ')
			text.append('tspan').attr('font-weight', 'bold').text(operator)
			text.append('tspan').text(' Subjective data')
		}

		function drawLine(x, y, percent, y2, text) {
			const x1 = x + (percent / 100) * barwidth
			svg
				.append('line')
				.style('stroke', '#aaa')
				.style('stroke-width', 1)
				.style('stroke-dasharray', '5, 5')
				.attr('x1', x1)
				.attr('y1', y)
				.attr('x2', x1)
				.attr('y2', y2)
			svg
				.append('text')
				.attr('transform', `translate(${x1 + 0.125 * barwidth}, ${y2 + 20})`)
				.attr('text-anchor', 'middle')
				.text(text)
				.style('font-weight', 'bold')
			if (percent == 50)
				svg
					.append('text')
					.attr('transform', `translate(${x1 - 0.25 * barwidth}, ${y2 + 20})`)
					.attr('text-anchor', 'middle')
					.text('C')
					.style('font-weight', 'bold')
		}
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const defaults = app.vocabApi.termdbConfig?.chartConfigByType?.profileBarchart
		if (!defaults) throw 'default config not found in termdbConfig.chartConfigByType.profileBarchart'
		const config = copyMerge(structuredClone(defaults), opts)
		for (const component of config.plotByComponent)
			for (const group of component.groups)
				for (const row of group.rows) {
					for (const t of row.twlst) {
						if (t.id) await fillTermWrapper(t, app.vocabApi)
						// allow empty cells, not all cells have a corresponding term
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
