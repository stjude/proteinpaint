import { getCompInit, copyMerge } from '../../rx/index.js'
import { getProfilePlotConfig, profilePlot, getDefaultProfilePlotSettings, FULL_COHORT } from './profilePlot.js'
import { scaleLinear as d3Linear, scaleSequential } from 'd3-scale'
import { interpolateRdYlGn } from 'd3-scale-chromatic'
import { roundValueAuto } from '#shared'

class ProfileImpressions extends profilePlot {
	static type = 'profileImpressions' as const
	impressionTWs: any[]
	impressionData: any
	impressionSubTab: string
	selectedSite: string | null
	filterG: any
	shiftTop: number

	constructor(opts) {
		super(opts, 'profileImpressions')
		this.impressionTWs = []
		this.impressionData = null
		this.impressionSubTab = 'Thermometer'
		this.selectedSite = null
		this.shiftTop = 50
	}

	async init(appState) {
		await super.init(appState)
		const cohortPrefix = appState.activeCohort == FULL_COHORT ? 'F' : 'A'
		this.impressionTWs = await this.app.vocabApi.getImpressionTWs(cohortPrefix)
		for (const tw of this.impressionTWs) {
			tw.q = { mode: 'continuous' }
		}
		this.scoreTerms = []

		const rightDiv = this.dom.rightDiv
		const headerDiv = rightDiv.append('div').style('padding-bottom', '10px')
		const svg = rightDiv.style('padding', '20px').append('svg')
		const mainG = svg.append('g').attr('transform', `translate(20, ${this.shiftTop})`)
		this.filterG = svg.append('g').attr('transform', `translate(20, ${this.shiftTop + 10})`)
		const legendG = svg.append('g')

		this.dom = copyMerge(this.dom, {
			svg,
			headerDiv,
			mainG,
			legendG
		})
	}

	async main() {
		super.main()
		if (!this.impressionTWs.length) return
		this.dom.mainG.selectAll('*').remove()
		this.dom.legendG.selectAll('*').remove()
		this.dom.svg.selectAll('.sjpp-profileImpressions-extra').remove()
		await this.setControls()
		this.impressionData = await this.app.vocabApi.getProfileImpressionScores({
			impressionTerms: this.impressionTWs,
			filter: this.filter,
			facilityTW: this.config.facilityTW,
			filterByUserSites: this.settings.filterByUserSites
		})
		if (this.impressionData && 'error' in this.impressionData) throw this.impressionData.error
		// Auto-select user's site if available and no site selected yet
		if (!this.selectedSite && this.impressionData.sites?.length) {
			this.selectedSite = this.impressionData.hospital
				? this.impressionData.sites.find((s: any) => s.label === this.impressionData.hospital)?.value ||
				  this.impressionData.sites[0].value
				: this.impressionData.sites[0].value
		}
		this.renderImpressions()
		this.filterG.selectAll('*').remove()
		this.addFilterLegend()
	}

	renderImpressions() {
		if (!this.impressionData) return
		this.dom.mainG.attr('transform', `translate(20, ${this.shiftTop})`)
		this.dom.headerDiv.style('display', 'block')
		this.dom.headerDiv.selectAll('*').remove()

		// Sub-tab toggle: Thermometer | Heatmap (hide Heatmap for public users with no site data)
		const hasSiteData = this.impressionData.sites?.length > 0
		const subTabs = hasSiteData ? ['Thermometer', 'Heatmap'] : ['Thermometer']
		if (!hasSiteData && this.impressionSubTab === 'Heatmap') this.impressionSubTab = 'Thermometer'
		const subTabDiv = this.dom.headerDiv.append('div').style('margin-bottom', '10px')
		for (const tab of subTabs) {
			subTabDiv
				.append('button')
				.text(tab)
				.style('margin-right', '5px')
				.style('padding', '4px 12px')
				.style('cursor', 'pointer')
				.style('font-weight', this.impressionSubTab === tab ? 'bold' : 'normal')
				.style('background', this.impressionSubTab === tab ? '#2381c3' : '#eee')
				.style('color', this.impressionSubTab === tab ? '#fff' : '#333')
				.style('border', '1px solid #ccc')
				.style('border-radius', '4px')
				.on('click', () => {
					this.impressionSubTab = tab
					this.dom.mainG.selectAll('*').remove()
					this.dom.legendG.selectAll('*').remove()
					this.renderImpressions()
				})
		}

		// Site selector dropdown for thermometer
		if (this.impressionSubTab === 'Thermometer' && this.impressionData.sites?.length) {
			const selectorDiv = this.dom.headerDiv.append('div').style('margin-bottom', '10px')
			selectorDiv.append('span').text('Site: ').style('font-weight', 'bold')
			const select = selectorDiv.append('select').on('change', (event: any) => {
				this.selectedSite = event.target.value
				this.dom.mainG.selectAll('*').remove()
				this.dom.legendG.selectAll('*').remove()
				if (this.impressionSubTab === 'Thermometer') this.renderThermometer()
			})
			for (const site of this.impressionData.sites) {
				select
					.append('option')
					.attr('value', site.value)
					.property('selected', site.value === this.selectedSite)
					.text(site.label)
			}
		}

		if (this.impressionSubTab === 'Thermometer') this.renderThermometer()
		else this.renderHeatmap()
	}

	renderThermometer() {
		const data = this.impressionData
		const terms = this.impressionTWs
		const thermW = 40
		const thermH = 250
		const spacing = 110
		const marginLeft = 20
		const marginTop = 30
		const labelAreaH = 120
		const legendAreaH = 50
		const svgW = marginLeft + terms.length * spacing + 100
		const svgH = this.shiftTop + marginTop + thermH + labelAreaH + legendAreaH + 30

		this.dom.svg.attr('width', svgW + 200).attr('height', svgH)
		this.filterG.attr('transform', `translate(${svgW + 20}, ${this.shiftTop + 10})`)

		const mainG = this.dom.mainG
		const colorScale = scaleSequential(interpolateRdYlGn).domain([1, 10])
		const yScale = d3Linear().domain([1, 10]).range([thermH, 0])

		for (let i = 0; i < terms.length; i++) {
			const tw = terms[i]
			const termScore = data.term2Scores[tw.term.id]
			if (!termScore) continue

			const x = marginLeft + i * spacing
			const g = mainG.append('g').attr('transform', `translate(${x}, ${marginTop})`)

			// Background thermometer
			g.append('rect')
				.attr('x', 0)
				.attr('y', 0)
				.attr('width', thermW)
				.attr('height', thermH)
				.attr('fill', '#f0f0f0')
				.attr('stroke', '#999')
				.attr('rx', 4)

			// Gradient fill segments (1-10 scale)
			for (let v = 1; v <= 10; v++) {
				const segH = thermH / 10
				const segY = yScale(v + 1) + segH
				g.append('rect')
					.attr('x', 1)
					.attr('y', segY)
					.attr('width', thermW - 2)
					.attr('height', segH)
					.attr('fill', colorScale(v))
					.attr('opacity', 0.3)
			}

			// Scale labels on left
			for (let v = 1; v <= 10; v += 1) {
				g.append('text')
					.attr('x', -5)
					.attr('y', yScale(v))
					.attr('text-anchor', 'end')
					.attr('dominant-baseline', 'central')
					.style('font-size', '0.7em')
					.text(v)
			}

			// Median marker — horizontal line with label
			const median = termScore.median
			const medianY = yScale(median)
			g.append('line')
				.attr('x1', -3)
				.attr('x2', thermW + 3)
				.attr('y1', medianY)
				.attr('y2', medianY)
				.attr('stroke', '#333')
				.attr('stroke-width', 3)
			g.append('text')
				.attr('x', thermW + 6)
				.attr('y', medianY)
				.attr('dominant-baseline', 'central')
				.style('font-size', '0.7em')
				.style('font-weight', 'bold')
				.text(roundValueAuto(median, true, 1))

			// Selected site marker — diamond
			if (this.selectedSite) {
				const siteValue = termScore.values.find((v: any) => v.siteId === this.selectedSite)
				if (siteValue) {
					const siteY = yScale(siteValue.value)
					const dSize = 6
					g.append('polygon')
						.attr(
							'points',
							`${thermW / 2},${siteY - dSize} ${thermW / 2 + dSize},${siteY} ${thermW / 2},${siteY + dSize} ${
								thermW / 2 - dSize
							},${siteY}`
						)
						.attr('fill', '#c0392b')
						.attr('stroke', '#fff')
						.attr('stroke-width', 1)
					g.append('text')
						.attr('x', thermW + 6)
						.attr('y', siteY + 12)
						.attr('dominant-baseline', 'central')
						.style('font-size', '0.65em')
						.style('fill', '#c0392b')
						.text(siteValue.value)
				}
			}

			// Module label below (rotated)
			const moduleName = tw.term.module || tw.term.name
			g.append('text')
				.attr('transform', `translate(${thermW / 2}, ${thermH + 35}) rotate(50)`)
				.attr('text-anchor', 'start')
				.attr('dominant-baseline', 'hanging')
				.style('font-size', '0.75em')
				.text(moduleName)

			// Tooltip on hover
			g.append('rect')
				.attr('x', 0)
				.attr('y', 0)
				.attr('width', thermW)
				.attr('height', thermH)
				.attr('fill', 'transparent')
				.on('mouseover', (event: any) => {
					const menu = this.tip.clear()
					let text = `${moduleName}\nMedian: ${roundValueAuto(median, true, 1)}`
					if (this.selectedSite) {
						const sv = termScore.values.find((v: any) => v.siteId === this.selectedSite)
						if (sv) text += `\n${sv.siteLabel}: ${sv.value}`
					}
					menu.d.style('white-space', 'pre').text(text)
					menu.show(event.clientX, event.clientY, true, true)
				})
				.on('mouseout', () => this.tip.hide())
		}

		// Legend
		const legendG = this.dom.legendG.attr(
			'transform',
			`translate(${marginLeft + 20}, ${this.shiftTop + marginTop + thermH + labelAreaH + 40})`
		)
		// Median legend
		legendG
			.append('line')
			.attr('x1', 0)
			.attr('x2', 20)
			.attr('y1', 10)
			.attr('y2', 10)
			.attr('stroke', '#333')
			.attr('stroke-width', 3)
		legendG
			.append('text')
			.attr('x', 25)
			.attr('y', 10)
			.attr('dominant-baseline', 'central')
			.style('font-size', '0.8em')
			.text('Median')
		// Site legend
		const dSize = 5
		legendG
			.append('polygon')
			.attr('points', `${110},${10 - dSize} ${110 + dSize},${10} ${110},${10 + dSize} ${110 - dSize},${10}`)
			.attr('fill', '#c0392b')
		legendG
			.append('text')
			.attr('x', 120)
			.attr('y', 10)
			.attr('dominant-baseline', 'central')
			.style('font-size', '0.8em')
			.text('Selected Site')
	}

	renderHeatmap() {
		const data = this.impressionData
		const terms = this.impressionTWs
		if (!data.sites?.length) return

		const cellW = 60
		const cellH = 25
		const labelLeftW = 250
		const labelTopH = 300
		const svgW = labelLeftW + terms.length * cellW + 100
		const svgH = labelTopH + data.sites.length * cellH + 80

		this.dom.svg.attr('width', svgW + 200).attr('height', svgH)
		this.filterG.attr('transform', `translate(${svgW + 20}, ${this.shiftTop + 10})`)

		const colorScale = scaleSequential(interpolateRdYlGn).domain([1, 10])
		const mainG = this.dom.mainG

		// Build site-to-score lookup: siteId -> { termId -> value }
		const siteScores: { [siteId: string]: { [termId: string]: number } } = {}
		for (const tw of terms) {
			const termScore = data.term2Scores[tw.term.id]
			if (!termScore) continue
			for (const sv of termScore.values) {
				if (!siteScores[sv.siteId]) siteScores[sv.siteId] = {}
				siteScores[sv.siteId][tw.term.id] = sv.value
			}
		}

		// Column headers (module names, rotated)
		for (let c = 0; c < terms.length; c++) {
			const moduleName = terms[c].term.module || terms[c].term.name
			mainG
				.append('text')
				.attr('transform', `translate(${labelLeftW + c * cellW + cellW / 2}, ${labelTopH - 10}) rotate(-50)`)
				.attr('text-anchor', 'start')
				.attr('dominant-baseline', 'central')
				.style('font-size', '0.75em')
				.text(moduleName)
		}

		// Rows
		for (let r = 0; r < data.sites.length; r++) {
			const site = data.sites[r]
			const y = labelTopH + r * cellH

			// Row label
			mainG
				.append('text')
				.attr('x', labelLeftW - 5)
				.attr('y', y + cellH / 2)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'central')
				.style('font-size', '0.7em')
				.text(getText(site.label, 30))
				.on('mouseenter', (event: any) => {
					if (site.label.length > 30) {
						const menu = this.tip.clear()
						menu.d.style('padding', '5px').text(site.label)
						menu.showunder(event.target)
					}
				})
				.on('mouseleave', () => this.tip.hide())

			// Cells
			for (let c = 0; c < terms.length; c++) {
				const tw = terms[c]
				const scores = siteScores[site.value]
				const value = scores?.[tw.term.id]
				const x = labelLeftW + c * cellW

				mainG
					.append('rect')
					.attr('x', x)
					.attr('y', y)
					.attr('width', cellW - 1)
					.attr('height', cellH - 1)
					.attr('fill', value != null ? colorScale(value) : '#ddd')
					.attr('stroke', '#fff')
					.attr('stroke-width', 1)
					.on('mouseover', (event: any) => {
						const menu = this.tip.clear()
						const moduleName = tw.term.module || tw.term.name
						menu.d.text(`${site.label} / ${moduleName}: ${value != null ? value : 'N/A'}`)
						menu.show(event.clientX, event.clientY, true, true)
					})
					.on('mouseout', () => this.tip.hide())

				// Show value in cell
				if (value != null) {
					mainG
						.append('text')
						.attr('x', x + (cellW - 1) / 2)
						.attr('y', y + cellH / 2)
						.attr('text-anchor', 'middle')
						.attr('dominant-baseline', 'central')
						.style('font-size', '0.65em')
						.style('fill', value <= 4 ? '#fff' : '#333')
						.attr('pointer-events', 'none')
						.text(value)
				}
			}
		}

		// Color legend bar
		const legendG = this.dom.legendG.attr(
			'transform',
			`translate(${labelLeftW + 20}, ${this.shiftTop + labelTopH + data.sites.length * cellH + 30})`
		)
		const legendW = 200
		const legendH = 15
		const steps = 10
		const stepW = legendW / steps
		for (let i = 1; i <= steps; i++) {
			legendG
				.append('rect')
				.attr('x', (i - 1) * stepW)
				.attr('y', 0)
				.attr('width', stepW)
				.attr('height', legendH)
				.attr('fill', colorScale(i))
		}
		legendG
			.append('text')
			.attr('x', 0)
			.attr('y', legendH + 14)
			.style('font-size', '0.7em')
			.text('1 (Low)')
		legendG
			.append('text')
			.attr('x', legendW)
			.attr('y', legendH + 14)
			.attr('text-anchor', 'end')
			.style('font-size', '0.7em')
			.text('10 (High)')
	}

	onMouseOver(_event) {
		// No-op: impressions uses inline tooltips
	}

	onMouseOut(_event) {
		this.tip.hide()
	}
}

export async function getPlotConfig(opts: any, app: any, _activeCohort: number) {
	try {
		const activeCohort = _activeCohort === undefined ? app.getState().activeCohort : _activeCohort
		const defaults = await getProfilePlotConfig(activeCohort, app, opts)
		if (!defaults) throw 'default config not found in termdbConfig.plotConfigByCohort.profileImpressions'
		const settings = getDefaultProfilePlotSettings()
		defaults.settings = { profileImpressions: settings }
		const config = copyMerge(structuredClone(defaults), opts)
		config.settings.controls = { isOpen: false }
		return config
	} catch (e) {
		throw new Error(`${e} [profileImpressions getPlotConfig()]`)
	}
}

export const profileImpressionsInit = getCompInit(ProfileImpressions)
export const componentInit = profileImpressionsInit

function getText(name: string, size = 110) {
	if (name.length > size) name = name.slice(0, size) + '...'
	return name
}
