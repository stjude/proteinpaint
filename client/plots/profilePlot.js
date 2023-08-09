import { downloadSingleSVG } from '../common/svg.download.js'
import { getSampleFilter } from '#termsetting/handlers/samplelst'

export class profilePlot {
	constructor() {
		this.type = 'profilePlot'
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
			plotDiv
		}
		const config = appState.plots.find(p => p.id === this.id)
		const tw = structuredClone(config.terms?.[0] || config.plotByComponent[0].groups[0].rows[0].twlst[0])

		const data = await this.app.vocabApi.getAnnotatedSampleData({ terms: [tw] })
		this.sampleidmap = {}
		for (const key in data.samples) {
			const sample = data.samples[key]
			this.sampleidmap[sample.sampleName] = sample.sample
		}
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
		const regionSelect = div.append('select').style('margin-left', '5px')
		regionSelect
			.selectAll('option')
			.data(this.regions)
			.enter()
			.append('option')
			.property('selected', d => d.key == config.region)
			.attr('value', d => d.key)
			.html((d, i) => d.label)

		regionSelect.on('change', () => {
			this.config.region = regionSelect.node().value
			this.config.income = ''
			const sampleId = parseInt(this.sampleidmap[config.region])
			this.config.filter = getSampleFilter(sampleId)
			this.app.dispatch({ type: 'plot_edit', id: this.id, config })
		})

		div.append('label').style('margin-left', '15px').html('Income Group:').style('font-weight', 'bold')
		const incomeSelect = div.append('select').style('margin-left', '5px')
		incomeSelect
			.selectAll('option')
			.data(this.incomes)
			.enter()
			.append('option')
			.property('selected', d => d == config.income)
			.html((d, i) => d)

		incomeSelect.on('change', () => {
			this.config.income = incomeSelect.node().value
			this.config.region = ''
			const sampleId = parseInt(this.sampleidmap[config.income])
			this.config.filter = getSampleFilter(sampleId)
			this.app.dispatch({ type: 'plot_edit', id: this.id, config })
		})

		div
			.append('button')
			.style('margin-left', '15px')
			.text('Download SVG')
			.on('click', () => downloadSingleSVG(this.svg, this.filename))
	}
}
