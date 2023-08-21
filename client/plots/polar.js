import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'
import * as d3 from 'd3'
import { getSampleFilter } from '#termsetting/handlers/samplelst'
import { Menu } from '#dom/menu'
import { getColors } from '#shared/common'

class Polar {
	constructor() {
		this.type = 'polar'
		this.radius = 250
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config
		}
	}

	async init(appState) {
		const holder = this.opts.holder.append('div')
		const div = holder.append('div').style('margin-left', '50px').style('margin-top', '20px')
		const plotDiv = holder.append('div')
		this.dom = {
			holder,
			filterDiv: div,
			plotDiv
		}
		this.opts.header.text('Polar Graph')
		this.arcGenerator = d3.arc().innerRadius(0)
		this.dom.plotDiv.on('mousemove', event => this.onMouseOver(event))
		this.dom.plotDiv.on('mouseleave', event => this.onMouseOut(event))
		this.dom.plotDiv.on('mouseout', event => this.onMouseOut(event))

		this.tip = new Menu({ padding: '4px', offsetX: 10, offsetY: 15 })

		const config = appState.plots.find(p => p.id === this.id)
		const tw = structuredClone(config.terms?.[0])
		const data = await this.app.vocabApi.getAnnotatedSampleData({ terms: [tw] })
		this.sampleidmap = {}
		for (const key in data.samples) {
			const sample = data.samples[key]
			const id = sample.sampleName || sample.sample
			this.sampleidmap[id] = sample.sample
		}
		this.samples = Object.keys(this.sampleidmap)
		this.select = div.append('select').style('margin-left', '5px')
		this.select
			.selectAll('option')
			.data(this.samples)
			.enter()
			.append('option')
			.attr('value', d => d)
			.html((d, i) => d)
		this.select.on('change', e => {
			this.config.sampleName = this.select.node().value
			this.app.dispatch({ type: 'plot_edit', id: this.id, config: this.config })
		})
	}

	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		this.twLst = []
		for (const [i, tw] of this.config.terms.entries()) {
			if (tw.id) this.twLst.push(tw)
		}
		const sampleName = this.config.sampleName || this.samples[0]
		const filter = this.config.filter || getSampleFilter(this.sampleidmap[sampleName])
		this.data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: this.twLst,
			filter
		})
		this.sampleData = this.data.lst[0]
		this.plot()
	}

	onMouseOut(event) {
		if (event.target.tagName == 'path') {
			const path = event.target
			path.setAttribute('stroke', 'white')
			this.tip.hide()
			if (path.getAttribute('stroke-opacity') == 0) path.setAttribute('stroke-opacity', 1)
		}
	}

	onMouseOver(event) {
		if (event.target.tagName == 'path') {
			const path = event.target
			path.setAttribute('stroke-opacity', 0)
			const d = path.__data__
			const menu = this.tip.clear()
			const percentage = this.sampleData[d.$id]?.value * this.config.scale
			menu.d.text(`${d.term.name} ${percentage}%`)
			menu.show(event.clientX, event.clientY, true, true)
		} else this.onMouseOut(event)
	}

	plot() {
		const config = this.config
		this.dom.plotDiv.selectAll('*').remove()

		if (!this.sampleData) return

		this.svg = this.dom.plotDiv.append('svg').attr('width', 1200).attr('height', 600)

		// Create a polar grid.
		const radius = this.radius
		const x = 400
		const y = 300
		const polarG = this.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.polarG = polarG
		const legendG = this.svg.append('g').attr('transform', `translate(${x + 350},${y + 150})`)

		for (let i = 0; i <= 10; i++) addCircle(i * 10)

		const validTerms = []
		for (let d of config.terms) {
			let percentage = this.sampleData[d.$id]?.value
			console.log(d.term.name, percentage)
			if (percentage) validTerms.push(d)
		}
		let i = 0
		const angle = (Math.PI * 2) / validTerms.length
		const colors = getColors(validTerms.length)
		for (let d of validTerms) {
			d.i = i
			let percentage = this.sampleData[d.$id]?.value
			percentage = percentage * this.config.scale

			const color = d.term.color || colors(i)
			const path = polarG
				.append('g')
				.append('path')
				.datum(d)
				.attr('fill', color)
				.attr('stroke', 'white')
				.attr(
					'd',
					this.arcGenerator({
						outerRadius: (percentage / 100) * radius,
						startAngle: i * angle,
						endAngle: (i + 1) * angle
					})
				)

			i++
		}
		for (let i = 0; i <= 10; i++) {
			const percent = i * 10
			polarG
				.append('text')
				.attr('transform', `translate(-10, ${(-percent / 100) * radius + 5})`)
				.attr('text-anchor', 'end')
				.style('font-size', '0.8rem')
				.text(`${percent}%`)
				.attr('pointer-events', 'none')
		}

		function addCircle(percent, text = null) {
			const circle = polarG
				.append('circle')
				.attr('r', (percent / 100) * radius)
				.style('fill', 'none')
				.style('opacity', '0.5')
			if (percent != 50) circle.style('stroke', '#aaa')
			if (text) {
				if (percent != 100) circle.style('stroke-dasharray', '5, 5').style('stroke-width', '2').style('stroke', 'black')

				polarG
					.append('text')
					.attr('transform', `translate(15, ${-(percent / 100 - 0.125) * radius + 10})`)
					.attr('text-anchor', 'middle')
					.text(text)
					.style('font-weight', 'bold')
					.style('font-size', '24px')
					.attr('pointer-events', 'none')
			}
		}
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const defaults = app.vocabApi.termdbConfig?.chartConfigByType?.polar
		if (!defaults) throw 'default config not found in termdbConfig.chartConfigByType.Polar'
		const config = copyMerge(structuredClone(defaults), opts)
		for (const t of config.terms) {
			if (t.id) await fillTermWrapper(t, app.vocabApi)
		}

		return config
	} catch (e) {
		throw `${e} [polar getPlotConfig()]`
	}
}

export const polarInit = getCompInit(Polar)
// this alias will allow abstracted dynamic imports
export const componentInit = polarInit
