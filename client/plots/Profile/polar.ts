import { getCompInit, copyMerge } from '#rx'
import { fillTwLst } from '#termsetting'
import * as d3 from 'd3'
import { profilePlot, loadFilterTerms, getDefaultProfilePlotSettings, getProfilePlotConfig } from '../profilePlot'
import { renderTable } from '#dom'

interface Term {
	module: string
	score: { term: { color: string } }
	maxScore: any
	i?: number
}

interface Config {
	id: string
	terms: Term[]
	title: string
}

interface AppState {
	plots: Config[]
	getState: () => { activeCohort: any }
	vocabApi: any
}

class ProfilePolar extends profilePlot {
	type: string
	radius: number
	arcGenerator: d3.Arc<any, d3.DefaultArcObject>
	angle!: number
	polarG!: d3.Selection<SVGGElement, unknown, null, undefined>
	legendG!: d3.Selection<SVGGElement, unknown, null, undefined>
	filterG!: d3.Selection<SVGGElement, unknown, null, undefined>
	dom: any
	config!: Config

	constructor() {
		super()
		this.type = 'profilePolar'
		this.radius = 250
		this.arcGenerator = d3.arc().innerRadius(0)
	}

	async init(appState: AppState) {
		await super.init(appState)
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw new Error('Config not found')
		this.config = config
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
		const width = 1100,
			height = 700
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

		this.dom.svg.append('text').attr('transform', `translate(130, 40)`).attr('font-weight', 'bold').text(config.title)

		const radius = this.radius
		const x = 280,
			y = 330
		this.polarG = this.dom.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.legendG = this.dom.svg.append('g').attr('transform', `translate(${x + 280}, ${y})`)
		this.filterG = this.dom.svg.append('g').attr('transform', `translate(${x + 280},${y + 150})`)
	}
}

export async function getPlotConfig(opts: any, app: AppState, _activeCohort?: any) {
	try {
		const activeCohort = _activeCohort ?? app.getState().activeCohort
		const defaults = getProfilePlotConfig(activeCohort, app, opts)
		if (!defaults) throw new Error('Default config not found')

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
		await loadFilterTerms(config, activeCohort, app)

		return config
	} catch (e) {
		throw new Error(`${e} [profilePolar getPlotConfig()]`)
	}
}

export const profilePolarInit = getCompInit(ProfilePolar)
export const componentInit = profilePolarInit
