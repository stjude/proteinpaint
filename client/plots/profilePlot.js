import { downloadSingleSVG } from '../common/svg.download.js'
import { getSampleFilter } from '#termsetting/handlers/samplelst'

export class profilePlot {
	constructor() {
		this.type = 'profilePlot'
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return {
			config
		}
	}

	async init(appState) {
		const controlsDiv = this.opts.holder.append('div').style('display', 'inline-block')
		const holder = this.opts.holder.append('div').style('display', 'inline-block').style('display', 'inline-block')

		const div = holder.append('div').style('margin-left', '50px').style('margin-top', '20px')
		const firstDiv = div.append('div').style('display', 'inline-block')
		const plotDiv = holder.append('div')
		this.dom = {
			controlsDiv,
			holder,
			firstDiv,
			filterDiv: div,
			facilityDiv: div.insert('div').style('display', 'inline-block'),
			plotDiv
		}
		const config = appState.plots.find(p => p.id === this.id)
		this.sampleidmap = await this.app.vocabApi.getAllSamplesByName()
		this.regions = [
			{ value: '', label: '' },
			{ value: 'Global', label: 'Global' }
		]
		this.incomes = [{ value: '', label: '' }]
		this.incomes.push(
			...config.incomes.map(elem => {
				return { label: elem, value: elem }
			})
		)

		for (const region of config.regions) {
			this.regions.push({ value: region.name, label: region.name })
			for (const country of region.countries) this.regions.push({ value: country, label: `-- ${country}` })
		}
	}

	setRegion(region) {
		const config = this.config
		this.settings.facility = ''
		this.settings.region = region
		this.settings.income = ''
		const sampleId = parseInt(this.sampleidmap[region])
		config.sampleName = config.region
		config.filter = getSampleFilter(sampleId)
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	setIncome(income) {
		const config = this.config
		this.settings.facility = ''
		this.settings.income = income
		this.settings.region = ''
		const sampleId = parseInt(this.sampleidmap[income])
		config.sampleName = config.income
		config.filter = getSampleFilter(sampleId)
		this.app.dispatch({ type: 'plot_edit', id: this.id, config })
	}

	addLegendFilter(filter, value, index) {
		const text = this.filterG
			.append('text')
			.attr('transform', `translate(0, ${index * 20})`)
			.attr('text-anchor', 'left')
		text.append('tspan').attr('font-weight', 'bold').text(filter)
		text.append('tspan').text(`: ${value ? value : 'None'}`)
	}

	addLegendItem(category, description, index) {
		const text = this.legendG
			.append('text')
			.attr('transform', `translate(0, ${index * 20})`)
			.attr('text-anchor', 'left')
		text.append('tspan').attr('font-weight', 'bold').text(category)
		text.append('tspan').text(`: ${description}`)
	}
}
