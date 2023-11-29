import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'
import * as d3 from 'd3'
import { profilePlot } from './profilePlot.js'
import { Menu } from '#dom/menu'
import { renderTable } from '#dom/table'
import { loadFilterTerms } from './profilePlot.js'

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
		for (const [i, data] of config.terms.entries()) {
			this.twLst.push(data.score)
			this.twLst.push(data.maxScore)
		}

		this.opts.header.text(config.name).style('font-weight', 'bold')
		this.arcGenerator = d3.arc().innerRadius(0)
		//this.dom.plotDiv.on('mouseover', event => this.onMouseOver(event))
		this.dom.plotDiv.on('mousemove', event => this.onMouseOver(event))
		this.dom.plotDiv.on('mouseleave', event => this.onMouseOut(event))
		this.dom.plotDiv.on('mouseout', event => this.onMouseOut(event))

		this.tip = new Menu({ padding: '4px', offsetX: 10, offsetY: 15 })
	}

	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		this.settings = this.config.settings.profilePolar

		await this.setControls('profilePolar')
		this.angle = (Math.PI * 2) / this.config.terms.length

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
			const percentage = this.getPercentage(d)
			menu.d.text(`${d.module} ${percentage}%`)
			menu.show(event.clientX, event.clientY, true, true)
		} else this.onMouseOut(event)
	}

	plot() {
		const config = this.config
		this.dom.plotDiv.selectAll('*').remove()
		const width = 1000
		const height = 600
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

		this.svg
			.append('text')
			.attr('transform', `translate(130, ${height - 40})`)
			.attr('font-weight', 'bold')
			.text(config.title)

		const rows = []
		const columns = [{ label: 'Color' }, { label: 'Module' }, { label: 'Score' }]

		// Create a polar grid.
		const radius = this.radius
		const x = 300
		const y = 280
		const polarG = this.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.polarG = polarG
		this.legendG = this.svg.append('g').attr('transform', `translate(${x + 250}, ${y + 100})`)
		this.filterG = this.svg.append('g').attr('transform', `translate(${x + 250},${y + 200})`)

		for (let i = 0; i <= 10; i++) addCircle(i * 10)

		const angle = this.angle
		let i = 0
		for (let d of config.terms) {
			const name = d.module
			d.i = i
			const color = d.score.term.color
			const percentage = this.getPercentage(d)
			rows.push([{ color }, { value: name }, { value: percentage }])
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
		if (this.settings.showTable)
			renderTable({
				rows,
				columns,
				div: this.tableDiv,
				showLines: true,
				resize: true,
				maxHeight: '60vh'
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
		const defaults = app.vocabApi.termdbConfig?.chartConfigByType?.profilePolar
		if (!defaults) throw 'default config not found in termdbConfig.chartConfigByType.profilePolar'
		const config = copyMerge(structuredClone(defaults), opts)
		const settings = getDefaultProfilePolarSettings()
		config.settings = {
			controls: {
				isOpen: true // control panel is hidden by default
			},
			profilePolar: settings
		}
		for (const data of config.terms) {
			const scoreTerm = data.score
			const maxScoreTerm = data.maxScore
			scoreTerm.q = { mode: 'continuous' }
			maxScoreTerm.q = { mode: 'continuous' }
			await fillTermWrapper(scoreTerm, app.vocabApi)
			await fillTermWrapper(maxScoreTerm, app.vocabApi)
		}
		await loadFilterTerms(config, app)

		return config
	} catch (e) {
		throw `${e} [profilePolar getPlotConfig()]`
	}
}

export const profilePolarInit = getCompInit(profilePolar)
// this alias will allow abstracted dynamic imports
export const componentInit = profilePolarInit

export function getDefaultProfilePolarSettings() {
	return {
		showTable: true
	}
}
