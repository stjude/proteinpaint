import { getCompInit, copyMerge } from '#rx'
import { appInit } from '#plots/plot.app.js'
import { fillTermWrapper } from '#termsetting'

class Facet {
	constructor(opts) {
		this.type = 'facet'
		this.dom = {
			holder: opts.holder.style('padding', '20px'),
			header: opts.header
		}
		if (this.dom.header) this.dom.header.html('Facet')
	}

	async init(appState) {
		const holder = this.dom.holder
		let config = appState.plots.find(p => p.id === this.id)
		config = JSON.parse(JSON.stringify(config))
		const tbody = holder.append('table').style('border-spacing', '2px').append('tbody')

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
				const result = await this.app.vocabApi.getAnnotatedSampleData({
					terms: [config.term, config.term2],
					filter: this.getFilter(term, value, term2, value2)
				})
				tr.append('td').append('a').text(result.lst.length)
			}
		}
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
		console.log(filter)
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

	main() {}
}

export const facetInit = getCompInit(Facet)
// this alias will allow abstracted dynamic imports
export const componentInit = facetInit

export async function getPlotConfig(opts, app) {
	const config = {}
	await fillTermWrapper(opts.term, app.vocabApi)
	await fillTermWrapper(opts.term2, app.vocabApi)
	const result = copyMerge(config, opts)
	return result
}
