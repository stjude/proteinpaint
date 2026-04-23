import { getCompInit, copyMerge } from '#rx'
import { fillTwLst } from '#termsetting'
import * as d3 from 'd3'
import { dofetch3 } from '#common/dofetch'
import { renderTable } from '../../dom/table.js'
import { getDefaultProfilePlotSettings, makeChartBtnMenu, getProfilePlotConfig, profilePlot } from './profilePlot.js'

export { makeChartBtnMenu }

/*
profileRadarFacility2 — redesigned facility radar chart following the per-plot
dedicated-route pattern.

Unlike polar2/barchart2/radar2 which are aggregate-only, this route returns
BOTH the aggregate median (the "Global" line) AND a single-site row (the
"Facility" line) in ONE response. The v1 chart made two sequential requests;
v2 makes one.

Key differences from profileRadarFacility:
  - Dedicated server route: termdb/profileRadarFacility2Scores.
  - Server-side facility term derivation: client does not send facilityTW.
  - Single round-trip: aggregate + single-site in one response.
  - Minimal client payload: scoreTerms stripped to { term: { id }, q }.
  - Zero-score sites included in the median (!= null filter).
  - Cleaner rendering structure: plot() split into focused private methods.

Still auth-gated — chart is hidden from public users via isSupportedChartOverride.
*/

class ProfileRadarFacility2 extends profilePlot {
	static type = 'profileRadarFacility2'

	radius: number
	lineGenerator: any
	arcGenerator: any
	angle?: number
	radarG: any

	constructor(opts) {
		super(opts, 'profileRadarFacility2')
		this.radius = 200
		this.isRadarFacility = true
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

	/**
	 * Called by the base class's setControls() in place of the shared
	 * getProfileScores fetch AND the second facility-site fetch — both are
	 * covered by this single dedicated-route call. Sets `this.data` (aggregate)
	 * and `this.sampleData` (single-site) from one response.
	 */
	async fetchRadarFacility2Scores() {
		const response = await dofetch3('termdb/profileRadarFacility2Scores', {
			body: {
				genome: this.state.vocab.genome,
				dslabel: this.state.vocab.dslabel,
				scoreTerms: this.scoreTerms.map((t: any) => ({
					score: { term: { id: t.score.term.id }, q: t.score.q },
					maxScore: typeof t.maxScore === 'number' ? t.maxScore : { term: { id: t.maxScore.term.id }, q: t.maxScore.q }
				})),
				filter: this.filter,
				filterByUserSites: this.settings?.filterByUserSites,
				facilitySite: this.settings?.facilitySite || null
			}
		})
		if (response && 'error' in response) throw response.error
		this.sampleData = response.sampleData
		return response
	}

	plot() {
		const { radarG, rows, data, data2 } = this.createSvgAndGrid()
		this.drawLines(radarG, data, data2)
		this.drawPercentLabels(radarG)
		this.drawTableAndLegend(rows)
	}

	private createSvgAndGrid() {
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
		this.dom.tableDiv = rightDiv.append('div').attr('data-testid', 'sjpp-profileRadarFacility2-data-table')

		this.dom.svg
			.append('text')
			.attr('transform', `translate(90, 30)`)
			.attr('font-weight', 'bold')
			.text(`${this.config.title} (v2)`)
		const x = 300
		const y = 330
		const radarG = this.dom.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.radarG = radarG

		this.legendG = this.dom.svg
			.append('g')
			.attr('data-testid', 'sjpp-profileRadarFacility2-legend')
			.attr('font-size', '0.9em')
			.attr('transform', `translate(${x + 320},${y - 150})`)
		this.filterG = this.dom.svg.append('g').attr('transform', `translate(${x + 320},${y - 50})`)

		for (let i = 0; i <= 10; i++) this.drawPolygon(i * 10)

		const rows: any[] = []
		const data: number[][] = []
		const data2: number[][] = []
		const angle = this.angle!
		let i = 0
		for (const item of this.config.terms) {
			const iangle = i * angle - Math.PI / 2
			const percentage1 = this.getSamplePercentage(item) // facility
			const percentage2 = this.getPercentage(item) // aggregate

			this.radarG
				.append('path')
				.datum({ module: item.module, percentage1, percentage2 })
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

			this.addDataPoint(iangle, item, data2, percentage2, false)
			this.addDataPoint(iangle, item, data, percentage1, true)

			const color = item.score.term.color
			const diff = Math.abs(percentage1 - percentage2)
			const diffRow: any = { value: diff }
			if (diff >= 20) diffRow.color = percentage2 > percentage1 ? 'red' : 'blue'
			rows.push([
				{ color, disabled: true },
				{ value: item.module },
				{ value: percentage1 },
				{ value: percentage2 },
				diffRow
			])

			this.drawModuleLabel(item.module, iangle)
			i++
		}

		return { radarG, rows, data, data2 }
	}

	private drawLines(radarG: any, data: number[][], data2: number[][]) {
		data.push(data[0])
		data2.push(data2[0])
		const color1 = 'blue'
		const color2 = 'gray'
		// Facility (blue solid) — always drawn
		radarG
			.append('g')
			.append('path')
			.style('stroke', color1)
			.attr('fill', 'none')
			.attr('stroke-width', '2px')
			.attr('d', this.lineGenerator(data))
		// Global aggregate (gray dashed) — only for logged-in users
		if (this.state.logged) {
			radarG
				.append('g')
				.append('path')
				.style('stroke', color2)
				.attr('fill', 'none')
				.style('stroke-dasharray', '5, 5')
				.attr('d', this.lineGenerator(data2))
		}
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
		const columns = [
			{ label: 'Color' },
			{ label: 'Module' },
			{ label: 'Facility' },
			{ label: 'Global' },
			{
				label: 'Difference*',
				tooltip: `* Difference between site and aggregated scores. If bigger than 20 and positive shown in blue, if negative shown in red.`
			}
		]
		if (!this.isComparison) {
			renderTable({
				rows,
				columns,
				div: this.dom.tableDiv,
				showLines: true,
				resize: true
			})
		}
		this.addFilterLegend()

		this.legendG.append('text').attr('text-anchor', 'left').style('font-weight', 'bold').text('Legend')
		const site = this.sampleData.site
		this.addFacilityLegendItem(`${site.label} / ${site.value}`, 'blue', 0, 'none')
		this.addFacilityLegendItem(this.config.score, 'gray', 1, '5, 5')
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

	private addDataPoint(iangle: number, item: any, data: number[][], percentage: number, isFacility: boolean) {
		const iradius = (percentage / 100) * this.radius
		const x = iradius * Math.cos(iangle)
		const y = iradius * Math.sin(iangle)
		const color = isFacility ? 'blue' : '#aaa'
		this.radarG
			.append('g')
			.attr('transform', `translate(${x}, ${y})`)
			.append('circle')
			.attr('r', 4)
			.attr('fill', color)
			.datum({ module: item.module, percentage })
			.on('click', event => this.onMouseOver(event))
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

	private addFacilityLegendItem(text: string, color: string, index: number, strokeDash: string) {
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

	getSamplePercentage(d: any) {
		if (!d) return 0
		return this.sampleData?.term2Score?.[d.score.term.id] ?? 0
	}
}

export async function getPlotConfig(opts, app, _activeCohort) {
	try {
		const activeCohort = _activeCohort === undefined ? app.getState().activeCohort : _activeCohort
		const defaults = await getProfilePlotConfig(activeCohort, app, opts)
		if (!defaults) throw 'default config not found in termdbConfig.plotConfigByCohort.profileRadarFacility2'
		const config = copyMerge(structuredClone(defaults), opts)
		const settings = getDefaultProfilePlotSettings()
		config.settings = {
			profileRadarFacility2: settings,
			controls: { isOpen: false }
		}
		const twlst: any[] = []
		for (const row of config.terms) {
			row.score.q = row.maxScore.q = { mode: 'continuous' }
			twlst.push(row.score)
			twlst.push(row.maxScore)
		}
		await fillTwLst(twlst, app.vocabApi)
		return config
	} catch (e) {
		throw `${e} [profileRadarFacility2 getPlotConfig()]`
	}
}

export const profileRadarFacility2Init = getCompInit(ProfileRadarFacility2)
// this alias will allow abstracted dynamic imports
export const componentInit = profileRadarFacility2Init
