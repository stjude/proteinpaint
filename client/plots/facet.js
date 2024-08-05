import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'
import { controlsInit } from './controls'
import { select2Terms } from '#dom/select2Terms'
import { isNumericTerm } from '../shared/terms'

/*
state {
	term {} // tw to determine columns
	term2 {} // tw to determine rows
}

facet table is always shown for secured or unsecured ds, as it does not reveal sample-level info
click on table cells allow to select corresponding samples, this is only allowed when hasVerifiedToken() is true
*/

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
	}

	async init(appState) {
		await this.setControls()
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (this.dom.header)
			this.dom.header.html(
				`${config.term.term.name} <span style="font-size:.8em">(COLUMN)</span> ${config.term2.term.name} <span style="font-size:.8em">(ROW) &nbsp; FACET TABLE</span>`
			)

		return {
			config,
			vocab: appState.vocab,
			termfilter: appState.termfilter
		}
	}

	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		await this.renderTable()
	}

	async renderTable() {
		const config = this.config
		this.dom.mainDiv.selectAll('*').remove()
		const tbody = this.dom.mainDiv.append('table').style('border-spacing', '5px').append('tbody')
		const headerRow = tbody.append('tr').style('text-align', 'center')
		//blank space left for row labels
		headerRow.append('th')

		const samplesAuth = this.app.vocabApi.hasVerifiedToken()
		if (samplesAuth) {
			/** If samples level data available, render interative
			 * facet table. Clicking cells creates the list of samples
			 * and on submit launches the sample view plot
			 */
			const { result, categories, categories2 } = await this.getSampleTableData(config)
			for (const category of categories) {
				const label = config.term.term.values?.[category]?.label || category
				this.addHeader(headerRow, label)
			}
			this.renderSampleTable(tbody, config, result, categories, categories2)
		} else {
			/** If sample data is not available or not authorized for this user,
			 * render a static table with counts. No interactivity. */
			const { rows, filteredCols } = await this.getStaticTableData(config)
			for (const col of filteredCols) {
				const label = config.term.term.values?.[col.seriesId]?.label || col.seriesId
				this.addHeader(headerRow, label)
			}
			this.renderStaticTable(tbody, config, rows, filteredCols)
		}
	}

	renderSampleTable(tbody, config, result, categories, categories2) {
		const cells = {}
		for (const category2 of categories2) {
			cells[category2] = {}
			const tr = tbody.append('tr')
			const label = config.term2.term.values?.[category2]?.label || category2
			this.addRowLabel(tr, label)
			for (const category of categories) {
				const samples = result.lst.filter(
					s => s[config.term.$id]?.key == category && s[config.term2.$id]?.key == category2
				)
				cells[category2][category] = { samples, selected: false }
				const label = samples.length > 0 ? samples.length : ''
				const td = this.addCellCount(tr, label)
				if (samples.length > 0) {
					td.on('click', () => {
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

	async getSampleTableData(config) {
		const result = await this.app.vocabApi.getAnnotatedSampleData({
			terms: [config.term, config.term2]
		})
		const categories = this.getCategories(config.term, result.lst)

		const categories2 = this.getCategories(config.term2, result.lst)

		return { result, categories, categories2 }
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

	renderStaticTable(tbody, config, rows) {
		for (const row of rows) {
			const tr = tbody.append('tr')
			const label = config.term2.term.values?.[row[0]].label || row[0]
			this.addRowLabel(tr, label)
			for (const col of row[1]) {
				const label = col[1].value > 0 ? col[1].value : ''
				this.addCellCount(tr, label)
			}
		}
	}

	async getStaticTableData(config) {
		config.settings = {
			exclude: {
				cols: Object.keys(config.term.q?.hiddenValues || {})
					.filter(id => config.term.q.hiddenValues[id])
					.map(id => {
						return config.term.term.type == 'categorical'
							? id
							: config.settings.cols?.includes(id)
							? id
							: config.term.term.values[id]?.label
							? config.term.term.values[id].label
							: id
					}),
				rows: !config.term2?.q?.hiddenValues
					? []
					: Object.keys(config.term2.q.hiddenValues)
							.filter(id => config.term2.q.hiddenValues[id])
							.map(id =>
								config.term2.term.type == 'categorical'
									? id
									: config.settings.rows?.includes(id)
									? id
									: config.term2.term.values[id]?.label
									? config.term2.term.values[id].label
									: id
							)
			}
		}

		const opts = { term: config.term, filter: this.state.termfilter.filter }
		if (this.state.termfilter.filter0) opts.filter0 = this.state.termfilter.filter0

		//Need to get the totals
		await this.getDescrStats(opts.term)

		if (config.term2) {
			opts.term2 = config.term2
			await this.getDescrStats(opts.term2)
		}

		const result = await this.app.vocabApi.getNestedChartSeriesData(opts)
		const rows = new Map()
		const filteredCols = result.data.charts[0].serieses.filter(
			col => !config.settings.exclude.cols.some(i => i == col.seriesId)
		)
		//These rows are in the correct ascending order
		//Set first and no need to sort later
		result.data.refs.rows
			.filter(row => !config.settings.exclude.rows.some(i => i == row))
			.forEach(row => {
				rows.set(row, new Map())
				for (const col of filteredCols) {
					rows.get(row).set(col.seriesId, { value: col.data.find(d => d.dataId == row)?.total || 0, selected: false })
				}
			})

		return { rows, filteredCols }
	}

	async getDescrStats(term) {
		if (isNumericTerm(term.term)) {
			const data = await this.app.vocabApi.getDescrStats(term, this.state.termfilter)
			if (data.error) throw data.error
			term.q.descrStats = data.values
		}
	}

	addHeader(headerRow, text) {
		headerRow
			.append('th')
			.attr('data-testid', 'sjpp-facet-col-header')
			.style('text-align', 'left')
			.style('background-color', '#FAFAFA')
			.style('padding-right', '50px')
			.text(text)
	}

	addRowLabel(tr, label) {
		tr.append('td')
			.attr('data-testid', 'sjpp-facet-row-label')
			.style('background-color', '#FAFAFA')
			.style('font-weight', 'bold')
			.text(label)
	}

	addCellCount(tr, label) {
		return tr.append('td').style('background-color', '#FAFAFA').style('text-align', 'center').text(label)
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
	if (!opts.term) throw '.term{} missing'
	await fillTermWrapper(opts.term, app.vocabApi)
	if (!opts.term2) throw '.term2{} missing'
	await fillTermWrapper(opts.term2, app.vocabApi)
	const result = copyMerge(config, opts)
	return result
}
