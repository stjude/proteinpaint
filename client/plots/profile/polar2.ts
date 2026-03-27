import type { MassAppApi, MassState } from '#mass/types/mass'
import type { SvgG } from '../../types/d3'
import type { ProfilePolarConfig, ProfilePolarDom } from './types/PolarTypes'
import type { TableCell } from '#dom'
import { getCompInit, copyMerge } from '#rx'
import { fillTwLst } from '#termsetting'
import * as d3 from 'd3'
import { profilePlot, getDefaultProfilePlotSettings, getProfilePlotConfig } from './profilePlot.js'
import { renderTable } from '#dom'

/** TODO: profilePlot must extend RxComponent but file not tsc.
 * Work arounds until profilePlot is migrated to ts.
 */
class ProfilePolar2 extends profilePlot {
	static type = 'profilePolar2'
	readonly radius = 250
	readonly arcGenerator = d3.arc().innerRadius(0)
	angle!: number
	polarG!: SvgG
	declare legendG: SvgG
	declare filterG: SvgG
	declare dom: ProfilePolarDom

	constructor(opts) {
		super(opts, 'profilePolar2')
	}

	async init(appState: MassState) {
		await super.init(appState)
		const config = appState.plots.find(p => p.id === this.id) as ProfilePolarConfig
		this.scoreTerms = config.terms
		this.angle = (Math.PI * 2) / config.terms.length
	}

	async main() {
		await super.main()
		await this.setControls()
		this.plot()
	}

	/**
	 * Override setControls() to fetch data from the dedicated polar2 route.
	 * The base class setControls() builds filter UI and sets this.filter but
	 * skips the data fetch for profilePolar2 (see profilePlot.ts).
	 * This method calls termdb/profilePolar2Scores, which derives the facility
	 * term server-side from the request data and returns aggregated (median)
	 * percentages across all eligible sites.
	 */
	async setControls(additionalInputs: any[] = []) {
		await super.setControls(additionalInputs)
		this.data = await this.fetchAggregatedScores()
	}

	private async fetchAggregatedScores() {
		// Pass scoreTerms as-is — getProfilePolar2Scores calls mayStripTwProps on each tw,
		// which strips unneeded client-only properties and reduces term to { id } only.
		// No facilityTW — the server derives it from term ID prefixes in the request.
		return this.app.vocabApi.getProfilePolar2Scores({
			scoreTerms: this.scoreTerms,
			filterByUserSites: this.settings?.filterByUserSites,
			filter: this.filter
		})
	}

	onMouseOut(event: MouseEvent) {
		const target = event.target as HTMLElement
		if (target.tagName === 'path') {
			target.setAttribute('stroke', 'white')
			if (target.getAttribute('stroke-opacity') === '0') {
				target.setAttribute('stroke-opacity', '1')
			}
		}
		this.tip.hide()
	}

	onMouseOver(event: MouseEvent) {
		const target = event.target as HTMLElement
		if (target.tagName === 'path') {
			target.setAttribute('stroke-opacity', '0')
			const d = (target as any).__data__
			const menu = this.tip.clear()
			const percentage = this.getPercentage(d)
			menu.d.text(`${d.module} ${percentage}%`)
			menu.show(event.clientX, event.clientY, true, true)
		} else {
			this.onMouseOut(event)
		}
	}

	plot() {
		this.createSvg()
		const rows = this.drawArcs()
		this.drawGrid()
		this.drawTable(rows)
		this.drawLegend()
	}

	private createSvg() {
		const width = this.isComparison ? 800 : 1000,
			height = 600
		this.dom.svg = this.dom.plotDiv
			.append('div')
			.style('display', 'inline-block')
			.append('svg')
			.attr('width', width)
			.attr('height', height) as any

		this.dom.tableDiv = this.dom.plotDiv
			.append('div')
			.attr('data-testid', 'sjpp-profilePolar2-data-table')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin', '45px 20px') as any

		this.dom.svg
			.append('text')
			.attr('transform', `translate(130, 40)`)
			.attr('font-weight', 'bold')
			.text(this.config.title)

		const x = 280,
			y = 330
		this.polarG = this.dom.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.legendG = this.dom.svg
			.append('g')
			.attr('data-testid', 'sjpp-profilePolar2-legend')
			.attr('transform', `translate(${x + 280}, ${y - 200})`)
		this.filterG = this.dom.svg.append('g').attr('transform', `translate(${x + 280},${y})`)
	}

	private drawGrid() {
		// Background concentric circles at every 10%
		for (let i = 0; i <= 10; i++) this.drawGridCircle(i * 10)

		// Grade boundary circles with grade labels
		this.drawGradeCircle(50, 'C')
		this.drawGradeCircle(75, 'B')
		this.drawGradeCircle(100, 'A')

		// Percentage labels along the left axis
		for (let i = 0; i <= 10; i++) {
			const percent = i * 10
			this.polarG
				.append('text')
				.attr('transform', `translate(-10, ${(-percent / 100) * this.radius + 5})`)
				.attr('text-anchor', 'end')
				.style('font-size', '0.8rem')
				.text(`${percent}%`)
				.attr('pointer-events', 'none')
		}
	}

	private drawGridCircle(percent: number) {
		const circle = this.polarG
			.append('circle')
			.attr('r', (percent / 100) * this.radius)
			.style('fill', 'none')
			.style('opacity', '0.5')
		if (percent != 50) circle.style('stroke', '#aaa')
	}

	private drawGradeCircle(percent: number, label: string) {
		const circle = this.polarG
			.append('circle')
			.attr('r', (percent / 100) * this.radius)
			.style('fill', 'none')
			.style('opacity', '0.5')

		if (percent != 100) circle.style('stroke-dasharray', '5, 5').style('stroke-width', '2').style('stroke', 'black')

		this.polarG
			.append('text')
			.attr('transform', `translate(15, ${-(percent / 100 - 0.125) * this.radius + 10})`)
			.attr('text-anchor', 'middle')
			.text(label)
			.style('font-weight', 'bold')
			.style('font-size', '24px')
			.attr('pointer-events', 'none')
	}

	/** Draws the arc slices and returns table rows for drawTable(). */
	private drawArcs(): TableCell[][] {
		const rows: TableCell[][] = []
		let i = 0
		for (const d of this.config.terms) {
			d.i = i
			const color = d.score.term.color
			const percentage = this.getPercentage(d)
			rows.push([{ color, disabled: true }, { value: d.module }, { value: percentage }])
			this.polarG
				.append('g')
				.append('path')
				.datum(d)
				.attr('fill', color)
				.attr('stroke', 'white')
				.attr(
					'd',
					this.arcGenerator({
						outerRadius: (percentage! / 100) * this.radius,
						startAngle: i * this.angle,
						endAngle: (i + 1) * this.angle
					} as any)
				)
				.on('click', event => this.onMouseOver(event))
			i++
		}
		return rows
	}

	private drawTable(rows: TableCell[][]) {
		const columns = [{ label: 'Color' }, { label: 'Module' }, { label: 'Score', align: 'center' }]
		this.dom.tableDiv.selectAll('*').remove()
		if (!this.isComparison)
			renderTable({
				rows,
				columns,
				div: this.dom.tableDiv,
				showLines: true,
				resize: true,
				maxHeight: '50vh'
			})
	}

	private drawLegend() {
		if (!this.isComparison) {
			this.legendG
				.append('text')
				.attr('text-anchor', 'left')
				.style('font-weight', 'bold')
				.text('Overall Score')
				.attr('transform', `translate(0, -5)`)
			this.addLegendItem('A', 'More than 75% of possible scorable items', 1)
			this.addLegendItem('B', '50-75% of possible scorable items', 2)
			this.addLegendItem('C', 'Less than 50% of possible scorable items', 3)
		}
		this.addFilterLegend()
	}
}

export async function getPlotConfig(opts: any, app: MassAppApi, _activeCohort: number) {
	try {
		const activeCohort = _activeCohort === undefined ? app.getState().activeCohort : _activeCohort
		const defaults = await getProfilePlotConfig(activeCohort, app, opts)
		if (!defaults) throw 'default config not found in termdbConfig.plotConfigByCohort.profilePolar2'
		const settings = getDefaultProfilePlotSettings()
		defaults.settings = { profilePolar2: settings }

		const config = copyMerge(structuredClone(defaults), opts)
		config.settings.controls = { isOpen: false }
		const twlst: any[] = []
		for (const data of config.terms) {
			data.score.q = { mode: 'continuous' }
			data.maxScore.q = { mode: 'continuous' }
			twlst.push(data.score, data.maxScore)
		}
		await fillTwLst(twlst, app.vocabApi)

		return config
	} catch (e) {
		throw new Error(`${e} [profilePolar2 getPlotConfig()]`)
	}
}

export const profilePolar2Init = getCompInit(ProfilePolar2)
export const componentInit = profilePolar2Init
