import { getCompInit, copyMerge } from '#rx'
import { fillTwLst } from '#termsetting'
import { scaleLinear as d3Linear } from 'd3-scale'
import { axisTop } from 'd3-axis'
import { dofetch3 } from '#common/dofetch'
import {
	profilePlot,
	getDefaultProfilePlotSettings,
	getProfilePlotConfig,
	FULL_COHORT,
	ABBREV_COHORT
} from './profilePlot.js'

/*
profileBarchart2 — redesigned bar chart that establishes the per-plot dedicated
route architecture for the bar chart (following profilePolar2's lead).

Key differences from profileBarchart:
  - Dedicated server route: termdb/profileBarchart2Scores.
  - Server-side facility term derivation: client does not send facilityTW.
  - Always aggregated: median percentage across eligible sites.
  - Minimal client payload: scoreTerms stripped to { term: { id }, q }.
  - Public role: sites is always [] in the response.
  - Cleaner rendering structure: plot() split into focused private methods.
*/

const stepx = 500
const barwidth = 400

class ProfileBarchart2 extends profilePlot {
	static type = 'profileBarchart2'
	additionalInputs: any[]
	componentNames!: { value: string; label: string }[]
	configProfileComponent: any
	rowCount: number = 0
	profileComponent!: string

	constructor(opts) {
		super(opts, 'profileBarchart2')
		this.additionalInputs = []
	}

	async init(appState) {
		await super.init(appState)
		const config = appState.plots.find(p => p.id === this.id)
		this.componentNames = config.plotByComponent.map(elem => ({
			value: elem.profileComponent.name,
			label: elem.profileComponent.name
		}))
		const profileComponentInput = {
			label: 'Component',
			type: 'dropdown',
			chartType: 'profileBarchart2',
			options: this.componentNames,
			settingsKey: 'profileComponent',
			callback: value => this.setProfileComponent(value)
		}
		this.additionalInputs.push(profileComponentInput)
	}

	setProfileComponent(value) {
		this.settings.profileComponent = value
		this.app.dispatch({ type: 'plot_edit', id: this.id, config: this.config })
	}

	async main() {
		try {
			await super.main()
			this.configProfileComponent =
				this.config.plotByComponent.find(comp => comp.profileComponent.name == this.settings.profileComponent) ||
				this.config.plotByComponent[0]
			this.rowCount = 0
			this.scoreTerms = []
			for (const group of this.configProfileComponent.groups)
				for (const row of group.rows) {
					this.rowCount++
					if (row.term1) this.scoreTerms.push(row.term1)
					if (row.term2) this.scoreTerms.push(row.term2)
				}
			await this.setControls(this.additionalInputs)
			this.profileComponent = this.settings.profileComponent || this.componentNames[0].value
			this.plot()
		} catch (e) {
			console.error(e)
			throw `${e} [profileBarchart2 main()]`
		}
	}

	/**
	 * Override setControls() to fetch data from the dedicated barchart2 route.
	 * The base class setControls() builds filter UI and sets this.filter but
	 * skips the data fetch for profileBarchart2 (see profilePlot.ts).
	 * This method calls termdb/profileBarchart2Scores, which derives the facility
	 * term server-side and returns aggregated (median) percentages.
	 */
	async setControls(additionalInputs: any[] = []) {
		await super.setControls(additionalInputs)
		this.data = await this.fetchAggregatedScores()
		if (this.data && 'error' in this.data) throw this.data.error
	}

	private async fetchAggregatedScores() {
		// No facilityTW — server derives it from term ID prefixes in the request.
		// scoreTerms stripped to { term: { id }, q } only — server fills the rest via termjsonByOneid.
		return dofetch3('termdb/profileBarchart2Scores', {
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

	onMouseOut(event) {
		if (event.target.tagName == 'rect' && event.target.getAttribute('fill-opacity') == 0.3) {
			event.target.setAttribute('fill-opacity', 0)
		}
	}

	onMouseOver(event) {
		if (event.target.tagName == 'rect' && event.target.getAttribute('fill-opacity') == 0) {
			event.target.setAttribute('fill-opacity', 0.3)
		}
	}

	plot() {
		const { hasSubjectiveData } = this.createSvg()
		this.drawTitleAndDefs(hasSubjectiveData)
		this.drawColumnHeaders(hasSubjectiveData)
		const yEnd = this.drawComponentRows(hasSubjectiveData)
		this.drawGuideLines(yEnd, hasSubjectiveData)
		this.drawLegend(yEnd, hasSubjectiveData)
	}

	private createSvg() {
		const hasSubjectiveData = this.configProfileComponent.hasSubjectiveData
		const width = this.state.activeCohort == ABBREV_COHORT ? 1000 : 1300
		const height = this.rowCount * 32 + 450
		this.dom.svg = this.dom.plotDiv.append('svg').attr('width', width).attr('height', height)
		return { width, height, hasSubjectiveData }
	}

	private drawTitleAndDefs(_hasSubjectiveData: boolean) {
		const title =
			this.state.activeCohort == ABBREV_COHORT
				? `Score-based Results for the ${this.profileComponent} Component by Module and Domain Compared with End-User Impression`
				: `Objective ${
						this.profileComponent == 'Patients and Outcomes' ? '' : 'and Subjective '
				  }Score-based Results for the ${this.profileComponent} Component by Module and Domain`
		this.dom.svg.append('text').attr('transform', `translate(50, 30)`).attr('font-weight', 'bold').text(title)

		const color = this.configProfileComponent.profileComponent.color
		this.dom.svg
			.append('defs')
			.append('pattern')
			.attr('id', `${this.id}_diagonalHatch`)
			.attr('patternUnits', 'userSpaceOnUse')
			.attr('width', 4)
			.attr('height', 4)
			.append('path')
			.attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
			.attr('stroke-width', 1)
			.attr('stroke', color)
	}

	private drawColumnHeaders(hasSubjectiveData: boolean) {
		const svg = this.dom.svg
		const config = this.config
		for (const [i, c] of config.columnNames.entries()) {
			if (i == 1 && !hasSubjectiveData) break
			const x = (i % 2 == 0 ? 400 : 900) + 10
			const y = 70
			svg
				.append('text')
				.attr('transform', `translate(${x}, ${y})`)
				.attr('text-anchor', 'start')
				.style('font-weight', 'bold')
				.text(c)
			this.drawAxis(x, y + 30)
		}
	}

	private drawAxis(x: number, y: number) {
		const xAxisScale = d3Linear().domain([0, 100]).range([0, barwidth])
		this.dom.svg.append('g').attr('transform', `translate(${x}, ${y})`).call(axisTop(xAxisScale))
	}

	private drawComponentRows(hasSubjectiveData: boolean): number {
		const svg = this.dom.svg
		const step = 30
		let y = 70
		for (const group of this.configProfileComponent.groups) {
			svg
				.append('text')
				.attr('transform', `translate(${50}, ${y + 40})`)
				.attr('text-anchor', 'start')
				.text(`${group.label}`)
				.style('font-weight', 'bold')

			y += step + 20
			for (const row of group.rows) {
				const g = svg.append('g')
				g.append('rect')
					.attr('transform', `translate(${20}, ${y - 6})`)
					.attr('x', 0)
					.attr('y', 0)
					.attr('width', hasSubjectiveData ? 1500 : 850)
					.attr('height', 30)
					.attr('fill', '#f8d335')
					.attr('fill-opacity', 0)
				const x = 400
				if (row.term1) this.drawRect(x, y, row, 'term1', g)
				if (row.term2) this.drawRect(x + stepx, y, row, 'term2', g)
				y += step
			}
		}
		return y
	}

	private drawRect(x: number, y: number, row: any, field: 'term1' | 'term2', g: any) {
		const hasSubjectiveData = this.configProfileComponent.hasSubjectiveData
		const d = row[field]
		let subjectiveTerm = false
		if ((row.name == 'Total Module' || row.name == 'End-user Impression*') && !row.term2) subjectiveTerm = true
		const termColor = d.score.term.color
		const value = this.getPercentage(d)
		const isFirst = field == 'term1' || (field == 'term2' && !row.term1)
		const pairValue = field == 'term1' ? this.getPercentage(row.term2) : this.getPercentage(row.term1)
		const width = value ? (value / 100) * barwidth : 0
		if (value) {
			const isObjective =
				this.state.activeCohort == FULL_COHORT && this.settings.profileComponent == 'Patients and Outcomes'
					? true
					: !subjectiveTerm && (pairValue || !hasSubjectiveData)
			const rect = g
				.append('rect')
				.attr('transform', `translate(${x + 10}, ${y})`)
				.attr('pointer-events', 'none')
				.attr('x', 0)
				.attr('y', 0)
				.attr('width', width)
				.attr('height', 20)
			if (isObjective) rect.attr('fill', termColor)
			else {
				const termid = this.id + d.score.term.id
				g.append('defs')
					.append('pattern')
					.attr('id', termid)
					.attr('patternUnits', 'userSpaceOnUse')
					.attr('width', 4)
					.attr('height', 4)
					.append('path')
					.attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
					.attr('stroke-width', 1)
					.attr('stroke', termColor)
				rect.attr('fill', `url(#${termid})`)
			}
		}
		const text = g
			.append('text')
			.attr('pointer-events', 'none')
			.attr('text-anchor', 'end')
			.text(`${value || 0}%`)
		if (width > 0) text.attr('transform', `translate(${x + width + 55}, ${y + 15})`)
		else if (!pairValue && field == 'term1') text.attr('transform', `translate(${x + 35}, ${y + 15})`)

		if (isFirst)
			g.append('text')
				.attr('transform', `translate(${field == 'term1' ? x : x - stepx}, ${y + 15})`)
				.attr('text-anchor', 'end')
				.text(row.name)
				.attr('pointer-events', 'none')
	}

	private drawGuideLines(yEnd: number, hasSubjectiveData: boolean) {
		this.drawGuide(410, 120, 50, yEnd, 'B')
		this.drawGuide(410, 120, 75, yEnd, 'A')
		if (!hasSubjectiveData) return
		this.drawGuide(910, 120, 50, yEnd, 'B')
		this.drawGuide(910, 120, 75, yEnd, 'A')
	}

	private drawGuide(x: number, y: number, percent: number, y2: number, text: string) {
		const svg = this.dom.svg
		const x1 = x + (percent / 100) * barwidth
		svg
			.append('line')
			.style('stroke', '#aaa')
			.style('stroke-width', 1)
			.style('stroke-dasharray', '5, 5')
			.attr('x1', x1)
			.attr('y1', y)
			.attr('x2', x1)
			.attr('y2', y2)
		svg
			.append('text')
			.attr('transform', `translate(${x1 + 0.125 * barwidth}, ${y2 + 20})`)
			.attr('text-anchor', 'middle')
			.text(text)
			.style('font-weight', 'bold')
		if (percent == 50)
			svg
				.append('text')
				.attr('transform', `translate(${x1 - 0.25 * barwidth}, ${y2 + 20})`)
				.attr('text-anchor', 'middle')
				.text('C')
				.style('font-weight', 'bold')
	}

	private drawLegend(yEnd: number, hasSubjectiveData: boolean) {
		this.legendG = this.dom.svg
			.append('g')
			.attr('data-testid', 'sjpp-profileBarchart2-legend')
			.attr('transform', `translate(400,${yEnd + 90})`)
		this.filterG = this.dom.svg.append('g').attr('transform', `translate(0,${yEnd + 90})`)

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
			if (this.state.activeCohort == ABBREV_COHORT) {
				this.addEndUserImpressionNote(this.legendG.append('g'))
			} else this.addPOCNote(this.legendG.append('g'))
		}
		this.addFilterLegend()

		if (!hasSubjectiveData) return

		const color = this.configProfileComponent.profileComponent.color
		const svg = this.dom.svg
		const y = yEnd + 40
		let x = 600
		const lineG = svg.append('g')
		this.drawLegendRect(x, y, 'and', color, lineG)
		x += 300
		this.drawLegendRect(x, y, 'or', color, lineG)
	}

	drawLegendRect(x: number, y: number, operator: 'and' | 'or', color: string, lineG: any) {
		const rect = lineG
			.append('g')
			.attr('transform', `translate(${x}, ${y})`)
			.append('rect')
			.attr('x', 0)
			.attr('y', 0)
			.attr('width', 20)
			.attr('height', 20)
		if (operator == 'and') rect.attr('fill', color)
		else rect.attr('fill', `url(#${this.id}_diagonalHatch)`)

		const text = this.dom.svg
			.append('text')
			.attr('transform', `translate(${x + 25}, ${y + 15})`)
			.attr('text-anchor', 'start')
			.text('Objective ')
		text.append('tspan').attr('font-weight', 'bold').text(operator)
		text.append('tspan').text(' Subjective data')
	}
}

export async function getPlotConfig(opts, app, _activeCohort) {
	try {
		const activeCohort = _activeCohort === undefined ? app.getState().activeCohort : _activeCohort
		const defaults = await getProfilePlotConfig(activeCohort, app, opts)
		if (!defaults) throw 'default config not found in termdbConfig.plotConfigByCohort.profileBarchart2'
		defaults.settings = { profileBarchart2: getDefaultProfilePlotSettings() }
		let config = structuredClone(defaults)
		config = copyMerge(config, opts)
		config.settings.controls = { isOpen: false }
		const twlst: any[] = []
		for (const profileComponent of config.plotByComponent) {
			profileComponent.hasSubjectiveData = false
			for (const group of profileComponent.groups)
				for (const row of group.rows) {
					if (row.term1) {
						row.term1.score.q = row.term1.maxScore.q = { mode: 'continuous' }
						twlst.push(row.term1.score)
						twlst.push(row.term1.maxScore)
					}
					if (row.term2) {
						row.term2.score.q = row.term2.maxScore.q = { mode: 'continuous' }
						twlst.push(row.term2.score)
						twlst.push(row.term2.maxScore)
					}
					if (row.term1 && row.term2) profileComponent.hasSubjectiveData = true
				}
		}
		await fillTwLst(twlst, app.vocabApi)

		return config
	} catch (e) {
		throw `${e} [profileBarchart2 getPlotConfig()]`
	}
}

export const profileBarchart2Init = getCompInit(ProfileBarchart2)
// this alias will allow abstracted dynamic imports
export const componentInit = profileBarchart2Init

export function getDefaultProfileBarchart2Settings() {
	return {}
}
