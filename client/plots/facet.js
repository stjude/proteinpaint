import { getCompInit, copyMerge } from '#rx'
import { fillTermWrapper } from '#termsetting'
import { controlsInit } from './controls'
import { select2Terms } from '#dom/select2Terms'
import { isNumericTerm } from '#shared/terms.js'
import { addNewGroup, getFilter, getSamplelstTW } from '../mass/groups'
// import { filterJoin, getFilterItemByTag } from '#filter'
import { Menu } from '#dom/menu'
import { getCombinedTermFilter } from '#filter'
import { PlotBase } from '#plots/PlotBase.js'
import { roundValueAuto } from '#shared/roundValue.js'

/*
state {
	columnTw {} // tw to determine columns -> historically .term{}
	rowTw {} // tw to determine rows -> historically .term2{}
}

facet table is always shown for secured or unsecured ds, as it does not reveal sample-level info
click on table cells allow to select corresponding samples, this is only allowed when hasVerifiedToken() is true
*/

class Facet extends PlotBase {
	constructor(opts) {
		super(opts)
		this.type = 'facet'
		const holder = opts.holder

		const controlsHolder = holder.append('div').style('display', 'inline-block')
		const mainDiv = holder.append('div').style('display', 'inline-block')

		this.dom = {
			holder: opts.holder.style('padding', '20px'),
			header: opts.header,
			controlsHolder,
			mainDiv,
			tip: opts.tip || new Menu()
		}
	}

	async init(appState) {
		await this.setControls()
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (this.dom.header)
			this.dom.header.html(
				`${config.columnTw.term.name} <span style="font-size:.8em">(COLUMN)</span> ${config.rowTw.term.name} <span style="font-size:.8em">(ROW) &nbsp; FACET TABLE</span>`
			)
		const parentConfig = this.parentId && appState.plots.find(p => p.id === this.parentId)
		const termfilter = getCombinedTermFilter(appState, config.filter || parentConfig?.filter)

		return {
			config,
			vocab: appState.vocab,
			termfilter,
			groups: appState.groups
		}
	}

	async main() {
		this.config = JSON.parse(JSON.stringify(this.state.config))
		await this.renderTable()
	}

	async renderTable() {
		const config = this.config
		this.dom.mainDiv.selectAll('*').remove()
		this.dom.tip.clear().hide()
		const table = this.dom.mainDiv.append('table')
		const tbody = table.append('tbody')
		const headerRow = tbody.append('tr').style('text-align', 'center')
		//blank space left for row labels
		headerRow.append('th')

		const samplesAuth = this.app.vocabApi.hasVerifiedToken()
		if (samplesAuth) {
			//overrides the default sja_root table style
			table.style('border-spacing', '0px')
			/** If samples level data available, render interative
			 * facet table. Clicking cells creates the list of samples
			 * and on submit launches the sample view plot
			 */
			const { result, categories, categories2 } = await this.getSampleTableData(config)
			if (!categories.length || !categories2.length) {
				//Show message if no overlapping samples
				this.showNoSampleMessage(this.dom.mainDiv)
				return
			}
			for (const category of categories) {
				const label = config.columnTw.term.values?.[category]?.label || category
				this.addHeader(headerRow, label)
			}
			this.renderSampleTable(tbody, config, result, categories, categories2)
		} else {
			table.style('border-spacing', '5px')
			/** If sample data is not available or not authorized for this user,
			 * render a static table with counts. No interactivity. */
			const { rows, filteredCols, total } = await this.getStaticTableData(config)
			if (!rows.size || !filteredCols.length) {
				this.showNoSampleMessage(this.dom.mainDiv)
				return
			}
			for (const col of filteredCols) {
				const label = config.columnTw.term.values?.[col.seriesId]?.label || col.seriesId
				this.addHeader(headerRow, label)
			}
			this.renderStaticTable(tbody, config, rows, filteredCols, total)
		}
	}

	renderSampleTable(tbody, config, result, categories, categories2) {
		const cells = {}
		for (const category2 of categories2) {
			cells[category2] = {}
			const tr = tbody.append('tr')
			const label2 = config.rowTw.term.values?.[category2]?.label || category2
			this.addRowLabel(tr, label2)
			for (const category of categories) {
				const samples = result.lst.filter(
					s => s[config.columnTw.$id]?.key == category && s[config.rowTw.$id]?.key == category2
				)
				const percent = roundValueAuto((samples.length / result.lst.length) * 100, true, 1)
				cells[category2][category] = { samples, selected: false }
				const td = tr.append('td')
				if (!samples.length) td.classed('highlightable-cell', true)
				if (samples.length > 0) {
					const colIdx = categories.indexOf(category) + 2
					td.classed('sja_menuoption', true)
						.style('text-align', 'center')
						.style('border', '2.5px solid white')
						.text(`${samples.length} (${percent}%)`)
						.on('mouseover', () => {
							this.highlightColRow(tbody, tr, colIdx, '#fffec8')
						})
						.on('mouseout', () => {
							this.highlightColRow(tbody, tr, colIdx, 'transparent')
						})
						.on('click', () => {
							const selected = (cells[category2][category].selected = !cells[category2][category].selected)
							if (selected) {
								td.style('border', '1px solid blue')
							} else {
								td.style('border', '2.5px solid white')
							}

							for (const category2 of categories2) {
								for (const category of categories) {
									if (cells[category2][category].selected) {
										buttonDiv.style('display', '')
										prompt.text('Choose how to use samples:')
										return
									}
								}
							}
							buttonDiv.style('display', 'none')
							prompt.text('Click on cells to select samples')
						})
				}
			}
		}
		const prompt = this.dom.mainDiv
			.append('div')
			.attr('data-testid', 'sjpp-facet-start-prompt')
			.style('margin', '20px 0px 0px 15px')
			.style('opacity', '0.7')
			.text('Click on cells to select samples')
		const buttonDiv = this.dom.mainDiv.append('div').style('margin', '20px 0px 0px 25px').style('display', 'none')
		const btns = [
			{
				text: 'Show samples view',
				// disabled: () => {}, add this if needed later
				callback: () => {
					const samples = this.getSelectedSamples(categories, categories2, cells)
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
				}
			},
			{
				text: 'List samples',
				callback: () => {
					const samples = this.getSelectedSamples(categories, categories2, cells)
					const sampleRows = samples.map(d => [
						result.refs.bySampleId[d.sample].label,
						d[config.columnTw.$id].key,
						d[config.rowTw.$id].key
					])
					this.dom.tip.clear().showunder(buttonDiv.node())
					// this.dom.tip.d.append('div').style('padding', '0px 5px 5px 5px').text('Selected samples:')
					const tbody = this.dom.tip.d.append('table').append('tbody')
					const headerRow = tbody.append('tr').style('text-align', 'center')
					headerRow.append('th').text('Sample')
					headerRow.append('th').text(config.columnTw.term.name)
					headerRow.append('th').text(config.rowTw.term.name)
					for (const row of sampleRows) {
						const tr = tbody.append('tr')
						tr.append('td').text(row[0])
						tr.append('td').text(row[1])
						tr.append('td').text(row[2])
					}
				}
			},
			{
				text: 'Create group',
				callback: () => {
					this.addGroup(categories, categories2, cells)
				}
			}
			// {
			// 	text: 'Add group and filter',
			// 	callback: () => {
			// 		const groupFilter = this.addGroup(categories, categories2, cells)
			// 		const filterUiRoot = getFilterItemByTag(this.state.termfilter.filter, 'filterUiRoot')
			// 		const filter = filterJoin([filterUiRoot, groupFilter])
			// 		filter.tag = 'filterUiRoot'
			// 		this.app.dispatch({
			// 			type: 'filter_replace',
			// 			filter
			// 		})
			// 	}
			// }
		]

		for (const btn of btns) {
			this.addBtn(buttonDiv, btn)
		}
	}

	highlightColRow = (tbody, tr, colIdx, color) => {
		tbody
			.selectAll(`td.highlightable-cell:nth-child(${colIdx})`)
			.style('background-color', `${color}`)
			.style('border', `2.5px solid ${color}`)
		tbody
			.select(`th:nth-child(${colIdx})`)
			.style('background-color', `${color}`)
			.style('border', `2.5px solid ${color}`)
		tr.style('background-color', `${color}`)
	}

	addBtn(div, btn) {
		return div
			.append('button')
			.classed('sja_menuoption', true)
			.style('padding', '0px 10px')
			.style('margin', '0px 5px')
			.text(btn.text)
			.on('click', btn.callback)
	}

	addGroup(categories, categories2, cells) {
		const group = {
			name: 'Group',
			items: this.getSelectedSamples(categories, categories2, cells)
		}
		const filter = getFilter(getSamplelstTW([group]))
		addNewGroup(this.app, filter, this.state.groups)
		return filter
	}

	getSelectedSamples(categories, categories2, cells) {
		const samples = []
		for (const category2 of categories2) {
			for (const category of categories) {
				if (cells[category2][category].selected) {
					samples.push(...cells[category2][category].samples)
				}
			}
		}
		return samples
	}

	async getSampleTableData(config) {
		const result = await this.app.vocabApi.getAnnotatedSampleData({
			filter: this.state.termfilter.filter,
			terms: [config.columnTw, config.rowTw]
		})
		const categories = this.getCategories(config.columnTw, result.lst)
		const categories2 = this.getCategories(config.rowTw, result.lst)
		return { result, categories, categories2 }
	}

	getCategories(tw, data) {
		let categories = []
		for (const sample of data) {
			let key = sample[tw.$id]?.key
			if (key) {
				if (!isNaN(key)) key = Number(key)
				categories.push(key)
			}
		}
		const set = new Set(categories)
		categories = Array.from(set).sort()

		if (isNumericTerm(tw.term)) {
			Object.values(tw.term.values).forEach(i => {
				if (i?.uncomputable) {
					const index = categories.indexOf(i.label)
					if (index > -1) categories.splice(index, 1)
				}
			})
			categories = this.orderColNames(categories)
		}
		return categories
	}

	orderColNames(cols) {
		//Show ranges first, then strings
		const tmpNums = []
		const tmpStrings = []
		for (const col of cols) {
			const c = col.split(' to ')
			const cx = c[0].replace(/[\>\≥\<\≤]/g, '')
			const x = Number(cx)
			if (!isNaN(x)) {
				const key =
					!c[1] && (col.includes('<') || col.includes('≤'))
						? x - 1
						: !c[1] && (col.includes('≥') || col.includes('>'))
						? x + 1
						: x
				tmpNums.push({ key, label: col })
			} else tmpStrings.push(cx)
		}
		return [...tmpNums.sort((a, b) => a.key - b.key).map(i => i.label), ...tmpStrings.sort()]
	}

	renderStaticTable(tbody, config, rows, filteredCols, totalSamples) {
		for (const row of rows) {
			const tr = tbody.append('tr')
			const label = config.rowTw.term.values?.[row[0]]?.label || row[0]
			this.addRowLabel(tr, label)
			for (const col of row[1]) {
				const label = col[1].value > 0 ? col[1].value : ''
				if (!label) continue
				const percent = roundValueAuto((col[1].value / totalSamples) * 100, true, 1)
				tr.append('td')
					.style('background-color', '#FAFAFA')
					.style('text-align', 'center')
					.text(`${label} (${percent}%)`)
			}
		}
	}

	async getStaticTableData(config) {
		//*** Do show uncomputeable values when table is static

		// config.settings = {
		// 	exclude: {
		// 		cols: Object.keys(config.term.q?.hiddenValues || {})
		// 			.filter(id => config.term.q.hiddenValues[id])
		// 			.map(id => {
		// 				return config.term.term.type == 'categorical'
		// 					? id
		// 					: config.settings.cols?.includes(id)
		// 					? id
		// 					: config.term.term.values[id]?.label
		// 					? config.term.term.values[id].label
		// 					: id
		// 			}),
		// 		rows: !config.term2?.q?.hiddenValues
		// 			? []
		// 			: Object.keys(config.term2.q.hiddenValues)
		// 					.filter(id => config.term2.q.hiddenValues[id])
		// 					.map(id =>
		// 						config.term2.term.type == 'categorical'
		// 							? id
		// 							: config.settings.rows?.includes(id)
		// 							? id
		// 							: config.term2.term.values[id]?.label
		// 							? config.term2.term.values[id].label
		// 							: id
		// 					)
		// 	}
		// }

		const opts = { term: config.columnTw, term2: config.rowTw, filter: this.state.termfilter.filter }
		if (this.state.termfilter.filter0) opts.filter0 = this.state.termfilter.filter0

		//Need to get the totals
		await this.getDescrStats(opts.term)
		await this.getDescrStats(opts.term2)

		const result = await this.app.vocabApi.getNestedChartSeriesData(opts)
		const rows = new Map()

		//These columns and rows are in the correct ascending order
		//Set first and no need to sort later
		const filteredCols = result.data.refs.cols
			// .filter(col => !config.settings.exclude.cols.some(i => i == col.seriesId))
			.map(col => result.data.charts[0].serieses.find(s => s.seriesId == col))
		result.data.refs.rows
			// .filter(row => !config.settings.exclude.rows.some(i => i == row))
			.forEach(row => {
				rows.set(row, new Map())
				for (const col of filteredCols) {
					rows.get(row).set(col.seriesId, { value: col.data.find(d => d.dataId == row)?.total || 0, selected: false })
				}
			})

		return { rows, filteredCols, total: result.data.charts[0].total }
	}

	async getDescrStats(tw) {
		if (isNumericTerm(tw.term)) {
			const data = await this.app.vocabApi.getDescrStats(tw, this.state.termfilter)
			if (data.error) throw data.error
			tw.q.descrStats = data.values
		}
	}

	showNoSampleMessage(div) {
		div.append('div').style('padding', '0px 50px').style('font-size', '1.15em').text('No overlapping samples')
		return
	}

	addHeader(headerRow, text) {
		headerRow
			.append('th')
			.attr('data-testid', 'sjpp-facet-col-header')
			.style('border', '2.5px solid white')
			.style('padding', '0px 25px')
			.text(text)
	}

	addRowLabel(tr, label) {
		tr.append('td')
			.attr('data-testid', 'sjpp-facet-row-label')
			.style('border', '2.5px solid white')
			.style('font-weight', 'bold')
			.text(label)
	}

	async setControls() {
		const inputs = [
			{
				type: 'term',
				configKey: 'columnTw',
				chartType: this.type,
				usecase: { target: this.type },
				title: 'Facet column categories',
				label: 'Columns',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: ['discrete']
			},
			{
				type: 'term',
				configKey: 'rowTw',
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
			columnTw: { term: xterm },
			rowTw: { term: yterm }
		}

		if (isNumericTerm(xterm)) config.columnTw.term.q = { mode: 'discrete' }
		if (isNumericTerm(yterm)) config.rowTw.term.q = { mode: 'discrete' }

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
	if (!opts.columnTw) throw '.columnTw{} missing'
	await fillTermWrapper(opts.columnTw, app.vocabApi)
	if (!opts.rowTw) throw '.rowTw{} missing'
	await fillTermWrapper(opts.rowTw, app.vocabApi)
	const result = copyMerge(config, opts)
	return result
}
