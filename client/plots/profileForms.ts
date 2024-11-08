import { getCompInit, copyMerge } from '../rx/index.js'
import { controlsInit } from './controls'
import { getProfilePlotConfig } from './profilePlot.js'
import { fillTwLst } from '#termsetting'

export class profileForms {
	id: string
	type: string
	opts: { [key: string]: any }
	svg: any
	components: any
	state: any
	app: any
	data: any
	dom: any

	constructor(opts) {
		this.opts = opts
		this.type = 'profileForms'
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		return { config }
	}

	async init(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		this.opts.header.text(config.tw.term.name)

		const controlsHolder = this.opts.holder
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
		const rightHolder = this.opts.holder.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		const headerHolder = rightHolder.append('div').style('padding', '10px')
		const contentHolder = rightHolder.append('div')
		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: controlsHolder,
				inputs: []
			})
		}
		this.data = await this.app.vocabApi.getAnnotatedSampleData({
			terms: config.terms
		})
		const sampleHolder = headerHolder.append('div').style('padding', '10px')
		sampleHolder.append('span').text('Sample: ')
		const selectSample = sampleHolder.append('select')
		selectSample
			.selectAll('option')
			.data(this.data.lst)
			.enter()
			.append('option')
			.text(d => this.data.refs.bySampleId[d.sample].label)
			.attr('value', d => d.sample)
		selectSample.on('change', () => {
			const id = selectSample.node().value
			this.app.dispatch({ type: 'plot_edit', id: this.id, config: { sample: id } })
		})
		const questionHolder = headerHolder.append('div')
		questionHolder.append('span').text('Question: ')
		const selectQuestion = questionHolder.append('select')
		selectQuestion
			.selectAll('option')
			.data(config.terms)
			.enter()
			.append('option')
			.text(d => d.term.name)
			.attr('value', d => d.term.id)
		selectQuestion.on('change', () => {
			const id = selectQuestion.node().value
			this.app.dispatch({ type: 'plot_edit', id: this.id, config: { question: id } })
		})
		const svg = contentHolder.append('svg')

		this.dom = {
			selectSample,
			svg
		}
	}

	async main() {
		const config = this.state.config
		this.renderPlot()
	}

	renderPlot() {
		const height = 200
		const sample = this.state.config.sample || this.data.lst[0].sample
		const tw = this.state.config.terms.find(t => t.term.id == this.state.config.question) || this.state.config.terms[0]
		const sampleData = this.data.samples[sample]
		let termData = sampleData[tw.$id].value
		termData = termData.slice(1, -1) //Removed string quoutes
		const percents = JSON.parse(termData)
	}
}

export async function getPlotConfig(opts, app) {
	let config = getProfilePlotConfig(app, opts)
	if (config) config = config.find(t => t.module == opts.tw.term.name)
	else config = {}
	config.settings = { controls: { isOpen: false } }
	config = copyMerge(structuredClone(config), opts)
	await fillTwLst(config.terms, app.vocabApi)

	return config
}

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/
	const menuDiv = holder.append('div')
}
export const profileFormsInit = getCompInit(profileForms)
// this alias will allow abstracted dynamic imports
export const componentInit = profileFormsInit
