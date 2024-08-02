import { getCompInit, copyMerge } from '#rx'
// import { appInit } from '#plots/plot.app.js'
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

	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		await this.renderTable()
	}

	async renderTable() {
		const config = this.config
		this.dom.mainDiv.selectAll('*').remove()
		const samplesAuth = this.app.vocabApi.hasVerifiedToken()

		const tbody = this.dom.mainDiv.append('table').style('border-spacing', '5px').append('tbody')

		const headerRow = tbody.append('tr').style('text-align', 'center')
		//blank space left for row labels
		headerRow.append('th')

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

		for (const col of filteredCols) {
			headerRow
				.append('th')
				.style('text-align', 'left')
				.style('background-color', '#FAFAFA')
				.style('padding-right', '50px')
				.attr('data-testid', 'sjpp-facet-col-header')
				.text(col.seriesId)
		}

		for (const row of rows) {
			const tr = tbody.append('tr')
			tr.append('td')
				.style('background-color', '#FAFAFA')
				.style('font-weight', 'bold')
				.text(row[0])
				.attr('data-testid', 'sjpp-facet-row-label')
			for (const col of row[1]) {
				const cell = tr
					.append('td')
					.style('background-color', '#FAFAFA')
					.style('text-align', 'center')
					.text(col[1].value > 0 ? col[1].value : '')
				if (col[1].value > 0) {
					cell.on('click', () => {
						const selected = (col[1].selected = !col[1].selected)
						if (selected) {
							cell.style('border', '1px solid blue')
						} else {
							cell.style('border', 'none')
						}
						for (const row of rows) {
							for (const col of row[1]) {
								if (col[1].selected && samplesAuth) {
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
		const showSamplesBt = buttonDiv.append('button').property('disabled', true)

		if (samplesAuth) {
			showSamplesBt.text('Show samples').on('click', async () => {
				const samples = []
				const sampleList = await this.app.vocabApi.getAnnotatedSampleData({
					filter: config.filter,
					terms: [config.term, config.term2]
				})
				for (const row of rows) {
					for (const col of row[1]) {
						if (col[1].selected) {
							const foundSamples = sampleList.lst
								.filter(s => s[config.term.$id].key == col[0] && s[config.term2.$id].key == row[0])
								.map(s => {
									return { sampleId: s.sample, sampleName: s._ref_.label }
								})
							samples.push(...foundSamples)
						}
					}
				}
				this.app.dispatch({
					type: 'plot_create',
					config: {
						chartType: 'sampleView',
						samples
					}
				})
			})
		} else {
			showSamplesBt.text('Not available')
		}
	}

	async getDescrStats(term) {
		if (isNumericTerm(term.term)) {
			const data = await this.app.vocabApi.getDescrStats(term, this.state.termfilter)
			if (data.error) throw data.error
			term.q.descrStats = data.values
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
