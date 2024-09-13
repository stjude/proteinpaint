import { getCompInit, copyMerge } from '#rx'
import { fillTwLst } from '#termsetting'
import * as d3 from 'd3'
import { profilePlot } from './profilePlot.js'
import { renderTable } from '../dom/table'
import { loadFilterTerms } from './profilePlot.js'
import { getDefaultProfilePlotSettings } from './profilePlot.js'

class profileRadar extends profilePlot {
	constructor() {
		super()
		this.type = 'profileRadar'
		this.radius = 250
	}

	async init(appState) {
		await super.init(appState)
		const config = appState.plots.find(p => p.id === this.id)
		this.lineGenerator = d3.line()
		this.twLst = []
		this.terms = config[config.plot].terms
		for (const row of this.terms) {
			this.twLst.push(row.term1.score)
			if (row.term1.maxScore.term) this.twLst.push(row.term1.maxScore)
			this.twLst.push(row.term2.score)
			if (row.term2.maxScore.term) this.twLst.push(row.term2.maxScore)
		}
		this.arcGenerator = d3.arc().innerRadius(0)
	}

	async main() {
		await super.main()

		await this.setControls()
		this.angle = (Math.PI * 2) / this.terms.length
		this.plot()
	}

	plot() {
		const config = this.config
		this.dom.plotDiv.selectAll('*').remove()
		if (this.data.lst.length == 0) return
		const width = 1200
		const height = 800
		this.svg = this.dom.plotDiv
			.append('div')
			.style('display', 'inline-block')
			.append('svg')
			.attr('width', width)
			.attr('height', height)
		this.tableDiv = this.dom.plotDiv
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin-top', '45px')
		const rows = []
		const columns = [
			{ label: 'Color' },
			{ label: 'Module' },
			{ label: config[config.plot].term1.abbrev },
			{ label: config[config.plot].term2.abbrev },
			{ label: 'Diff' }
		]

		// Create a polar grid.
		const radius = this.radius
		const x = 370
		const y = 340
		if (!this.settings.comparison)
			this.svg
				.append('text')
				.attr('transform', `translate(60, ${40})`)
				.attr('font-weight', 'bold')
				.attr('font-size', '0.9rem')
				.text(config[config.plot].title)

		const radarG = this.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.radarG = radarG
		this.legendG = this.svg.append('g').attr('transform', `translate(${x + 320},${y + 240})`)
		this.filterG = this.svg.append('g').attr('transform', `translate(${40},${y + 320})`)

		for (let i = 0; i <= 10; i++) this.addPoligon(i * 10)

		let i = 0
		const data = [], //term1
			data2 = [] //term2
		for (let { module, term1, term2 } of this.terms) {
			const iangle = i * this.angle - Math.PI / 2
			const item = this.terms[i]
			const percentage1 = this.getPercentage(term1)
			const percentage2 = this.getPercentage(term2)
			//arc
			this.radarG
				.append('path')
				.datum({ module: item.module, percentage1, percentage2 })
				.attr('fill', 'transparent')
				.attr(
					'd',
					this.arcGenerator({
						outerRadius: this.radius,
						startAngle: i * this.angle,
						endAngle: (i + 1) * this.angle
					})
				)
				.on('click', event => this.onMouseOver(event))

			this.addData('term2', percentage2, iangle, data2)
			this.addData('term1', percentage1, iangle, data)
			const color = term1.score.term.color
			const diff = Math.abs(percentage1 - percentage2)
			const diffRow = { value: diff }
			if (diff >= 20) diffRow.color = percentage2 > percentage1 ? 'red' : 'blue'
			rows.push([{ color, disabled: true }, { value: module }, { value: percentage1 }, { value: percentage2 }, diffRow])
			i++
			const leftSide = iangle > Math.PI / 2 && iangle <= (3 / 2) * Math.PI
			let dx = radius * 1.1 * Math.cos(iangle)
			let dy = radius * 1.1 * Math.sin(iangle) - 10
			const textElem = radarG.append('text').attr('x', `${dx}px`).attr('y', `${dy}px`)
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
		const color1 = 'blue',
			color2 = 'gray'
		radarG
			.append('g')
			.append('path')
			.style('stroke', color1)
			.attr('fill', 'none')
			.attr('stroke-width', '2px')
			.attr('d', this.lineGenerator(data))

		radarG
			.append('g')
			.append('path')
			.style('stroke', color2)
			.attr('fill', 'none')
			.style('stroke-dasharray', '5, 5')
			.attr('stroke-width', '2px')
			.attr('d', this.lineGenerator(data2))

		for (let i = 0; i <= 10; i++) {
			const percent = i * 10
			radarG
				.append('text')
				.attr('transform', `translate(-10, ${(-percent / 100) * radius + 5})`)
				.attr('text-anchor', 'end')
				.style('font-size', '0.8rem')
				.text(`${percent}%`)
				.attr('pointer-events', 'none')
		}
		if (!this.settings.comparison) {
			this.legendG.append('text').attr('text-anchor', 'left').style('font-weight', 'bold').text(`Legend`)
			let abbrev = config[config.plot].term1.abbrev ? `(${config[config.plot].term1.abbrev})` : ''
			const item1 = `${config[config.plot].term1.name} ${abbrev}`
			this.addLegendItem(item1, color1, 0, 'none')
			abbrev = config[config.plot].term2.abbrev ? `(${config[config.plot].term2.abbrev})` : ''

			const item2 = `${config[config.plot].term2.name} ${abbrev}`
			this.addLegendItem(item2, color2, 1, '5, 5')
			if (this.state.dslabel == 'ProfileAbbrev')
				this.addEndUserImpressionNote(this.legendG.append('g').attr('transform', `translate(0, -15)`))
			else this.addPOCNote(this.legendG.append('g').attr('transform', `translate(0, -15)`))
		}
		this.addFilterLegend()
	}

	addData(field, percentage, iangle, data) {
		const iradius = (percentage / 100) * this.radius
		let x = iradius * Math.cos(iangle)
		let y = iradius * Math.sin(iangle)
		const color = field == 'term1' ? 'blue' : '#aaa'
		//circle
		this.radarG.append('g').attr('transform', `translate(${x}, ${y})`).append('circle').attr('r', 4).attr('fill', color)

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
		this.radarG
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
			.attr('font-size', '0.9em')
			.attr('transform', `translate(${x + 5}, ${y})`)
			.attr('text-anchor', 'left')
		textElem.append('tspan').text(text)
	}

	onMouseOver(event) {
		if (event.target.tagName == 'path') {
			const circle = event.target
			const d = circle.__data__
			const menu = this.tip.clear()
			const percentage = d.percentage1
			menu.d.text(`${d.module} ${percentage}%`)
			menu.show(event.clientX, event.clientY, true, true)
		} else this.onMouseOut(event)
	}

	onMouseOut(event) {
		this.tip.hide()
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const defaults = app.vocabApi.termdbConfig?.chartConfigByType?.profileRadar
		defaults.settings = { profileRadar: getDefaultProfilePlotSettings() }

		if (!defaults) throw 'default config not found in termdbConfig.chartConfigByType.profileRadar'
		const config = copyMerge(structuredClone(defaults), opts)
		config.settings.controls = { isOpen: false }
		const terms = config[opts.plot].terms
		const twlst = []
		for (const row of terms) {
			row.term1.score.q = { mode: 'continuous' }
			twlst.push(row.term1.score)
			if (row.term1.maxScore.id) {
				row.term1.maxScore.q = { mode: 'continuous' }
				twlst.push(row.term1.maxScore)
			}
			row.term2.score.q = { mode: 'continuous' }
			twlst.push(row.term2.score)
			if (row.term2.maxScore.id) {
				row.term2.maxScore.q = { mode: 'continuous' }
				twlst.push(row.term2.maxScore)
			}
		}
		await fillTwLst(twlst, app.vocabApi)
		await loadFilterTerms(config, app)
		return config
	} catch (e) {
		throw `${e} [profileRadar getPlotConfig()]`
	}
}

export const profileRadarInit = getCompInit(profileRadar)
// this alias will allow abstracted dynamic imports
export const componentInit = profileRadarInit
