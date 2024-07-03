import { getCompInit, copyMerge } from '#rx'
import { fillTwLst } from '#termsetting'
import * as d3 from 'd3'
import { profilePlot } from './profilePlot.js'
import { Menu } from '#dom/menu'
import { renderTable } from '../dom/table.js'
import { loadFilterTerms } from './profilePlot.js'
import { getDefaultProfilePlotSettings } from './profilePlot.js'

class profileSummary extends profilePlot {
	constructor() {
		super()
		this.type = 'profileSummary'
		this.twLst = []
	}
	async init(appState) {
		await super.init(appState)
		const config = appState.plots.find(p => p.id === this.id)
	}

	async main() {
		await super.main()
		await this.setControls()
		this.plot()
	}

	plot() {
		const config = this.config
		this.dom.plotDiv.selectAll('*').remove()
		const width = 1100
		const height = 600
		this.svg = this.dom.plotDiv
			.append('div')
			.style('display', 'inline-block')
			.append('svg')
			.attr('width', width)
			.attr('height', height)
		this.dom.tableDiv = this.dom.plotDiv
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin-top', '45px')

		this.svg
			.append('text')
			.attr('transform', `translate(150, ${height - 40})`)
			.attr('font-weight', 'bold')
			.text(config.title)

		const x = 300
		const y = 280
		const mainG = this.svg.append('g').attr('transform', `translate(${x},${y})`)
		this.mainG = mainG
		this.legendG = this.svg.append('g').attr('transform', `translate(${x + 280}, ${y - 200})`)
		this.filterG = this.svg.append('g').attr('transform', `translate(${x + 280},${y - 80})`)
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const defaults = app.vocabApi.termdbConfig?.chartConfigByType?.profileSummary
		if (!defaults) throw 'default config not found in termdbConfig.chartConfigByType.profileSummary'
		const config = copyMerge(structuredClone(defaults), opts)
		const settings = getDefaultProfilePlotSettings()
		config.settings = {
			profileSummary: settings,
			controls: { isOpen: false }
		}

		await loadFilterTerms(config, app)

		return config
	} catch (e) {
		throw `${e} [profileSummary getPlotConfig()]`
	}
}

export const profileSummaryInit = getCompInit(profileSummary)
// this alias will allow abstracted dynamic imports
export const componentInit = profileSummaryInit
