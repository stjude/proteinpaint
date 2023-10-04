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
		const config = appState.plots.find(p => p.id === this.id)
		this.opts.header.text(config[config.plot].name)
		this.lineGenerator = d3.line()
		this.tip = new Menu({ padding: '4px', offsetX: 10, offsetY: 15 })
		this.dom.facilityDiv.insert('label').style('margin-left', '15px').html('Facility:').style('font-weight', 'bold')
		this.facilities = ['']
		this.facilities.push(...(await this.app.vocabApi.getProfileFacilities()))

		this.facilitySelect = this.dom.facilityDiv.insert('select').style('margin-left', '5px')
		this.facilitySelect
			.selectAll('option')
			.data(this.facilities)
			.enter()
			.append('option')
			.attr('value', d => d)
			.html((d, i) => d)
		this.facilitySelect.on('change', () => {
			const config = this.config
			config.facility = this.facilitySelect.node().value
			config.sampleName = config.facility
			config.income = ''
			config.region = ''
			const sampleId = parseInt(this.sampleidmap[config.facility])
			config.filter = getSampleFilter(sampleId)
			this.app.dispatch({ type: 'plot_edit', id: this.id, config })
		})
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
		if (this.config.sampleName == undefined) this.config.sampleName = 'Global' //Global region

		const filter = this.config.filter || getSampleFilter(this.sampleidmap[this.config.sampleName])
		this.data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: this.twLst,
			filter
		})
		this.sampleData = this.data.lst[0]
		this.angle = (Math.PI * 2) / this.terms.length

		this.income = this.config.income || this.incomes[0]
		this.region = this.config.region !== undefined ? this.config.region : this.income == '' ? 'Global' : ''
		this.setFilter()

		this.filename = `radar_plot_${this.config.sampleName}.svg`.split(' ').join('_')
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
		const color1 = 'gray',
			color2 = 'blue'
		polarG
			.append('g')
			.append('path')
			.style('stroke', color1)
			.attr('fill', 'none')
			.style('stroke-dasharray', '5, 5')
			.attr('stroke-width', '2px')
			.attr('d', this.lineGenerator(data))

		polarG
			.append('g')
			.append('path')
			.style('stroke', color2)
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
		this.addLegendItem(config[config.plot].term1, color1, 0, '5, 5')
		this.addLegendItem(config[config.plot].term2, color2, 1, 'none')
	}

	addData(field, iangle, i, data) {
		const tw = this.terms[i][field]
		const percentage = this.sampleData[tw.$id]?.value
		const iradius = (percentage / 100) * this.radius
		let x = iradius * Math.cos(iangle)
		let y = iradius * Math.sin(iangle)
		const color = field == 'term1' ? '#aaa' : 'blue'
		this.polarG.append('g').attr('transform', `translate(${x}, ${y})`).append('circle').attr('r', 4).attr('fill', color)
		data.push([x, y])
	}

	addPoligon(percent) {
		const data = []
		for (let i = 0; i < this.terms.length; i++) {
			const iangle = i * this.angle - Math.PI / 2
			const iradius = (percent / 100) * this.radius
			const x = iradius * Math.cos(iangle)
			const y = iradius * Math.sin(iangle)
			data.push([x, y])
		}

		data.push(data[0])
		this.polarG
			.append('g')
			.append('path')
			.style('stroke', '#aaa')
			.attr('fill', 'none')
			.attr('d', this.lineGenerator(data))
			.style('opacity', '0.5')
	}

	addLegendItem(text, color, index, strokeDash) {
		const step = 25
		const y = step + index * step
		const x = 35
		this.legendG
			.append('path')
			.attr('stroke', color)
			.style('stroke-dasharray', strokeDash)
			.attr('stroke-width', '2px')
			.attr(
				'd',
				this.lineGenerator([
					[0, y - 5],
					[x, y - 5]
				])
			)
		this.legendG
			.append('g')
			.attr('transform', `translate(${0}, ${y - 5})`)
			.append('circle')
			.attr('r', 4)
			.attr('fill', color)

		const textElem = this.legendG
			.append('text')
			.attr('transform', `translate(${x + 5}, ${y})`)
			.attr('text-anchor', 'left')
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
