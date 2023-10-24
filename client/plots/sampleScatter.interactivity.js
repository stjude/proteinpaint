import { filterJoin, getFilterItemByTag } from '#filter'
import { renderTable } from '#dom/table'
import { mclass, morigin, dt2label } from '#shared/common'
import { Menu } from '#dom/menu'
import { rgb } from 'd3-color'
import { getSamplelstTW, getFilter } from '../termsetting/handlers/samplelst.ts'
import { addPlotMenuItem, showTermsTree, addMatrixMenuItems, openSummaryPlot, tip2 } from '../mass/groups'
import { newSandboxDiv } from '#dom/sandbox'
import { getId } from '#mass/nav'

export function setInteractivity(self) {
	self.mouseover = function (event, chart) {
		if (event.target.tagName == 'path' && event.target.getAttribute('name') == 'serie') {
			const s2 = event.target.__data__
			const displaySample = 'sample' in s2
			const shrink = self.opts.parent?.type == 'summary' && !displaySample
			const include = shrink ? dist => dist > 0 && dist < 0.2 : dist => dist < 0.2
			const overlapSamples = []
			const samples = chart.data.samples.filter(s => {
				const dist = distance(s.x, s.y, s2.x, s2.y)
				if (dist == 0) overlapSamples.push(s)
				return self.getOpacity(s) > 0 && include(dist)
			})
			if (shrink)
				//filtered out s2, dist = 0
				samples.push(s2)
			if (samples.length == 0) return
			samples.sort((a, b) => {
				if (a.category < b.category) return -1
				if (a.category > b.category) return 1
				return 0
			})

			self.dom.tooltip.clear()
			if (shrink)
				self.dom.tooltip.d
					.append('div')
					.html(` ${overlapSamples.length} ${overlapSamples.length == 1 ? 'sample' : 'samples'}`)
			const table = self.dom.tooltip.d.append('table').style('width', '100%')

			for (const [i, d] of samples.entries()) {
				if (i > 5) break
				if (!('sampleId' in d) && (!self.settings.showRef || self.settings.refSize == 0)) continue
				const row = table.append('tr').style('padding-top', '2px')
				if (displaySample) {
					if (d.sample == s2.sample) {
						let title = ''
						for (const os of overlapSamples) title += os.sample + ' '
						row.append('td').style('color', '#aaa').html(`Sample`)
						row.append('td').html(`${title}`)
					} else {
						row.append('td').style('color', '#aaa').html(`Sample`)
						row.append('td').html(d.sample)
					}
				}

				if (self.config.colorTW) addCategoryInfo(self.config.colorTW?.term, 'category', d, table, true, true)
				if (self.config.shapeTW) addCategoryInfo(self.config.shapeTW.term, 'shape', d, table, false, true)
				if (self.config.term) addCategoryInfo(self.config.term.term, 'x', d, table)
				if (self.config.term2) addCategoryInfo(self.config.term2?.term, 'y', d, table)
				if (self.config.scaleDotTW) addCategoryInfo(self.config.scaleDotTW?.term, 'scale', d, table)

				if ('info' in d)
					for (const [k, v] of Object.entries(d.info)) {
						const row = table.append('tr')
						row.append('td').style('color', '#aaa').text(k)
						row.append('td').text(v)
					}
			}
			if (samples.length > 5) self.dom.tooltip.d.append('div').html(`<b>...(${samples.length - 5} more)</b>`)

			self.dom.tooltip.show(event.clientX, event.clientY, true, true)
		} else self.dom.tooltip.hide()

		function addCategoryInfo(term, category, d, table, showColor = false, showShape = false) {
			if (!term) return
			if (d[category] == 'Ref') return
			let row = table.append('tr')
			const ctd = row.append('td').style('color', '#aaa').html(`Sample`).text(term.name)

			if ('cat_info' in d && d.cat_info[category]) {
				const mutations = d.cat_info[category]
				ctd.attr('rowspan', mutations.length + 1)
				// row.append('td').text('Mutation')
				for (const mutation of mutations) {
					const dt = mutation.dt
					row = table.append('tr')
					const class_info = mclass[mutation.class]
					const clabel = 'mname' in mutation ? `${mutation.mname} ${class_info.label}` : class_info.label
					const tdclass = row.append('td').text(clabel).style('color', '#aaa')
					if (mutation.class != 'Blank') tdclass.style('color', class_info.color)
					else tdclass.style('color', mclass['WT'].color)
					const origin = morigin[mutation.origin]?.label
					const dtlabel = origin ? `${origin} ${dt2label[dt]}` : dt2label[dt]
					row.append('td').text(dtlabel)
				}
			} else {
				let value = d[category]
				if (typeof value == 'number' && value % 1 != 0) value = value.toFixed(2)
				const td = row.append('td')
				if (showShape) {
					const color = showColor ? self.getColor(d, chart) : self.config.colorTW ? 'gray' : self.settings.defaultColor
					const shape = showColor ? self.getShape(chart, d, 1, true) : self.getShape(chart, d)
					const width = value.length * 9 + 60
					const svg = td.append('svg').attr('width', width).attr('height', '35px')
					const g = svg.append('g').attr('transform', 'translate(10, 18)')
					g.append('path').attr('d', shape).attr('fill', color)
					g.append('text').attr('x', 18).attr('y', 6).text(value)
				} else td.append('span').text(value)
			}
		}
	}

	self.mouseclick = function (event) {
		if (!self.lassoOn) self.dom.tip.hide()
		tip2.hide()
		const target = event.target
		const sample = target.__data__

		sample.sample_id = sample.sample
		const drawMethylationArrayPlot =
			self.state.termdbConfig.queries?.singleSampleGenomeQuantification &&
			target.tagName == 'path' &&
			target.getAttribute('name') == 'serie'
		const drawDiscoPlot =
			self.state.termdbConfig.queries?.singleSampleMutation &&
			target.tagName == 'path' &&
			target.getAttribute('name') == 'serie'
		self.dom.tooltip.hide()
		self.dom.tip.clear()
		let show = false
		if ('sample' in sample) {
			self.dom.tip.d.append('div').style('padding', '4px').html(`<b>&nbsp;${sample.sample}</b>`)

			self.dom.tip.d
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Show sample')
				.on('click', async event => {
					self.app.dispatch({
						type: 'plot_create',
						id: getId(),
						config: {
							chartType: 'sampleView',
							sample: { sampleId: sample.sampleId, sampleName: sample.sample }
						}
					})
					self.dom.tip.hide()
				})
			show = true
		}
		if (drawMethylationArrayPlot || drawDiscoPlot) {
			if (drawMethylationArrayPlot) {
				for (const k in self.state.termdbConfig.queries.singleSampleGenomeQuantification) {
					const label = k.match(/[A-Z][a-z]+|[0-9]+/g).join(' ')
					const menuDiv = self.dom.tip.d
						.append('div')
						.attr('class', 'sja_menuoption sja_sharp_border')
						.text(label)
						.on('click', async event => {
							const sandbox = newSandboxDiv(self.opts.plotDiv)
							sandbox.header.text(sample.sample_id)
							const ssgqImport = await import('./plot.ssgq.js')
							await ssgqImport.plotSingleSampleGenomeQuantification(
								self.state.termdbConfig,
								self.state.vocab.dslabel,
								k,
								sample,
								sandbox.body.append('div').style('margin', '20px'),
								self.app.opts.genome
							)
							self.dom.tip.hide()
						})
				}
			}
			if (drawDiscoPlot) {
				const menuDiv = self.dom.tip.d
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text('Disco plot')
					.on('click', async event => {
						const sandbox = newSandboxDiv(self.opts.plotDiv)
						sandbox.header.text(sample.sample_id)
						const discoPlotImport = await import('./plot.disco.js')
						discoPlotImport.default(
							self.state.termdbConfig,
							self.state.vocab.dslabel,
							sample,
							sandbox.body,
							self.app.opts.genome
						)

						self.dom.tip.hide()
					})
			}
			show = true
		}
		if (show) self.dom.tip.show(event.clientX, event.clientY, true, true)
	}

	self.onLegendClick = function (chart, legendG, name, key, e, category) {
		const tw = self.config[name]
		const hidden = tw.q.hiddenValues ? key in tw.q.hiddenValues : false
		const menu = new Menu({ padding: '0px' })
		const div = menu.d.append('div')
		div
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(hidden ? 'Show' : 'Hide')
			.on('click', () => {
				self.hideCategory(legendG, tw, key, !hidden)
				menu.hide()
				const config = {}
				config[name] = tw
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config
				})
			})
		div
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Show only')
			.on('click', () => {
				const map = name == 'colorTW' ? chart.colorLegend : chart.shapeLegend
				for (const mapKey of map.keys())
					self.hideCategory(
						legendG,
						tw,
						mapKey,
						tw.term.type == 'geneVariant' ? !mapKey.startsWith(key) : mapKey != key
					)

				menu.hide()
				const config = {}
				config[name] = tw
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config
				})
			})
		div
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Show all')
			.on('click', () => {
				menu.hide()
				const map = name == 'colorTW' ? chart.colorLegend : chart.shapeLegend
				for (const mapKey of map.keys()) self.hideCategory(legendG, tw, mapKey, false)
				const config = {}
				config[name] = tw
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config
				})
			})
		if (category.color) {
			const color = rgb(category.color).formatHex()
			const input = div
				.append('div')
				.attr('class', 'sja_sharp_border')
				.style('padding', '0px 10px')
				.text('Color:')
				.append('input')
				.attr('type', 'color')
				.attr('value', color)
				.on('change', () => {
					self.changeColor(key, input.node().value)
					menu.hide()
				})
		}
		menu.showunder(e.target)
	}

	self.hideCategory = function (legendG, tw, key, hide) {
		if (key == 'Ref') {
			self.settings.showRef = !hide
			self.app.dispatch({
				type: 'plot_edit',
				id: self.id,
				config: {
					settings: { sampleScatter: self.settings }
				}
			})
		}
		if (!tw.q.hiddenValues) tw.q.hiddenValues = {}
		const value = tw.term.type != 'geneVariant' && tw.term.values[key] ? tw.term.values[key] : { key: key, label: key }
		const items = legendG.selectAll(`text[name="sjpp-scatter-legend-label"]`).nodes()
		const itemG = items.find(item => key.startsWith(item.innerHTML))?.parentElement

		if (itemG) itemG.style['text-decoration'] = hide ? 'line-through' : 'none'
		if (!hide) delete tw.q.hiddenValues[key]
		else tw.q.hiddenValues[key] = value
	}

	self.changeColor = async function (key, color) {
		const tw = self.config.colorTW
		if (tw.term.type != 'geneVariant' && tw.term.values[key]) tw.term.values[key].color = color
		else {
			if (!tw.term.values) tw.term.values = {}
			tw.term.values[key] = { key: key, label: key, color }
		}
		await self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: { colorTW: tw }
		})
	}

	self.searchSample = function (e) {
		const menu = new Menu({ padding: '3px' })
		let group
		const input = menu.d.append('input').on('keyup', event => {
			if (event.code == 'Escape') {
				if (group) {
					self.config.groups.splice(group.index, 1)
					self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })
				}
				menu.hide()
				return
			}
			if (event.code == 'Enter' && group) {
				//Enter
				if (group.items.length == 0) msgDiv.text('Invalid group')
				else {
					const group = self.config.groups[self.config.groups.length - 1]
					self.config.groups.splice(group.index, 1) //was added temporarily
					self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })

					group.fromSearch = false
					group.showOnly = false
					self.addGroup(group)
					const tw = getSamplelstTW([group])
					self.addToFilter(tw)

					menu.hide()
				}
				return
			}
			// ok to not await here, since no returned value is required
			// and menu.hide() does not need to wait for the dispatch to finish
			const value = input.node().value.toUpperCase()
			const items = []
			for (const chart of self.charts)
				for (const sample of chart.cohortSamples) {
					if (
						sample.sample.toUpperCase().includes(value) ||
						sample.category?.toUpperCase().includes(value) ||
						sample.shape?.toUpperCase().includes(value)
					)
						items.push(sample)
				}
			if (items.length == 0) {
				msgDiv.text('No samples found')
			} else msgDiv.text('')
			if (self.config.groups.length > 0 && self.config.groups[self.config.groups.length - 1].fromSearch) {
				group = self.config.groups[self.config.groups.length - 1]
				group.items = items
			} else {
				group = {
					name: `Group ${self.config.groups.length + 1}`,
					items,
					index: self.config.groups.length,
					showOnly: true,
					fromSearch: true
				}
				self.config.groups.push(group)
			}
			self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })
		})

		const msgDiv = menu.d.append('div').style('padding-left', '5px')
		menu.show(e.clientX, e.clientY, false)
	}

	self.getCategoryInfo = function (d, category) {
		if (!(category in d)) return ''
		return d[category]
	}

	self.addToFilter = function (samplelstTW) {
		const filterUiRoot = getFilterItemByTag(self.state.termfilter.filter, 'filterUiRoot')
		const filter = filterJoin([filterUiRoot, getFilter(samplelstTW)])
		filter.tag = 'filterUiRoot'
		self.app.dispatch({
			type: 'filter_replace',
			filter
		})
	}

	self.showTable = function (group, x, y, addGroup) {
		let rows = []
		const columns = []
		const first = group.items[0]
		if ('sample' in first) columns.push(formatCell('Sample', 'label'))
		if (self.config.colorTW) columns.push(formatCell(self.config.colorTW.term.name, 'label'))

		if (self.config.shapeTW) columns.push(formatCell(self.config.shapeTW.term.name, 'label'))
		let info = false
		for (const item of group.items) {
			const row = []
			if ('sample' in item) row.push(formatCell(item.sample))
			if (self.config.colorTW) row.push(formatCell(self.getCategoryInfo(item, 'category')))
			if (self.config.shapeTW) row.push(formatCell(self.getCategoryInfo(item, 'shape')))
			if ('info' in item) {
				info = true
				const values = []
				for (const [k, v] of Object.entries(item.info)) values.push(`${k}: ${v}`)
				row.push(formatCell(values.join(', ')))
			}
			rows.push(row)
		}
		if (info) columns.push(formatCell('Info', 'label'))

		self.dom.tip.clear()
		const div = self.dom.tip.d.append('div').style('padding', '5px')
		const headerDiv = div.append('div').style('margin-top', '5px')

		const groupDiv = headerDiv
			.append('div')
			.html('&nbsp;' + group.name)
			.style('font-size', '0.9rem')
			.on('click', () => {
				const isEdit = groupDiv.select('input').empty()
				if (!isEdit) return
				groupDiv.html('')
				const input = groupDiv
					.append('input')
					.attr('value', group.name)
					.on('change', async () => {
						const name = input.node().value
						if (name) self.renameGroup(group, name)
						else input.node().value = group.name
						groupDiv.html('&nbsp;' + group.name)
					})
				input.node().focus()
				input.node().select()
			})
		const tableDiv = div.append('div')
		const buttons = []
		if (addGroup) {
			const addGroupCallback = {
				text: 'Add to a group',
				callback: indexes => {
					const items = []
					for (const i of indexes) items.push(self.selectedItems[i].__data__)
					const group = {
						name: `Group ${self.config.groups.length + 1}`,
						items,
						index: self.config.groups.length
					}
					self.addGroup(group)
				}
			}
			buttons.push(addGroupCallback)
		} else {
			const deleteSamples = {
				text: 'Delete samples',
				callback: indexes => {
					group.items = group.items.filter((elem, index, array) => !(index in indexes))
					self.showTable(group, x, y, addGroup)
				}
			}
			buttons.push(deleteSamples)
		}
		renderTable({
			rows,
			columns,
			div: tableDiv,
			showLines: true,
			maxWidth: columns.length * '15' + 'vw',
			maxHeight: '35vh',
			buttons,
			selectAll: true
		})

		self.dom.tip.show(x, y, false, false)
		function formatCell(column, name = 'value') {
			let dict = {}
			dict[name] = column
			return dict
		}
	}

	self.showGroupMenu = function (event, group) {
		self.dom.tip.clear()
		self.dom.tip.show(event.clientX, event.clientY, false, true)
		const menuDiv = self.dom.tip.d.append('div')
		const plot_name = self.config.name ? self.config.name : 'Summary scatter'
		const tw = getSamplelstTW([group], plot_name + ' groups')
		const groupDiv = menuDiv
			.append('div')
			.attr('name', 'sjpp-group-input-div')
			.html('&nbsp;' + group.name)
			.style('font-size', '0.9rem')
			.on('click', () => {
				const isEdit = groupDiv.select('input').empty()
				if (!isEdit) return
				groupDiv.html('')
				const input = groupDiv
					.append('input')
					.attr('value', group.name)
					.on('change', async () => {
						const name = input.node().value
						if (name) self.renameGroup(group, name)
						else input.node().value = group.name
						groupDiv.html('&nbsp;' + group.name)
					})
				input.node().focus()
				input.node().select()
			})
		const listDiv = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(`Edit ${group.items.length} samples`)
			.on('click', e => {
				self.dom.tip.hide()
				self.showTable(group, event.clientX, event.clientY, false)
			})
		self.addCommonMenuItems(menuDiv, tw)
		const deleteDiv = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(`Delete group`)
			.on('click', async e => {
				await self.app.vocabApi.deleteGroup(group.name)
				self.dom.tip.hide()
			})
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Add to filter')
			.on('click', () => {
				self.addToFilter(tw)
				self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })
			})
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(group.showOnly ? 'Show All' : 'Show Only')
			.on('click', () => {
				group.showOnly = !group.showOnly
				self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })
			})
	}

	self.renameGroup = async function (group, newName) {
		const i = self.config.groups.findIndex(group => group.name == newName)
		if (i != -1) alert(`Group named ${newName} already exists`)
		else
			await self.app.dispatch({
				type: 'rename_group',
				index: group.index,
				newName
			})
	}

	self.addCommonMenuItems = function (menuDiv, tw) {
		addMatrixMenuItems(self.dom.tip, menuDiv, tw, self.app, self.id, self.state)
		if (self.state.supportedChartTypes.includes('survival'))
			addPlotMenuItem('survival', menuDiv, 'Compare survival', self.dom.tip, tw, self.id, this)

		if (self.state.supportedChartTypes.includes('cuminc'))
			addPlotMenuItem('cuminc', menuDiv, 'Compare cumulative incidence', self.dom.tip, tw, self.id, this)

		const summarizeDiv = menuDiv.append('div').attr('class', 'sja_menuoption sja_sharp_border').html('Summarize')
		summarizeDiv.insert('div').html('›').style('float', 'right')

		summarizeDiv.on('click', async e => {
			showTermsTree(
				summarizeDiv,
				term => {
					openSummaryPlot(term, tw, self.app, self.id)
				},
				self.app,
				self.dom.tip
			)
		})
	}

	self.showGroupsMenu = function (event) {
		self.dom.tip.clear()
		self.dom.tip.show(event.clientX, event.clientY, false, true)
		const menuDiv = self.dom.tip.d.append('div')
		const plot_name = self.config.name ? self.config.name : 'Summary scatter'
		const tw = getSamplelstTW(self.config.groups, plot_name + ' groups')
		let row = menuDiv.append('div')

		for (const [i, group] of self.config.groups.entries()) {
			row = menuDiv.append('div').attr('class', 'sja_menuoption sja_sharp_border')
			row.insert('div').style('display', 'inline-block').text(` ${group.name}: ${group.items.length} `)

			row.append('div').style('display', 'inline-block').style('float', 'right').html('&nbsp;&nbsp;›')
			row.on('click', e => {
				self.dom.tip.clear().hide()
				self.showGroupMenu(event, group)
			})
		}
		self.addCommonMenuItems(menuDiv, tw)
		row = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Delete groups')
			.on('click', async event => {
				for (const group of self.config.groups) await self.app.vocabApi.deleteGroup(group.name)
				self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: [] } })
			})
	}
}

function distance(x1, y1, x2, y2) {
	const x = x2 - x1
	const y = y2 - y1
	const distance = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))
	return distance
}
