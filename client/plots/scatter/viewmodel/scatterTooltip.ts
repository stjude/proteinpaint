import { mclass } from '#shared/common.js'
import { shapesArray } from '../../../dom/shapes.js'
import { roundValueAuto } from '#shared/roundValue.js'
import { getDateStrFromNumber } from '#shared/terms.js'
import { rgb } from 'd3-color'
import type { Scatter } from '../scatter.js'
import { Menu, table2col, openActionMenu, openMultiHitClickMenu } from '#dom'
import type { ActionMenuItem } from '#dom'
import { getCoordinate } from '../model/scatterModel.ts'
import { zoomTransform } from 'd3-zoom'

export class ScatterTooltip {
	scatter: Scatter
	view: any
	chart: any
	samples!: any[]
	tree!: any[]
	tableDiv: any
	displaySample!: boolean
	parentCategories!: string[]
	level: any
	parentTW: any

	// Click menu shared with the volcano/manhattan flow.
	clickMenu: Menu
	clickMenuIsShown = false
	private lastRingChart: any = null

	constructor(scatter: Scatter) {
		this.scatter = scatter
		this.view = scatter.view
		this.clickMenu = new Menu({
			padding: '',
			onHide: () => {
				this.clickMenuIsShown = false
				if (this.lastRingChart) this.drawHoverRings([], this.lastRingChart)
			}
		})
	}

	showTooltip(event, chart) {
		if (this.scatter.config.lassoOn) return
		this.chart = chart
		if (!(event.target.tagName == 'path' && event.target.getAttribute('name') == 'serie')) {
			this.view.dom.tooltip.hide()
			if (!this.clickMenuIsShown) this.drawHoverRings([], chart)
			return
		}
		this.showSampleTooltip(event.target.__data__, event.clientX, event.clientY, chart)
	}

	showSampleClickMenu(event, chart) {
		if (this.scatter.config.lassoOn) return
		this.view.dom.tooltip.hide()
		if (!(event.target.tagName == 'path' && event.target.getAttribute('name') == 'serie')) return
		this.chart = chart
		const seedSample = event.target.__data__
		const samples = this.getClusterSamples(seedSample, chart)
		if (samples.length === 0) return
		this.drawHoverRings(samples, chart)
		this.clickMenuIsShown = true
		if (samples.length === 1) {
			this.openSampleActionMenu(samples[0], event)
		} else {
			this.openClusterClickMenu(samples, event)
		}
	}

	showSampleTooltip(s2, x, y, chart) {
		this.chart = chart
		this.displaySample = 'sample' in s2 || 'cellId' in s2
		const samples = this.getClusterSamples(s2, chart)
		this.samples = samples
		if (samples.length == 0) return
		this.tree = []
		const showCoords = this.scatter.config.term ? true : false

		//Building tree
		for (const sample of samples) {
			const id = `${roundValueAuto(sample.x)},${roundValueAuto(sample.y)}`
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
		this.level = showCoords ? 4 : 2 //current level after adding the parent categories
		this.parentCategories = showCoords ? ['y', 'x', ''] : ['']
		if (showCoords) this.parentTW = this.scatter.config.term
		else this.parentTW = null
		if (this.scatter.config.colorTW) this.addNodes('category', this.scatter.config.colorTW)
		if (this.scatter.config.shapeTW) this.addNodes('shape', this.scatter.config.shapeTW)
		if (this.scatter.config.scaleDotTW) this.addNodes('scale', this.scatter.config.scaleDotTW)
		this.view.dom.tooltip.clear()
		//Rendering tooltip
		const div = this.view.dom.tooltip.d
		if (samples.length > 1)
			div
				.append('div')
				.style('color', '#aaa')
				.style('font-weight', 'bold')
				.style('margin-left', '1em')
				.text(`${samples.length} ${this.scatter.settings.itemLabel}s`)
		const tableDiv = div.append('div').style('max-height', '500px').style('overflow-y', 'scroll')
		if (samples.length > 4) tableDiv.attr('class', 'sjpp_show_scrollbar')
		this.tableDiv = tableDiv
		const nodes = this.tree.filter(node => (showCoords ? node.level == 1 : node.level == 2))
		if (showCoords)
			for (const node of nodes) {
				if (samples.length > 1) tableDiv.append('div').style('padding', '2px')
				for (const child of node.children) {
					this.addCategory(child, null)
				}
			}
		else
			for (const node of nodes) {
				if (samples.length > 1) tableDiv.append('div').style('padding', '2px')
				this.addCategory(node, null)
			}

		if (!this.clickMenuIsShown) this.drawHoverRings(samples, chart)
		this.view.dom.tooltip.show(x, y, true, false)
	}

	private getClusterSamples(s2, chart): any[] {
		const threshold = 5 / this.scatter.zoom //Threshold should consider the zoom
		const xMin = chart.xAxisScale.invert(0)
		const xMax = chart.xAxisScale.invert(chart.width ?? this.scatter.settings.svgw)
		const yMin = chart.yAxisScale.invert(chart.height ?? this.scatter.settings.svgh)
		const yMax = chart.yAxisScale.invert(0)
		const samples = chart.data.samples.filter(s => {
			const dist = distance(s.x, s.y, s2.x, s2.y, chart, xMin, xMax, yMin, yMax)
			if (!('sampleId' in s) && (!this.scatter.settings.showRef || this.scatter.settings.refSize == 0)) return false
			return this.scatter.model.getOpacity(s) > 0 && dist < threshold
		})
		samples.sort((s1, s2) => {
			if (!('sampleId' in s1)) return 1
			if (this.scatter.config.term) {
				if (s1.x < s2.x) return -1
				if (s1.x > s2.x) return 1
				if (s1.y < s2.y) return -1
				return 1
			}
			if (this.scatter.config.colorTW) {
				if (this.scatter.config.colorTW.term.type == 'categorical') {
					if (s1.category.includes(mclass.WT.label) || s1.category.includes(mclass.Blank.label)) return 1
				} else {
					if (s1.category < s2.category) return -1
					else if (s1.category > s2.category) return 1
				}
			}
			if (s1.shape.includes(mclass.WT.label) || s1.shape.includes(mclass.Blank.label)) return 1
			return -1
		})
		return samples
	}

	private drawHoverRings(samples: any[], chart: any) {
		// `mainG` is reused across re-renders; chart.serie's children get cleared,
		// but our sibling layer is untouched, so just clear and repaint each call.
		let layer = chart.mainG.select('.sjpcb-scatter-hover-rings')
		if (layer.empty()) {
			layer = chart.mainG.append('g').attr('class', 'sjpcb-scatter-hover-rings').style('pointer-events', 'none')
		}
		// Mirror the zoom transform on every redraw — getCoordinates returns
		// pre-zoom pixels, and zoom is applied via chart.serie's `transform`
		// attribute. Picking it up here keeps rings aligned right after a zoom.
		const serieTransform = chart.serie.attr('transform')
		if (serieTransform) layer.attr('transform', serieTransform)
		else layer.attr('transform', null)
		layer.selectAll('circle').remove()
		if (samples.length === 0) return
		this.lastRingChart = chart
		// The parent transform scales geometry, so a fixed 2px slack would balloon
		// into 2*k visible px at zoom k. Divide by k pre-transform so the visible
		// slack stays a constant 2px at any zoom level.
		const k = zoomTransform(chart.mainG.node()).k || 1
		for (const s of samples) {
			const { x, y } = this.scatter.model.getCoordinates(chart, s)
			const scale = this.scatter.model.getScale(chart, s)
			const r = 8 * scale + 2 / k
			layer
				.append('circle')
				.attr('cx', x)
				.attr('cy', y)
				.attr('r', r)
				.attr('data-base-scale', scale)
				.attr('fill', 'none')
				.attr('stroke', 'black')
				.attr('stroke-width', 1.5)
				// Stroke stays a constant 1.5px — without this it bloats with the
				// parent zoom transform.
				.attr('vector-effect', 'non-scaling-stroke')
		}
	}

	private openSampleActionMenu(sample: any, event: any) {
		openActionMenu({
			menu: this.clickMenu,
			event,
			actions: this.buildSampleActions(sample),
			renderInfo: container => this.renderSampleInfo(container, sample)
		})
	}

	private openClusterClickMenu(samples: any[], event: any) {
		const config = this.scatter.config
		const itemLabel = this.scatter.settings.itemLabel || 'Sample'
		const columns: any[] = [{ label: itemLabel }]
		if (config.colorTW) columns.push({ label: config.colorTW.term.name, sortable: true })
		if (config.shapeTW) columns.push({ label: config.shapeTW.term.name, sortable: true })

		const rows = samples.map(s => {
			const r: any[] = [{ value: s.sample ?? s.cellId ?? '' }]
			if (config.colorTW) r.push({ value: String(this.getCategoryValue('category', s, config.colorTW) ?? '') })
			if (config.shapeTW) r.push({ value: String(this.getCategoryValue('shape', s, config.shapeTW) ?? '') })
			return r
		})

		openMultiHitClickMenu<any>({
			menu: this.clickMenu,
			event,
			items: samples,
			columns,
			rows,
			getRowKey: (s: any) => String(s.sample ?? s.cellId ?? ''),
			header: `${samples.length} ${itemLabel}s`,
			onRowClick: (s, ev) => this.openSampleActionMenu(s, ev)
		})
	}

	private buildSampleActions(sample: any): ActionMenuItem[] {
		const actions: ActionMenuItem[] = []
		const config = this.scatter.config
		const termdb = this.scatter.state.termdbConfig
		const interactivity = this.scatter.interactivity

		if ('sampleId' in sample && !config?.singleCellPlot) {
			if (this.scatter.state.currentCohortChartTypes?.includes('sampleView')) {
				actions.push({
					label: 'Sample view',
					onClick: () => interactivity.openSampleView(sample)
				})
			}
			if (termdb?.queries?.singleSampleMutation) {
				actions.push({
					label: 'Disco',
					onClick: async () => interactivity.openDiscoPlot(sample)
				})
			}
			if (termdb?.queries?.singleSampleGenomeQuantification) {
				actions.push({
					label: 'Met Array',
					onClick: async () => interactivity.openMetArray(sample)
				})
			}
		}

		// Lollipop appears when the sample's color or shape value is a gene-mutation
		// label — same condition as the inline button it replaces.
		for (const tw of [config.colorTW, config.shapeTW]) {
			if (!tw) continue
			if (tw.term.type !== 'geneVariant' || tw.q?.type !== 'values') continue
			const raw = tw === config.colorTW ? sample.category : sample.shape
			const mutation = String(raw ?? '').split(', ')[0]
			if (!mutation) continue
			let matched = false
			for (const id in mclass) {
				if (mclass[id].label === mutation) {
					matched = true
					break
				}
			}
			if (!matched) continue
			actions.push({
				label: `Lollipop (${mutation})`,
				onClick: async () => interactivity.openLollipop(mutation)
			})
		}

		return actions
	}

	private renderSampleInfo(container: any, sample: any) {
		const table = table2col({ holder: container.append('table'), disableScroll: true, cellPadding: '5px' })
		const config = this.scatter.config
		const itemLabel = this.scatter.settings.itemLabel || 'Sample'

		const sampleId = sample.sample ?? sample.cellId
		if (sampleId != null) {
			const [td1, td2] = table.addRow()
			td1.text(itemLabel)
			td2.text(sampleId)
		}

		if (config.term) {
			const xv = this.getCategoryValue('x', sample, config.term)
			const [td1, td2] = table.addRow()
			td1.text(config.term.term.name)
			td2.text(String(xv))
			if (config.term2) {
				const yv = this.getCategoryValue('y', sample, config.term2)
				const [td1b, td2b] = table.addRow()
				td1b.text(config.term2.term.name)
				td2b.text(String(yv))
			}
		}
		if (config.colorTW) {
			const cv = this.getCategoryValue('category', sample, config.colorTW)
			const [td1, td2] = table.addRow()
			td1.text(config.colorTW.term.name)
			td2.text(String(cv ?? ''))
		}
		if (config.shapeTW) {
			const sv = this.getCategoryValue('shape', sample, config.shapeTW)
			const [td1, td2] = table.addRow()
			td1.text(config.shapeTW.term.name)
			td2.text(String(sv ?? ''))
		}
		if (config.scaleDotTW) {
			const dv = this.getCategoryValue('scale', sample, config.scaleDotTW)
			const [td1, td2] = table.addRow()
			td1.text(config.scaleDotTW.term.name)
			td2.text(String(dv ?? ''))
		}
		if (sample.info) {
			for (const [k, v] of Object.entries(sample.info)) {
				const [td1, td2] = table.addRow()
				td1.text(k)
				td2.text(String(v))
			}
		}
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

	addCategory(node, table) {
		const samples = this.samples
		const chart = this.chart
		const tw = this.getTW(node.category)
		node.added = true
		const div = this.tableDiv.append('div')
		if (!table) table = table2col({ holder: div, disableScroll: true, cellPadding: '5px' })
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
							node.value = this.getCategoryValue(node.category, sample, tw, true)
							break
						}
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

		for (const child of node.children) if (!child.added) this.addCategory(child, table)
		if (node.children.length == 0 && this.displaySample) {
			for (const sample of node.samples) {
				if ('info' in sample)
					for (const [k, v] of Object.entries(sample.info)) {
						const [tdlabel, td] = table.addRow()
						tdlabel.text(k)
						td.text(v)
					}

				const [tdlabel, td] = table.addRow()
				tdlabel.text(this.scatter.settings.itemLabel)
				td.text(sample.sample || sample.cellId)
			}
		}
	}

	addNodes(category, tw) {
		for (const sample of this.samples) {
			const value = this.getCategoryValue(category, sample, tw)
			let parentId = ''
			for (const pc of this.parentCategories) parentId += this.getCategoryValue(pc, sample, this.parentTW)
			const id = value + parentId
			let node = this.tree.find(item => item.id == id && item.parentId == parentId)
			const parent = this.tree.find(item => item.id == parentId)
			if (!node) {
				node = { id, parentId, samples: [], level: this.level, category, children: [], value }
				this.tree.push(node)
			}
			node.samples.push(sample)
			if (parent) parent.children.push(node)
		}
		this.parentCategories.unshift(category)
		this.parentTW = tw
		this.level++
	}

	getCategoryValue(category, d, tw, includeMutation = false) {
		if (category == '') return ''
		let value = d[category]
		if (tw?.term.type == 'geneVariant' && tw.q?.type == 'values') {
			const mutation = value.split(', ')[0]
			for (const id in mclass) {
				const class_info = mclass[id]
				if (mutation == class_info.label) {
					const mname = d.cat_info[category].find(m => m.class == class_info.key).mname
					if (mname && includeMutation) value = `${mname} ${value}`
				}
			}
		}
		if (tw?.term.type == 'date') value = getDateStrFromNumber(value)
		else if (typeof value == 'number' && value % 1 != 0) value = roundValueAuto(value)
		return value
	}
}

export function distance(x1: number, y1: number, x2: number, y2: number, chart: any, xMin, xMax, yMin, yMax): number {
	const convertedX1 = getCoordinate(x1, xMin, xMax)
	const convertedX2 = getCoordinate(x2, xMin, xMax)
	const convertedY1 = getCoordinate(y1, yMin, yMax)
	const convertedY2 = getCoordinate(y2, yMin, yMax)
	const x = chart.xAxisScale(convertedX2) - chart.xAxisScale(convertedX1)
	const y = chart.yAxisScale(convertedY2) - chart.yAxisScale(convertedY1)
	const distance = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))
	return distance
}
