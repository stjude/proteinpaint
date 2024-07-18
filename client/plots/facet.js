import { getCompInit, copyMerge } from '#rx'
import { appInit } from '#plots/plot.app.js'
import { fillTermWrapper } from '#termsetting'
import { controlsInit } from './controls'
import { Menu } from '#dom/menu'
import { showTermsTree } from '../mass/groups'
import { isNumeric } from '../shared/helpers'

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
		if (this.dom.header) this.dom.header.html('Facet')
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
			tr.append('th').style('background-color', '#FAFAFA').text(category)
		}
		const categories2 = this.getCategories(config.term2, result.lst)
		for (const category2 of categories2) {
			const tr = tbody.append('tr')
			tr.append('td').style('background-color', '#FAFAFA').text(category2)
			for (const category of categories) {
				const samples = result.lst.filter(
					s => s[config.term.$id]?.key == category && s[config.term2.$id]?.key == category2
				)
				const td = tr.append('td').style('background-color', '#FAFAFA')
				if (samples.length > 0)
					td.append('a')
						.text(samples.length)
						.on('click', () => {
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
		}
	}

	getCategories(tw, data) {
		const categories = []
		for (const sample of data) {
			const value = sample[tw.$id]
			if (value) categories.push(value.key)
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
	selectTerms(chartsInstance.dom.tip, chartsInstance.app)
}

// export function getBin(lst, value) {
// 	value = Math.round(value * 100) / 100 //to keep 2 decimal places

// 	let bin = lst.findIndex(
// 		b => (b.startunbounded && value < b.stop) || (b.startunbounded && b.stopinclusive && value == b.stop)
// 	)
// 	if (bin == -1)
// 		bin = lst.findIndex(
// 			b => (b.stopunbounded && value > b.start) || (b.stopunbounded && b.startinclusive && value == b.start)
// 		)
// 	if (bin == -1)
// 		bin = lst.findIndex(
// 			b =>
// 				(value > b.start && value < b.stop) ||
// 				(b.startinclusive && value == b.start) ||
// 				(b.stopinclusive && value == b.stop)
// 		)
// 	return bin
// }

export function selectTerms(tip, app) {
	const tip2 = new Menu({ padding: '5px' })
	const coordsDiv = tip.d.append('div').style('padding', '5px') //.attr('class', 'sja_menuoption sja_sharp_border')
	coordsDiv.append('div').html('Select variables to plot').style('font-size', '0.9rem')
	let xterm, yterm
	const xDiv = coordsDiv.append('div').style('padding-top', '5px').html('&nbsp;X&nbsp;&nbsp;')
	const xtermDiv = xDiv
		.append('div')
		.attr('class', 'sja_filter_tag_btn add_term_btn')
		.text('+')
		.on('click', e => {
			getTreeTerm(xtermDiv, term => (xterm = term))
		})

	const yDiv = coordsDiv.append('div').html('&nbsp;Y&nbsp;&nbsp;')
	const ytermDiv = yDiv
		.append('div')
		.attr('class', 'sja_filter_tag_btn add_term_btn')
		.text('+')
		.on('click', e => {
			getTreeTerm(ytermDiv, term => (yterm = term))
		})

	const submitbt = coordsDiv
		.append('div')
		.style('float', 'right')
		.style('padding', '5px')
		.insert('button')
		.text('Submit')
		.property('disabled', true)
		.on('click', () => {
			const config = {
				chartType: 'facet',
				term: { term: xterm },
				term2: { term: yterm }
			}
			if (isNumeric(xterm)) config.term.q = { mode: 'discrete' }
			if (isNumeric(yterm)) config.term2.q = { mode: 'discrete' }
			app.dispatch({
				type: 'plot_create',
				config
			})
			tip.hide()
		})

	function getTreeTerm(div, callback) {
		const state = { tree: { usecase: { target: 'facet' } } }
		//state.nav = {header_mode: 'hide_search'}
		const disable_terms = []
		if (xterm) disable_terms.push(xterm)
		if (yterm) disable_terms.push(yterm)
		showTermsTree(
			div,
			term => {
				callback(term)
				tip2.hide()
				div.selectAll('*').remove()
				div.text(term.name)
				if (xterm != null && yterm != null) submitbt.property('disabled', false)
			},
			app,
			tip,
			state,
			false,
			false,
			disable_terms
		)
	}
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
