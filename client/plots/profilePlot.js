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

	setFilter() {
		this.regionSelect.selectAll('option').property('selected', d => d.key == this.region)
		this.incomeSelect.selectAll('option').property('selected', d => d == this.income)
		if (this.facilitySelect)
			this.facilitySelect.selectAll('option').property('selected', d => d == this.config.facility)

		if (this.selectComp) this.selectComp.selectAll('option').property('selected', (d, i) => i == this.componentIndex)
	}

	async init(appState) {
		const holder = this.opts.holder.append('div')
		const div = holder.append('div').style('margin-left', '50px').style('margin-top', '20px')
		const firstDiv = div.append('div').style('display', 'inline-block')
		const plotDiv = holder.append('div')
		this.dom = {
			holder,
			firstDiv,
			filterDiv: div,
			facilityDiv: div.insert('div').style('display', 'inline-block'),
			plotDiv
		}
		const config = appState.plots.find(p => p.id === this.id)

		this.sampleidmap = await this.app.vocabApi.getAllSamplesByName()
		this.regions = [
			{ key: '', label: '' },
			{ key: 'Global', label: 'Global' }
		]
		this.incomes = ['']
		this.incomes.push(...config.incomes)

		for (const region of config.regions) {
			this.regions.push({ key: region.name, label: region.name })
			for (const country of region.countries) this.regions.push({ key: country, label: `-- ${country}` })
		}

		div.append('label').style('margin-left', '15px').html('Region:').style('font-weight', 'bold')
		this.regionSelect = div.append('select').style('margin-left', '5px')
		this.regionSelect
			.selectAll('option')
			.data(this.regions)
			.enter()
			.append('option')
			.attr('value', d => d.key)
			.html((d, i) => d.label)

		this.regionSelect.on('change', () => {
			const config = this.config
			config.facility = ''
			config.region = this.regionSelect.node().value
			config.income = ''
			const sampleId = parseInt(this.sampleidmap[config.region])
			config.sampleName = config.region
			config.filter = getSampleFilter(sampleId)
			this.app.dispatch({ type: 'plot_edit', id: this.id, config })
		})

		div.append('label').style('margin-left', '15px').html('Income Group:').style('font-weight', 'bold')
		this.incomeSelect = div.append('select').style('margin-left', '5px')
		this.incomeSelect
			.selectAll('option')
			.data(this.incomes)
			.enter()
			.append('option')
			.html((d, i) => d)

		this.incomeSelect.on('change', () => {
			const config = this.config
			config.facility = ''
			config.income = this.incomeSelect.node().value
			config.region = ''
			const sampleId = parseInt(this.sampleidmap[config.income])
			config.sampleName = config.income
			config.filter = getSampleFilter(sampleId)
			this.app.dispatch({ type: 'plot_edit', id: this.id, config })
		})

		div
			.append('button')
			.style('margin-left', '15px')
			.text('Download Image')
			.on('click', () => downloadSingleSVG(this.svg, this.filename))
	}
}
