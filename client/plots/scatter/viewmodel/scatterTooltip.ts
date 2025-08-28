import { mclass } from '#shared/common.js'
import { shapesArray } from '../../../dom/shapes.js'
import { roundValueAuto } from '#shared/roundValue.js'
import { getDateStrFromNumber } from '#shared/terms.js'
import { rgb } from 'd3-color'
import type { Scatter } from '../scatter.js'
import { table2col } from '#dom'

export class ScatterTooltip {
	scatter: Scatter
	view: any
	chart: any
	samples!: any[]
	tree!: any[]
	tableDiv: any
	onClick: boolean
	displaySample!: boolean
	parentCategories!: string[]
	searchMenu: any
	samplesData: any
	chartDiv: any

	constructor(scatter: Scatter) {
		this.scatter = scatter
		this.view = scatter.view
		this.onClick = false
	}

	showTooltip(event, chart) {
		this.chart = chart
		const onClick = event.type == 'click'
		this.onClick = onClick
		if (onClick) this.scatter.interactivity.searchMenu?.hide()
		if (!(event.target.tagName == 'path' && event.target.getAttribute('name') == 'serie')) {
			if (this.onClick && onClick) {
				this.onClick = false
				this.view.dom.tooltip.hide()
				return
			}
			if (!onClick) {
				this.view.dom.tooltip.hide()
			} //dont hide current tooltip if mouse moved away, may want to scroll
			return
		}
		this.showSampleTooltip(event.target.__data__, event.clientX, event.clientY, chart)
	}

	showSampleTooltip(s2, x, y, chart) {
		this.chart = chart
		this.displaySample = 'sample' in s2
		const threshold = 5 / this.scatter.vm.scatterZoom.zoom //Threshold should consider the zoom
		const samples = chart.data.samples.filter(s => {
			const dist = distance(s.x, s.y, s2.x, s2.y, chart)
			if (!('sampleId' in s) && (!this.scatter.settings.showRef || this.scatter.settings.refSize == 0)) return false
			return this.scatter.model.getOpacity(s) > 0 && dist < threshold
		})
		this.samples = samples
		samples.sort((s1, s2) => {
			if (!('sampleId' in s1)) return 1
			if (this.scatter.config.term) {
				//coordinates from terms
				if (s1.x < s2.x) return -1
				if (s1.x > s2.x) return 1
				if (s1.y < s2.y) return -1
				return 1
			}

			if (this.scatter.config.colorTW) {
				if (this.scatter.config.colorTW.term.type == 'categorical') {
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
		this.tree = []
		const showCoords = this.scatter.config.term ? true : false
		const getCoords = sample => `${roundValueAuto(sample.x)},${roundValueAuto(sample.y)}`
		//Building tree
		for (const sample of samples) {
			const id = getCoords(sample)
			let node = this.tree.find(item => item.id == id)
			if (!node) {
				node = { id, parentId: null, samples: [sample], level: 1, category: null, children: [] }
				this.tree.push(node)
				if (showCoords) {
					const xvalue = this.getCategoryValue('x', sample, this.scatter.config.term)
					const xnode: any = {
						id: xvalue,
						parentId: id,
						samples: [sample],
						level: 2,
						category: this.scatter.config.term.term.name,
						children: [],
						value: xvalue
					}
					this.tree.push(xnode)
					node.children.push(xnode)
					const yvalue = this.getCategoryValue('y', sample, this.scatter.config.term2)
					const ynode = {
						id: `${yvalue}${xvalue}`,
						parent: xnode,
						parentId: xvalue,
						samples: [sample],
						level: 3,
						category: this.scatter.config.term2.term.name,
						children: [],
						value: yvalue
					}
					xnode.children.push(ynode)
					this.tree.push(ynode)
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
		const level = showCoords ? 4 : 2 //current level after adding the parent categories
		this.parentCategories = showCoords ? ['y', 'x', ''] : ['']
		if (this.scatter.config.colorTW)
			this.addNodes('category', this.scatter.config.colorTW, showCoords ? this.scatter.config.term : '', level)
		if (this.scatter.config.shapeTW)
			this.addNodes('shape', this.scatter.config.shapeTW, this.scatter.config.colorTW, level + 1)
		if (this.scatter.config.scaleDotTW)
			this.addNodes('scale', this.scatter.config.scaleDotTW, this.scatter.config.shapeTW, level + 2)
		this.view.dom.tooltip.clear()
		//Rendering tooltip
		const div = this.view.dom.tooltip.d.style('padding', '5px')
		if (samples.length > 1)
			div
				.append('div')
				.style('color', '#aaa')
				.style('padding', '3px')
				.style('font-weight', 'bold')
				.html(`${samples.length} Samples`)
		const tableDiv = div.append('div').style('max-height', '500px').style('overflow-y', 'scroll')
		if (samples.length > 4) tableDiv.attr('class', 'sjpp_show_scrollbar')
		this.tableDiv = tableDiv
		const nodes = this.tree.filter(node => (showCoords ? node.level == 1 : node.level == 2))
		if (showCoords)
			for (const node of nodes) {
				if (samples.length > 1) tableDiv.append('div').style('padding', '5px')
				for (const child of node.children) {
					this.addCategory(child)
				}
			}
		else
			for (const node of nodes) {
				if (samples.length > 1) tableDiv.append('div').style('padding', '5px')
				this.addCategory(node)
			}

		this.view.dom.tooltip.show(x, y, true, false)
	}

	getTW(category) {
		switch (category) {
			case 'category':
				return this.scatter.config.colorTW
			case 'shape':
				return this.scatter.config.shapeTW
			case 'scale':
				return this.scatter.config.scaleDotTW
			case 'x':
				return this.scatter.config.term
			case 'y':
				return this.scatter.config.term2
			default:
				return null
		}
	}

	addCategory(node) {
		const samples = this.samples
		const chart = this.chart
		const tw = this.getTW(node.category)
		node.added = true
		const hasDiscoPlot = this.scatter.state.termdbConfig.queries?.singleSampleMutation
		const hasMetArrayPlot = this.scatter.state.termdbConfig.queries?.singleSampleGenomeQuantification
		const div = this.tableDiv.append('div')
		const table = table2col({ holder: div, disableScroll: true, cellPadding: '5px' })
		const sample = node.samples[0]
		if (sample.category != 'Ref') {
			const [tdlabel, td] = table.addRow()
			const showIcon = tw != null && (tw == this.scatter.config.colorTW || tw == this.scatter.config.shapeTW)
			let label = tw ? tw.term.name : node.category
			if (samples.length > 1 && !this.displaySample) label = label + ` (${node.samples.length})`
			tdlabel.text(label)

			if (showIcon) {
				const color =
					tw == this.scatter.config.colorTW
						? this.scatter.model.getColor(sample, chart)
						: this.scatter.config.colorTW
						? 'gray'
						: this.scatter.settings.defaultColor
				const index =
					tw == this.scatter.config.colorTW
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
					if (this.onClick) {
						td.append('button')
							.style('float', 'right')
							.text('Lollipop')
							.on('click', async () => {
								await this.scatter.interactivity.openLollipop(label)
								this.scatter.dom.tip.hide()
							})
					}
				}

				const chars = node.value.toString().length
				const width = chars * 9 + 60
				const svg = td.append('svg').attr('width', width).attr('height', '25px')
				const g = svg.append('g').attr('transform', 'translate(0, 14)')
				g.append('path')
					.attr('d', shape)
					.attr('fill', color)
					.attr('stroke', '#aaa')
					.attr('transform', 'translate(0, -4) scale(0.6)')
				const text = g.append('text').attr('x', 15).attr('y', 6).attr('font-size', '0.9em')
				text.append('tspan').text(node.value).attr('fill', fontColor)
			} else td.text(`${node.value}`)
		}

		for (const child of node.children) if (!child.added) this.addCategory(child)
		if (node.children.length == 0 && this.displaySample) {
			for (const sample of node.samples) {
				if ('info' in sample)
					for (const [k, v] of Object.entries(sample.info)) {
						const [tdlabel, td] = table.addRow()
						tdlabel.text(k)
						td.text(v)
					}

				const [tdlabel, td] = table.addRow()
				tdlabel.text('Sample')
				td.text(sample.sample)
				if ('sampleId' in sample && this.onClick) {
					td.append('button')
						.style('float', 'right')
						.text('Sample view')
						.on('click', () => this.scatter.interactivity.openSampleView(sample))
					if (hasDiscoPlot)
						td.append('button')
							.style('float', 'right')
							.text('Disco')
							.on('click', async () => this.scatter.interactivity.openDiscoPlot(sample))

					if (hasMetArrayPlot)
						td.append('button')
							.style('float', 'right')
							.text('Met Array')
							.on('click', async () => this.scatter.interactivity.openMetArray(sample))
				}
			}
		}
	}

	addNodes(category, tw, parentTW, level) {
		for (const sample of this.samples) {
			const value = this.getCategoryValue(category, sample, tw)
			let parentId = ''
			for (const pc of this.parentCategories) parentId += this.getCategoryValue(pc, sample, parentTW)
			const id = value + parentId
			let node = this.tree.find(item => item.id == id && item.parentId == parentId)
			const parent = this.tree.find(item => item.id == parentId)
			if (!node) {
				node = { id, parentId, samples: [], level, category, children: [], value }
				this.tree.push(node)
			}
			node.samples.push(sample)
			if (parent) parent.children.push(node)
		}
		this.parentCategories.unshift(category)
	}

	getCategoryValue(category, d, tw) {
		if (category == '') return ''
		let value = d[category]
		if (tw?.term.type == 'geneVariant' && tw.q?.type == 'values') {
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

function distance(x1, y1, x2, y2, chart) {
	const x = chart.xAxisScale(x2) - chart.xAxisScale(x1)
	const y = chart.yAxisScale(y2) - chart.yAxisScale(y1)
	const distance = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))
	return distance
}
