import { getCompInit, copyMerge } from '../../rx/index.js'
import { getProfilePlotConfig, profilePlot, getDefaultProfilePlotSettings } from './profilePlot.js'
import { fillTermWrapper, fillTwLst } from '#termsetting'
import { axisBottom, axisTop } from 'd3-axis'
import { scaleLinear as d3Linear } from 'd3-scale'
import { select } from 'd3-selection'
import type { Selection } from 'd3-selection'
import 'd3-transition'
import { Tabs } from '../../dom/toggleButtons.js'
import { roundValueAuto } from '#shared'
import { dofetch3 } from '#common/dofetch'
import { renderImpressionThermometer, IMPRESSION_MAX_SCORE, POC_FILL } from './renderImpressionThermometer.js'
import { renderResponseDistribution } from './renderResponseDistribution.js'
import { renderImpressionLegend } from './renderImpressionLegend.js'

const YES_NO_TAB = 'Yes/No Barchart'
const LIKERT_TAB = 'Likert Scale'

// Used to detect when the user clicked an "Impression" domain term in the tree
// (parent term ID ends with '__Impression'). Such domains don't have multivalue
// children — they wrap a SC integer term and a POC float term — so the standard
// tabs flow is skipped and a dedicated thermometer is rendered instead.
const IMPRESSION_SUFFIX = '__Impression'

export class profileForms extends profilePlot {
	static type = 'profileForms' as const
	id: any
	svg: any
	components: any
	dom: any
	xAxisScale: any
	shift: any
	twLst: any
	filterG: any
	activePlot: any
	scScoreTerms: any
	tabs: any
	shiftTop: any
	categories: any
	module: any
	legendG: any
	//for each plot tab, a dict of sc term wrappers
	id2SCTW: { [key: string]: { [key: string]: any } }

	// Impression-domain mode (set in init() when config.tw.term.id ends with '__Impression')
	isImpressionDomain!: boolean
	scTW: any
	pocTW: any
	// Responder-level multivalue impression term ids under this __Impression domain
	// (POCFimpression_mod*). When present, the route builds the POC distribution per
	// responder from these instead of the per-site pocTW float.
	pocResponderTermIds: string[] = []
	// Per-module color sourced from the DB: terms.jsondata.color on the SC and POC children.
	// Within a module SC and POC share the same color in the DB; we capture both for safety.
	impressionScColor?: string
	impressionPocColor?: string

	constructor(opts) {
		super(opts, 'profileForms')
		this.opts = opts
		this.id2SCTW = {}
	}

	async init(appState) {
		super.init(appState)
		const config = structuredClone(appState.plots.find(p => p.id === this.id))
		const parentId: string = config.tw?.term?.id || ''
		this.isImpressionDomain = parentId.endsWith(IMPRESSION_SUFFIX)
		const settings = config.settings.profileForms
		this.tabs = []
		this.twLst = []
		if (this.isImpressionDomain) {
			// Children of an "__Impression" domain are scalar (integer SC + float POC),
			// not multivalue. Resolve them via getTermChildren — but note the server
			// joins on subcohort_terms with a cohort string, so we MUST pass the active
			// cohort or no children come back. Mirrors the lookup tree.js does
			// (state.cohortValuelst = termdbConfig.selectCohort.values[activeCohort].keys).
			const cohortValuelst = appState.termdbConfig?.selectCohort
				? appState.termdbConfig.selectCohort.values[appState.activeCohort]?.keys
				: null
			const childData = await this.vocabApi!.getTermChildren({ id: parentId }, cohortValuelst)
			const children: any[] = childData?.lst || []
			const scChild = children.find(t => t.type === 'integer') || children[0]
			// pocChild may be absent — Patients & Outcomes is SC-only by design.
			const pocChild = children.find(t => t.type === 'float')
			// Responder-level impression terms (one or more per domain). Selected by type
			// rather than id pattern, so the upstream POCFmpression_mod8 typo is tolerated.
			this.pocResponderTermIds = children.filter(t => t.type === 'multivalue').map(t => t.id)
			if (!scChild) {
				console.error('profileForms impression-domain SC child not found:', { parentId, cohortValuelst, childData })
			}
			if (scChild) {
				this.scTW = { id: scChild.id, q: { mode: 'continuous' } }
				await fillTermWrapper(this.scTW, this.app.vocabApi)
				// Per-module color: every term under a module (SC/POC/responder) carries the same
				// module color in the DB. Read it off the filled tw, same as polar2/radar2/barchart2.
				this.impressionScColor = this.scTW.term.color
			}
			if (pocChild) {
				this.pocTW = { id: pocChild.id, q: { mode: 'continuous' } }
				await fillTermWrapper(this.pocTW, this.app.vocabApi)
				this.impressionPocColor = this.pocTW.term.color
			}
		} else {
			this.twLst = await this.vocabApi!.getMultivalueTWs({ parent_id: parentId })
			for (const plot of config.options) {
				const tws = this.twLst.filter(tw => tw.term.subtype == plot.subtype)
				if (!tws.length) continue //no terms for this plot
				const tab: any = {
					label: plot.name,
					callback: () => {
						this.app.dispatch({ type: 'plot_edit', id: this.id, config: { activeTab: plot.name } })
					},
					active: false
				}
				if (plot.name == config.activeTab) tab.active = true
				if (plot.hasSC) {
					this.id2SCTW[plot.name] = {}
					for (const tw of this.twLst) {
						if (tw.term.subtype != plot.subtype) continue
						const scTermId = tw.term.id.replace(/^POC/, '')
						const scTW: any = { id: scTermId }
						await fillTermWrapper(scTW, this.app.vocabApi)
						this.id2SCTW[plot.name][scTermId] = scTW
					}
					this.twLst.push(...Object.values(this.id2SCTW[plot.name]))
				}
				this.tabs.push(tab)
			}
		}
		const rightDiv = this.dom.rightDiv
		const topDiv = rightDiv.append('div')
		const domainDiv = topDiv.append('div').style('padding-bottom', '10px').style('font-weight', 'bold')

		const headerDiv = rightDiv.append('div').style('padding-bottom', '10px')
		if (!this.isImpressionDomain && this.tabs.length > 1)
			await new Tabs({
				holder: topDiv,
				tabsPosition: 'horizontal',
				tabs: this.tabs
			}).main()

		const shift = 690
		const shiftTop = 50
		const width = settings.svgw + shift + 500
		const svg = rightDiv.style('padding', '20px').append('svg').attr('width', width)
		svg
			.append('defs')
			.append('pattern')
			.attr('id', `${this.id}_diagonalHatch`)
			.attr('patternUnits', 'userSpaceOnUse')
			.attr('width', 4)
			.attr('height', 4)
			.append('path')
			.attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
			.attr('stroke-width', 1)
			.attr('stroke', 'gray')
		this.shiftTop = shiftTop
		this.shift = shift
		const mainG = svg.append('g').attr('transform', `translate(${shift}, ${shiftTop})`)
		const gridG = svg.append('g').attr('transform', `translate(${shift}, ${shiftTop})`)
		this.filterG = svg.append('g').attr('transform', `translate(${shift + settings.svgw + 60}, ${shiftTop + 40})`)
		this.legendG = svg.append('g') //each plot will translate it to the right position

		const xAxisG = svg.append('g').attr('transform', `translate(${shift}, ${shiftTop / 2})`)

		// Impression-domain charts (thermometer + response distribution) render into their own
		// per-group svgs inside this div, not the Likert/YesNo svg scaffolding above. Kept inside
		// rightDiv so the mousemove/mouseout tooltip delegation (profilePlot) covers them.
		const impressionDiv = rightDiv.append('div')
		if (this.isImpressionDomain) svg.style('display', 'none')

		this.dom = copyMerge(this.dom, {
			svg,
			headerDiv,
			mainG,
			gridG,
			legendG: this.legendG,
			xAxisG,
			domainDiv,
			impressionDiv
		})
	}

	async main() {
		this.dom.loadingDiv.style('display', '')
		try {
			await super.main()
			const parents = this.config.tw.term.id.split('__')
			this.module = parents[1]
			const domain = parents.slice(1).join(' / ')
			/*
			The impression view's own title already names the module, so this breadcrumb would repeat
			it directly above. Set display in both directions — the same instance switches modes.
			*/
			this.dom.domainDiv.style('display', this.isImpressionDomain ? 'none' : '').text(domain)
			this.dom.mainG.selectAll('*').remove()
			this.dom.gridG.selectAll('*').remove()
			this.dom.xAxisG.selectAll('*').remove()
			this.dom.legendG.selectAll('*').remove()

			if (this.isImpressionDomain) {
				await this.setControls()
				this.data = await this.fetchImpressionDistribution()
				if (this.data && 'error' in this.data) throw this.data.error
				this.renderImpression()
				return
			}

			if (this.tabs.length == 0) return // no plots to show
			const activeTab = this.state.config.activeTab || this.tabs[0].label
			this.activePlot = this.state.config.options.find(p => p.name == activeTab)
			this.scoreTerms = this.twLst.filter(tw => tw.term.subtype == this.activePlot.subtype)
			if (this.activePlot.hasSC) {
				this.scScoreTerms = Object.values(this.id2SCTW[this.activePlot.name])
			}
			this.categories = new Set()
			await this.setControls()
			this.renderPlot()
			this.filterG.selectAll('*').remove()
			this.addFilterLegend()
		} finally {
			this.dom.loadingDiv.style('display', 'none')
		}
	}

	async setControls(additionalInputs: any[] = []) {
		if (!this.isImpressionDomain) return super.setControls(additionalInputs)
		// In impression-domain mode scoreTerms/scScoreTerms are not initialized, so the
		// base setControls() profileForms branch (getProfileFormScores) must not fire.
		// Temporarily shadow this.type so the base treats this call like a non-forms type,
		// which still builds filteredTermValues, this.filter, and the controls UI.
		const savedType = (this as any).type
		;(this as any).type = '__impressionDomain'
		try {
			await super.setControls(additionalInputs)
		} finally {
			;(this as any).type = savedType
		}
	}

	renderPlot() {
		try {
			this.dom.headerDiv.style('display', 'none')

			switch (this.activePlot.name) {
				case LIKERT_TAB:
					this.renderLikert()
					break
				case YES_NO_TAB:
					this.renderYesNo()
			}
		} catch (e) {
			console.error('Error rendering profile forms plot:', e) //prints stack trace
			throw e
		}
	}

	private async fetchImpressionDistribution() {
		if (!this.scTW) return { error: 'missing SC term for impression domain' }
		// pocTermId is omitted when this.pocTW is undefined (SC-only modules e.g. Patients & Outcomes).
		const body: any = {
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			scTermId: this.scTW.term.id,
			maxScore: IMPRESSION_MAX_SCORE,
			filter: this.filter,
			filterByUserSites: this.settings?.filterByUserSites
		}
		if (this.pocTW) body.pocTermId = this.pocTW.term.id
		if (this.pocResponderTermIds.length) body.pocResponderTermIds = this.pocResponderTermIds
		return dofetch3('termdb/profileImpressionDistribution', { body })
	}

	/*
	Impression-domain view: for each POC responder group render a thermometer (shared SC median +
	that group's POC median, with performance zones) beside a response-distribution combo chart
	(SC line on the left axis, grey POC columns on the right axis). Groups stack vertically. A
	module with no POC responders (e.g. Patients & Outcomes) renders a single SC-only thermometer.
	*/
	private renderImpression() {
		const holder = this.dom.impressionDiv
		holder.selectAll('*').remove()
		const texts = this.config.impression
		// The whole view is driven off this config block (zones, titles, legend, axis labels), so a
		// dataset missing it fails here with a named cause rather than downstream on a member access.
		if (!texts) throw `Missing impression config for the plot ${this.type} in this dataset`
		const scColor = this.impressionScColor || '#888'
		const data = this.data

		// Resolve each performance-zone color from this module's colorMap gradient (config gives the
		// shade key, not a literal color): Weak=SOMETIMES (lightest) … Strong=ALMOST ALWAYS (darkest).
		// Falls back to the base module color if a shade is absent for the module.
		const moduleShades = this.state.termdbConfig?.colorMap?.[this.module] || {}
		const zones = texts.zones.map((z: any) => ({
			label: z.label,
			min: z.min,
			max: z.max,
			color: moduleShades[z.shade] || scColor
		}))

		// Bind tooltip text + optional hover descriptor as the element's datum. The shared
		// profilePlot mousemove→onMouseOver delegation reads __data__ (same pattern as polar2/radar2).
		const attachTip = (sel: any, text: string, hover?: any) => {
			sel.datum({ tip: text, ...(hover || {}) }).style('cursor', 'pointer')
		}

		const responders: any[] = Array.isArray(data.responders) ? data.responders : []
		const groups = responders.length
			? responders.map(r => ({
					groupLabel: r.label,
					poc: { median: r.median, total: r.total },
					pocDistribution: r.distribution
			  }))
			: [{ groupLabel: null, poc: null, pocDistribution: [] }]

		groups.forEach((g, i) => {
			/*
			One self-contained block per responder group: the module title, the Site-Coordinator-vs-group
			comparison line, and the applied-filters + n line, above a single bordered box holding the two
			charts. Tagged so getChartImages() can collect this block's svgs for download and name them.
			*/
			const block = holder
				.append('div')
				.attr('class', 'sjpp-impression-card')
				.attr('data-testid', 'sjpp-profileForms-impression-card')
				.attr('data-group-label', g.groupLabel || texts.legend.sc)
				.style('width', 'fit-content')
				.style('max-width', '100%')
				.style('margin', '18px auto')

			// Centered title block: module title, the SC-vs-group comparison (POC groups only), and the
			// applied-filters + n line. addFilterLegend() draws into this.filterG partly above y=0, so the
			// group is shifted to start at (pad, pad) and the svg sized to fit it.
			const header = block.append('div').style('text-align', 'center')
			header
				.append('div')
				.attr('data-testid', 'sjpp-profileForms-impression-title')
				.style('font-size', '1.25rem')
				.style('font-weight', 'bold')
				.style('padding', '4px 0')
				.text(texts.titleTemplate.replace('{module}', this.module))
			if (g.poc)
				header
					.append('div')
					.attr('data-testid', 'sjpp-profileForms-impression-comparison')
					.style('font-size', '1.05rem')
					.style('font-weight', 'bold')
					.text(texts.comparisonTitle.replace('{group}', g.groupLabel))
			const filterSvg = header.append('div').style('padding', '2px 0').append('svg')
			this.filtersCount = 0
			this.filterG = filterSvg.append('g')
			this.addFilterLegend()
			const ffb = filterSvg.node().getBBox()
			const fpad = 3
			this.filterG.attr('transform', `translate(${-ffb.x + fpad}, ${-ffb.y + fpad})`)
			filterSvg.attr('width', Math.ceil(ffb.width + 2 * fpad)).attr('height', Math.ceil(ffb.height + 2 * fpad))

			// The bordered box: the two chart panels side by side with a vertical divider between them.
			const box = block
				.append('div')
				.style('border', '1px solid #bbb')
				.style('border-radius', '8px')
				.style('background', '#fff')
				.style('margin-top', '6px')
			// align-items:stretch makes both panels the tallest panel's height, so the legends (pinned to
			// the bottom of each) line up on the same row.
			const body = box
				.append('div')
				.style('display', 'flex')
				.style('flex-wrap', 'wrap')
				.style('align-items', 'stretch')
				.style('justify-content', 'center')

			// A panel holds a title, the chart svg (vertically centered in the stretched height), and the
			// chart's own two-row legend at the bottom. `divider` draws the vertical line to the next
			// panel as a right border on this one.
			const chartPanel = (title: string, divider: boolean, testid: string) => {
				const panel = body
					.append('div')
					.attr('data-testid', testid)
					.style('padding', '12px 18px')
					.style('display', 'flex')
					.style('flex-direction', 'column')
					.style('align-items', 'center')
				if (divider) panel.style('border-right', '1px solid #ddd')
				panel
					.append('div')
					.style('text-align', 'center')
					.style('font-weight', 'bold')
					.style('font-size', '1rem')
					.style('padding-bottom', '4px')
					.text(title)
				// Grow to fill the panel height and center the chart in it; the caller appends the legend
				// after this, so it settles at the bottom — level with the other panel's legend.
				const chartWrap = panel
					.append('div')
					.style('flex', '1 1 auto')
					.style('display', 'flex')
					.style('align-items', 'center')
				return { panel, chartHolder: chartWrap.append('div') }
			}

			// Thermometer panel (left); a divider follows it only when a distribution panel does.
			const thermo = chartPanel(texts.chartTitles.thermometer, !!g.poc, 'sjpp-profileForms-thermometer-panel')
			renderImpressionThermometer({
				holder: thermo.chartHolder,
				id: `${this.id}-g${i}`,
				sc: { median: data.scMedian, total: data.scTotal },
				poc: g.poc,
				ratingAxisLabel: texts.ratingAxisLabel,
				zones,
				colors: { sc: scColor },
				attachTip
			})
			renderImpressionLegend({
				holder: thermo.panel.append('div'),
				series: [
					{ color: scColor, label: texts.legend.sc, symbol: 'circle' as const },
					...(g.poc ? [{ color: POC_FILL, label: texts.legend.poc, symbol: 'circle' as const }] : [])
				],
				zones
			})

			if (g.poc) {
				const dist = chartPanel(texts.chartTitles.distribution, false, 'sjpp-profileForms-distribution-panel')
				renderResponseDistribution({
					holder: dist.chartHolder,
					id: `${this.id}-dist-g${i}`,
					maxScore: IMPRESSION_MAX_SCORE,
					scDistribution: data.scDistribution || [],
					pocDistribution: g.pocDistribution,
					texts: texts.distribution,
					zones,
					colors: { sc: scColor },
					attachTip
				})
				renderImpressionLegend({
					holder: dist.panel.append('div'),
					series: [
						{ color: scColor, label: texts.legend.sc, symbol: 'line' as const },
						{ color: POC_FILL, label: texts.legend.poc, symbol: 'square' as const }
					],
					zones
				})
			}
		})
	}

	/*
	The impression view renders each card's charts as separate <svg> elements under impressionDiv and
	hides the main this.dom.svg, so the base getChartImages() — which only collects this.dom.svg —
	would hand the download menu one empty, hidden svg (nothing downloads). Collect the card svgs
	instead, keyed by the group label so a multi-card module downloads sensibly. The Likert/YesNo
	path still draws into this.dom.svg, so it keeps the base behavior.
	*/
	getChartImages() {
		if (!this.isImpressionDomain) return super.getChartImages()
		const note = '© 2025 St. Jude Children’s Research Hospital'
		const charts: { name: string; svg: Selection<SVGSVGElement, unknown, null, undefined> }[] = []
		this.dom.impressionDiv.selectAll('.sjpp-impression-card').each(function (this: HTMLElement) {
			const card = select(this)
			const label = card.attr('data-group-label') || ''
			card.selectAll<SVGSVGElement, unknown>('svg').each(function (this: SVGSVGElement) {
				charts.push({ name: `${label} ${note}`.trim(), svg: select(this) })
			})
		})
		return charts
	}

	renderLikert() {
		this.dom.headerDiv.style('display', 'block')
		this.dom.headerDiv.selectAll('*').remove()
		let y = 0
		const step = 30
		const height = (this.scoreTerms.length + 2) * step
		this.dom.svg.attr('height', height + 120)
		this.categories = new Set<string>()

		// First pass: render labels to measure max width
		const labelPadding = 80
		const tempG = this.dom.svg.append('g').style('visibility', 'hidden')
		let maxLabelWidth = 0
		for (const tw of this.scoreTerms) {
			if (tw.term.type != 'multivalue') continue
			const text = getText(tw.term.details || tw.term.name)
			const tempText = tempG.append('text').style('font-size', '0.85em').text(text)
			const w = (tempText.node() as SVGTextElement).getBBox().width
			if (w > maxLabelWidth) maxLabelWidth = w
		}
		tempG.remove()
		const shift = maxLabelWidth + labelPadding
		this.dom.mainG.attr('transform', `translate(${shift}, ${this.shiftTop})`)
		this.dom.gridG.attr('transform', `translate(${shift}, ${this.shiftTop})`)
		this.filterG.attr('transform', `translate(${shift + this.settings.svgw + 60}, ${this.shiftTop + 40})`)
		this.dom.svg.attr('width', shift + this.settings.svgw + 500)
		this.shift = shift

		for (const tw of this.scoreTerms) {
			if (tw.term.type != 'multivalue') continue
			const dict = this.getPercentageDict(tw) //get the dict with the counts for each category  for the list of samples
			this.renderLikertBar(dict, y, 25, tw)
			y += step
		}
		y += step * 2
		const width = this.settings.svgw
		const posScale = d3Linear()
			.domain([0, 100])
			.range([shift, shift + width])
		const posAxisBottom = axisBottom(posScale)
			.ticks(10)
			.tickFormat(d => d + '%')
		const scaleG = this.dom.svg.append('g').attr('transform', `translate(0, ${y})`)
		posAxisBottom(scaleG)
		// Fixed legend display order for Likert categories
		const likertLegendOrder = [
			"I Don't Know",
			'Do Not Know',
			'No',
			'Not Available',
			'Not Applicable For My Role',
			'Almost Never',
			'Infrequently',
			'Sometimes',
			'Frequently',
			'Almost Always'
		]
		const catUpperSet = new Set([...this.categories].map(c => c.toUpperCase()))
		const orderedCategories: string[] = likertLegendOrder.filter(c => catUpperSet.has(c.toUpperCase()))
		const colorMap = this.state.termdbConfig.colorMap
		const legendG = this.dom.legendG.attr('transform', `translate(0, ${y + 50})`)
		const rectSize = 14
		const rectTextGap = 5
		const itemGap = 12
		let x = 0
		for (const category of orderedCategories) {
			const key = category.toUpperCase()
			const color = colorMap[this.module][key] || colorMap['*'][key] || colorMap['*'][category]
			const itemG = legendG.append('g').attr('transform', `translate(${x}, 0)`)
			itemG.append('rect').attr('width', rectSize).attr('height', rectSize).attr('fill', color)
			const label = itemG
				.append('text')
				.attr('x', rectSize + rectTextGap)
				.attr('y', rectSize / 2)
				.attr('dominant-baseline', 'central')
				.style('font-size', '0.8em')
				.text(category)
			x += rectSize + rectTextGap + (label.node() as SVGTextElement).getBBox().width + itemGap
		}
	}

	renderYesNo() {
		const step = 30
		const height = this.scoreTerms.length * step
		this.dom.svg.attr('height', height * 3 + 200) //space for the sc, for the poc and between items

		// First pass: render labels to measure max width
		const labelPadding = 50
		const tempG = this.dom.svg.append('g').style('visibility', 'hidden')
		let maxLabelWidth = 0
		for (const tw of this.scoreTerms) {
			const text = getText(tw.term.name)
			const tempText = tempG.append('text').style('font-size', '0.8em').text(text)
			const w = (tempText.node() as SVGTextElement).getBBox().width
			if (w > maxLabelWidth) maxLabelWidth = w
		}
		tempG.remove()
		const shift = maxLabelWidth + labelPadding
		this.dom.mainG.attr('transform', `translate(${shift}, ${this.shiftTop})`)
		this.dom.gridG.attr('transform', `translate(${shift}, ${this.shiftTop})`)
		this.dom.xAxisG.attr('transform', `translate(${shift}, ${this.shiftTop / 2})`)
		this.filterG.attr('transform', `translate(${shift + this.settings.svgw + 60}, ${this.shiftTop + 40})`)
		this.dom.svg.attr('width', shift + this.settings.svgw + 500)
		this.shift = shift

		this.xAxisScale = d3Linear().domain([0, 100]).range([0, this.settings.svgw])
		this.dom.xAxisG.call(axisTop(this.xAxisScale))

		let y = 0
		let showSCBar = false
		for (const tw of this.scoreTerms) {
			const percents: { [key: string]: number } = this.getPercentageDict(tw)
			const scTermId = tw.term.id.replace(/^POC/, '')
			const scTW = this.id2SCTW[this.activePlot.name][scTermId]
			const scPercents: { [key: string]: number } = this.getPercentageDict(scTW)
			// SC term stores raw categorical codes as keys (e.g. "1", "2").
			// POC bar uses text labels as keys (e.g. "Yes", "No").
			// Map SC codes to labels so scPercentKeys matches the POC bar's key format.
			const scPercentKeys = Object.keys(scPercents)
				.filter(k => scPercents[k] > 0)
				.map(k => scTW.term.values?.[k]?.label || k)
			const scTotal = Object.values(scPercents).reduce((a, b) => a + b, 0)
			showSCBar = scTotal > 1
			this.renderYesNoBar(percents, y, step, scTotal == 1 ? scPercentKeys : [])
			if (showSCBar) {
				y += step + 10
				this.renderYesNoBar(scPercents, y, step, [])
				this.dom.mainG
					.append('text')
					.text('SC')
					.style('font-size', '0.7em')
					.attr('x', this.settings.svgw + 8)
					.attr('y', y + step * 0.6)
			}

			this.dom.mainG
				.append('text')
				.text('POC')
				.style('font-size', '0.7em')
				.attr('x', this.settings.svgw + 8)
				.attr('y', showSCBar ? y - step + 0.35 * step : y + step * 0.6)
			this.dom.mainG
				.append('text')
				.attr('x', -this.shift)
				.attr('y', showSCBar ? y : y + step / 2)
				.text(getText(tw.term.name))
				.attr('font-size', '0.8em')
				.on('mouseenter', event => this.showText(event, tw.term.name))
				.on('mouseleave', () => this.tip.hide())

			y += step + 40
		}
		this.renderLines(y - 20) //last padding not needed

		if (showSCBar) this.dom.legendG.attr('transform', `translate(${550}, ${30 + this.settings.svgh})`)
		else this.dom.legendG.attr('transform', `translate(${550}, ${this.settings.svgh * 0.8})`)

		let x = 0
		for (const category of this.activePlot.categories) {
			x += this.drawLegendRect(x, 0, category.name, this.dom.legendG, true)
		}
		let text = this.dom.legendG
			.append('text')
			.attr('x', x + 80)
			.attr('y', 18)
		text.append('tspan').style('font-weight', 'bold').text('SC:')
		text.append('tspan').text('Site Coordinator')
		text = this.dom.legendG
			.append('text')
			.attr('x', x + 250)
			.attr('y', 18)
		text.append('tspan').style('font-weight', 'bold').text('POC:')
		text.append('tspan').text('Point of Care Staff')
	}

	onMouseOver(event) {
		// Impression thermometer: elements carry their tooltip text + hover-highlight descriptor as
		// __data__ (bound by renderImpressionThermometer's attachTip). Same delegation pattern as
		// polar2/radar2 — show the tip, apply the outline, and animate the POC ball's radius.
		if (this.isImpressionDomain) {
			const target = event.target
			const d = target.__data__
			if (d?.tip) {
				const menu = this.tip.clear()
				menu.d.text(d.tip)
				menu.show(event.clientX, event.clientY, true, true)
				if (d.on) for (const k in d.on) target.setAttribute(k, d.on[k]) // idempotent on repeated mousemove
				if (d.growR && !d._grown) {
					d._grown = true
					select(target).interrupt().transition().duration(150).attr('r', d.growR)
				}
			} else this.onMouseOut(event)
			return
		}
		if (event.target.tagName == 'rect') {
			const path = event.target
			const d = path.__data__
			if (!d?.value) return this.onMouseOut(event)
			const menu = this.tip.clear()
			const percent = roundValueAuto(d.value, true, 1)
			const row = menu.d.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '5px')
			if (d.color)
				row
					.append('div')
					.style('width', '12px')
					.style('height', '12px')
					.style('background-color', d.color)
					.style('flex-shrink', '0')
			row.append('span').text(`${d.key}: ${percent}%`)
			menu.show(event.clientX, event.clientY, true, true)
		} else this.onMouseOut(event)
	}

	onMouseOut(event) {
		// Reset the impression thermometer's hover highlight for the element being left; the base
		// only hides the tip. Targeted via event.target (mouseout bubbles from the element).
		if (this.isImpressionDomain) {
			const target = event?.target
			const d = target?.__data__
			if (d?.off) for (const k in d.off) target.setAttribute(k, d.off[k])
			if (d?._grown) {
				d._grown = false
				select(target).interrupt().transition().duration(150).attr('r', d.baseR)
			}
		}
		this.tip.hide()
	}

	getColor(key: string) {
		return key == 'Yes' ? this.activePlot.color : key == 'No' ? '#aaa' : `url(#${this.id}_diagonalHatch)`
	}

	renderLikertBar(dict: { [key: string]: number }, y: number, height: number, tw: any) {
		const itemG = this.dom.mainG.append('g')
		let total = 0
		for (const key in dict) total += dict[key]
		const key2num = {}
		for (const key in tw.term.values) {
			const category = tw.term.values[key].label.toUpperCase()
			key2num[category] = Number(key)
		}
		let x = 0
		const keys = Object.keys(dict).sort((a, b) => key2num[a.toUpperCase()] - key2num[b.toUpperCase()])
		for (const key of keys) {
			//const category = tw.term.values[key].label
			this.categories.add(key)
			const width = this.renderCategory(key, dict, itemG, x, height, total)
			x += width
		}
		const text = getText(tw.term.details || tw.term.name)
		const textG = this.dom.svg.append('g').attr('transform', `translate(0, ${y + this.shiftTop})`)
		textG
			.append('text')
			.text(text)
			.attr('y', (height * 2) / 3)
			.style('font-size', '0.85em')
			.on('mouseenter', event => this.showText(event, tw.term.name))
			.on('mouseleave', () => this.tip.hide())

		itemG.attr('transform', `translate(0, ${y})`)
	}

	renderCategory(category, dict, itemG, x, height, total, showPercent = false) {
		const key = category.toUpperCase()
		const module = this.module
		const colorMap = this.state.termdbConfig.colorMap
		const color = colorMap[module][key] || colorMap['*'][key]
		const entry: any = Object.entries(dict).find(k => k[0].toUpperCase() == key)
		if (!entry) return 0
		const value: number = entry[1]
		this.categories.add(category)

		const percent = (value / total) * 100
		const width = (percent / 100) * this.settings.svgw
		itemG
			.append('rect')
			.attr('x', x)
			.attr('width', width)
			.attr('height', height)
			.attr('stroke', 'gray')
			.attr('stroke-width', 0.5)
			.attr('stroke-opacity', 0.5)
			.attr('fill', color)
			.datum({ key: category, value: percent, color })
			.on('mouseover', event => this.onMouseOver(event))
		if (showPercent)
			itemG
				.append('text')
				.text(`${roundValueAuto(percent, true, 1)}%`)
				.style('font-size', '0.8em')
				.attr('x', x + width + 10)
				.attr('y', height * 0.6)
		return width
	}

	renderYesNoBar(percents: { [key: string]: number }, y: number, height: number, scPercentKeys: string[]) {
		const percentsOrdered = Object.keys(percents).sort((a, b) => -a.localeCompare(b))
		const total = Object.values(percents).reduce((a, b) => a + b, 0)
		let x = 0
		for (const key of percentsOrdered) {
			const color = this.getColor(key)

			const value = percents[key]
			const width = (value / total) * this.settings.svgw
			const percent = (value / total) * 100
			this.dom.mainG
				.append('rect')
				.attr('x', x)
				.attr('y', y)
				.attr('width', width)
				.attr('height', height)
				.attr('stroke', 'gray')
				.attr('fill', color)
				.datum({ key, value: percent, color })

			if (scPercentKeys.includes(key)) {
				const arrowX = x + width / 2
				const arrowSize = 6
				this.dom.mainG
					.append('polygon')
					.attr(
						'points',
						`${arrowX},${y} ${arrowX - arrowSize},${y - arrowSize * 1.5} ${arrowX + arrowSize},${y - arrowSize * 1.5}`
					)
					.attr('fill', '#c0392b')
					.attr('pointer-events', 'none')
				this.dom.mainG
					.append('text')
					.text(`SC ${roundValueAuto(percent, true, 1)}%`)
					.style('font-size', '0.7em')
					.style('fill', '#c0392b')
					.attr('font-weight', 'bold')
					.attr('text-anchor', 'middle')
					.attr('x', arrowX)
					.attr('y', y - arrowSize * 1.5 - 3)
					.attr('pointer-events', 'none')
			}

			x += width
		}
	}

	renderLines(y: number) {
		const width = this.settings.svgw
		const color = 'lightgray'
		const opacity = 0.5
		const bins = 4
		const size = width / bins
		let x
		const gridG = this.dom.gridG
		for (let i = 0; i <= bins; i++) {
			x = i * size
			gridG
				.append('line')
				.attr('x1', x)
				.attr('x2', x)
				.attr('y1', 0)
				.attr('y2', y)
				.style('stroke', color)
				.style('stroke-opacity', opacity)
				.style('stroke-dasharray', '5, 5')
		}
	}

	drawLegendRect(x, y, text, legendG, isYesNo = false) {
		const key = text.toUpperCase()
		const colorMap = this.state.termdbConfig.colorMap
		// For Yes/No bars, use getColor() so the legend always matches the bar fill
		const color = isYesNo
			? this.getColor(text)
			: colorMap[this.module][key] || colorMap['*'][key] || colorMap['*'][text]

		const size = 20
		const gap = 15
		const itemG = legendG.append('g').attr('transform', `translate(${x}, ${y})`)
		itemG
			.append('rect')
			.attr('x', 0)
			.attr('y', 0)
			.attr('width', size)
			.attr('height', size)
			.attr('fill', color)
			.attr('stroke', 'gray')
			.attr('stroke-width', 0.5)
			.attr('stroke-opacity', 0.5)
			.attr('pointer-events', 'none')
		const label = itemG
			.append('text')
			.attr('transform', `translate(${size + gap}, ${size / 2})`)
			.attr('dominant-baseline', 'central')
			.style('font-size', '0.85em')
			.text(text)
		const labelWidth = (label.node() as SVGTextElement).getBBox().width
		return size + gap + labelWidth + gap
	}

	showText(event, text, size = 110) {
		if (text.length <= size) return
		const menu = this.tip.clear()
		menu.d.style('padding', '5px').text(text)
		menu.showunder(event.target)
	}

	getPercentageDict(tw) {
		return this.data.term2Score[tw.term.id]
	}
}

export async function getPlotConfig(opts, app, _activeCohort) {
	const activeCohort = _activeCohort === undefined ? app.getState().activeCohort : _activeCohort
	const formsConfig = await getProfilePlotConfig(activeCohort, app, opts)
	let config = formsConfig
	config.settings = getDefaultProfileFormsSettings()
	config.headerTitle = 'Templates: Visualization tools to provide insights and assist in leveraging data'
	config = copyMerge(structuredClone(config), opts)
	for (const plot of config.options) {
		if (plot.terms) await fillTwLst(plot.terms, app.vocabApi)
	}

	return config
}

export function getDefaultProfileFormsSettings() {
	const settings = {
		controls: {
			isOpen: false
		},
		profileForms: { svgw: 420, svgh: 480 }
	}
	const profilePlotSettings = getDefaultProfilePlotSettings()
	settings.profileForms = copyMerge(settings.profileForms, profilePlotSettings)

	return settings
}

export const profileFormsInit = getCompInit(profileForms)
// this alias will allow abstracted dynamic imports
export const componentInit = profileFormsInit

function getText(name, size = 110) {
	if (name.length > size) name = name.slice(0, size) + '...'
	return name
}
