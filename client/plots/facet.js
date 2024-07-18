import { getCompInit, copyMerge } from '#rx'
import { appInit } from '#plots/plot.app.js'
import { fillTermWrapper } from '#termsetting'
import { controlsInit } from './controls'
import { Menu } from '#dom/menu'
import { showTermsTree } from '../mass/groups'

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

	getFilter(term, value, term2, value2) {
		const filter = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [
				{
					type: 'tvs',
					tvs: { term, values: [value] }
				},
				{
					type: 'tvs',
					tvs: { term: term2, values: [value2] }
				}
			]
		}
		return filter
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
		const tbody = this.dom.mainDiv.append('table').style('border-spacing', '2px').append('tbody')

		const tr = tbody.append('tr')
		tr.append('td')

		const term = config.term.term
		const term2 = config.term2.term
		for (const key in term.values) {
			const value = term.values[key]
			tr.append('td').text(value.label || value.key)
		}
		for (const key2 in term2.values) {
			const tr = tbody.append('tr')
			let value2 = term2.values[key2]
			value2.key = key2
			const category = value2.label || value2.key
			tr.append('td').text(category)
			for (const key in term.values) {
				let value = term.values[key]
				value.key = key
				const filter = this.getFilter(term, value, term2, value2)
				const result = await this.app.vocabApi.getAnnotatedSampleData({
					terms: [config.term, config.term2],
					filter
				})
				const samples = result.lst.map(d => ({
					sampleId: d.sample,
					sampleName: result.refs.bySampleId[d.sample].label
				}))
				const td = tr.append('td').style('background-color', '#FAFAFA')
				if (samples.length > 0)
					td.append('a')
						.text(result.lst.length)
						.on('click', () => {
							this.app.dispatch({
								type: 'plot_create',
								config: {
									chartType: 'sampleView',
									samples
								}
							})
						})
			}
		}
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
			app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'facet',
					term: { term: xterm, q: { mode: 'continuous' } },
					term2: { term: yterm, q: { mode: 'continuous' } }
				}
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
