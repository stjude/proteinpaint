import { getCompInit, copyMerge } from '../common/rx.core'
import { select } from 'd3-selection'
import { scaleOrdinal, schemeCategory10, schemeCategory20 } from 'd3-scale'
import { fillTermWrapper } from '../common/termsetting'
import { MatrixCluster } from './matrix.cluster'
import { MatrixControls } from './matrix.controls'
import htmlLegend from '../html.legend'
import { mclass } from '../../shared/common'
import { Menu } from '../dom/menu'
import { setInteractivity } from './matrix.interactivity'
import { setRenderers } from './matrix.renderers'
import { getSampleSorter, getTermSorter } from './matrix.sort'

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
			sampleGrpLabelG: mainG
				.append('g')
				.attr('class', 'sjpp-matrix-series-group-label-g')
				.on('click', this.showSampleGroupMenu),
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
			this.lastActiveTerm = this.activeTerm
			delete this.activeTerm
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

		// enable embedding of termsetting and tree menu inside self.dom.menu
		this.customTipApi = this.dom.tip.getCustomApi({
			d: this.dom.menubody,
			clear: () => {
				this.dom.menubody.selectAll('*').remove()
				return this.customTipApi
			},
			show: () => {
				this.dom.menubody.style('display', 'block')
			},
			hide: () => {
				//this.dom.menubody.style('display', 'none')
			}
		})

		this.setPill(appState)
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
			this.setTermOrder(this.currData)
			this.setSampleGroupsOrder(this.currData)
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
		this.sampleSorter = getSampleSorter(this, s, data.lst)

		const sampleGroups = new Map()
		if (!this.config.divideBy) {
			defaultSampleGrp.lst = data.lst
			defaultSampleGrp.name = ''
		} else {
			defaultSampleGrp.name = 'Not annotated'
			const term = this.config.divideBy.term
			const $id = this.config.divideBy.$id
			const exclude = this.config.divideBy.exclude || []
			const values = term.values || {}
			const ref = data.refs.byTermId[$id] || {}

			for (const row of data.lst) {
				if ($id in row) {
					if (exclude.includes(row[$id].key)) continue
					const key = row[$id].key
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

		let total = 0
		for (const [grpIndex, grp] of this.sampleGroups.entries()) {
			grp.lst.sort(this.sampleSorter)
			for (const [index, row] of grp.lst.entries()) {
				this.sampleOrder.push({ grp, grpIndex, row, index, prevGrpTotalIndex: total, totalIndex: total + index })
			}
			total += grp.lst.length
		}
	}

	setTermOrder(data) {
		this.termSorter = getTermSorter(this, this.settings.matrix, data.lst)
		this.termGrp = this.config.termgroups
		this.termOrder = []
		let total = 0
		for (const [grpIndex, grp] of this.config.termgroups.entries()) {
			const lst = [] // will derive a mutable copy of grp.lst
			for (const [index, tw] of grp.lst.entries()) {
				const counts = { samples: 0, hits: 0 }
				for (const sn in data.samples) {
					const row = data.samples[sn]
					if (tw.$id in row) {
						counts.samples += 1
						counts.hits += Array.isArray(row[tw.$id].values) ? row[tw.$id].values.length : 1
					}
				}
				lst.push({ tw, counts, index })
			}

			lst.sort(this.termSorter)
			for (const [index, t] of lst.entries()) {
				const { tw, counts } = t
				const ref = data.refs.byTermId[t.tw.$id] || {}
				this.termOrder.push({
					grp,
					grpIndex,
					tw,
					index,
					prevGrpTotalIndex: total,
					totalIndex: total + index,
					ref,
					counts
				})
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
				sortSamplesBy: 'selectedTerms',
				sortSamplesTieBreakers: [{ $id: 'sample', sortSamples: {} /*split: {char: '', index: 0}*/ }],
				sortTermsBy: 'asListed', // or sampleCount
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
