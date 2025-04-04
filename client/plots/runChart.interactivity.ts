import { mclass } from '#shared/common.js'
import { Menu } from '#dom/menu'
import { rgb } from 'd3-color'
import { newSandboxDiv } from '../dom/sandbox.ts'
import { getId } from '#mass/nav'
import { shapesArray, shapeSelector } from '../dom/shapes.js'
import { roundValueAuto } from '#shared/roundValue.js'
import { getDateStrFromNumber } from '#shared/terms.js'
import { select } from 'd3-selection'


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
		const samples = chart.samples.filter(s => {
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
		const tree: any = []
		const showCoords = self.config.term ? true : false
		const getCoords = sample => `${roundValueAuto(sample.x)},${roundValueAuto(sample.y)}`
		//Building tree
		for (const sample of samples) {
			const id = getCoords(sample)
			let node: any = tree.find(item => item.id == id)
			if (!node) {
				node = { id, parentId: null, samples: [sample], level: 1, category: null, children: [] }
				tree.push(node)
				if (showCoords) {
					const xvalue = getCategoryValue('x', sample, self.config.term)
					const xnode: any = {
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
					const yvalue = getCategoryValue('y', sample, self.config.term2)
					const ynode: any = {
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
		if (self.config.colorTW) addNodes('category', self.config.colorTW, null)
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
							? chart.shapeLegend.get('Ref').shape % shapesArray.length
							: chart.shapeLegend.get(sample.shape).shape % shapesArray.length
					const shape = shapesArray[index]
					let fontColor = 'black'
					const whiteColor = rgb('white').toString()

					if (tw?.term.type == 'geneVariant' && tw.q.type == 'values') {
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
					g.append('path')
						.attr('d', shape)
						.attr('fill', color)
						.attr('stroke', '#aaa')
						.attr('transform', 'translate(0, -2) scale(0.5)')
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
				let node: any = tree.find((item: any) => item.id == id && item.parentId == parentId)
				let parent = tree.find((item: any) => item.id == parentId)
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
			if (tw?.term.type == 'geneVariant' && tw.q.type == 'values') {
				const mutation = value.split(', ')[0]
				for (const id in mclass) {
					const class_info = mclass[id]
					if (mutation == class_info.label) {
						const mname = d.cat_info[category].find(m => m.class == class_info.key).mname
						if (mname) value = `${mname} ${value}`
					}
				}
			}
			if (tw?.term.type == 'date') value = getDateStrFromNumber(value)
			else if (typeof value == 'number' && value % 1 != 0) value = roundValueAuto(value)
			return value
		}
	}

	self.showText = function (event, text) {
		self.dom.tooltip.clear()
		self.dom.tooltip.d.style('padding', '5px').append('div').text(text)
		self.dom.tooltip.show(event.clientX, event.clientY, true, false)
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
					filterObj: structuredClone(self.state.termfilter.filter)
				}
			]
		}
		const _ = await import('#src/block.init')
		await _.default(arg)
	}

	self.onLegendClick = function (chart, name, key, e, category) {
		const tw = self.config[name]
		const isColorTW = name == 'colorTW'
		const hidden = tw.q.hiddenValues ? key in tw.q.hiddenValues : false
		const hiddenCount = tw.q.hiddenValues ? Object.keys(tw.q.hiddenValues).length : 0

		if (hidden && hiddenCount == 1) {
			//show hidden category and skip menu
			this.hideCategory(tw, key, false)
			dispatchConfig()
			return
		}
		const menu = new Menu({ padding: '0px' })
		const div = menu.d.append('div')
		div
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(hidden ? 'Show' : 'Hide')
			.on('click', () => {
				self.hideCategory(tw, key, !hidden)
				menu.hide()
				dispatchConfig()
			})
		div
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Show only')
			.on('click', () => {
				const map = name == 'colorTW' ? chart.colorLegend : chart.shapeLegend
				for (const mapKey of map.keys())
					self.hideCategory(
						tw,
						mapKey,
						tw.term.type == 'geneVariant' && tw.q.type == 'values' ? !mapKey.startsWith(key) : mapKey != key
					)

				menu.hide()
				dispatchConfig()
			})
		if (hiddenCount > 1)
			div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Show all')
				.on('click', () => {
					menu.hide()
					const map = isColorTW ? chart.colorLegend : chart.shapeLegend
					for (const mapKey of map.keys()) self.hideCategory(tw, mapKey, false)
					dispatchConfig()
				})
		if (isColorTW) {
			const color = rgb(category.color).formatHex()
			const input: any = div
				.append('div')
				.attr('class', 'sja_sharp_border')
				.style('padding', '0px 10px')
				.text('Color:')
				.append('input')
				.attr('type', 'color')
				.attr('value', color)
				.on('change', () => {
					self.changeColor(category.key, input.node().value)
					menu.hide()
				})
		}
		if (!isColorTW) {
			//is shape
			const shapeDiv = div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Change shape')
				.on('click', () => {
					div.selectAll('*').remove()
					const callback = index => {
						self.changeShape(category.key, index)
						menu.hide()
					}
					shapeSelector(div, callback)
				})
		}

		function dispatchConfig() {
			self.app.dispatch({
				type: 'plot_edit',
				id: self.id,
				config: { [name]: tw }
			})
		}
		menu.showunder(e.target)
	}

	self.hideCategory = function (tw, key, hide) {
		if (!tw.q) tw.q = {}
		if (!tw.q.hiddenValues) tw.q.hiddenValues = {}
		const value =
			!(tw.term.type == 'geneVariant' && tw.q.type == 'values') && tw.term.values[key]
				? tw.term.values[key]
				: { key: key, label: key }

		if (!hide) delete tw.q.hiddenValues[key]
		else tw.q.hiddenValues[key] = value
		if (key == 'Ref') {
			self.settings.showRef = !hide
			self.app.dispatch({
				type: 'plot_edit',
				id: self.id,
				config: {
					settings: { runChart: self.settings }
				}
			})
		}
	}

	self.changeColor = async function (key, color) {
		const tw = self.config.colorTW
		if (!tw.term.values) tw.term.values = {}
		if (!tw.term.values[key]) tw.term.values[key] = {}
		tw.term.values[key].color = color
		await self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: { colorTW: tw }
		})
	}

	self.changeShape = async function (key, shape) {
		const tw = self.config.shapeTW
		if (!tw.term.values) tw.term.values = {}
		if (!tw.term.values[key]) tw.term.values[key] = {}
		tw.term.values[key].shape = shape
		await self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: { shapeTW: tw }
		})
	}

	self.getCategoryInfo = function (d, category) {
		if (!(category in d)) return ''
		return d[category]
	}
}

function distance(x1, y1, x2, y2, chart) {
	const x = chart.xAxisScale(x2) - chart.xAxisScale(x1)
	const y = chart.yAxisScale(y2) - chart.yAxisScale(y1)
	const distance = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))
	return distance
}
