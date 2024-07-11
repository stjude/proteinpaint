import { getCompInit, copyMerge } from '#rx'
import { fillTwLst } from '#termsetting'
import * as d3 from 'd3'
import { renderTable } from '../dom/table'
import { profilePlot } from './profilePlot.js'
import { loadFilterTerms } from './profilePlot.js'
import { getDefaultProfilePlotSettings } from './profilePlot.js'

class profileRadarFacility extends profilePlot {
	constructor() {
		super()
		this.type = 'profileRadarFacility'
		this.radius = 250
	}

	async init(appState) {
		await super.init(appState)
		const config = appState.plots.find(p => p.id === this.id)
		this.twLst = []
		this.terms = config[config.plot].terms
		for (const row of this.terms) {
			this.rowCount++
			this.twLst.push(row.score)
			this.twLst.push(row.maxScore)
		}
		this.lineGenerator = d3.line()
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
		const widht = 1550
		const height = 650
		this.svg = this.dom.plotDiv
			.append('div')
			.style('display', 'inline-block')
			.append('svg')
			.attr('width', widht)
			.attr('height', height)
		this.tableDiv = this.dom.plotDiv
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin-top', '45px')
		// Create a polar grid.

		this.svg
			.append('text')
			.attr('transform', `translate(110, ${height - 30})`)
			.attr('font-weight', 'bold')
			.text(this.config[this.config.plot].title)
		const radius = this.radius
		const x = 370
		const y = 300
		const polarG = this.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.polarG = polarG

		this.legendG = this.svg.append('g').attr('transform', `translate(${x + 420},${y - 180})`)
		this.filterG = this.svg.append('g').attr('transform', `translate(${x + 420},${y + 10})`)

		const rows = []
		const columns = [{ label: 'Module' }, { label: `Facility` }, { label: 'Global' }]

		for (let i = 0; i <= 10; i++) this.addPoligon(i * 10)

		let i = 0
		const data = [],
			data2 = []
		for (const item of this.terms) {
			const iangle = i * this.angle - Math.PI / 2
			this.addData(iangle, i, data2, true)
			const row = [{ value: item.module }, { value: this.getPercentage(item) }]

			this.addData(iangle, i, data, false)
			row.push({ value: this.getPercentage(item, true) })
			rows.push(row)

			i++
			const leftSide = iangle > Math.PI / 2 && iangle <= (3 / 2) * Math.PI
			let dx = radius * 1.1 * Math.cos(iangle)
			let dy = radius * 1.1 * Math.sin(iangle) - 10
			const textElem = polarG.append('text').attr('x', `${dx}px`).attr('y', `${dy}px`)

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
		if (this.state.isLoggedIn) {
			polarG
				.append('g')
				.append('path')
				.style('stroke', color2)
				.attr('fill', 'none')
				.attr('stroke-width', '2px')
				.attr('d', this.lineGenerator(data2))
		}

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
		this.legendG.append('text').attr('text-anchor', 'left').style('font-weight', 'bold').text('Legend')
		const siteLabel = this.sites.find(s => s.value == this.settings.site).label
		this.addLegendItem(siteLabel, color2, 0, 'none')
		this.addLegendItem(this.config[this.config.plot].score, color1, 1, '5, 5')
	}

	addData(iangle, i, data, isFacility) {
		const item = this.terms[i]
		const percentage = isFacility ? this.getPercentage(item) : this.getPercentage(item, true)
		const iradius = (percentage / 100) * this.radius
		let x = iradius * Math.cos(iangle)
		let y = iradius * Math.sin(iangle)
		const color = isFacility ? 'blue' : '#aaa'
		const circle = this.polarG
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
			.attr('font-size', '0.9em')
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
		this.tip.hide()
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const defaults = app.vocabApi.termdbConfig?.chartConfigByType?.profileRadarFacility
		if (!defaults) throw 'default config not found in termdbConfig.chartConfigByType.profileRadarFacility'
		let config = copyMerge(structuredClone(defaults), opts)
		const settings = getDefaultProfilePlotSettings()

		config.settings = {
			profileRadarFacility: settings,
			controls: { isOpen: true }
		}
		const terms = config[opts.plot].terms
		const twlst = []
		for (const row of terms) {
			row.score.q = row.maxScore.q = { mode: 'continuous' }
			twlst.push(row.score)
			twlst.push(row.maxScore)
		}
		await fillTwLst(twlst, app.vocabApi)
		await loadFilterTerms(config, app)
		return config
	} catch (e) {
		throw `${e} [profileRadarFacility getPlotConfig()]`
	}
}

export const profileRadarFacilityInit = getCompInit(profileRadarFacility)
// this alias will allow abstracted dynamic imports
export const componentInit = profileRadarFacilityInit
