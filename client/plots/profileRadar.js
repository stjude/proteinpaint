import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'
import * as d3 from 'd3'
import { getSampleFilter } from '#termsetting/handlers/samplelst'
import { profilePlot } from './profilePlot.js'
import { Menu } from '#dom/menu'

class profileRadar extends profilePlot {
	constructor() {
		super()
		this.type = 'profileRadar'
		this.radius = 250
	}
	async init(appState) {
		await super.init(appState)
		this.opts.header.text('Radar Graph')
		this.lineGenerator = d3.line()
		this.tip = new Menu({ padding: '4px', offsetX: 10, offsetY: 15 })
	}

	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		this.twLst = []
		this.terms = this.config[this.config.plot].terms
		for (const { parent, term1, term2 } of this.terms) {
			this.twLst.push(parent)
			this.twLst.push(term1)
			this.twLst.push(term2)
		}
		this.twLst.push(this.config.typeTW)
		const sampleName = this.config.region !== undefined ? this.config.region : this.config.income || 'Global'
		const filter = this.config.filter || getSampleFilter(this.sampleidmap[sampleName])
		this.data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: this.twLst,
			filter
		})
		this.sampleData = this.data.lst[0]
		this.angle = (Math.PI * 2) / this.terms.length

		this.income = this.config.income || this.incomes[0]
		this.region = this.config.region !== undefined ? this.config.region : this.income == '' ? 'Global' : ''

		this.setFilter()

		this.filename = `radar_plot${this.region ? '_' + this.region : ''}${this.income ? '_' + this.income : ''}.svg`
			.split(' ')
			.join('_')
		this.plot()
	}

	plot() {
		const config = this.config
		this.dom.plotDiv.selectAll('*').remove()

		if (!this.sampleData) return

		this.svg = this.dom.plotDiv.append('svg').attr('width', 1200).attr('height', 650)

		// Create a polar grid.
		const radius = this.radius
		const x = 400
		const y = 320
		const polarG = this.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.polarG = polarG
		this.legendG = this.svg.append('g').attr('transform', `translate(${x + 550},${y + 150})`)

		for (let i = 0; i <= 10; i++) this.addPoligon(i * 10)

		let i = 0
		const data = [],
			data2 = []
		for (let { parent, term1, term2 } of this.terms) {
			const d = parent
			const iangle = i * this.angle - Math.PI / 2
			this.addData('term1', iangle, i, data)
			this.addData('term2', iangle, i, data2)
			i++
			const leftSide = iangle > Math.PI / 2 && iangle <= (3 / 2) * Math.PI
			let dx = radius * 1.1 * Math.cos(iangle)
			let dy = radius * 1.1 * Math.sin(iangle) - 10
			const textElem = polarG.append('text').attr('x', `${dx}px`).attr('y', `${dy}px`)

			const texts = d.term.name.split(' ')
			let span
			texts.forEach((text, j) => {
				if (text != 'and') {
					dy += 15
					span = textElem
						.append('tspan')
						.attr('x', `${dx}px`)
						.attr('y', `${dy}px`)
						.text(text + '')
				} else span.append('tspan').text(' and')
			})
			if (leftSide) textElem.attr('text-anchor', 'end')
		}
		data.push(data[0])
		data2.push(data2[0])
		polarG
			.append('g')
			.append('path')
			.style('stroke', '#aaa')
			.attr('fill', 'none')
			.attr('stroke', 'black')
			.attr('stroke-width', '2px')
			.attr('d', this.lineGenerator(data))

		polarG
			.append('g')
			.append('path')
			.style('stroke', 'blue')
			.attr('fill', 'none')
			.attr('stroke-width', '2px')
			.attr('d', this.lineGenerator(data2))

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
		this.legendG.append('text').attr('text-anchor', 'left').style('font-weight', 'bold').text('Legend')
		this.addLegendItem(config[config.plot].term1, '#aaa', 0)
		this.addLegendItem(config[config.plot].term2, 'blue', 1)
	}

	addData(field, iangle, i, data) {
		const tw = this.terms[i][field]
		const percentage = this.sampleData[tw.$id]?.value
		const iradius = (percentage / 100) * this.radius

		let x = iradius * Math.cos(iangle)
		let y = iradius * Math.sin(iangle)
		const color = field == 'term1' ? '#aaa' : 'blue'
		this.polarG.append('g').attr('transform', `translate(${x}, ${y})`).append('circle').attr('r', 5).attr('fill', color)
		data.push([x, y])
	}

	addPoligon(percent, text = null) {
		const data = []
		for (let i = 0; i < this.terms.length; i++) {
			const iangle = i * this.angle - Math.PI / 2
			const iradius = (percent / 100) * this.radius
			const x = iradius * Math.cos(iangle)
			const y = iradius * Math.sin(iangle)
			data.push([x, y])
		}

		data.push(data[0])
		const poligon = this.polarG
			.append('g')
			.append('path')
			.style('stroke', '#aaa')
			.attr('fill', 'none')
			.attr('stroke', 'black')
			.attr('d', this.lineGenerator(data))
			.style('opacity', '0.5')
		if (percent != 50) poligon.style('stroke', '#aaa')
		if (text) {
			if (percent != 100) poligon.style('stroke-dasharray', '5, 5').style('stroke-width', '2').style('stroke', 'black')

			this.polarG
				.append('text')
				.attr('transform', `translate(15, ${-(percent / 100 - 0.125) * this.radius + 10})`)
				.attr('text-anchor', 'middle')
				.text(text)
				.style('font-weight', 'bold')
				.style('font-size', '24px')
				.attr('pointer-events', 'none')
		}
	}

	addLegendItem(text, color, index) {
		const step = 25
		const y = step + index * step
		this.legendG
			.append('path')
			.attr('stroke', color)
			.attr('stroke-width', '2px')

			.attr(
				'd',
				this.lineGenerator([
					[0, y - 5],
					[10, y - 5]
				])
			)

		const textElem = this.legendG.append('text').attr('transform', `translate(20, ${y})`).attr('text-anchor', 'left')
		textElem.append('tspan').text(text)
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const defaults = app.vocabApi.termdbConfig?.chartConfigByType?.profileRadar
		if (!defaults) throw 'default config not found in termdbConfig.chartConfigByType.profileRadar'
		let config = copyMerge(structuredClone(defaults), opts)
		const terms = config[opts.plot].terms
		for (const { parent, term1, term2 } of terms) {
			await fillTermWrapper(parent, app.vocabApi)
			await fillTermWrapper(term1, app.vocabApi)
			await fillTermWrapper(term2, app.vocabApi)
		}
		config.typeTW = await fillTermWrapper({ id: 'sampleType' }, app.vocabApi)
		return config
	} catch (e) {
		throw `${e} [profileRadar getPlotConfig()]`
	}
}

export const profileRadarInit = getCompInit(profileRadar)
// this alias will allow abstracted dynamic imports
export const componentInit = profileRadarInit
