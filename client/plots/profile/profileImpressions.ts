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
		const thermW = 50
		const thermH = 300
		const bulbR = 28
		const spacing = 130
		const marginLeft = 80
		const marginTop = 40
		const labelAreaH = 120
		const legendAreaH = 80
		const svgW = marginLeft + terms.length * spacing + 60
		const svgH = this.shiftTop + marginTop + thermH + bulbR * 2 + 20 + labelAreaH + legendAreaH

		this.dom.svg.attr('width', svgW + 200).attr('height', svgH)
		this.filterG.attr('transform', `translate(${svgW + 20}, ${this.shiftTop + 10})`)

		const mainG = this.dom.mainG

		// Rating colors from red (1) to green (10)
		const ratingColors: Record<number, string> = {
			1: '#8B0000',
			2: '#CC3300',
			3: '#E85D04',
			4: '#F77F00',
			5: '#FCBF49',
			6: '#EAE151',
			7: '#B5D22C',
			8: '#7CB518',
			9: '#4A9D2F',
			10: '#2D6A1E'
		}
		const ratingScale = d3Linear().domain([1, 10]).range([thermH, 0])

		for (let i = 0; i < terms.length; i++) {
			const tw = terms[i]
			const termScore = data.term2Scores[tw.term.id]
			if (!termScore) continue

			const x = marginLeft + i * spacing
			const g = mainG.append('g').attr('transform', `translate(${x}, ${marginTop})`)

			const median = termScore.median
			const moduleName = tw.term.module || tw.term.name

			// Get site coordinator value
			let siteValue: any = null
			if (this.selectedSite) {
				siteValue = termScore.values.find((v: any) => v.siteId === this.selectedSite)
			}

			// Background — empty tube
			g.append('rect')
				.attr('x', 0)
				.attr('y', 0)
				.attr('width', thermW)
				.attr('height', thermH)
				.attr('fill', '#f0f0f0')
				.attr('stroke', '#999')
				.attr('rx', 2)

			// Colored bands for ratings 1-10 (always visible as background scale)
			for (let r = 1; r <= 10; r++) {
				const y1 = ratingScale(r + 1)
				const y2 = ratingScale(r)
				g.append('rect')
					.attr('x', 2)
					.attr('y', y1)
					.attr('width', thermW - 4)
					.attr('height', y2 - y1)
					.attr('fill', ratingColors[r])
			}

			// Site Coordinator mercury level line
			if (siteValue) {
				const fillY = ratingScale(siteValue.value)
				g.append('line')
					.attr('x1', 0)
					.attr('x2', thermW)
					.attr('y1', fillY)
					.attr('y2', fillY)
					.attr('stroke', '#333')
					.attr('stroke-width', 2.5)
			}

			// Thermometer tube outline
			g.append('rect')
				.attr('x', 0)
				.attr('y', 0)
				.attr('width', thermW)
				.attr('height', thermH)
				.attr('fill', 'none')
				.attr('stroke', '#666')
				.attr('stroke-width', 1.5)

			// Thermometer bulb
			const bulbColor = siteValue ? ratingColors[Math.min(Math.max(Math.round(siteValue.value), 1), 10)] : '#E07020'
			g.append('circle')
				.attr('cx', thermW / 2)
				.attr('cy', thermH + bulbR)
				.attr('r', bulbR)
				.attr('fill', bulbColor)
				.attr('stroke', '#666')
				.attr('stroke-width', 1.5)
			// Connector between tube and bulb
			g.append('rect')
				.attr('x', 2)
				.attr('y', thermH - 1)
				.attr('width', thermW - 4)
				.attr('height', bulbR - thermW / 2 + 5)
				.attr('fill', bulbColor)
				.attr('stroke', 'none')
			// Re-draw tube side borders over the connector
			g.append('line')
				.attr('x1', 0)
				.attr('x2', 0)
				.attr('y1', thermH)
				.attr('y2', thermH + bulbR - thermW / 2 + 2)
				.attr('stroke', '#666')
				.attr('stroke-width', 1.5)
			g.append('line')
				.attr('x1', thermW)
				.attr('x2', thermW)
				.attr('y1', thermH)
				.attr('y2', thermH + bulbR - thermW / 2 + 2)
				.attr('stroke', '#666')
				.attr('stroke-width', 1.5)

			// Median marker — gray circle
			const medianY = ratingScale(median)
			g.append('circle')
				.attr('cx', thermW / 2)
				.attr('cy', medianY)
				.attr('r', 8)
				.attr('fill', '#aaa')
				.attr('stroke', '#555')
				.attr('stroke-width', 1.5)

			// Left axis — site coordinator value label
			if (siteValue) {
				const siteY = ratingScale(siteValue.value)
				g.append('text')
					.attr('x', -5)
					.attr('y', siteY)
					.attr('text-anchor', 'end')
					.attr('dominant-baseline', 'central')
					.style('font-size', '0.7em')
					.style('font-weight', 'bold')
					.text(siteValue.value)
			}
			// Left axis — median value label
			g.append('text')
				.attr('x', -5)
				.attr('y', medianY)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'central')
				.style('font-size', '0.65em')
				.style('fill', '#666')
				.text(roundValueAuto(median, true, 1))

			// Left axis label (rotated, only on first thermometer)
			if (i === 0) {
				g.append('text')
					.attr('transform', `translate(${-40}, ${thermH / 2}) rotate(-90)`)
					.attr('text-anchor', 'middle')
					.style('font-size', '0.65em')
					.text('Impression Rating')
			}

			// Right axis — impression rating scale (1-10)
			for (let r = 1; r <= 10; r++) {
				const y = ratingScale(r)
				g.append('line')
					.attr('x1', thermW)
					.attr('x2', thermW + 4)
					.attr('y1', y)
					.attr('y2', y)
					.attr('stroke', '#666')
				g.append('text')
					.attr('x', thermW + 7)
					.attr('y', y)
					.attr('text-anchor', 'start')
					.attr('dominant-baseline', 'central')
					.style('font-size', '0.65em')
					.text(r)
			}
			// Right axis label (rotated, only on last thermometer)
			if (i === terms.length - 1) {
				g.append('text')
					.attr('transform', `translate(${thermW + 35}, ${thermH / 2}) rotate(90)`)
					.attr('text-anchor', 'middle')
					.style('font-size', '0.65em')
					.text('Impression Rating')
			}

			// Module label below bulb (rotated)
			g.append('text')
				.attr('transform', `translate(${thermW / 2}, ${thermH + bulbR * 2 + 15}) rotate(50)`)
				.attr('text-anchor', 'start')
				.attr('dominant-baseline', 'hanging')
				.style('font-size', '0.75em')
				.style('font-weight', 'bold')
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
					if (siteValue) text += `\nSite Coordinator: ${siteValue.value}`
					menu.d.style('white-space', 'pre').text(text)
					menu.show(event.clientX, event.clientY, true, true)
				})
				.on('mouseout', () => this.tip.hide())
		}

		// Legend
		const legendG = this.dom.legendG.attr(
			'transform',
			`translate(${marginLeft}, ${this.shiftTop + marginTop + thermH + bulbR * 2 + 20 + labelAreaH})`
		)

		// Rating color swatches (10 down to 1)
		const swatchSize = 14
		const swatchGap = 4
		let lx = 0
		for (let r = 10; r >= 6; r--) {
			legendG
				.append('rect')
				.attr('x', lx)
				.attr('y', 0)
				.attr('width', swatchSize)
				.attr('height', swatchSize)
				.attr('fill', ratingColors[r])
				.attr('stroke', '#666')
				.attr('stroke-width', 0.5)
			legendG
				.append('text')
				.attr('x', lx + swatchSize + 2)
				.attr('y', swatchSize / 2)
				.attr('dominant-baseline', 'central')
				.style('font-size', '0.65em')
				.text(r)
			lx += swatchSize + 20
		}
		lx = 0
		for (let r = 5; r >= 1; r--) {
			legendG
				.append('rect')
				.attr('x', lx)
				.attr('y', swatchSize + swatchGap + 2)
				.attr('width', swatchSize)
				.attr('height', swatchSize)
				.attr('fill', ratingColors[r])
				.attr('stroke', '#666')
				.attr('stroke-width', 0.5)
			legendG
				.append('text')
				.attr('x', lx + swatchSize + 2)
				.attr('y', swatchSize + swatchGap + 2 + swatchSize / 2)
				.attr('dominant-baseline', 'central')
				.style('font-size', '0.65em')
				.text(r)
			lx += swatchSize + 20
		}

		// Site marker legend (line)
		const legendRow2Y = (swatchSize + swatchGap) * 2 + 10
		legendG
			.append('line')
			.attr('x1', 0)
			.attr('x2', 22)
			.attr('y1', legendRow2Y)
			.attr('y2', legendRow2Y)
			.attr('stroke', '#333')
			.attr('stroke-width', 2.5)
		legendG
			.append('text')
			.attr('x', 28)
			.attr('y', legendRow2Y)
			.attr('dominant-baseline', 'central')
			.style('font-size', '0.75em')
			.text('Selected Site')

		// Median marker legend (circle)
		legendG
			.append('circle')
			.attr('cx', 160)
			.attr('cy', legendRow2Y)
			.attr('r', 6)
			.attr('fill', '#aaa')
			.attr('stroke', '#333')
			.attr('stroke-width', 1.5)
		legendG
			.append('text')
			.attr('x', 170)
			.attr('y', legendRow2Y)
			.attr('dominant-baseline', 'central')
			.style('font-size', '0.75em')
			.text('Median')
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
