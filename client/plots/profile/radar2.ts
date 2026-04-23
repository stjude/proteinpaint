import { getCompInit, copyMerge } from '#rx'
import { fillTwLst } from '#termsetting'
import * as d3 from 'd3'
import { dofetch3 } from '#common/dofetch'
import { renderTable } from '../../dom/table.js'
import {
	profilePlot,
	getDefaultProfilePlotSettings,
	getProfilePlotConfig,
	makeChartBtnMenu,
	ABBREV_COHORT
} from './profilePlot.js'

/*
profileRadar2 — redesigned radar chart that follows the per-plot dedicated
route architecture established by profilePolar2 and profileBarchart2.

Key differences from profileBarchart:
  - Dedicated server route: termdb/profileRadar2Scores.
  - Server-side facility term derivation: client does not send facilityTW.
  - Always aggregated: median percentage across eligible sites.
  - Minimal client payload: scoreTerms stripped to { term: { id }, q }.
  - Public role: sites is always [] in the response.
  - Cleaner rendering structure: plot() split into focused private methods.
*/

class ProfileRadar2 extends profilePlot {
	static type = 'profileRadar2'

	radius: number
	lineGenerator: any
	arcGenerator: any
	angle?: number
	radarG: any
	noteG: any

	constructor(opts) {
		super(opts, 'profileRadar2')
		this.radius = 200
		this.lineGenerator = d3.line()
		this.arcGenerator = d3.arc().innerRadius(0)
	}

	async init(appState) {
		await super.init(appState)
		const config = appState.plots.find(p => p.id === this.id)
		for (const row of config.terms) {
			this.scoreTerms.push(row.term1)
			this.scoreTerms.push(row.term2)
		}
		this.angle = (Math.PI * 2) / config.terms.length
	}

	async main() {
		await super.main()
		await this.setControls()
		this.plot()
	}

	/**
	 * Override setControls() to fetch data from the dedicated radar2 route.
	 * The base class setControls() builds filter UI and sets this.filter but
	 * skips the data fetch for profileRadar2 (see profilePlot.ts).
	 */
	async setControls(additionalInputs: any[] = []) {
		await super.setControls(additionalInputs)
		this.data = await this.fetchAggregatedScores()
		if (this.data && 'error' in this.data) throw this.data.error
	}

	private async fetchAggregatedScores() {
		// No facilityTW — server derives it from term ID prefixes in the request.
		// scoreTerms stripped to { term: { id }, q } only — server fills the rest via termjsonByOneid.
		return dofetch3('termdb/profileRadar2Scores', {
			body: {
				genome: this.state.vocab.genome,
				dslabel: this.state.vocab.dslabel,
				scoreTerms: this.scoreTerms.map((t: any) => ({
					score: { term: { id: t.score.term.id }, q: t.score.q },
					maxScore: typeof t.maxScore === 'number' ? t.maxScore : { term: { id: t.maxScore.term.id }, q: t.maxScore.q }
				})),
				filterByUserSites: this.settings?.filterByUserSites,
				filter: this.filter
			}
		})
	}

	plot() {
		const { radarG, rows, data, data2 } = this.createSvgAndGrid()
		this.drawLines(radarG, data, data2)
		this.drawPercentLabels(radarG)
		this.drawTableAndLegend(rows)
	}

	private createSvgAndGrid() {
		const config = this.config
		const width = this.isComparison ? 1000 : 1050
		const height = 650
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
		this.dom.tableDiv = rightDiv.append('div').attr('data-testid', 'sjpp-profileRadar2-data-table')

		const x = 300
		const y = 310
		this.dom.svg
			.append('text')
			.attr('transform', `translate(60, 40)`)
			.attr('font-weight', 'bold')
			.attr('font-size', '0.9rem')
			.text(`${config.title} (v2)`)

		const radarG = this.dom.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.radarG = radarG
		this.legendG = this.dom.svg
			.append('g')
			.attr('data-testid', 'sjpp-profileRadar2-legend')
			.attr('transform', `translate(${x + 340},${y - 120})`)
		this.filterG = this.dom.svg.append('g').attr('transform', `translate(${x + 340},${y - 20})`)
		this.noteG = this.dom.svg.append('g').attr('transform', `translate(20, ${y + 150})`)

		for (let i = 0; i <= 10; i++) this.drawPolygon(i * 10)

		// Populate per-module arc slices + compute percentages + build rows table.
		const rows: any[] = []
		const data: number[][] = [] // term1 vertices
		const data2: number[][] = [] // term2 vertices
		const angle = this.angle!
		let i = 0
		for (const { module, term1, term2 } of config.terms) {
			const iangle = i * angle - Math.PI / 2
			const percentage1 = this.getPercentage(term1)
			const percentage2 = this.getPercentage(term2)
			this.radarG
				.append('path')
				.datum({ module, percentage1, percentage2 })
				.attr('fill', 'transparent')
				.attr(
					'd',
					this.arcGenerator({
						outerRadius: this.radius,
						startAngle: i * angle - angle / 2,
						endAngle: (i + 1) * angle - angle / 2
					})
				)
				.on('click', event => this.onMouseOver(event))

			this.addDataPoint('term2', percentage2, iangle, data2)
			this.addDataPoint('term1', percentage1, iangle, data)

			const color = term1.score.term.color
			const diff = Math.abs(percentage1 - percentage2)
			const diffRow: any = { value: diff }
			if (diff >= 20) diffRow.color = percentage2 > percentage1 ? 'red' : 'blue'
			rows.push([{ color, disabled: true }, { value: module }, { value: percentage1 }, { value: percentage2 }, diffRow])

			this.drawModuleLabel(module, iangle)
			i++
		}

		return { radarG, rows, data, data2 }
	}

	private drawLines(radarG: any, data: number[][], data2: number[][]) {
		data.push(data[0])
		data2.push(data2[0])
		const color1 = 'blue'
		const color2 = 'gray'

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
	}

	private drawPercentLabels(radarG: any) {
		for (let i = 0; i <= 10; i++) {
			const percent = i * 10
			radarG
				.append('text')
				.attr('transform', `translate(0, ${(-percent / 100) * this.radius - 2})`)
				.attr('text-anchor', 'end')
				.style('font-size', '0.8rem')
				.text(`${percent}%`)
				.attr('pointer-events', 'none')
		}
	}

	private drawTableAndLegend(rows: any[]) {
		const config = this.config
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

		if (!this.isComparison) {
			renderTable({
				rows,
				columns,
				div: this.dom.tableDiv,
				showLines: true,
				resize: true,
				maxHeight: '60vh'
			})

			this.legendG.append('text').attr('text-anchor', 'left').style('font-weight', 'bold').text('Legend')
			let abbrev = config.term1.abbrev ? `(${config.term1.abbrev})` : ''
			this.addRadarLegendItem(`${config.term1.name} ${abbrev}`, 'blue', 0, 'none')
			abbrev = config.term2.abbrev ? `(${config.term2.abbrev})` : ''
			this.addRadarLegendItem(`${config.term2.name} ${abbrev}`, 'gray', 1, '5, 5')
			if (this.state.activeCohort == ABBREV_COHORT) this.addEndUserImpressionNote(this.noteG)
			else this.addPOCNote(this.noteG)
		}
		this.addFilterLegend()
	}

	private drawModuleLabel(module: string, iangle: number) {
		const radius = this.radius
		const leftSide = iangle > Math.PI / 2 && iangle <= (3 / 2) * Math.PI
		const dx = radius * 1.1 * Math.cos(iangle)
		let dy = radius * 1.1 * Math.sin(iangle) - 10
		const textElem = this.radarG.append('text').attr('x', `${dx}px`).attr('y', `${dy}px`).attr('font-size', '0.9em')
		const texts = module.split(' ')
		let span: any
		for (const text of texts) {
			if (text != 'and') {
				dy += 15
				span = textElem.append('tspan').attr('x', `${dx}px`).attr('y', `${dy}px`).text(text)
			} else span.append('tspan').text(' and')
		}
		if (leftSide) textElem.attr('text-anchor', 'end')
	}

	private addDataPoint(field: 'term1' | 'term2', percentage: number, iangle: number, data: number[][]) {
		const iradius = (percentage / 100) * this.radius
		const x = iradius * Math.cos(iangle)
		const y = iradius * Math.sin(iangle)
		const color = field == 'term1' ? 'blue' : '#aaa'
		this.radarG.append('g').attr('transform', `translate(${x}, ${y})`).append('circle').attr('r', 4).attr('fill', color)
		data.push([x, y])
	}

	private drawPolygon(percent: number) {
		const data: number[][] = []
		for (let i = 0; i < this.config.terms.length; i++) {
			const iangle = i * this.angle! - Math.PI / 2
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

	private addRadarLegendItem(text: string, color: string, index: number, strokeDash: string) {
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
			.attr('transform', `translate(0, ${y - 5})`)
			.append('circle')
			.attr('r', 4)
			.attr('fill', color)
		this.legendG
			.append('text')
			.attr('font-size', '0.9em')
			.attr('transform', `translate(${x + 5}, ${y})`)
			.attr('text-anchor', 'left')
			.append('tspan')
			.text(text)
	}

	onMouseOver(event) {
		const d = event.target.__data__
		if (d?.module) {
			const label1 = this.config.term1.name
			const label2 = this.config.term2.name
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
		if (!defaults) throw 'default config not found in termdbConfig.plotConfigByCohort.profileRadar2'
		defaults.settings = { profileRadar2: getDefaultProfilePlotSettings() }
		const config = copyMerge(structuredClone(defaults), opts)
		config.settings.controls = { isOpen: false }
		const twlst: any[] = []
		for (const row of config.terms) {
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
		throw `${e} [profileRadar2 getPlotConfig()]`
	}
}

export { makeChartBtnMenu }

export const profileRadar2Init = getCompInit(ProfileRadar2)
// this alias will allow abstracted dynamic imports
export const componentInit = profileRadar2Init
