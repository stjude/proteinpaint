import { getCompInit, copyMerge } from '#rx'
import { fillTwLst } from '#termsetting'
import * as d3 from 'd3'
import { profilePlot } from './profilePlot.js'
import { renderTable } from '../dom/table'
import { getDefaultProfilePlotSettings, ABBREV_COHORT, makeChartBtnMenu, getProfilePlotConfig } from './profilePlot.js'

class profileRadar extends profilePlot {
	constructor() {
		super()
		this.type = 'profileRadar'
		this.radius = 200
	}

	async init(appState) {
		await super.init(appState)
		const config = appState.plots.find(p => p.id === this.id)
		this.plotConfig = config
		this.lineGenerator = d3.line()
		this.twLst = []
		this.terms = this.plotConfig.terms
		for (const row of this.terms) {
			this.twLst.push(row.term1.score)
			if (row.term1.maxScore.term) this.twLst.push(row.term1.maxScore)
			this.scoreTerms.push(row.term1)
			this.twLst.push(row.term2.score)
			if (row.term2.maxScore.term) this.twLst.push(row.term2.maxScore)
			this.scoreTerms.push(row.term2)
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
		const width = this.isComparison ? 1000 : 1180
		const height = 800
		this.dom.svg = this.dom.plotDiv
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
		this.dom.tableDiv = rightDiv.append('div').attr('data-testid', 'sjpp-profileRadar-data-table')

		const rows = []
		const columns = [
			{ label: 'Color' },
			{ label: 'Module' },
			{ label: config.term1.abbrev },
			{ label: config.term2.abbrev },
			{
				label: 'Difference*',
				tooltip: `* Difference between ${config.term1.abbrev} and ${config.term2.abbrev}. If bigger than 20 and positive shown in blue, if negative shown in red.`
			}
		]

		// Create a polar grid.
		const radius = this.radius
		const x = 300
		const y = 330
		this.dom.svg
			.append('text')
			.attr('transform', `translate(60, ${40})`)
			.attr('font-weight', 'bold')
			.attr('font-size', '0.9rem')
			.text(config.title)

		const radarG = this.dom.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.radarG = radarG
		this.legendG = this.dom.svg
			.append('g')
			.attr('data-testid', 'sjpp-profileRadar-legend')
			.attr('transform', `translate(${x + 340},${y - 250})`)
		this.filterG = this.dom.svg.append('g').attr('transform', `translate(${x + 340},${y - 150})`)
		this.noteG = this.dom.svg.append('g').attr('transform', `translate(0,${y + 250})`)

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
						startAngle: i * this.angle - this.angle / 2,
						endAngle: (i + 1) * this.angle - this.angle / 2
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
			const textElem = radarG.append('text').attr('x', `${dx}px`).attr('y', `${dy}px`).attr('font-size', '0.9em')
			const texts = module.split(' ')
			let span
			texts.forEach(text => {
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
		if (this.settings.showTable && !this.isComparison) {
			renderTable({
				rows,
				columns,
				div: this.dom.tableDiv,
				showLines: true,
				resize: true,
				maxHeight: '60vh'
			})
		}

		data.push(data[0])
		data2.push(data2[0])
		const color1 = 'blue',
			color2 = 'gray'

		radarG
			.append('g')
			.append('path')
			.style('stroke', color2)
			.attr('fill', 'none')
			.style('stroke-dasharray', '5, 5')
			.attr('stroke-width', '2px')
			.attr('d', this.lineGenerator(data2))
		radarG
			.append('g')
			.append('path')
			.style('stroke', color1)
			.attr('fill', 'none')
			.attr('stroke-width', '2px')
			.attr('d', this.lineGenerator(data))

		for (let i = 0; i <= 10; i++) {
			const percent = i * 10
			radarG
				.append('text')
				.attr('transform', `translate(0, ${(-percent / 100) * radius - 2})`)
				.attr('text-anchor', 'end')
				.style('font-size', '0.8rem')
				.text(`${percent}%`)
				.attr('pointer-events', 'none')
		}
		if (!this.isComparison) {
			this.legendG.append('text').attr('text-anchor', 'left').style('font-weight', 'bold').text(`Legend`)
			let abbrev = config.term1.abbrev ? `(${config.term1.abbrev})` : ''
			const item1 = `${config.term1.name} ${abbrev}`
			this.addLegendItem(item1, color1, 0, 'none')
			abbrev = config.term2.abbrev ? `(${config.term2.abbrev})` : ''

			const item2 = `${config.term2.name} ${abbrev}`
			this.addLegendItem(item2, color2, 1, '5, 5')
			if (this.state.activeCohort == ABBREV_COHORT) this.addEndUserImpressionNote(this.noteG)
			else this.addPOCNote(this.noteG)
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
		const d = event.target.__data__
		if (d?.module) {
			const label1 = this.plotConfig.term1.name
			const label2 = this.plotConfig.term2.name
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
}

export async function getPlotConfig(opts, app, _activeCohort) {
	try {
		const activeCohort = _activeCohort === undefined ? app.getState().activeCohort : _activeCohort
		const defaults = await getProfilePlotConfig(activeCohort, app, opts)

		defaults.settings = { profileRadar: getDefaultProfilePlotSettings() }

		if (!defaults) throw 'default config not found in termdbConfig.plotConfigByCohort.profileRadar'
		const config = copyMerge(structuredClone(defaults), opts)
		config.settings.controls = { isOpen: false }
		const terms = config.terms
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
		return config
	} catch (e) {
		throw `${e} [profileRadar getPlotConfig()]`
	}
}

export { makeChartBtnMenu }

export const profileRadarInit = getCompInit(profileRadar)
// this alias will allow abstracted dynamic imports
export const componentInit = profileRadarInit
