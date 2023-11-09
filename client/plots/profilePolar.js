import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'
import * as d3 from 'd3'
import { getSampleFilter } from '#termsetting/handlers/samplelst'
import { profilePlot } from './profilePlot.js'
import { Menu } from '#dom/menu'
import { renderTable } from '#dom/table'
import { controlsInit } from './controls'
import { downloadSingleSVG } from '../common/svg.download.js'

class profilePolar extends profilePlot {
	constructor() {
		super()
		this.type = 'profilePolar'
		this.radius = 250
	}
	async init(appState) {
		await super.init(appState)
		this.opts.header.text('Polar Graph: Score based results by PrOFILE module').style('font-weight', 'bold')
		this.arcGenerator = d3.arc().innerRadius(0)
		//this.dom.plotDiv.on('mouseover', event => this.onMouseOver(event))
		this.dom.plotDiv.on('mousemove', event => this.onMouseOver(event))
		this.dom.plotDiv.on('mouseleave', event => this.onMouseOut(event))
		this.dom.plotDiv.on('mouseout', event => this.onMouseOut(event))

		this.tip = new Menu({ padding: '4px', offsetX: 10, offsetY: 15 })
	}

	async setControls() {
		this.dom.controlsDiv.selectAll('*').remove()
		const inputs = [
			{
				label: 'Show table',
				type: 'checkbox',
				chartType: 'profilePolar',
				settingsKey: 'showTable',
				boxLabel: 'Yes'
			},
			{
				label: 'Region',
				type: 'dropdown',
				chartType: 'profilePolar',
				options: this.regions,
				settingsKey: 'region',
				callback: value => this.setRegion(value)
			},
			{
				label: 'Income group',
				type: 'dropdown',
				chartType: 'profilePolar',
				options: this.incomes,
				settingsKey: 'income',
				callback: value => this.setIncome(value)
			}
		]
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsDiv,
				inputs
			})
		}
		this.components.controls.on('downloadClick.profilePolar', () => downloadSingleSVG(this.svg, this.filename))
	}

	setRegion(region) {
		const config = this.config
		config.settings.profilePolar.facility = ''
		config.settings.profilePolar.region = region
		config.settings.profilePolar.income = ''
		const sampleId = parseInt(this.sampleidmap[region])
		config.sampleName = config.region
		config.filter = getSampleFilter(sampleId)
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	setIncome(income) {
		const config = this.config
		config.settings.profilePolar.facility = ''
		config.settings.profilePolar.income = income
		config.settings.profilePolar.region = ''
		const sampleId = parseInt(this.sampleidmap[income])
		config.sampleName = config.income
		config.filter = getSampleFilter(sampleId)
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		this.settings = this.config.settings.profilePolar
		await this.setControls()
		this.twLst = []
		for (const [i, tw] of this.config.terms.entries()) {
			if (tw.id) this.twLst.push(tw)
		}
		this.twLst.push(this.config.typeTW)
		const sampleName = this.settings.region !== undefined ? this.settings.region : this.settings.income || 'Global'
		const filter = this.config.filter || getSampleFilter(this.sampleidmap[sampleName])

		this.data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: this.twLst,
			filter
		})
		this.sampleData = this.data.lst[0]
		this.angle = (Math.PI * 2) / this.config.terms.length

		this.income = this.settings.income || this.incomes[0].value
		this.region = this.settings.region !== undefined ? this.settings.region : this.income == '' ? 'Global' : ''
		this.filename = `polar_plot${this.region ? '_' + this.region : ''}${this.income ? '_' + this.income : ''}.svg`
			.split(' ')
			.join('_')
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
			const percentage = this.sampleData[d.$id]?.value
			menu.d.text(`${d.term.name} ${percentage}%`)
			menu.show(event.clientX, event.clientY, true, true)
		} else this.onMouseOut(event)
	}

	plot() {
		const config = this.config
		this.dom.plotDiv.selectAll('*').remove()

		if (!this.sampleData) return

		this.svg = this.dom.plotDiv
			.append('div')
			.style('display', 'inline-block')
			.append('svg')
			.attr('width', 1000)
			.attr('height', 600)
		this.tableDiv = this.dom.plotDiv
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin-top', '45px')
		const rows = []
		const columns = [{ label: 'Module' }, { label: 'Score' }]

		// Create a polar grid.
		const radius = this.radius
		const x = 300
		const y = 300
		const polarG = this.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.polarG = polarG
		this.legendG = this.svg.append('g').attr('transform', `translate(${x + 300},${y + 150})`)
		this.filterG = this.svg.append('g').attr('transform', `translate(${x + 300}, ${y})`)

		for (let i = 0; i <= 10; i++) addCircle(i * 10)

		const angle = this.angle
		let i = 0

		for (let d of config.terms) {
			d.i = i
			const percentage = this.sampleData[d.$id]?.value
			rows.push([{ value: d.term.name }, { value: percentage }])
			const path = polarG
				.append('g')
				.append('path')
				.datum(d)
				.attr('fill', d.term.color)
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

		this.filterG
			.append('text')
			.attr('text-anchor', 'left')
			.style('font-weight', 'bold')
			.text('Filters')
			.attr('transform', `translate(0, -5)`)
		this.addLegendFilter('region', this.settings.region, 1)
		this.addLegendFilter('income', this.settings.income, 2)

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

	addLegendFilter(filter, value, index) {
		const text = this.filterG
			.append('text')
			.attr('transform', `translate(0, ${index * 20})`)
			.attr('text-anchor', 'left')
		text.append('tspan').attr('font-weight', 'bold').text(filter)
		text.append('tspan').text(`: ${value ? value : 'None'}`)
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
				isOpen: false // control panel is hidden by default
			},
			profilePolar: settings
		}
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

export function getDefaultProfilePolarSettings() {
	return {
		showTable: true
	}
}
