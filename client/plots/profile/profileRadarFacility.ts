import { getCompInit, copyMerge } from '#rx'
import { fillTwLst } from '#termsetting'
import * as d3 from 'd3'
import { renderTable } from '../../dom/table.js'
import { getDefaultProfilePlotSettings, makeChartBtnMenu, getProfilePlotConfig, profilePlot } from './profilePlot'
export { makeChartBtnMenu }

class profileRadarFacility extends profilePlot {
	radius: number
	lineGenerator: any
	arcGenerator: any
	angle?: number
	radarG: any

	constructor(opts) {
		super(opts, 'profileRadarFacility')
		this.radius = 200
		this.isRadarFacility = true // this is a radar facility plot
		this.lineGenerator = d3.line()
		this.arcGenerator = d3.arc().innerRadius(0)
	}

	async init(appState) {
		await super.init(appState)
		const config = structuredClone(appState.plots.find(p => p.id === this.id))
		for (const row of config.terms) {
			this.scoreTerms.push(row)
		}
		this.angle = (Math.PI * 2) / config.terms.length
	}

	async main() {
		await super.main()
		await this.setControls()
		this.plot()
	}

	plot() {
		const width = this.isComparison ? 1000 : 1100
		const height = 630
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
			.style('margin-top', '80px')
			.style('margin-right', '20px')
		this.dom.tableDiv = rightDiv.append('div')

		// Create a polar grid.

		this.dom.svg
			.append('text')
			.attr('transform', `translate(90, ${30})`)
			.attr('font-weight', 'bold')
			.text(this.config.title)
		const radius = this.radius
		const x = 300
		const y = 330
		const radarG = this.dom.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.radarG = radarG

		this.legendG = this.dom.svg
			.append('g')
			.attr('font-size', '0.9em')
			.attr('transform', `translate(${x + 320},${y - 150})`)
		this.filterG = this.dom.svg.append('g').attr('transform', `translate(${x + 320},${y - 50})`)

		const rows: any[] = []
		const columns = [
			{ label: 'Color' },
			{ label: 'Module' },
			{ label: `Facility` },
			{ label: 'Global' },
			{
				label: 'Difference*',
				tooltip: `* Difference between site and aggregated scores. If bigger than 20 and positive shown in blue, if negative shown in red.`
			}
		]

		for (let i = 0; i <= 10; i++) this.addPoligon(i * 10)

		let i = 0
		const data = [],
			data2 = []
		for (const item of this.config.terms) {
			const iangle = i * this.angle - Math.PI / 2
			const percentage1 = this.getSamplePercentage(item) //facility
			const percentage2 = this.getPercentage(item)

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
			const diffRow: any = { value: diff }
			if (diff >= 20) diffRow.color = percentage2 > percentage1 ? 'red' : 'blue'
			const row: any[] = [
				{ color, disabled: true },
				{ value: item.module },
				{ value: percentage1 },
				{ value: percentage2 },
				diffRow
			]
			rows.push(row)

			i++
			const leftSide = iangle > Math.PI / 2 && iangle <= (3 / 2) * Math.PI
			const dx = radius * 1.1 * Math.cos(iangle)
			let dy = radius * 1.1 * Math.sin(iangle) - 10
			const textElem = radarG.append('text').attr('x', `${dx}px`).attr('y', `${dy}px`).attr('font-size', '0.9em')

			const texts = item.module.split(' ')
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
		if (!this.isComparison) {
			renderTable({
				rows,
				columns,
				div: this.dom.tableDiv,
				showLines: true,
				resize: true
			})
		}

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
				.attr('transform', `translate(0, ${(-percent / 100) * radius - 2})`)
				.attr('text-anchor', 'end')
				.style('font-size', '0.8rem')
				.text(`${percent}%`)
				.attr('pointer-events', 'none')
		}

		this.addFilterLegend()
		this.legendG.append('text').attr('text-anchor', 'left').style('font-weight', 'bold').text('Legend')
		const site = this.sampleData.site
		const hospital = site.label
		const id = site.value
		this.addFacilityLegendItem(`${hospital} / ${id}`, color1, 0, 'none')
		this.addFacilityLegendItem(this.config.score, color2, 1, '5, 5')
	}

	addData(iangle, i, data, percentage, isFacility) {
		const item = this.config.terms[i]
		const iradius = (percentage / 100) * this.radius
		const x = iradius * Math.cos(iangle)
		const y = iradius * Math.sin(iangle)
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
		const data: any[] = []
		for (let i = 0; i < this.config.terms.length; i++) {
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

	addFacilityLegendItem(text, color, index, strokeDash) {
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
			const label2 = this.config.score
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

	getSamplePercentage(d) {
		if (!d) return 0
		const score = this.sampleData.term2Score[d.score.term.id]
		return score
	}
}

export async function getPlotConfig(opts, app, _activeCohort) {
	try {
		const activeCohort = _activeCohort === undefined ? app.getState().activeCohort : _activeCohort
		const defaults = await getProfilePlotConfig(activeCohort, app, opts)
		if (!defaults) throw 'default config not found in termdbConfig.plotConfigByCohort.profileRadarFacility'
		const config = copyMerge(structuredClone(defaults), opts)
		const settings = getDefaultProfilePlotSettings()

		config.settings = {
			profileRadarFacility: settings,
			controls: { isOpen: false }
		}
		const terms = config.terms
		const twlst: any[] = []
		for (const row of terms) {
			row.score.q = row.maxScore.q = { mode: 'continuous' }
			twlst.push(row.score)
			twlst.push(row.maxScore)
		}
		await fillTwLst(twlst, app.vocabApi)
		return config
	} catch (e) {
		throw `${e} [profileRadarFacility getPlotConfig()]`
	}
}

export const profileRadarFacilityInit = getCompInit(profileRadarFacility)
// this alias will allow abstracted dynamic imports
export const componentInit = profileRadarFacilityInit
