import type { MassAppApi, MassState } from '#mass/types/mass'
import type { SvgG } from '../../types/d3'
import type { TermWrapper } from '#types'
// import type { ProfilePolarConfig, ProfilePolarDom } from './types/PolarTypes'
import type { TableCell } from '#dom'
import { getCompInit, copyMerge } from '#rx'
import { fillTwLst } from '#termsetting'
import * as d3 from 'd3'
import { profilePlot, getDefaultProfilePlotSettings, getProfilePlotConfig } from '../profilePlot.js'
import { renderTable } from '#dom'

/** TODO: profilePlot must extend RxComponent but file not tsc.
 * Work arounds until profilePlot is migrated to ts.
 */
class ProfilePolar extends profilePlot {
	readonly type = 'profilePolar'
	readonly radius = 250
	readonly arcGenerator = d3.arc().innerRadius(0)
	angle!: number
	polarG!: SvgG
	legendG!: SvgG
	filterG!: SvgG
	twLst: TermWrapper[]
	/** Once profilePlot is tsc, use extended dom profile plot type */
	dom: any //ProfilePolarDom
	config: any //Partial<ProfilePolarConfig> should be extended from a ProfilePlotConfig
	/** Rm after profilePlot is tsc and extended from RxComponent */
	id: any

	constructor() {
		super()
		this.config = {}
		this.twLst = []
	}

	async init(appState: MassState) {
		await super.init(appState)
		const config = appState.plots.find(p => p.id === this.id) as any
		this.scoreTerms = config.terms
		for (const data of config.terms) {
			this.twLst.push(data.score)
			this.twLst.push(data.maxScore)
		}
	}

	async main() {
		await super.main()
		await this.setControls()
		this.angle = (Math.PI * 2) / this.config.terms.length
		this.plot()
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
		const config = this.config
		this.dom.plotDiv.selectAll('*').remove()
		const width = 1000,
			height = 600
		this.dom.svg = this.dom.plotDiv
			.append('div')
			.style('display', 'inline-block')
			.append('svg')
			.attr('width', width)
			.attr('height', height)
		this.dom.tableDiv = this.dom.plotDiv
			.append('div')
			.attr('data-testid', 'sjpp-profilePolar-data-table')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin', '45px 20px')

		this.dom.svg
			.append('text')
			.attr('transform', `translate(130, ${40})`)
			.attr('font-weight', 'bold')
			.text(config.title)

		const rows: TableCell[][] = []
		const columns = [{ label: 'Color' }, { label: 'Module' }, { label: 'Score', align: 'center' }]

		// Create a polar grid.
		const radius = this.radius
		const x = 280
		const y = 330
		const polarG = this.dom.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.polarG = polarG
		this.legendG = this.dom.svg
			.append('g')
			.attr('data-testid', 'sjpp-profilePolar-legend')
			.attr('transform', `translate(${x + 280}, ${y - 200})`)
		this.filterG = this.dom.svg.append('g').attr('transform', `translate(${x + 280},${y})`)

		for (let i = 0; i <= 10; i++) addCircle(i * 10)

		const angle = this.angle
		let i = 0
		for (const d of config.terms) {
			const name = d.module
			d.i = i
			const color = d.score.term.color
			const percentage = this.getPercentage(d)
			rows.push([{ color, disabled: true }, { value: name }, { value: percentage }])
			polarG
				.append('g')
				.append('path')
				.datum(d)
				.attr('fill', color)
				.attr('stroke', 'white')
				.attr(
					'd',
					this.arcGenerator({
						outerRadius: (percentage! / 100) * radius,
						startAngle: i * angle,
						endAngle: (i + 1) * angle
					} as any)
				)
				.on('click', event => this.onMouseOver(event))

			i++
		}
		this.dom.tableDiv.selectAll('*').remove()
		if (this.settings.showTable)
			renderTable({
				rows,
				columns,
				div: this.dom.tableDiv,
				showLines: true,
				resize: true,
				maxHeight: '50vh'
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

		function addCircle(percent: number, text?: string) {
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

export async function getPlotConfig(opts: any, app: MassAppApi, _activeCohort: number) {
	try {
		const activeCohort = _activeCohort === undefined ? app.getState().activeCohort : _activeCohort
		const defaults = await getProfilePlotConfig(activeCohort, app, opts)
		if (!defaults) throw 'default config not found in termdbConfig.plotConfigByCohort.profilePolar'
		const settings = getDefaultProfilePlotSettings()
		defaults.settings = { profilePolar: settings }

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
		throw new Error(`${e} [profilePolar getPlotConfig()]`)
	}
}

export const profilePolarInit = getCompInit(ProfilePolar)
export const componentInit = profilePolarInit
