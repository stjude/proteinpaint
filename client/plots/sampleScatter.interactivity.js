import { filterJoin, getFilterItemByTag } from '#filter'
import { renderTable } from '#dom/table'
import { dofetch3 } from '#common/dofetch'
import { mclass, morigin, dt2label } from '#shared/common'
import { Menu } from '#dom/menu'
import { rgb } from 'd3-color'
import { getSamplelstTW, openSurvivalPlot } from '#termsetting/handlers/samplelst'

export function setInteractivity(self) {
	self.mouseover = function(event, chart) {
		if (event.target.tagName == 'path' && event.target.__data__) {
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
					.html(`<b> ${overlapSamples.length} ${overlapSamples.length == 1 ? 'sample' : 'samples'}</b>`)

			for (const [i, d] of samples.entries()) {
				if (i > 5) break
				if (!('sampleId' in d) && (!self.settings.showRef || self.settings.refSize == 0)) continue
				const div = self.dom.tooltip.d.append('div').style('padding-top', '2px')
				const table = div.append('table').style('width', '100%')
				const row = table.append('tr')
				if (displaySample) {
					if (d.sample == s2.sample) {
						let title = ''
						for (const os of overlapSamples) title += os.sample + ' '
						row
							.append('td')
							.attr('colspan', 2)
							.html(`<b>${title}</b>`)
					} else
						row
							.append('td')
							.attr('colspan', 2)
							.html(`<b>${d.sample}</b>`)
				}

				if (self.config.colorTW) addCategoryInfo(self.config.colorTW?.term, 'category', d, table)
				if (self.config.shapeTW) addCategoryInfo(self.config.shapeTW.term, 'shape', d, table)
				if (self.config.term) addCategoryInfo(self.config.term.term, 'x', d, table)
				if (self.config.term2) addCategoryInfo(self.config.term2?.term, 'y', d, table)

				if ('info' in d)
					for (const [k, v] of Object.entries(d.info)) {
						const row = table.append('tr')
						row.append('td').text(k)
						row.append('td').text(v)
					}
			}
			if (samples.length > 5) self.dom.tooltip.d.append('div').html(`<b>...(${samples.length - 5} more)</b>`)

			self.dom.tooltip.show(event.clientX, event.clientY, true, false)
		} else self.dom.tooltip.hide()

		function addCategoryInfo(term, category, d, table) {
			if (!term) return
			if (d[category] == 'Ref') return
			let row = table.append('tr')
			const ctd = row.append('td').text(term.name)

			if ('cat_info' in d && d.cat_info[category]) {
				const mutations = d.cat_info[category]
				ctd.attr('rowspan', mutations.length + 1)
				// row.append('td').text('Mutation')
				for (const mutation of mutations) {
					const dt = mutation.dt
					row = table.append('tr')
					const class_info = mclass[mutation.class]
					const clabel = 'mname' in mutation ? `${mutation.mname} ${class_info.label}` : class_info.label
					const tdclass = row.append('td').text(clabel)
					if (mutation.class != 'Blank') tdclass.style('color', class_info.color)
					else tdclass.style('color', mclass['WT'].color)
					const origin = morigin[mutation.origin]?.label
					const dtlabel = origin ? `${origin} ${dt2label[dt]}` : dt2label[dt]
					row.append('td').text(dtlabel)
				}
			} else {
				let value = d[category]
				if (typeof value == 'number') value = value.toFixed(2)
				row.append('td').text(value)
			}
		}
	}

	self.mouseclick = function() {
		if (!self.lassoOn) self.dom.tip.hide()
		self.dom.termstip.hide()
	}

	self.onLegendClick = function(chart, G, name, key, e) {
		const tw = self.config[name]
		const hidden = tw.q.hiddenValues ? key in tw.q.hiddenValues : false
		const menu = new Menu({ padding: '5px' })
		const div = menu.d.append('div')

		if (!hidden) {
			div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Hide')
				.on('click', () => {
					self.hideCategory(G, tw, key, true)
					menu.hide()
					const config = {}
					config[name] = tw
					self.app.dispatch({
						type: 'plot_edit',
						id: self.id,
						config
					})
				})
		} else
			div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Show')
				.on('click', () => {
					self.hideCategory(G, tw, key, false)
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
				for (const mapKey of map.keys()) self.hideCategory(G, tw, mapKey, !mapKey.startsWith(key))

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
				for (const mapKey of map.keys()) self.hideCategory(G, tw, mapKey, false)
				const config = {}
				config[name] = tw
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config
				})
			})
		menu.show(e.clientX, e.clientY, false)
	}

	self.hideCategory = function(G, tw, key, hide) {
		if (!tw.q.hiddenValues) tw.q.hiddenValues = {}
		const value = tw.term.type != 'geneVariant' && tw.term.values[key] ? tw.term.values[key] : { key: key, label: key }
		const items = G.selectAll(`text[name="sjpp-scatter-legend-label"]`).nodes()
		const itemG = items.find(item => key.startsWith(item.innerHTML))?.parentElement

		if (itemG) itemG.style['text-decoration'] = hide ? 'line-through' : 'none'
		if (!hide) delete tw.q.hiddenValues[key]
		else tw.q.hiddenValues[key] = value
	}

	self.onColorClick = function(e, key, category) {
		const color = rgb(category.color)
		const menu = new Menu()
		const input = menu.d
			.append('input')
			.attr('type', 'color')
			.attr('value', color.formatHex())
			.on('change', () => {
				// ok to not await here, since no returned value is required
				// and menu.hide() does not need to wait for the dispatch to finish
				self.changeColor(key, input.node().value)
				menu.hide()
			})
		menu.show(e.clientX, e.clientY, false)
	}

	self.changeColor = async function(key, color) {
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

	self.searchSample = function(e) {
		const menu = new Menu({ padding: '5px' })
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
				if (group.items.length == 0 || group.items.length == self.cohortSamples.length) msgDiv.text('Invalid group')
				else {
					self.config.groups[self.config.groups.length - 1].fromSearch = false
					self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })
					menu.hide()
				}
				return
			}
			// ok to not await here, since no returned value is required
			// and menu.hide() does not need to wait for the dispatch to finish
			const value = input.node().value
			const items = []
			for (const sample of self.cohortSamples)
				if (sample.sample.toUpperCase().includes(value.toUpperCase())) items.push(sample)
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

	self.downloadSVG = function(svg) {
		const link = document.createElement('a')
		// If you don't know the name or want to use
		// the webserver default set name = ''
		link.setAttribute('download', 'scatter.svg')
		document.body.appendChild(link)
		link.click()
		link.remove()
		const serializer = new XMLSerializer()
		const svg_blob = new Blob([serializer.serializeToString(svg.node())], {
			type: 'image/svg+xml'
		})
		link.href = URL.createObjectURL(svg_blob)
		link.click()
		link.remove()
	}

	self.openSummaryPlot = async function(term, groups) {
		// barchart config.term{} name is confusing, as it is actually a termsetting object, not term
		// thus convert the given term into a termwrapper
		// tw.q can be missing and will be filled in with default setting
		const tw = { id: term.id, term }
		const plot_name = self.config.name ? self.config.name : 'Summary scatter'
		const config = {
			chartType: 'summary',
			childType: 'barchart',
			term: tw, // self is a termsetting, not a term
			term2: getSamplelstTW(groups, plot_name + ' groups'),
			insertBefore: self.id
		}
		await self.app.dispatch({
			type: 'plot_create',
			config
		})
	}

	self.showTermsTree = async function(div, callback, state = { tree: { usecase: { detail: 'term' } } }) {
		self.dom.termstip.clear()
		self.dom.termstip.showunderoffset(div.node())
		const termdb = await import('../termdb/app')
		termdb.appInit({
			holder: self.dom.termstip.d,
			vocabApi: self.app.vocabApi,
			state,
			tree: {
				click_term: term => {
					callback(term)
					self.dom.tip.hide()
					self.dom.termstip.hide()
				}
			}
		})
	}

	self.getCategoryInfo = function(d, category) {
		if (!(category in d)) return ''
		return d[category]
	}

	self.addToFilter = function(group) {
		const filterUiRoot = getFilterItemByTag(self.state.termfilter.filter, 'filterUiRoot')
		const samplelstTW = getSamplelstTW([group])
		const values = samplelstTW.q.groups[0].values
		const filter = filterJoin([
			filterUiRoot,
			{
				type: 'tvslst',
				in: true,
				join: '',
				lst: [
					{
						type: 'tvs',
						tvs: { term: samplelstTW.term, values },
						noEdit: !('sample' in values[0])
					}
				]
			}
		])
		filter.tag = 'filterUiRoot'
		self.app.dispatch({
			type: 'filter_replace',
			filter
		})
	}

	self.showTable = function(group, x, y, addGroup) {
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
		const headerDiv = self.dom.tip.d.append('div').style('margin-top', '5px')

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
					.on('change', () => {
						const value = input.node().value
						if (value) group.name = value
						else input.node().value = group.name
						groupDiv.html('&nbsp;' + group.name)
						self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })
					})
				input.node().focus()
				input.node().select()
			})
		const tableDiv = self.dom.tip.d.append('div')
		const buttons = []
		if (addGroup) {
			const addGroup = {
				text: 'Add to a group',
				callback: indexes => {
					const items = []
					for (const i of indexes) items.push(self.selectedItems[i].__data__)
					self.config.groups.push({
						name: group.name,
						items,
						index: self.config.groups.length
					})
					self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })
				}
			}
			buttons.push(addGroup)
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

	self.showGroupMenu = function(event, group) {
		self.dom.tip.clear()
		self.dom.tip.show(event.clientX, event.clientY, false, false)
		const menuDiv = self.dom.tip.d.append('div')
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
					.on('change', () => {
						const value = input.node().value
						if (value) group.name = value
						else input.node().value = group.name
						groupDiv.html('&nbsp;' + group.name)
						self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })
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
		self.addMatrixMenuItems(menuDiv, [group])
		if (self.state.allowedTermTypes.includes('survival')) {
			const survivalDiv = menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.style('position', 'relative')
				.html('Survival analysis&nbsp;&nbsp;&nbsp;›')

			survivalDiv.on('click', async e => {
				const state = {
					nav: { header_mode: 'hide_search' },
					tree: { usecase: { target: 'survival', detail: 'term' } }
				}
				const plot_name = self.config.name ? self.config.name : 'Summary scatter'
				const tw = getSamplelstTW([group], plot_name + ' groups')

				self.showTermsTree(
					survivalDiv,
					term => {
						openSurvivalPlot(term, tw, self.app, self.id)
					},
					state
				)
			})
		}
		const summarizeDiv = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.html('Summarize')
		summarizeDiv
			.insert('div')
			.html('›')
			.style('float', 'right')

		summarizeDiv.on('click', async e => {
			self.showTermsTree(summarizeDiv, term => self.openSummaryPlot(term, [group]))
		})
		const deleteDiv = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(`Delete group`)
			.on('click', e => {
				self.config.groups.splice(group.index, 1)
				self.app.dispatch({ type: 'plot_edit', id: self.id, config: { groups: self.config.groups } })
			})
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Add to filter')
			.on('click', () => {
				self.addToFilter(group)
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

	self.addMatrixMenuItems = function(menuDiv, groups) {
		if (self.state.matrixplots) {
			for (const plot of self.state.matrixplots) {
				menuDiv
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text(plot.name)
					.on('click', async () => {
						const config = await dofetch3('termdb', {
							body: {
								for: 'matrix',
								getPlotDataByName: plot.name,
								genome: self.state.vocab.genome,
								dslabel: self.state.vocab.dslabel
							}
						})

						config.divideBy = getSamplelstTW(groups)
						config.settings.matrix.colw = 0
						self.app.dispatch({
							type: 'plot_create',
							config
						})
						self.dom.tip.hide()
					})
			}
		}
	}

	self.showGroupsMenu = function(event) {
		self.dom.tip.clear()
		self.dom.tip.show(event.clientX, event.clientY)
		const menuDiv = self.dom.tip.d.append('div')

		let row = menuDiv.append('div')

		for (const [i, group] of self.config.groups.entries()) {
			row = menuDiv.append('div').attr('class', 'sja_menuoption sja_sharp_border')
			row
				.insert('div')
				.style('display', 'inline-block')
				.text(` ${group.name}: ${group.items.length} `)

			row
				.append('div')
				.style('display', 'inline-block')
				.style('float', 'right')
				.html('&nbsp;&nbsp;›')
			row.on('click', e => {
				self.dom.tip.clear().hide()
				self.showGroupMenu(event, group)
			})
		}
		self.addMatrixMenuItems(menuDiv, self.config.groups)
		if (self.state.allowedTermTypes.includes('survival')) {
			const survivalDiv = menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.html('Compare survival&nbsp;&nbsp;›')

			survivalDiv.on('click', async e => {
				const state = {
					nav: { header_mode: 'hide_search' },
					tree: { usecase: { target: 'survival', detail: 'term' } }
				}
				const plot_name = self.config.name ? self.config.name : 'Summary scatter'
				const tw = getSamplelstTW(self.config.groups, plot_name + ' groups')
				self.showTermsTree(
					survivalDiv,
					term => {
						openSurvivalPlot(term, tw, self.app, self.id)
					},
					state
				)
			})
		}
		const summarizeDiv = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.html('Summarize')
		summarizeDiv
			.insert('div')
			.html('›')
			.style('float', 'right')

		summarizeDiv.on('click', async e => {
			self.showTermsTree(summarizeDiv, term => {
				self.openSummaryPlot(term, self.config.groups)
			})
		})
		row = menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Delete groups')
			.on('click', event => {
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
