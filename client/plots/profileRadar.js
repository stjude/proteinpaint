import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'
import * as d3 from 'd3'
import { getSampleFilter } from '#termsetting/handlers/samplelst'
import { profilePlot } from './profilePlot.js'
import { Menu } from '#dom/menu'
import { renderTable } from '#dom/table'
import { loadFilterTerms } from './profilePlot.js'

class profileRadar extends profilePlot {
	constructor() {
		super()
		this.type = 'profileRadar'
		this.radius = 250
	}

	async init(appState) {
		await super.init(appState)
		const config = appState.plots.find(p => p.id === this.id)
		this.opts.header.style('font-weight', 'bold').text(config[config.plot].name)
		this.lineGenerator = d3.line()
		this.tip = new Menu({ padding: '4px', offsetX: 10, offsetY: 15 })

		this.dom.plotDiv.on('mousemove', event => this.onMouseOver(event))
		this.dom.plotDiv.on('mouseout', event => this.onMouseOut(event))
		this.dom.plotDiv.on('mouseleave', event => this.onMouseOut(event))
	}

	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		this.settings = this.config.settings.profileRadar
		this.twLst = []
		this.terms = this.config[this.config.plot].terms
		for (const row of this.terms) {
			this.rowCount++
			if (row.sc) {
				this.twLst.push(row.sc.score)
				this.twLst.push(row.sc.maxScore)
			}
			if (row.poc) {
				this.twLst.push(row.poc.score)
				this.twLst.push(row.poc.maxScore)
			}
		}
		await this.setControls('profileRadar')
		this.angle = (Math.PI * 2) / this.terms.length
		this.plot()
	}

	plot() {
		const config = this.config
		this.dom.plotDiv.selectAll('*').remove()
		if (this.data.lst.length == 0) return

		this.svg = this.dom.plotDiv
			.append('div')
			.style('display', 'inline-block')
			.append('svg')
			.attr('width', 1200)
			.attr('height', 650)
		this.tableDiv = this.dom.plotDiv
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin-top', '45px')
		const rows = []
		const columns = [
			{ label: 'Module' },
			{ label: config[config.plot].term1.abbrev },
			{ label: config[config.plot].term2.abbrev }
		]

		// Create a polar grid.
		const radius = this.radius
		const x = 370
		const y = 250
		const polarG = this.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.polarG = polarG
		this.legendG = this.svg.append('g').attr('transform', `translate(${x + 390},${y + 100})`)
		this.filterG = this.svg.append('g').attr('transform', `translate(${x + 390},${y + 200})`)

		for (let i = 0; i <= 10; i++) this.addPoligon(i * 10)

		let i = 0
		const data = [],
			data2 = []
		for (let { module, sc, poc } of this.terms) {
			const iangle = i * this.angle - Math.PI / 2
			this.addData('sc', iangle, i, data)
			this.addData('poc', iangle, i, data2)
			rows.push([{ value: module }, { value: this.getPercentage(sc) }, { value: this.getPercentage(poc) }])

			i++
			const leftSide = iangle > Math.PI / 2 && iangle <= (3 / 2) * Math.PI
			let dx = radius * 1.1 * Math.cos(iangle)
			let dy = radius * 1.1 * Math.sin(iangle) - 10
			const textElem = polarG.append('text').attr('x', `${dx}px`).attr('y', `${dy}px`)
			const texts = module.split(' ')
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
		if (this.settings.showTable)
			renderTable({
				rows,
				columns,
				div: this.tableDiv,
				showLines: true,
				resize: true,
				maxHeight: '60vh'
			})

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

		this.addFilterLegend()

		this.legendG.append('text').attr('text-anchor', 'left').style('font-weight', 'bold').text(`Legend`)
		const item1 = `${config[config.plot].term1.name} (${config[config.plot].term1.abbrev})`
		this.addLegendItem(item1, color1, 0, '5, 5')
		const item2 = `${config[config.plot].term2.name} (${config[config.plot].term2.abbrev})`
		this.addLegendItem(item2, color2, 1, 'none')
	}

	addData(field, iangle, i, data) {
		const item = this.terms[i]
		const percentage = this.getPercentage(item[field])
		const iradius = (percentage / 100) * this.radius
		let x = iradius * Math.cos(iangle)
		let y = iradius * Math.sin(iangle)
		const color = field == 'term1' ? '#aaa' : 'blue'
		const circle = this.polarG
			.append('g')
			.attr('transform', `translate(${x}, ${y})`)
			.append('circle')
			.attr('r', 4)
			.attr('fill', color)
		circle.datum({ module: item.module, percentage })
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

	onMouseOver(event) {
		if (event.target.tagName == 'circle') {
			const circle = event.target
			const d = circle.__data__
			const menu = this.tip.clear()
			const percentage = d.percentage
			menu.d.text(`${d.module} ${percentage}%`)
			menu.show(event.clientX, event.clientY, true, true)
		} else this.onMouseOut(event)
	}

	onMouseOut(event) {
		if (event.target.tagName == 'circle') {
			this.tip.hide()
		}
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const defaults = app.vocabApi.termdbConfig?.chartConfigByType?.profileRadar
		if (!defaults) throw 'default config not found in termdbConfig.chartConfigByType.profileRadar'
		let config = copyMerge(structuredClone(defaults), opts)
		const settings = getDefaultProfileRadarSettings()

		config.settings = {
			controls: {
				isOpen: false // control panel is hidden by default
			},
			profileRadar: settings
		}
		const terms = config[opts.plot].terms

		for (const row of terms) {
			if (row.sc) {
				row.sc.score.q = row.sc.maxScore.q = { mode: 'continuous' }
				await fillTermWrapper(row.sc.score, app.vocabApi)
				await fillTermWrapper(row.sc.maxScore, app.vocabApi)
			}
			if (row.poc) {
				row.poc.score.q = row.poc.maxScore.q = { mode: 'continuous' }
				await fillTermWrapper(row.poc.score, app.vocabApi)
				await fillTermWrapper(row.poc.maxScore, app.vocabApi)
			}
		}
		await loadFilterTerms(config, app)
		return config
	} catch (e) {
		throw `${e} [profileRadar getPlotConfig()]`
	}
}

export const profileRadarInit = getCompInit(profileRadar)
// this alias will allow abstracted dynamic imports
export const componentInit = profileRadarInit

export function getDefaultProfileRadarSettings() {
	return {
		showTable: true
	}
}
