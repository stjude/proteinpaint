import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'
import * as d3 from 'd3'
import { getSampleFilter } from '#termsetting/handlers/samplelst'
import { profilePlot } from './profilePlot.js'

class profilePolar extends profilePlot {
	constructor() {
		super()
		this.type = 'profilePolar'
	}
	async init(appState) {
		await super.init(appState)
		this.opts.header.text('Polar plot')
		this.arcGenerator = d3.arc().innerRadius(0)
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
		this.twLst = []
		for (const [i, tw] of this.config.terms.entries()) {
			if (tw.id) this.twLst.push(tw)
		}
		this.twLst.push(this.config.typeTW)
		const sampleName = this.config.region || this.config.income || 'Global'
		const filter = this.config.filter || getSampleFilter(this.sampleidmap[sampleName])
		this.data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: this.twLst,
			filter
		})
		this.sampleData = this.data.lst[0]

		this.region = this.config.region || this.regions[0].key
		this.income = this.config.income || this.incomes[0]
		this.plot()
	}

	plot() {
		const config = this.config
		this.dom.plotDiv.selectAll('*').remove()

		if (!this.sampleData) return
		this.filename = `polar_plot${this.region ? '_' + this.region : ''}${this.income ? '_' + this.income : ''}.svg`
			.split(' ')
			.join('_')

		this.svg = this.dom.holder.append('svg').attr('width', 1200).attr('height', 600)

		// Create a polar grid.
		const radius = 250
		const x = 400
		const y = 300
		const polarG = this.svg.append('g').attr('transform', `translate(${x},${y})`)
		const legendG = this.svg.append('g').attr('transform', `translate(${x + 350},${y + 150})`)

		for (let i = 0; i <= 10; i++) addCircle(i * 10)

		const angle = (Math.PI * 2) / config.terms.length
		let i = 0
		for (const d of config.terms) {
			const percentage = this.sampleData[d.$id]?.value

			polarG
				.append('g')
				.append('path')
				.attr('fill', d.term.color)
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

		addCircle(50, 'C')
		addCircle(75, 'B')
		addCircle(100, 'A')
		for (let i = 0; i <= 10; i++) {
			const percent = i * 10
			polarG
				.append('text')
				.attr('transform', `translate(-10, ${(-percent / 100) * radius + 5})`)
				.attr('text-anchor', 'end')
				.style('font-size', '0.8rem')
				.text(`${percent}%`)
		}
		legendG
			.append('text')
			.attr('text-anchor', 'left')
			.style('font-weight', 'bold')
			.text('Overall Score')
			.attr('transform', `translate(0, -10)`)

		addLegendItem('A', 'More than 75% of possible scorable items', 1)
		addLegendItem('B', '50-75% of possible scorable items', 2)
		addLegendItem('C', 'Less than 50% of possible scorable items', 3)

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
			}
		}

		function addLegendItem(category, description, index) {
			const text = legendG
				.append('text')
				.attr('transform', `translate(0, ${index * 20})`)
				.attr('text-anchor', 'left')
			text.append('tspan').attr('font-weight', 'bold').text(category)
			text.append('tspan').text(`: ${description}`)
		}
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const defaults = app.vocabApi.termdbConfig?.chartConfigByType?.profilePolar
		if (!defaults) throw 'default config not found in termdbConfig.chartConfigByType.profilePolar'
		const config = copyMerge(structuredClone(defaults), opts)
		for (const t of config.terms) {
			if (t.id) await fillTermWrapper(t, app.vocabApi)
		}
		config.typeTW = await fillTermWrapper({ id: 'sampleType' }, app.vocabApi)
		return config
	} catch (e) {
		throw `${e} [profilePolar getPlotConfig()]`
	}
}

export const profilePolarInit = getCompInit(profilePolar)
// this alias will allow abstracted dynamic imports
export const componentInit = profilePolarInit
