import { getCompInit, copyMerge } from '#rx'
import { fillTwLst } from '#termsetting'
import * as d3 from 'd3'
import { renderTable } from '../dom/table'
import { profilePlot } from './profilePlot.js'
import { loadFilterTerms } from './profilePlot.js'
import { getDefaultProfilePlotSettings, makeChartBtnMenu } from './profilePlot.js'
export { makeChartBtnMenu }

class profileRadarFacility extends profilePlot {
	constructor() {
		super()
		this.type = 'profileRadarFacility'
		this.radius = 250
	}

	async init(appState) {
		await super.init(appState)
		const config = appState.plots.find(p => p.id === this.id)
		this.plotConfig = config
		this.twLst = []
		this.terms = config.terms
		for (const row of this.terms) {
			this.rowCount++
			this.twLst.push(row.score)
			this.twLst.push(row.maxScore)
		}
		this.lineGenerator = d3.line()
		this.arcGenerator = d3.arc().innerRadius(0)
	}

	async main() {
		await super.main()

		await this.setControls()

		this.angle = (Math.PI * 2) / this.terms.length
		this.plot()
	}

	plot() {
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
		const rightDiv = this.dom.plotDiv
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin-top', '140px')
			.style('margin-right', '20px')
		this.tableDiv = rightDiv.append('div')
		const noteDiv = rightDiv
			.append('div')
			.style('font-size', '0.9rem')
			.style('padding-top', '5px')
			.style('word-wrap', 'wrap')
		const footNote = `* Difference between site and aggregated scores. If bigger than 20, shown in red if negative and in blue if positive.`
		noteDiv.text(footNote)
		// Create a polar grid.

		this.svg
			.append('text')
			.attr('transform', `translate(110, ${30})`)
			.attr('font-weight', 'bold')
			.text(this.config.title)
		const radius = this.radius
		const x = 370
		const y = 350
		const radarG = this.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.radarG = radarG

		this.legendG = this.svg.append('g').attr('transform', `translate(${x + 360},${y + 50})`)
		this.filterG = this.svg.append('g').attr('transform', `translate(${x + 360},${y + 150})`)

		const rows = []
		const columns = [
			{ label: 'Color' },
			{ label: 'Module' },
			{ label: `Facility` },
			{ label: 'Global' },
			{ label: 'Difference*' }
		]

		for (let i = 0; i <= 10; i++) this.addPoligon(i * 10)

		let i = 0
		const data = [],
			data2 = []
		for (const item of this.terms) {
			const iangle = i * this.angle - Math.PI / 2
			const percentage1 = this.getPercentage(item) //facility
			const percentage2 = this.getPercentage(item, true)

			this.radarG
				.append('path')
				.datum({ module: item.module, percentage1, percentage2 })
				.attr('fill', 'transparent')
				.attr(
					'd',
					this.arcGenerator({
						outerRadius: this.radius,
						startAngle: i * this.angle - this.angle / 2,
						endAngle: (i + 1) * this.angle - this.angle / 2
					})
				)
				.on('click', event => this.onMouseOver(event))
			this.addData(iangle, i, data2, percentage2, false)
			this.addData(iangle, i, data, percentage1, true)

			const color = item.score.term.color
			const diff = Math.abs(percentage1 - percentage2)
			const diffRow = { value: diff }
			if (diff >= 20) diffRow.color = percentage2 > percentage1 ? 'red' : 'blue'
			const row = [
				{ color, disabled: true },
				{ value: item.module },
				{ value: percentage1 },
				{ value: percentage2 },
				diffRow
			]
			rows.push(row)

			i++
			const leftSide = iangle > Math.PI / 2 && iangle <= (3 / 2) * Math.PI
			let dx = radius * 1.1 * Math.cos(iangle)
			let dy = radius * 1.1 * Math.sin(iangle) - 10
			const textElem = radarG.append('text').attr('x', `${dx}px`).attr('y', `${dy}px`)

			const texts = item.module.split(' ')
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
				resize: true
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
		if (this.state.logged) {
			radarG
				.append('g')
				.append('path')
				.style('stroke', color2)
				.attr('fill', 'none')
				.style('stroke-dasharray', '5, 5')
				.attr('d', this.lineGenerator(data2))
		}

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

		this.addFilterLegend()
		this.legendG.append('text').attr('text-anchor', 'left').style('font-weight', 'bold').text('Legend')
		const siteLabel = this.sites.find(s => s.value == this.settings.site).label
		this.addLegendItem(siteLabel, color1, 0, 'none')
		this.addLegendItem(this.config.score, color2, 1, '5, 5')
	}

	addData(iangle, i, data, percentage, isFacility) {
		const item = this.terms[i]
		const iradius = (percentage / 100) * this.radius
		let x = iradius * Math.cos(iangle)
		let y = iradius * Math.sin(iangle)
		const color = isFacility ? 'blue' : '#aaa'
		const circle = this.radarG
			.append('g')
			.attr('transform', `translate(${x}, ${y})`)
			.append('circle')
			.attr('r', 4)
			.attr('fill', color)
			.on('click', event => this.onMouseOver(event))

		data.push([x, y])
		circle.datum({ module: item.module, percentage })
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
		const d = event.target.__data__
		if (d?.module) {
			const label1 = 'Facility'
			const label2 = this.plotConfig.score
			const menu = this.tip.clear()
			menu.d.append('div').style('font-weight', 'bold').text(d.module)
			const table = menu.d.append('table')
			let tr = table.append('tr')
			tr.append('td').text(label1)
			tr.append('td').text(d.percentage1)
			tr = table.append('tr')
			tr.append('td').text(label2)
			tr.append('td').text(d.percentage2)
			menu.show(event.clientX, event.clientY, true, true)
		} else this.onMouseOut(event)
	}

	onMouseOut(event) {
		this.tip.hide()
	}
}

export async function getPlotConfig(opts, app, _activeCohort) {
	try {
		const defaults = opts
		if (!defaults) throw 'default config not found in termdbConfig.plotConfigByCohort.profileRadarFacility'
		let config = copyMerge(structuredClone(defaults), opts)
		const settings = getDefaultProfilePlotSettings()

		config.settings = {
			profileRadarFacility: settings,
			controls: { isOpen: false }
		}
		const terms = config.terms
		const twlst = []
		for (const row of terms) {
			row.score.q = row.maxScore.q = { mode: 'continuous' }
			twlst.push(row.score)
			twlst.push(row.maxScore)
		}
		await fillTwLst(twlst, app.vocabApi)
		const activeCohort = _activeCohort === undefined ? app.getState().activeCohort : _activeCohort
		await loadFilterTerms(config, activeCohort, app)
		return config
	} catch (e) {
		throw `${e} [profileRadarFacility getPlotConfig()]`
	}
}

export const profileRadarFacilityInit = getCompInit(profileRadarFacility)
// this alias will allow abstracted dynamic imports
export const componentInit = profileRadarFacilityInit
