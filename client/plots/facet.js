import { getCompInit, copyMerge } from '#rx'
import { appInit } from '#plots/plot.app.js'
import { fillTermWrapper } from '#termsetting'
import { controlsInit } from './controls'
import { select2Terms } from '#dom/select2Terms'
import { isNumericTerm } from '../shared/terms'

class Facet {
	constructor(opts) {
		this.type = 'facet'
		const holder = opts.holder
		const controlsHolder = holder.append('div').style('display', 'inline-block')
		const mainDiv = holder.append('div').style('display', 'inline-block')

		this.dom = {
			holder: opts.holder.style('padding', '20px'),
			header: opts.header,
			controlsHolder,
			mainDiv
		}
		if (this.dom.header) this.dom.header.html('Facet Table')
	}

	async init(appState) {
		await this.setControls()
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)

		return {
			config,
			vocab: appState.vocab,
			termfilter: appState.termfilter
		}
	}

	main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		this.renderTable()
	}

	async renderTable() {
		const config = this.config
		this.dom.mainDiv.selectAll('*').remove()
		const tbody = this.dom.mainDiv.append('table').style('border-spacing', '5px').append('tbody')

		const tr = tbody.append('tr')
		tr.append('th')

		const result = await this.app.vocabApi.getAnnotatedSampleData({
			terms: [config.term, config.term2]
		})
		const categories = this.getCategories(config.term, result.lst)
		for (const category of categories) {
			const label = config.term.term.values?.[category]?.label || category
			tr.append('th')
				.style('text-align', 'left')
				.style('background-color', '#FAFAFA')
				.style('padding-right', '50px')
				.text(label)
		}
		const categories2 = this.getCategories(config.term2, result.lst)
		const cells = {}
		for (const category2 of categories2) {
			cells[category2] = {}
			const tr = tbody.append('tr')
			const label2 = config.term2.term.values?.[category2]?.label || category2
			tr.append('td').style('background-color', '#FAFAFA').style('font-weight', 'bold').text(label2)
			for (const category of categories) {
				const samples = result.lst.filter(
					s => s[config.term.$id]?.key == category && s[config.term2.$id]?.key == category2
				)
				cells[category2][category] = { samples, selected: false }
				const td = tr.append('td').style('background-color', '#FAFAFA')
				if (samples.length > 0)
					td.text(samples.length) //.append('a')
						.on('click', () => {
							const selected = (cells[category2][category].selected = !cells[category2][category].selected)
							if (selected) {
								td.style('border', '1px solid blue')
							} else {
								td.style('border', 'none')
							}

							for (const category2 of categories2) {
								for (const category of categories) {
									if (cells[category2][category].selected) {
										showSamplesBt.property('disabled', false)
										return
									}
								}
							}
							showSamplesBt.property('disabled', true)
						})
			}
		}
		const buttonDiv = this.dom.mainDiv.append('div').style('display', 'inline-block').style('margin-top', '20px')
		//.style('float', 'right')
		const showSamplesBt = buttonDiv
			.append('button')
			.property('disabled', true)
			.text('Show samples')
			.on('click', () => {
				const samples = []
				for (const category2 of categories2) {
					for (const category of categories) {
						if (cells[category2][category].selected) {
							samples.push(...cells[category2][category].samples)
						}
					}
				}
				this.app.dispatch({
					type: 'plot_create',
					config: {
						chartType: 'sampleView',
						samples: samples.map(d => ({
							sampleId: d.sample,
							sampleName: result.refs.bySampleId[d.sample].label
						}))
					}
				})
			})
	}

	getCategories(tw, data) {
		const categories = []
		for (const sample of data) {
			let key = sample[tw.$id]?.key
			if (key) {
				if (!isNaN(key)) key = Number(key)
				categories.push(key)
			}
		}
		const set = new Set(categories)
		return Array.from(set).sort()
	}

	async setControls() {
		const inputs = [
			{
				type: 'term',
				configKey: 'term',
				chartType: this.type,
				usecase: { target: this.type },
				title: 'Facet column categories',
				label: 'Columns',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: ['discrete']
			},
			{
				type: 'term',
				configKey: 'term2',
				chartType: this.type,
				usecase: { target: this.type },
				title: 'Facet row categories',
				label: 'Rows',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: ['discrete']
			}
		]

		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: this.dom.controlsHolder,
				inputs
			})
		}
	}
}

export function makeChartBtnMenu(holder, chartsInstance) {
	const callback = (xterm, yterm) => {
		const config = {
			chartType: 'facet',
			term: { term: xterm },
			term2: { term: yterm }
		}
		if (isNumericTerm(xterm)) config.term.q = { mode: 'discrete' }
		if (isNumericTerm(yterm)) config.term2.q = { mode: 'discrete' }
		chartsInstance.app.dispatch({
			type: 'plot_create',
			config
		})
	}
	select2Terms(chartsInstance.dom.tip, chartsInstance.app, 'facet', '', callback)
}

export const facetInit = getCompInit(Facet)
// this alias will allow abstracted dynamic imports
export const componentInit = facetInit

export async function getPlotConfig(opts, app) {
	const config = { settings: {} }
	await fillTermWrapper(opts.term, app.vocabApi)
	await fillTermWrapper(opts.term2, app.vocabApi)
	const result = copyMerge(config, opts)
	return result
}
