import { filterJoin, getFilterItemByTag } from '#filter'
import { renderTable } from '../dom/table.ts'
import { mclass } from '#shared/common'
import { Menu } from '#dom/menu'
import { rgb } from 'd3-color'
import { getFilter } from '../mass/groups.js'
import {
	addPlotMenuItem,
	showTermsTree,
	addMatrixMenuItems,
	openSummaryPlot,
	tip2,
	addNewGroup,
	getSamplelstTWFromIds,
	getSamplelstTW
} from '../mass/groups'
import { newSandboxDiv } from '../dom/sandbox.ts'
import { getId } from '#mass/nav'
import { searchSampleInput, getSamplesRelated } from './sampleView.js'

export function setInteractivity(self) {
	self.showTooltip = function (event, chart) {
		const onClick = event.type == 'click'
		self.onClick = onClick
		if (onClick) self.searchMenu?.hide()

		if (!(event.target.tagName == 'path' && event.target.getAttribute('name') == 'serie')) {
			if (self.onClick && onClick) {
				self.onClick = false
				self.dom.tooltip.hide()
				return
			}
			if (!onClick) {
				self.dom.tooltip.hide()
			} //dont hide current tooltip if mouse moved away, may want to scroll
			return
		}
		const s2 = event.target.__data__
		const displaySample = 'sample' in s2
		let threshold = 10 //min distance in pixels to be in the neighborhood
		threshold = threshold / self.zoom //Threshold should consider the zoom
		const samples = chart.data.samples.filter(s => {
			const dist = distance(s.x, s.y, s2.x, s2.y, chart)
			if (!('sampleId' in s) && (!self.settings.showRef || self.settings.refSize == 0)) return false
			return self.getOpacity(s) > 0 && dist < threshold
		})
		samples.sort((s1, s2) => {
			if (!('sampleId' in s1)) return 1
			if (self.config.term) {
				//coordinates from terms
				if (s1.x < s2.x) return -1
				if (s1.x > s2.x) return 1
				if (s1.y < s2.y) return -1
				return 1
			}

			if (self.config.colorTW) {
				if (self.config.colorTW.term.type == 'categorical') {
					if (s1.category.includes(mclass.WT.label) || s1.category.includes(mclass.Blank.label)) return 1
				} // numeric
				else {
					if (s1.category < s2.category) return -1
					else if (s1.category > s2.category) return 1
				}
			}
			if (s1.shape.includes(mclass.WT.label) || s1.shape.includes(mclass.Blank.label)) return 1

			return -1
		})
		if (samples.length == 0) return
		const tree = []
		const showCoords = self.config.term ? true : false
		const getCoords = sample => `${sample.x.toPrecision(2)},${sample.y.toPrecision(2)}`
		//Building tree
		for (const sample of samples) {
			const id = getCoords(sample)
			let node = tree.find(item => item.id == id)
			if (!node) {
				node = { id, parentId: null, samples: [sample], level: 1, category: null, children: [] }
				tree.push(node)
				if (showCoords) {
					const xvalue = getCategoryValue('x', sample)
					const xnode = {
						id: xvalue,
						parentId: id,
						samples: [sample],
						level: 2,
						category: 'X',
						children: [],
						value: xvalue
					}
					tree.push(xnode)
					node.children.push(xnode)
					const yvalue = getCategoryValue('y', sample)
					const ynode = {
						id: `${yvalue}${xvalue}`,
						parent: xnode,
						parentId: xvalue,
						samples: [sample],
						level: 3,
						category: 'Y',
						children: [],
						value: yvalue
					}
					xnode.children.push(ynode)
					tree.push(ynode)
					node.xnode = xnode
					node.ynode = ynode
				}
			} else {
				node.samples.push(sample)
				if (showCoords) {
					node.xnode.samples.push(sample)
					node.ynode.samples.push(sample)
				}
			}
		}
		let level = showCoords ? 4 : 2
		let parentCategories = showCoords ? ['y', 'x', ''] : ['']
		if (self.config.colorTW) addNodes('category', self.config.colorTW)
		if (self.config.shapeTW) addNodes('shape', self.config.shapeTW, self.config.colorTW)
		if (self.config.scaleDotTW) addNodes('scale', self.config.scaleDotTW, self.config.shapeTW)
		self.dom.tooltip.clear()
		//Rendering tooltip
		const div = self.dom.tooltip.d.style('padding', '5px')
		const hasMetArrayPlot = self.state.termdbConfig.queries?.singleSampleGenomeQuantification
		const hasDiscoPlot = self.state.termdbConfig.queries?.singleSampleMutation

		if (samples.length > 1)
			div
				.append('div')
				.style('color', '#aaa')
				.style('padding', '3px')
				.style('font-weight', 'bold')
				.html(`${samples.length} Samples`)
		const tableDiv = div.append('div').style('max-height', '400px').style('overflow', 'scroll')
		if (samples.length > 3) tableDiv.attr('class', 'sjpp_show_scrollbar')

		const table = tableDiv.append('table').style('width', '100%')
		const nodes = tree.filter(node => (showCoords ? node.level == 1 : node.level == 2))
		if (showCoords)
			for (const node of nodes) {
				if (samples.length > 1) table.append('tr').append('td').attr('colspan', 3).style('border-top', '1px solid #aaa')
				for (const child of node.children) {
					addCategory(child)
				}
			}
		else
			for (const node of nodes) {
				if (samples.length > 1) table.append('tr').append('td').attr('colspan', 3).style('border-top', '1px solid #aaa')
				addCategory(node)
			}

		self.dom.tooltip.show(event.clientX, event.clientY, true, false)

		function getTW(category) {
			const tw =
				category == 'category'
					? self.config.colorTW
					: category == 'shape'
					? self.config.shapeTW
					: category == 'scale'
					? self.config.scaleDotTW
					: category == 'X' && self.config.term
					? self.config.term
					: category == 'Y' && self.config.term2
					? self.config.term2
					: null
			return tw
		}

		function addCategory(node) {
			const tw = getTW(node.category)
			node.added = true
			let row
			const sample = node.samples[0]

			if (sample.category != 'Ref') {
				let row = table.append('tr')

				const showIcon = tw != null && (tw == self.config.colorTW || tw == self.config.shapeTW)
				let label = tw ? tw.term.name : node.category
				if (samples.length > 1 && !displaySample) label = label + ` (${node.samples.length})`
				row.append('td').style('color', '#aaa').text(label)
				const td = row.append('td')

				if (showIcon) {
					const color =
						tw == self.config.colorTW
							? self.getColor(sample, chart)
							: self.config.colorTW
							? 'gray'
							: self.settings.defaultColor
					const index =
						tw == self.config.colorTW
							? chart.shapeLegend.get('Ref').shape % self.symbols.length
							: chart.shapeLegend.get(sample.shape).shape % self.symbols.length
					const shape = self.symbols[index].size(64)()
					let fontColor = 'black'
					const whiteColor = rgb('white').toString()

					if (tw?.term.type == 'geneVariant' && !tw.q.groupsetting.inuse) {
						for (const id in mclass) {
							const class_info = mclass[id]
							if (node.value.includes(class_info.label)) {
								if (rgb(class_info.color).toString() != whiteColor) fontColor = class_info.color
								break
							}
						}
						if (onClick) {
							row
								.append('td')
								.append('button')
								.text('Lollipop')
								.on('click', async e => {
									await self.openLollipop(label)
									self.dom.tip.hide()
								})
						}
					}

					let chars = node.value.toString().length
					const width = chars * 9 + 60
					const svg = td.append('svg').attr('width', width).attr('height', '25px')
					const g = svg.append('g').attr('transform', 'translate(10, 14)')
					g.append('path').attr('d', shape).attr('fill', color).attr('stroke', '#aaa')
					const text = g.append('text').attr('x', 12).attr('y', 6).attr('font-size', '0.9em')
					const span2 = text.append('tspan').text(node.value).attr('fill', fontColor)
				} else td.style('padding', '2px').text(`${node.value}`)
			}

			for (const child of node.children) if (!child.added) addCategory(child)
			if (node.children.length == 0 && displaySample) {
				for (const sample of node.samples) {
					if ('info' in sample)
						for (const [k, v] of Object.entries(sample.info)) {
							row = table.append('tr')
							row.append('td').style('color', '#aaa').text(k)
							row.append('td').text(v)
						}

					row = table.append('tr')
					row.append('td').style('color', '#aaa').text('Sample')
					row.append('td').style('padding', '2px').text(sample.sample)
					if ('sampleId' in sample && onClick) {
						row
							.append('td')
							.append('button')
							.text('Sample view')
							.on('click', e => self.openSampleView(sample))
						if (hasDiscoPlot)
							row
								.append('td')
								.append('button')
								.text('Disco')
								.on('click', async e => self.openDiscoPlot(sample))

						if (hasMetArrayPlot)
							row
								.append('td')
								.append('button')
								.text('Met Array')
								.on('click', async e => self.openMetArray(sample))
					}
				}
			}
		}

		function addNodes(category, tw, parentTW) {
			for (const sample of samples) {
				const value = getCategoryValue(category, sample, tw)
				let parentId = ''
				for (const pc of parentCategories) parentId += getCategoryValue(pc, sample, parentTW)
				const id = value + parentId
				let node = tree.find(item => item.id == id && item.parentId == parentId)
				let parent = tree.find(item => item.id == parentId)
				if (!node) {
					node = { id, parentId, samples: [], level, category, children: [], value }
					tree.push(node)
				}
				node.samples.push(sample)
				if (parent) parent.children.push(node)
			}
			level++
			parentCategories.unshift(category)
		}

		function getCategoryValue(category, d, tw) {
			if (category == '') return ''
			let value = d[category]
			if (tw?.term.type == 'geneVariant' && !tw.q.groupsetting.inuse) {
				const mutation = value.split(', ')[0]
				for (const id in mclass) {
					const class_info = mclass[id]
					if (mutation == class_info.label) {
						const mname = d.cat_info[category].find(m => m.class == class_info.key).mname
						if (mname) value = `${mname} ${value}`
					}
				}
			}
			if (typeof value == 'number' && value % 1 != 0) value = value.toPrecision(2)
			return value
		}
	}

	self.openSampleView = function (sample) {
		self.dom.tooltip.hide()
		self.onClick = false
		self.app.dispatch({
			type: 'plot_create',
			id: getId(),
			config: {
				chartType: 'sampleView',
				sample: { sampleId: sample.sampleId, sampleName: sample.sample }
			}
		})
		self.dom.tip.hide()
	}

	self.openMetArray = async function (sample) {
		self.dom.tooltip.hide()
		self.onClick = false

		sample.sample_id = sample.sample
		for (const k in self.state.termdbConfig.queries.singleSampleGenomeQuantification) {
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
		}
		self.dom.tip.hide()
	}

	self.openDiscoPlot = async function (sample) {
		self.dom.tooltip.hide()
		self.onClick = false

		sample.sample_id = sample.sample
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
	}

	self.openLollipop = async function (label) {
		self.dom.tooltip.hide()
		self.onClick = false
		const sandbox = newSandboxDiv(self.opts.plotDiv || select(self.opts.holder.node().parentNode))
		sandbox.header.text(label)
		const arg = {
			holder: sandbox.body.append('div').style('margin', '20px'),
			genome: self.app.opts.genome,
			nobox: true,
			query: label,
			tklst: [
				{
					type: 'mds3',
					dslabel: self.app.opts.state.vocab.dslabel,
					filter0: self.state.termfilter.filter0,
					filterObj: self.state.termfilter.filter
				}
			]
		}
		const _ = await import('#src/block.init')
		await _.default(arg)
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
						tw.term.type == 'geneVariant' && !tw.q.groupsetting.inuse ? !mapKey.startsWith(key) : mapKey != key
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
		const value =
			!(tw.term.type == 'geneVariant' && !tw.q.groupsetting.inuse) && tw.term.values[key]
				? tw.term.values[key]
				: { key: key, label: key }
		const items = legendG.selectAll(`text[name="sjpp-scatter-legend-label"]`).nodes()
		const itemG = items.find(item => key.startsWith(item.innerHTML))?.parentElement

		if (itemG) itemG.style['text-decoration'] = hide ? 'line-through' : 'none'
		if (!hide) delete tw.q.hiddenValues[key]
		else tw.q.hiddenValues[key] = value
	}

	self.changeColor = async function (key, color) {
		const tw = self.config.colorTW
		if (!(tw.term.type == 'geneVariant' && !tw.q.groupsetting.inuse) && tw.term.values[key])
			tw.term.values[key].color = color
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

	self.searchSample = async function (e) {
		if (!this.searchMenu) this.searchMenu = new Menu({ padding: '3px' })
		this.searchMenu.clear()
		this.samplesData = await this.app.vocabApi.getSamplesByName({
			filter: self.state.termfilter.filter
		})
		const callback = sampleName => {
			if (this.samplesData[sampleName]) {
				const samples = getSamplesRelated(this.samplesData, sampleName)
				const samplelsttw = getSamplelstTWFromIds(samples.map(s => s.sampleId))
				self.addToFilter(samplelsttw)
			}
		}
		searchSampleInput(this.searchMenu.d, this.samplesData, callback)

		this.searchMenu.show(e.clientX, e.clientY, false)
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
					const filter = getFilter(getSamplelstTW([group]))
					addNewGroup(self.app, filter, self.state.groups)
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

function distance(x1, y1, x2, y2, chart) {
	const x = chart.xAxisScale(x2) - chart.xAxisScale(x1)
	const y = chart.yAxisScale(y2) - chart.yAxisScale(y1)
	const distance = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))
	return distance
}
