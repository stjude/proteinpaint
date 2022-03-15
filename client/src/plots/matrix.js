import { getCompInit, copyMerge } from '../common/rx.core'
import { select } from 'd3-selection'
import { scaleOrdinal, schemeCategory10, schemeCategory20 } from 'd3-scale'
import { fillTermWrapper, termsettingInit } from '../common/termsetting'
import { MatrixCluster } from './matrix.cluster'
import { MatrixControls } from './matrix.controls'
import htmlLegend from '../html.legend'
import { mclass } from '../../shared/common'
import { Menu } from '../dom/menu'

class Matrix {
	constructor(opts) {
		this.type = 'matrix'
		setInteractivity(this)
		setRenderers(this)
		this.currData = { samples: {}, refs: { byTermId: {} }, lastTerms: [], lastFilter: {} }
	}

	async init(appState) {
		const opts = this.opts
		const holder = opts.controls ? opts.holder : opts.holder.append('div')
		const controls = this.opts.controls ? null : holder.append('div')
		const svg = holder
			.append('svg')
			.style('margin', '20px 10px')
			.style('overflow', 'visible')
		const mainG = svg
			.append('g')
			.on('mouseover', this.showCellInfo)
			.on('mouseout', this.mouseout)

		const tip = new Menu({ padding: '5px' })
		this.dom = {
			header: opts.header,
			controls,
			holder,
			svg,
			mainG,
			sampleGrpLabelG: mainG.append('g').attr('class', 'sjpp-matrix-series-group-label-g'),
			termGrpLabelG: mainG.append('g').attr('class', 'sjpp-matrix-term-group-label-g'),
			cluster: mainG.append('g').attr('class', 'sjpp-matrix-cluster-g'),
			seriesesG: mainG.append('g').attr('class', 'sjpp-matrix-serieses-g'),
			sampleLabelG: mainG.append('g').attr('class', 'sjpp-matrix-series-label-g'),
			termLabelG: mainG
				.append('g')
				.attr('class', 'sjpp-matrix-term-label-g')
				.on('click', this.showTermMenu),
			legendDiv: holder.append('div').style('margin', '5px 5px 15px 50px'),
			tip,
			menutop: tip.d.append('div'),
			menubody: tip.d.append('div')
		}

		this.dom.tip.onHide = () => {
			delete this.termBeingEdited
		}
		this.config = appState.plots.find(p => p.id === this.id)
		this.settings = Object.assign({}, this.config.settings.matrix)
		if (this.dom.header) this.dom.header.html('Sample Matrix')

		this.setControls(appState)
		this.clusterRenderer = new MatrixCluster({ holder: this.dom.cluster, app: this.app, parent: this })
		this.legendRenderer = htmlLegend(this.dom.legendDiv, {
			settings: {
				legendOrientation: 'grid',
				legendTextAlign: 'left'
			},
			handlers: {
				legend: {
					click: this.legendClick
				}
			}
		})

		// will use the same pill to show term edit menu
		this.pill = termsettingInit({
			tip: this.dom.tip,
			menudiv: this.dom.menubody,
			menuOptions: 'edit',
			vocabApi: this.app.vocabApi,
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			numericEditMenuVersion: ['discrete', 'continuous'],
			//holder: {}, //self.dom.inputTd.append('div'),
			//debug: opts.debug,
			renderAs: 'none',
			callback: tw => {
				// data is object with only one needed attribute: q, never is null
				if (tw && !tw.q) throw 'data.q{} missing from pill callback'
				const t = this.termBeingEdited
				console.log(77, t, tw)
				//delete this.termBeingEdited
				//const termgroups = JSON.parse(this.config.termgroups
				if (tw) {
					if (t && t.tw) tw.$id = t.tw.$id
					this.pill.main(tw)
					this.app.dispatch({
						type: 'plot_nestedEdits',
						id: opts.id,
						edits: [
							{
								nestedKeys: ['termgroups', t.grpIndex, 'lst', t.index],
								value: tw
							}
						]
					})
				} else {
					// reset the pill data
					console.log('no tw')
				}
				this.dom.tip.hide()
			}
		})
	}

	setControls(appState) {
		if (this.opts.controls) return
		this.controlsRenderer = new MatrixControls(
			{
				app: this.app,
				id: this.id,
				parent: this,
				holder: this.dom.controls
			},
			appState
		)
	}

	/*reactsTo(action) {
		if (action.type == 'plot_edit') {
			// note: parent 'plot' component already checked against action.id == this.id
			// no need to react to edits to controls panel 
			return action.config && action.config.settings && actions.config.settings.matrix
		}
		return true
	}*/

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		return {
			isVisible: true,
			config,
			filter: appState.termfilter.filter
		}
	}

	async main() {
		try {
			this.config = this.state.config
			const prevTranspose = this.settings.transpose
			Object.assign(this.settings, this.config.settings)

			// get the data
			const reqOpts = this.getDataRequestOpts()
			// this will write annotation data to this.currData
			await this.app.vocabApi.setAnnotatedSampleData(reqOpts, this.currData)

			// process the data
			this.setSampleGroupsOrder(this.currData)
			this.setTermOrder(this.currData)
			this.setLayout()
			this.serieses = this.getSerieses(this.currData)
			// render the data
			this.render()

			const [xGrps, yGrps] = !this.settings.matrix.transpose ? ['sampleGrps', 'termGrps'] : ['termGrps', 'sampleGrps']
			this.clusterRenderer.main({
				settings: this.settings.matrix,
				xGrps: this[xGrps],
				yGrps: this[yGrps],
				dimensions: this.dimensions
			})

			await this.adjustSvgDimensions(prevTranspose)
			this.legendRenderer(this.legendData)
		} catch (e) {
			throw e
		}
	}

	// creates an opts object for the vocabApi.getNestedChartsData()
	getDataRequestOpts() {
		const terms = []
		for (const grp of this.config.termgroups) {
			terms.push(...grp.lst)
		}
		if (this.config.divideBy) terms.push(this.config.divideBy)
		return { terms, filter: this.state.filter, data: this.currData }
	}

	setSampleGroupsOrder(data) {
		const s = this.settings.matrix
		const defaultSampleGrp = { id: undefined, lst: [] }

		const sampleGroups = new Map()
		if (!this.config.divideBy) {
			defaultSampleGrp.lst = data.lst
			defaultSampleGrp.name = ''
		} else {
			defaultSampleGrp.name = 'Not annotated'
			const term = this.config.divideBy.term
			const $id = this.config.divideBy.$id
			const values = term.values || {}
			const ref = data.refs.byTermId[$id] || {}

			for (const row of data.lst) {
				const anno = row[$id]
				if ($id in row) {
					const key = anno.key
					if (!sampleGroups.has(key)) {
						sampleGroups.set(key, {
							id: key,
							name: key in values && values[key].label ? values[key].label : key,
							lst: [],
							order: ref.bins ? ref.bins.findIndex(bin => bin.name == key) : 0,
							tw: this.config.divideBy
						})
					}
					sampleGroups.get(key).lst.push(row)
				} else {
					defaultSampleGrp.lst.push(row)
				}
			}
		}

		if (defaultSampleGrp.lst.length) {
			sampleGroups.set(undefined, defaultSampleGrp)
		}

		// TODO: sort sample groups, maybe by sample count, value order, etc
		this.sampleGroups = [...sampleGroups.values()].sort((a, b) => a.order - b.order)
		//this.sampleGroupKeys = [...sampleGroups.keys()] -- not needed?
		this.sampleOrder = []
		const sampleSorter = (a, b) => {
			const k = a[s.sortSamplesBy] // TODO: support many types of sorting
			const l = b[s.sortSamplesBy]
			if (k < l) return -1
			if (k > l) return 1
			return 0
		}

		let total = 0
		for (const [grpIndex, grp] of this.sampleGroups.entries()) {
			grp.lst.sort(sampleSorter)
			for (const [index, row] of grp.lst.entries()) {
				this.sampleOrder.push({ grp, grpIndex, row, index, prevGrpTotalIndex: total, totalIndex: total + index })
			}
			total += grp.lst.length
		}
	}

	setTermOrder(data) {
		this.termGrp = this.config.termgroups
		this.termOrder = []
		let total = 0
		for (const [grpIndex, grp] of this.config.termgroups.entries()) {
			for (const [index, tw] of grp.lst.entries()) {
				const ref = data.refs.byTermId[tw.$id] || {}
				this.termOrder.push({ grp, grpIndex, tw, index, prevGrpTotalIndex: total, totalIndex: total + index, ref })
			}
			total += grp.lst.length
		}
	}

	setLayout() {
		const s = this.settings.matrix
		const [col, row] = !s.transpose ? ['sample', 'term'] : ['term', 'sample']
		const [_t_, _b_] = s.collabelpos == 'top' ? ['', 'Grp'] : ['Grp', '']
		const [_l_, _r_] = s.rowlabelpos == 'left' ? ['', 'Grp'] : ['Grp', '']
		const top = col + _t_
		const btm = col + _b_
		const left = row + _l_
		const right = row + _r_

		// TODO: should not need aliases, rename class properties to simplify
		this.samples = this.sampleOrder
		this.sampleGrps = this.sampleOrder.filter(s => s.index === 0)
		this.terms = this.termOrder
		this.termGrps = this.termOrder.filter(t => t.index === 0)

		const layout = {}
		const sides = { top, btm, left, right }
		for (const direction in sides) {
			const d = sides[direction]
			const Direction = direction[0].toUpperCase() + direction.slice(1)
			layout[direction] = {
				data: this[`${d}s`],
				offset: s[`${d}LabelOffset`],
				box: this.dom[`${d}LabelG`],
				key: this[`${d}Key`],
				label: this[`${d}Label`],
				render: this[`render${Direction}Label`]
			}
		}

		const yOffset = layout.top.offset + s.margin.top
		const xOffset = layout.left.offset + s.margin.left
		const dx = s.colw + s.colspace
		const nx = this[`${col}s`].length
		const dy = s.rowh + s.rowspace
		const ny = this[`${row}s`].length
		const mainw = nx * dx + (this[`${col}Grps`].length - 1) * s.colgspace
		const mainh = ny * dy + (this[`${row}Grps`].length - 1) * s.rowgspace

		layout.top.attr = {
			boxTransform: `translate(${xOffset}, ${yOffset - s.collabelgap})`,
			labelTransform: 'rotate(-90)',
			labelAnchor: 'start',
			labelGY: 0,
			labelGTransform: this[`col${_t_}LabelGTransform`],
			fontSize: s.colw + s.colspace - (_t_ == 'Grp' ? 0 : 4)
		}

		layout.btm.attr = {
			boxTransform: `translate(${xOffset}, ${yOffset + mainh + s.collabelgap})`,
			labelTransform: 'rotate(-90)',
			labelAnchor: 'end',
			labelGY: 0,
			labelGTransform: this[`col${_b_}LabelGTransform`],
			fontSize: s.colw + s.colspace - (_b_ == 'Grp' ? 0 : 4)
		}

		layout.left.attr = {
			boxTransform: `translate(${xOffset - s.rowlabelgap}, ${yOffset})`,
			labelTransform: '',
			labelAnchor: 'end',
			labelGX: 0,
			labelGTransform: this[`row${_l_}LabelGTransform`],
			fontSize: s.rowh + s.rowspace - (_l_ == 'Grp' ? 2 : 4)
		}

		layout.right.attr = {
			boxTransform: `translate(${xOffset + mainw + s.rowlabelgap}, ${yOffset})`,
			labelTransform: '',
			labelAnchor: 'start',
			labelGX: 0,
			labelGTransform: this[`row${_r_}LabelGTransform`],
			fontSize: s.rowh + s.rowspace - (_r_ == 'Grp' ? 2 : 4)
		}

		this.layout = layout
		this.dimensions = {
			dx,
			dy,
			xOffset,
			yOffset,
			mainw,
			mainh
		}
	}

	getSerieses(data) {
		const s = this.settings.matrix
		const serieses = []
		const dx = s.colw + s.colspace
		const dy = s.rowh + s.rowspace
		const keysByTermId = {}

		for (const { totalIndex, grpIndex, row } of this.sampleOrder) {
			const series = {
				row,
				cells: [],
				x: !s.transpose ? totalIndex * dx + grpIndex * s.colgspace : 0,
				y: !s.transpose ? 0 : totalIndex * dy + grpIndex * s.rowgspace
			}

			for (const t of this.termOrder) {
				const $id = t.tw.$id
				// TODO: generalize the alternative ID handling
				const anno = row[$id]
				if (!anno) continue
				const termid = 'id' in t.tw.term ? t.tw.term : t.tw.term.name
				const key = anno.key
				const values = t.tw.term.values || {}
				const label = 'label' in anno ? anno.label : key in values && values[key].label ? values[key].label : key

				if (!anno.values) {
					// only one rect for this sample annotation
					series.cells.push({
						sample: row.sample,
						tw: t.tw,
						term: t.tw.term,
						termid,
						$id,
						key,
						label,
						x: !s.transpose ? 0 : t.totalIndex * dx + t.grpIndex * s.colgspace,
						y: !s.transpose ? t.totalIndex * dy + t.grpIndex * s.rowgspace : 0,
						order: t.ref.bins ? t.ref.bins.findIndex(bin => bin.name == key) : 0
					})
				} else {
					// some term types like geneVariant can have multiple values for the same term,
					// which will be renderd as multiple smaller, non-overlapping rects within the same cell
					const height = !s.transpose ? s.rowh / anno.values.length : 0
					const width = !s.transpose ? 0 : s.colw / anno.values.length
					for (const [i, value] of anno.values.entries()) {
						series.cells.push({
							sample: row.sample,
							tw: t.tw,
							term: t.tw.term,
							termid,
							$id,
							key,
							label: value.class ? mclass[value.class].label : '',
							value,
							x: !s.transpose ? 0 : t.totalIndex * dx + t.grpIndex * s.colgspace + width * i,
							y: !s.transpose ? t.totalIndex * dy + t.grpIndex * s.rowgspace + height * i : 0,
							height,
							width,
							fill: mclass[value.class].color,
							class: value.class,
							order: t.ref.bins ? t.ref.bins.findIndex(bin => bin.name == key) : 0
						})
					}
				}

				// TODO: improve logic for excluding data from legend
				if (t.tw.q.mode != 'continuous' && t.tw.term.type != 'geneVariant') {
					if (!t.tw.$id) console.log(427, t.tw.$id, t.tw.term?.id)
					if (!keysByTermId[t.tw.$id]) keysByTermId[t.tw.$id] = { ref: t.ref, values: {} }
					if (!keysByTermId[t.tw.$id].values[key]) keysByTermId[t.tw.$id].values[key] = { key, label }
				}
			}
			serieses.push(series)
		}

		this.setLegendData(keysByTermId, data.refs)

		return serieses
	}

	sampleKey(series) {
		return series.row.sample
	}

	sampleLabel(series) {
		return series.row.sample
	}

	sampleGrpKey(s) {
		return s.grp.name
	}

	sampleGrpLabel(s) {
		return s.grp.name
	}

	termKey(t) {
		return t.tw.$id
	}

	termLabel(t) {
		return t.tw.term.name
	}

	termGrpKey(t) {
		return t.grp.name
	}

	termGrpLabel(t) {
		return t.grp.name
	}

	setLegendData(keysByTermId, refs) {
		this.colorScaleByTermId = {}
		const legendData = new Map()
		for (const $id in keysByTermId) {
			const term = this.termOrder.find(t => t.tw.$id == $id).tw.term
			const termid = term.id
			const keys = Object.keys(keysByTermId[$id].values)
			const ref = keysByTermId[$id].ref
			if (ref.bins)
				keys.sort((a, b) => ref.bins.findIndex(bin => bin.name === a) - ref.bins.findIndex(bin => bin.name === b))

			this.colorScaleByTermId[$id] = keys.length < 11 ? scaleOrdinal(schemeCategory10) : scaleOrdinal(schemeCategory20)

			legendData.set($id, {
				name: term.name,
				items: keys.map((key, i) => {
					const item = keysByTermId[$id].values[key]
					return {
						termid,
						key,
						text: item.label,
						color: this.colorScaleByTermId[$id](key),
						order: i
					}
				})
			})
		}

		this.legendData = [...legendData.values()]
	}
}

export const matrixInit = getCompInit(Matrix)
// this alias will allow abstracted dynamic imports
export const componentInit = matrixInit

function setRenderers(self) {
	self.render = function() {
		const s = self.settings.matrix
		const l = self.layout
		const d = self.dimensions
		const duration = self.dom.svg.attr('width') ? s.duration : 0
		self.renderSerieses(s, l, d, duration)
		self.renderLabels(s, l, d, duration)
	}

	self.renderSerieses = function(s, l, d, duration) {
		self.dom.seriesesG
			.transition()
			.duration(duration)
			.attr('transform', `translate(${d.xOffset},${d.yOffset})`)

		const sg = self.dom.seriesesG.selectAll('.sjpp-mass-series-g').data(this.serieses, series => series.row.sample)

		sg.exit().remove()
		sg.each(self.renderSeries)
		sg.enter()
			.append('g')
			.attr('class', 'sjpp-mass-series-g')
			.style('opacity', 0.001)
			.each(self.renderSeries)
	}

	self.renderSeries = function(series) {
		const s = self.settings.matrix
		const g = select(this)
		const duration = g.attr('transform') ? s.duration : 0

		g.transition()
			.duration(duration)
			.attr('transform', `translate(${series.x},${series.y})`)
			.style('opacity', 1)

		const rects = g.selectAll('rect').data(series.cells, (cell, i) => cell.sample + ';;' + cell.tw.$id)
		rects.exit().remove()
		rects.each(self.renderCell)
		rects
			.enter()
			.append('rect')
			.each(self.renderCell)
	}

	self.renderCell = function(cell) {
		if (!cell.fill)
			cell.fill = cell.$id in self.colorScaleByTermId ? self.colorScaleByTermId[cell.$id](cell.key) : getRectFill(cell)
		const s = self.settings.matrix
		const rect = select(this)
			.transition()
			.duration('x' in this ? s.duration : 0)
			.attr('x', cell.x)
			.attr('y', cell.y)
			.attr('width', cell.width ? cell.width : s.colw)
			.attr('height', cell.height ? cell.height : s.rowh)
			//.attr('stroke', '#eee')
			//.attr('stroke-width', 1)
			.attr('fill', cell.fill)
	}

	self.renderLabels = function(s, l, d, duration) {
		for (const direction of ['top', 'btm', 'left', 'right']) {
			const side = l[direction]
			side.box
				.transition()
				.duration(duration)
				.attr('transform', side.attr.boxTransform)

			const labels = side.box.selectAll('g').data(side.data, side.key)
			labels.exit().remove()
			labels.each(renderLabel)
			labels
				.enter()
				.append('g')
				.each(renderLabel)

			function renderLabel(lab) {
				const g = select(this)
				const textduration = g.attr('transform') ? duration : 0
				g.transition()
					.duration(textduration)
					.attr('transform', side.attr.labelGTransform)

				if (!g.select('text').size()) g.append('text')
				g.select('text')
					.attr('fill', '#000')
					.transition()
					.duration(textduration)
					.attr('opacity', side.attr.fontSize < 6 ? 0 : 1)
					.attr('font-size', side.attr.fontSize)
					.attr('text-anchor', side.attr.labelAnchor)
					.attr('transform', side.attr.labelTransform)
					.attr('cursor', 'pointer')
					.text(side.label)
			}
		}
	}

	self.colLabelGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		const x = lab.grpIndex * s.colgspace + lab.totalIndex * d.dx + 0.8 * s.colw
		return `translate(${x},0)`
	}

	self.colGrpLabelGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		const x = lab.grpIndex * s.colgspace + lab.prevGrpTotalIndex * d.dx + (lab.grp.lst.length * d.dx) / 2 + 3
		return `translate(${x},0)`
	}

	self.rowLabelGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		const y = lab.grpIndex * s.rowgspace + lab.totalIndex * d.dy + 0.7 * s.rowh
		return `translate(0,${y})`
	}

	self.rowGrpLabelGTransform = (lab, grpIndex) => {
		const s = self.settings.matrix
		const d = self.dimensions
		const y = lab.grpIndex * s.rowgspace + lab.prevGrpTotalIndex * d.dy + (lab.grp.lst.length * d.dy) / 2 + 3
		return `translate(0,${y})`
	}

	self.adjustSvgDimensions = async function(prevTranspose) {
		const s = self.settings.matrix
		const d = self.dimensions
		const duration = self.dom.svg.attr('width') ? s.duration : 10

		// wait for labels to render; when transposing, must wait for
		// the label rotation to end before measuring the label height and width
		await sleep(prevTranspose == s.transpose ? duration : s.duration)

		const topBox = self.layout.top.box.node().getBBox()
		const btmBox = self.layout.btm.box.node().getBBox()
		const leftBox = self.layout.left.box.node().getBBox()
		const rtBox = self.layout.right.box.node().getBBox()

		d.extraWidth = leftBox.width + rtBox.width + s.margin.left + s.margin.right + s.rowlabelgap * 2
		d.extraHeight = topBox.height + btmBox.height + s.margin.top + s.margin.bottom + s.collabelgap * 2
		d.svgw = d.mainw + d.extraWidth
		d.svgh = d.mainh + d.extraHeight
		self.dom.svg
			.transition()
			.duration(duration)
			.attr('width', d.svgw)
			.attr('height', d.svgh)

		const x = leftBox.width - self.layout.left.offset
		const y = topBox.height - self.layout.top.offset
		self.dom.mainG
			.transition()
			.duration(duration)
			.attr('transform', `translate(${x},${y})`)
	}
}

function setInteractivity(self) {
	self.showCellInfo = function() {
		if (self.termBeingEdited) return
		const d = event.target.__data__
		if (!d || !d.term || !d.sample) return
		if (event.target.tagName == 'rect') {
			const rows = [
				`<tr><td style='text-align: center'>Sample: ${d.sample}</td></tr>`,
				`<tr><td style='text-align: center'>${d.term.name}</td></tr>`,
				`<tr><td style='text-align: center; color: ${d.fill}'>${d.label}</td></tr>`
			]

			if (d.term.type == 'geneVariant') {
				rows.push()
				if (d.value.alt)
					rows.push(`<tr><td style='text-align: center'>ref=${d.value.ref}, alt=${d.value.alt}</td></tr>`)
				if (d.value.isoform) rows.push(`<tr><td style='text-align: center'>Isoform: ${d.value.isoform}</td></tr>`)
				if (d.value.mname) rows.push(`<tr><td style='text-align: center'>${d.value.mname}</td></tr>`)
				if (d.value.chr) rows.push(`<tr><td style='text-align: center'>${d.value.chr}:${d.value.pos}</td></tr>`)
			}

			self.dom.menutop.selectAll('*').remove()
			self.dom.menubody.html(`<table class='sja_simpletable'>${rows.join('\n')}</table>`)
			self.dom.tip.show(event.clientX, event.clientY)
		}
	}

	self.mouseout = function() {
		if (!self.termBeingEdited) self.dom.tip.hide()
	}

	self.showTermMenu = async function() {
		event.stopPropagation()
		// event.target should be remembered before any await
		self.eventTarget = event.target
		const d = event.target.__data__
		if (!d || !d.tw) return
		self.termBeingEdited = d
		self.dom.menutop.selectAll('*').remove()
		self.dom.menubody
			.style('padding', 0)
			.selectAll('*')
			.remove()

		//self.dom.tip.d.on('click.sjpp_matrix_menuclick', () => event.stopPropagation())

		self.dom.menutop
			.append('div')
			.selectAll(':scope>.sja_menuoption')
			.data([
				{ label: 'Edit', callback: self.showTermEditMenu },
				{ label: 'Insert', callback: self.showTermInsertMenu },
				{ label: 'Remove', callback: self.removeTerm }
			])
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', 'inline-block')
			.html(d => d.label)
			.on('click', d => {
				event.stopPropagation()
				d.callback(d)
			})

		self.dom.tip.showunder(event.target)
	}

	self.showTermEditMenu = async () => {
		event.stopPropagation()
		const d = self.eventTarget.__data__
		await self.pill.main(Object.assign({ doNotHideTipInMain: true }, d.tw))
		self.dom.menubody.selectAll('*').remove()
		self.pill.showMenu(self.eventTarget)
	}

	self.showTermInsertMenu = () => {
		//self.dom.tip.clear()
		//self.dom.menutop = self.dom.tip.d.append('div')
		self.dom.menubody.selectAll('*').remove()

		self.dom.editbtns = self.dom.menubody.append('div')
		self.dom.editbody = self.dom.menubody.append('div')

		const grpNameDiv = self.dom.editbtns.append('div').style('margin', '10px 5px')
		grpNameDiv.append('label').html('Insert terms in ')
		self.dom.grpNameSelect = grpNameDiv.append('select').on('change', () => {
			const value = self.dom.grpNameSelect.property('value')
			self.dom.grpNameTextInput
				.property('disabled', value == 'current')
				.property('value', value == 'current' ? self.termBeingEdited.grp.name : newGrpName)
		})
		self.dom.grpNameSelect
			.selectAll('option')
			.data([{ label: 'current', value: 'current', selected: true }, { label: 'new', value: 'new' }])
			.enter()
			.append('option')
			.attr('selected', d => d.selected)
			.html(d => d.label)

		grpNameDiv.append('span').html('&nbsp;group: &nbsp;')

		let newGrpName = ''
		self.dom.grpNameTextInput = grpNameDiv
			.append('input')
			.attr('type', 'text')
			.property('disabled', true)
			.property('value', self.termBeingEdited.grp.name)
			.on('change', () => {
				const name = self.dom.grpNameTextInput.property('value')
				if (name == self.termBeingEdited.grp.name) {
				} else {
					newGrpName = self.dom.grpNameTextInput.property('value')
				}
			})

		const insertPosInput = self.dom.editbtns
			.append('div') /*.style('display', 'inline-block')*/
			.style('margin', '10px 5px')
		insertPosInput
			.append('div')
			.style('display', 'inline-block')
			.style('padding-right', '10px')
			.html('Insert&nbsp')
		const insertRadiosDiv = insertPosInput.append('div').style('display', 'inline-block')

		self.insertRadioId = `sjpp-matrix-${self.id}-insert-pos`
		const aboveLabel = insertRadiosDiv.append('label')
		aboveLabel
			.append('input')
			.attr('type', 'radio')
			.attr('value', 'above')
			.property('checked', true)
			.attr('name', self.insertRadioId)
		aboveLabel.append('span').html('above')

		insertRadiosDiv.append('span').html('&nbsp;&nbsp')

		const belowLabel = insertRadiosDiv.append('label')
		belowLabel
			.append('input')
			.attr('type', 'radio')
			.attr('value', 'below')
			.attr('name', self.insertRadioId)
		belowLabel.append('span').html('&nbsp;below')

		const termSrcDiv = self.dom.editbtns.append('div')
		termSrcDiv.append('span').html('Source&nbsp;')

		self.dom.dictTermBtn = termSrcDiv
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', 'inline-block')
			//.style('font-size', '0.8em')
			.html('Dictionary term')
			.on('click', self.showDictTermSelection)

		self.dom.textTermBtn = termSrcDiv
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('display', 'inline-block')
			//.style('font-size', '0.8em')
			.html('Text input')
			.on('click', self.showTermTextInput)

		self.dom.dictTermBtn.on('click')()
	}

	self.showDictTermSelection = async () => {
		event.stopPropagation()
		self.dom.dictTermBtn.style('text-decoration', 'underline')
		self.dom.textTermBtn.style('text-decoration', '')

		const termdb = await import('../termdb/app')
		self.dom.editbody.selectAll('*').remove()
		termdb.appInit({
			holder: self.dom.editbody.append('div'),
			vocabApi: self.app.vocabApi,
			state: {
				vocab: self.state.vocab,
				activeCohort: self.activeCohort,
				nav: {
					header_mode: 'search_only'
				},
				tree: {
					usecase: { target: 'matrix', detail: 'termgroups' }
				}
			},
			tree: {
				submit_lst: async termlst => {
					const newterms = await Promise.all(
						termlst.map(async term => {
							const tw = { id: term.id, term }
							await fillTermWrapper(tw)
							return tw
						})
					)
					const pos = select(`input[name='${self.insertRadioId}']:checked`).property('value')
					const t = self.termBeingEdited
					const termgroups = JSON.parse(JSON.stringify(self.config.termgroups))
					if (self.dom.grpNameSelect.property('value') == 'current') {
						const grp = termgroups[t.grpIndex]
						const i = pos == 'above' ? t.index : t.index + 1
						// remove this element
						grp.lst.splice(i, 0, ...newterms)
						self.app.dispatch({
							type: 'plot_nestedEdits',
							id: self.opts.id,
							edits: [
								{
									nestedKeys: ['termgroups', t.grpIndex, 'lst'],
									value: grp.lst
								}
							]
						})
					} else {
						const i = pos == 'above' ? t.grpIndex : t.grpIndex + 1
						termgroups.splice(i, 0, {
							name: self.dom.grpNameTextInput.property('value'),
							lst: newterms
						})
						self.app.dispatch({
							type: 'plot_edit',
							id: self.opts.id,
							config: { termgroups }
						})
					}
					self.dom.tip.hide()
					delete self.termBeingEdited
				}
			}
		})
	}

	self.showTermTextInput = opt => {
		event.stopPropagation()
		self.dom.dictTermBtn.style('text-decoration', '')
		self.dom.textTermBtn.style('text-decoration', 'underline')

		self.dom.editbody.selectAll('*').remove()
		self.dom.editbody
			.append('button')
			.style('margin', '0 5px')
			.html('Submit')
			.on('click', async () => {
				event.stopPropagation()
				const text = ta.property('value')
				const lines = text.split('\n').map(line => line.trim())
				const ids = lines.filter(id => !!id)
				const terms = await self.app.vocabApi.getTermTypes(ids)
				console.log(terms)
				const termgroups = JSON.parse(JSON.stringify(self.config.termgroups))
				const name = self.dom.grpNameTextInput.property('value')
				console.log(name)
				let grp = termgroups.find(g => g.name === name)
				if (!grp) {
					grp = { name, lst: [] }
					termgroups.push(grp)
				}
				for (const id of lines) {
					if (!(id in terms)) continue
					const tw = { term: terms[id] }
					await fillTermWrapper(tw)
					grp.lst.push(tw)
				}

				self.app.dispatch({
					type: 'plot_edit',
					id: self.opts.id,
					config: { termgroups }
				})
				self.dom.tip.hide()
				delete self.termBeingEdited
			})

		const ta = self.dom.editbody
			.append('div')
			.style('text-align', 'left')
			.append('textarea')
			.attr('placeholder', 'term')
			.style('width', '300px')
			.style('height', '300px')
			.style('margin', '5px')
			.style('padding', '5px')
			.on('keydown', () => {
				const keyCode = event.keyCode || event.which
				// handle tab key press, otherwise it will cause the focus to move to another input
				if (keyCode == 9) {
					event.preventDefault()
					const t = event.target
					const s = t.selectionStart
					t.value = t.value.substring(0, t.selectionStart) + '\t' + t.value.substring(t.selectionEnd)
					t.selectionEnd = s + 1
				}
			})
	}

	self.removeTerm = () => {
		const t = self.termBeingEdited
		const termgroups = JSON.parse(JSON.stringify(self.config.termgroups))
		const grp = termgroups[t.grpIndex]
		// remove this element
		grp.lst.splice(t.index, 1)
		if (grp.lst.length) {
			self.app.dispatch({
				type: 'plot_nestedEdits',
				id: self.opts.id,
				edits: [
					{
						nestedKeys: ['termgroups', t.grpIndex, 'lst'],
						value: grp.lst
					}
				]
			})
		} else {
			// remove this now-empty group
			termgroups.splice(t.grpIndex, 1)
			self.app.dispatch({
				type: 'plot_edit',
				id: self.opts.id,
				config: { termgroups }
			})
		}
		delete self.termBeingEdited
		self.dom.tip.hide()
	}

	self.legendClick = function() {}
}

function getRectFill(d) {
	if (d.fill) return d.fill
	/*** TODO: class should be for every values entry, as applicable ***/
	const cls = d.class || (Array.isArray(d.values) && d.values[0].class)
	return cls ? mclass[cls].color : '#555'
}

export async function getPlotConfig(opts, app) {
	const config = {
		// data configuration
		termgroups: [],
		samplegroups: [],
		divideBy: null,

		// rendering options
		settings: {
			controls: {
				isOpen: false // control panel is hidden by default
			},
			matrix: {
				margin: {
					top: 10,
					right: 5,
					bottom: 20,
					left: 50
				},
				sortSamplesBy: 'sample',
				colw: 14,
				colspace: 1,
				colgspace: 8,
				collabelpos: 'bottom',
				collabelvisible: true,
				colglabelpos: true,
				collabelgap: 5,
				rowh: 18,
				rowspace: 1,
				rowgspace: 8,
				rowlabelpos: 'left', // | 'right'
				rowlabelgap: 5,
				rowlabelvisible: true,
				rowglabelpos: true,
				rowlabelgap: 5,
				transpose: false,
				sampleLabelOffset: 120,
				sampleGrpLabelOffset: 120,
				termLabelOffset: 80,
				termGrpLabelOffset: 80,
				duration: 250
			}
		}
	}

	// may apply term-specific changes to the default object
	copyMerge(config, opts)
	const promises = []
	for (const grp of config.termgroups) {
		for (const tw of grp.lst) promises.push(fillTermWrapper(tw, app.vocabApi))
	}
	if (config.divideBy) promises.push(fillTermWrapper(config.divideBy, app.vocabApi))
	await Promise.all(promises)
	return config
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}
