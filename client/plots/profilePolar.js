import { getCompInit, copyMerge } from '#rx'
import { fillTwLst } from '#termsetting'
import * as d3 from 'd3'
import { profilePlot } from './profilePlot.js'
import { renderTable } from '../dom/table'
import { loadFilterTerms } from './profilePlot.js'
import { getDefaultProfilePlotSettings, getProfilePlotConfig } from './profilePlot.js'

class profilePolar extends profilePlot {
	constructor() {
		super()
		this.type = 'profilePolar'
		this.radius = 250
	}
	async init(appState) {
		await super.init(appState)
		const config = appState.plots.find(p => p.id === this.id)

		this.twLst = []
		for (const data of config.terms) {
			this.twLst.push(data.score)
			this.twLst.push(data.maxScore)
		}

		this.arcGenerator = d3.arc().innerRadius(0)
	}

	async main() {
		await super.main()
		await this.setControls()
		this.angle = (Math.PI * 2) / this.config.terms.length
		this.plot()
	}

	onMouseOut(event) {
		if (event.target.tagName == 'path') {
			const path = event.target
			path.setAttribute('stroke', 'white')
			if (path.getAttribute('stroke-opacity') == 0) path.setAttribute('stroke-opacity', 1)
		}
		this.tip.hide()
	}

	onMouseOver(event) {
		if (event.target.tagName == 'path') {
			const path = event.target
			path.setAttribute('stroke-opacity', 0)
			const d = path.__data__
			const menu = this.tip.clear()
			const percentage = this.getPercentage(d)
			menu.d.text(`${d.module} ${percentage}%`)
			menu.show(event.clientX, event.clientY, true, true)
		} else this.onMouseOut(event)
	}

	plot() {
		const config = this.config
		this.dom.plotDiv.selectAll('*').remove()
		const width = 1100
		const height = 700
		this.svg = this.dom.plotDiv
			.append('div')
			.style('display', 'inline-block')
			.append('svg')
			.attr('width', width)
			.attr('height', height)
		this.dom.tableDiv = this.dom.plotDiv
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin', '45px 20px')

		if (!this.settings.comparison)
			this.svg.append('text').attr('transform', `translate(130, ${40})`).attr('font-weight', 'bold').text(config.title)

		const rows = []
		const columns = [{ label: 'Color' }, { label: 'Module' }, { label: 'Score', align: 'center' }]

		// Create a polar grid.
		const radius = this.radius
		const x = 280
		const y = 330
		const polarG = this.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.polarG = polarG
		this.legendG = this.svg.append('g').attr('transform', `translate(${x + 280}, ${y})`)
		this.filterG = this.svg.append('g').attr('transform', `translate(${x + 280},${y + 150})`)

		for (let i = 0; i <= 10; i++) addCircle(i * 10)

		const angle = this.angle
		let i = 0
		for (let d of config.terms) {
			const name = d.module
			d.i = i
			const color = d.score.term.color
			const percentage = this.getPercentage(d)
			rows.push([{ color, disabled: true }, { value: name }, { value: percentage }])
			polarG
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
				.on('click', event => this.onMouseOver(event))

			i++
		}
		this.dom.tableDiv.selectAll('*').remove()
		if (this.settings.showTable)
			renderTable({
				rows,
				columns,
				div: this.dom.tableDiv,
				showLines: true,
				resize: true,
				maxHeight: '50vh'
			})

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
				.attr('pointer-events', 'none')
		}
		this.legendG
			.append('text')
			.attr('text-anchor', 'left')
			.style('font-weight', 'bold')
			.text('Overall Score')
			.attr('transform', `translate(0, -5)`)

		this.addLegendItem('A', 'More than 75% of possible scorable items', 1)
		this.addLegendItem('B', '50-75% of possible scorable items', 2)
		this.addLegendItem('C', 'Less than 50% of possible scorable items', 3)
		this.addFilterLegend()

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
		const defaults = getProfilePlotConfig(app, opts)
		defaults.settings = { profilePolar: getDefaultProfilePlotSettings() }

		if (!defaults) throw 'default config not found in termdbConfig.chartConfigByType.profilePolar'
		const config = copyMerge(structuredClone(defaults), opts)
		config.settings.controls = { isOpen: false }
		const twlst = []
		for (const data of config.terms) {
			const scoreTerm = data.score
			const maxScoreTerm = data.maxScore
			scoreTerm.q = { mode: 'continuous' }
			maxScoreTerm.q = { mode: 'continuous' }
			twlst.push(scoreTerm)
			twlst.push(maxScoreTerm)
		}
		await fillTwLst(twlst, app.vocabApi)
		await loadFilterTerms(config, app, opts)

		return config
	} catch (e) {
		throw `${e} [profilePolar getPlotConfig()]`
	}
}

export const profilePolarInit = getCompInit(profilePolar)
// this alias will allow abstracted dynamic imports
export const componentInit = profilePolarInit
