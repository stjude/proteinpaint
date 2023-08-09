import { getCompInit, copyMerge } from '#rx'

export class profilePlot {
	constructor() {
		this.type = 'profilePlot'
	}

	async init(appState) {
		const holder = this.opts.holder.append('div')
		this.dom = {
			holder
		}
		const config = appState.plots.find(p => p.id === this.id)
		this.twLst = []
		for (const [i, tw] of config.terms.entries()) {
			if (tw.id) {
				this.twLst.push(tw)
			}
		}
		this.twLst.push(config.typeTW)

		const tw = structuredClone(config.terms[0])
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

		const div = holder.append('div').style('margin-left', '50px').style('margin-top', '20px')

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
			config.region = regionSelect.node().value
			config.income = ''
			const sampleId = parseInt(this.sampleidmap[config.region])
			config.filter = getSampleFilter(sampleId)
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
			config.income = incomeSelect.node().value
			config.region = ''
			const sampleId = parseInt(this.sampleidmap[config.income])
			config.filter = getSampleFilter(sampleId)
			this.app.dispatch({ type: 'plot_edit', id: this.id, config })
		})
	}
}

export async function getPlotConfig(opts, app) {
	try {
		const defaults = app.vocabApi.termdbConfig?.chartConfigByType?.profilePolar
		if (!defaults) throw 'default config not found in termdbConfig.chartConfigByType.profilePlot'
		const config = copyMerge(structuredClone(defaults), opts)
		for (const t of config.terms) {
			if (t.id) await fillTermWrapper(t, app.vocabApi)
		}
		config.typeTW = await fillTermWrapper({ id: 'sampleType' }, app.vocabApi)
		return config
	} catch (e) {
		throw `${e} [profilePolar getPlotConfig()]`
	}
}

export const profilePlotInit = getCompInit(profilePlot)
// this alias will allow abstracted dynamic imports
export const componentInit = profilePlotInit
