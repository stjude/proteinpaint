import { getCompInit, copyMerge } from '../rx'
import { select } from 'd3-selection'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { schemeCategory10 } from 'd3-scale-chromatic'
import { schemeCategory20 } from '#common/legacy-d3-polyfill'
import { axisLeft, axisTop, axisRight, axisBottom } from 'd3-axis'
import { fillTermWrapper } from '../termsetting/termsetting'
import { MatrixCluster } from './matrix.cluster'
import { MatrixControls } from './matrix.controls'
import svgLegend from '../dom/svg.legend'
import { mclass } from '#shared/common'
import { Menu } from '../dom/menu'
import { setInteractivity } from './matrix.interactivity'
import { setRenderers } from './matrix.renderers'
import { getSampleSorter, getTermSorter } from './matrix.sort'
import { dofetch3 } from '../common/dofetch'

class Matrix {
	constructor(opts) {
		this.type = 'matrix'
		setInteractivity(this)
		setRenderers(this)
	}

	async init(appState) {
		const opts = this.opts
		const holder = opts.controls ? opts.holder : opts.holder.append('div')
		const controls = this.opts.controls ? null : holder.append('div')
		const loadingDiv = holder.append('div').style('margin-left', '50px')
		const errdiv = holder
			.append('div')
			.attr('class', 'sja_errorbar')
			.style('display', 'none')
		const svg = holder
			.append('svg')
			.style('margin', '20px 10px')
			.style('overflow', 'visible')
			.on('mousemove.label', this.svgMousemove)
			.on('mouseup.label', this.svgMouseup)
		const mainG = svg
			.append('g')
			.on('mouseover', this.showCellInfo)
			.on('mousemove', this.showCellInfo)
			.on('mouseout', this.mouseout)

		const tip = new Menu({ padding: '5px' })
		this.dom = {
			header: opts.header,
			holder,
			errdiv,
			controls,
			loadingDiv,
			svg,
			mainG,
			sampleGrpLabelG: mainG
				.append('g')
				.attr('class', 'sjpp-matrix-series-group-label-g')
				.on('click', this.showSampleGroupMenu),
			termGrpLabelG: mainG
				.append('g')
				.attr('class', 'sjpp-matrix-term-group-label-g')
				.on('mouseover', this.termGrpLabelMouseover)
				.on('mouseout', this.termGrpLabelMouseout)
				.on('mousedown', this.termGrpLabelMousedown)
				.on('mousemove', this.termGrpLabelMousemove)
				.on('mouseup', this.termGrpLabelMouseup),
			cluster: mainG.append('g').attr('class', 'sjpp-matrix-cluster-g'),
			seriesesG: mainG.append('g').attr('class', 'sjpp-matrix-serieses-g'),
			sampleLabelG: mainG.append('g').attr('class', 'sjpp-matrix-series-label-g'),
			/* // TODO: sample label drag to move
				.on('mouseover', this.sampleLabelMouseover)
				.on('mouseout', this.sampleLabelMouseout)
				.on('mousedown', this.sampleLabelMousedown)
				.on('mousemove', this.sampleLabelMousemove)
				.on('mouseup', this.sampleLabelMouseup)*/ termLabelG: mainG
				.append('g')
				.attr('class', 'sjpp-matrix-term-label-g')
				.on('mouseover', this.termLabelMouseover)
				.on('mouseout', this.termLabelMouseout)
				.on('mousedown', this.termLabelMousedown)
				.on('mousemove', this.termLabelMousemove)
				.on('mouseup', this.termLabelMouseup),
			//legendDiv: holder.append('div').style('margin', '5px 5px 15px 50px'),
			legendG: mainG.append('g'),
			tip,
			menutop: tip.d.append('div'),
			menubody: tip.d.append('div')
		}

		this.dom.tip.onHide = () => {
			this.lastActiveLabel = this.activeLabel
			delete this.activeLabel
		}

		this.config = appState.plots.find(p => p.id === this.id)
		this.settings = Object.assign({}, this.config.settings.matrix)
		if (this.dom.header) this.dom.header.html('Sample Matrix')

		this.setControls(appState)
		this.clusterRenderer = new MatrixCluster({ holder: this.dom.cluster, app: this.app, parent: this })
		this.legendRenderer = svgLegend({
			holder: this.dom.legendG,
			rectFillFxn: d => d.color,
			iconStroke: '#aaa',
			handlers: {
				legend: {
					click: this.legendClick
				}
			}
		})

		// enable embedding of termsetting and tree menu inside self.dom.menu
		this.customTipApi = this.dom.tip.getCustomApi({
			d: this.dom.menubody,
			clear: event => {
				if (event?.target) this.dom.menutop.style('display', 'none')
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
		//TODO: may conflict with serverconfig.commonOverrides
		this.mclass = copyMerge({}, mclass, appState.termdbConfig.mclass || {})
	}

	setControls(appState) {
		if (this.opts.controls) return
		this.controlsRenderer = new MatrixControls(
			{
				app: this.app,
				id: this.id,
				parent: this,
				holder: this.dom.controls,
				getSvg: () => this.dom.svg.node()
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
			filter: appState.termfilter.filter,
			filter0: appState.termfilter.filter0, // read-only, invisible filter currently only used for gdc dataset
			hasVerifiedToken: this.app.vocabApi.hasVerifiedToken(),
			tokenVerificationMessage: this.app.vocabApi.tokenVerificationMessage
		}
	}

	async main() {
		try {
			this.config = JSON.parse(JSON.stringify(this.state.config))
			if (this.mayRequireToken()) return

			const prevTranspose = this.settings.transpose
			Object.assign(this.settings, this.config.settings)

			// get the data
			this.dom.loadingDiv.html('').style('display', '')
			const reqOpts = await this.getDataRequestOpts()
			this.data = await this.app.vocabApi.getAnnotatedSampleData(reqOpts)
			this.dom.loadingDiv.html('Processing data ...')

			this.setAutoDimensions()
			this.setSampleGroups(this.data)
			this.setTermOrder(this.data)
			this.setSampleOrder(this.data)
			this.setSampleCountsByTerm()
			this.setLayout()
			this.serieses = this.getSerieses(this.data)
			this.dom.loadingDiv.html('').style('display', 'none')
			// render the data
			this.render()

			const [xGrps, yGrps] = !this.settings.matrix.transpose ? ['sampleGrps', 'termGrps'] : ['termGrps', 'sampleGrps']
			const d = this.dimensions
			this.clusterRenderer.main({
				settings: this.settings.matrix,
				xGrps: this[xGrps],
				yGrps: this[yGrps],
				dimensions: d
			})

			this.legendRenderer(this.legendData, {
				settings: Object.assign(
					{
						svgw: Math.max(400, d.mainw),
						svgh: d.mainh + d.yOffset,
						dimensions: d
					},
					this.settings.legend
				)
			})

			await this.adjustSvgDimensions(prevTranspose)
			this.controlsRenderer.main()
		} catch (e) {
			// a new token message error may have been triggered by the data request here,
			// even if the initial state did not have a token message at the start of a dispatch
			const message = this.app.vocabApi.tokenVerificationMessage
			this.mayRequireToken(message)
			if (!message) throw e
		}
	}

	mayRequireToken(tokenMessage = '') {
		const message = tokenMessage || this.state.tokenVerificationMessage
		if (!message && this.state.hasVerifiedToken) {
			this.dom.errdiv.style('display', 'none').html()
			this.dom.controls.style('display', '')
			this.dom.svg.style('display', '')
			return false
		} else {
			this.dom.errdiv.style('display', '').html(message || 'Requires login')
			this.dom.controls.style('display', 'none')
			this.dom.svg.style('display', 'none')
			return true
		}
	}

	// creates an opts object for the vocabApi.getNestedChartsData()
	async getDataRequestOpts() {
		const terms = []
		for (const grp of this.config.termgroups) {
			terms.push(...grp.lst)
		}
		if (this.config.divideBy) terms.push(this.config.divideBy)
		this.numTerms = terms.length
		return {
			terms,
			filter: this.state.filter,
			filter0: this.state.filter0,
			loadingDiv: this.dom.loadingDiv
		}
	}

	setAutoDimensions() {
		const m = this.state.config.settings.matrix
		if (!this.autoDimensions) this.autoDimensions = new Set()

		if (!m.colw) this.autoDimensions.add('colw')
		else this.autoDimensions.delete('colw')

		if (!m.rowh) this.autoDimensions.add('rowh')
		else this.autoDimensions.delete('rowh')

		const s = this.settings.matrix
		if (this.autoDimensions.has('colw')) {
			const offset = !s.transpose
				? s.termLabelOffset + s.termGrpLabelOffset
				: s.sampleLabelOffset + s.sampleGrpLabelOffset
			s.colw = Math.min(
				16,
				Math.max(1, Math.round((screen.availWidth - offset - 300) / this.data.lst.length - s.colspace))
			)
			if (s.colw == 1) s.colspace = 0
		}

		if (this.autoDimensions.has('rowh')) {
			s.rowh = Math.max(5, Math.round(screen.availHeight / this.numTerms))
		}
	}

	setSampleGroups(data) {
		const s = this.settings.matrix
		const defaultSampleGrp = {
			id: this.config.divideBy?.$id,
			name: this.config.divideBy ? 'Not annotated' : '',
			lst: []
		}

		const sampleGroups = new Map()
		const term = this.config.divideBy?.term || {}
		const $id = this.config.divideBy?.$id || '-'
		const exclude = this.config.divideBy?.exclude || []
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

		if (defaultSampleGrp.lst.length && !sampleGroups.size) {
			sampleGroups.set(undefined, defaultSampleGrp)
		}

		// TODO: sort sample groups, maybe by sample count, value order, etc
		this.sampleGroups = [...sampleGroups.values()].sort((a, b) => a.order - b.order)
	}

	setSampleOrder(data) {
		const s = this.settings.matrix
		this.sampleOrder = []
		this.sampleSorter = getSampleSorter(this, s, data.lst)
		let total = 0
		for (const [grpIndex, grp] of this.sampleGroups.entries()) {
			grp.lst.sort(this.sampleSorter)
			let processedLst = grp.lst
			if (s.maxSample && total + grp.lst.length > s.maxSample) {
				processedLst = grp.lst.slice(0, s.maxSample - total)
			}

			for (const [index, row] of processedLst.entries()) {
				this.sampleOrder.push({
					grp,
					grpIndex,
					row,
					index,
					prevGrpTotalIndex: total,
					totalIndex: total + index,
					totalHtAdjustments: 0,
					grpHtAdjustments: 0,
					_SAMPLENAME_: data.refs.bySampleId[row.sample],
					processedLst
				})
			}
			total += processedLst.length
			if (s.maxSample && total >= s.maxSample) break
		}
	}

	setTermOrder(data) {
		const s = this.settings.matrix
		// ht: standard cell dimension for term row or column
		const ht = s.transpose ? s.colw : s.rowh
		this.termSorter = getTermSorter(this, s)
		this.termGroups = JSON.parse(JSON.stringify(this.config.termgroups))
		this.termOrder = []
		let totalIndex = 0,
			visibleGrpIndex = 0,
			totalHtAdjustments = 0
		for (const [grpIndex, grp] of this.termGroups.entries()) {
			const lst = [] // will derive a mutable copy of grp.lst
			let grpHtAdjustments = 0
			for (const [index, tw] of grp.lst.entries()) {
				const counts = { samples: 0, hits: 0 }
				const countedSamples = new Set()
				for (const sgrp of this.sampleGroups) {
					for (const s of sgrp.lst) {
						if (countedSamples.has(s.sample)) continue
						countedSamples.add(s.sample)
						const anno = data.samples[s.sample][tw.$id]
						if (anno) {
							const { filteredValues, countedValues } = this.getFilteredValues(anno, tw, grp)
							anno.filteredValues = filteredValues
							anno.countedValues = countedValues
							if (anno.countedValues?.length) {
								const v = tw.term.values?.[anno.value]
								if (v?.uncountable) continue
								counts.samples += 1
								counts.hits += anno.countedValues.length
								if (tw.q?.mode == 'continuous') {
									const v = anno.value
									if (!('minval' in counts) || counts.minval > v) counts.minval = v
									if (!('maxval' in counts) || counts.maxval < v) counts.maxval = v
								}
							}
						}
					}
				}
				lst.push({ tw, counts, index })
				grpHtAdjustments += (tw.settings ? (tw.settings?.barh || 0) + 2 * (tw.settings.gap || 0) : ht) - ht
			}

			// may override the settings.sortTermsBy with a sorter that is specific to a term group
			const termSorter = grp.sortTermsBy ? getTermSorter(this, grp) : this.termSorter
			const processedLst = lst
				.filter(t => {
					if ('minNumSamples' in t.tw) return t.tw.minNumSamples <= t.counts.samples
					if (!grp.settings) return true
					return !('minNumSamples' in grp.settings) || t.counts.samples >= grp.settings.minNumSamples
				})
				/*
					NOTE: When sorting terms by sample counts, those counts would have been computed before applying the s.maxSample truncation.
					The sample counts are then re-computed, if applicable, in setSampleCountByTerm() after sample list truncation.
					If the left-most sample group does not have much less hits relative to sample groups to its right, then this
					may look like a term with less sample count got mistakenly sorted to the top.

					TODO: 
					(a) Option for s.sortSampleGroupBy = hits-by-term-order, and force this option so that the left-most sample group would
					    make visually sense with s.maxSample is not empty and s.sortTermsBy = 'sampleCount'
					(b) OR, re-sort the term lst based on sample counts without rearranging sample groups
				*/
				.sort(termSorter)

			if (!processedLst.length) continue
			for (const [index, t] of processedLst.entries()) {
				const { tw, counts } = t
				const ref = data.refs.byTermId[t.tw.$id] || {}
				this.termOrder.push({
					grp,
					grpIndex,
					visibleGrpIndex,
					tw,
					index, // rendered index
					lstIndex: t.index, // as-listed index, before applying term filters
					processedLst,
					prevGrpTotalIndex: totalIndex,
					totalIndex: totalIndex + index,
					totalHtAdjustments,
					grpHtAdjustments,
					ref,
					counts,
					label:
						(t.tw.label || t.tw.term.name) +
						(s.samplecount4gene && t.tw.term.type.startsWith('gene') ? ` (${counts.samples})` : ''),
					scale:
						tw.q?.mode == 'continuous'
							? scaleLinear()
									.domain([counts.minval, counts.maxval])
									.range([1, tw.settings.barh])
							: null
				})
				totalHtAdjustments += (t.tw.settings ? t.tw.settings.barh + 2 * t.tw.settings.gap : ht) - ht
			}

			totalIndex += processedLst.length
			visibleGrpIndex += 1
		}
	}

	getFilteredValues(anno, tw, grp) {
		const values = 'value' in anno ? [anno.value] : anno.values
		if (!values) return { filteredValues: null, countedValues: null }
		const valueFilter = tw.valueFilter || grp.valueFilter

		const filteredValues = values.filter(v => {
			/*** do not count wildtype and not tested as hits ***/
			if (tw.term.type == 'geneVariant' && v.class == 'WT') return false
			if (!valueFilter) return true

			if (valueFilter.type == 'tvs') {
				const matched = true
				// quick fix: assume tvs values are joined by "and", not "or"
				// TODO: reuse the filter.js code/data format for a more flexible filter configuration
				for (const vf of valueFilter.tvs.values) {
					if (v[vf.key] === vf.value && valueFilter.isnot) return false
					else if (v[vf.key] !== vf.value && !valueFilter.isnot) return false
				}
				return matched
			} else {
				// TODO: handle non-tvs type value filter
				throw `unknown matrix value filter type='${valueFilter.type}'`
			}
		})

		return {
			filteredValues,
			countedValues: filteredValues.filter(v => {
				/*** do not count wildtype and not tested as hits ***/
				if (tw.term.type == 'geneVariant' && (v.class == 'WT' || v.class == 'Blank')) return false
				return true
			})
		}
	}

	setSampleCountsByTerm() {
		const s = this.settings.matrix
		// only overwrite the sample counts if one or more sample group.lst has been truncated
		if (!s.maxSample) return
		// must redo the sample counts by term after sorting and applying maxSamples, if applicable
		for (const t of this.termOrder) {
			t.allCounts = t.counts
			const countedSamples = new Set()
			t.counts = { samples: 0, hits: 0 }
			for (const s of this.sampleOrder) {
				if (countedSamples.has(s.row.sample)) continue
				const anno = s.row[t.tw.$id]
				if (!anno) continue
				const { filteredValues, countedValues } = this.getFilteredValues(anno, t.tw, t.grp)
				anno.filteredValues = filteredValues
				anno.countedValues = countedValues
				if (anno.countedValues?.length) {
					t.counts.samples += 1
					t.counts.hits += anno.countedValues.length
					if (t.tw.q?.mode == 'continuous') {
						const v = anno.value
						if (!('minval' in t.counts) || t.counts.minval > v) t.counts.minval = v
						if (!('maxval' in t.counts) || t.counts.maxval < v) t.counts.maxval = v
					}
				}
			}

			t.label =
				(t.tw.label || t.tw.term.name) +
				(s.samplecount4gene && t.tw.term.type.startsWith('gene') ? ` (${t.counts.samples})` : '')

			t.scale =
				t.tw.q?.mode == 'continuous'
					? scaleLinear()
							.domain([t.counts.minval, t.counts.maxval])
							.range([1, t.tw.settings.barh])
					: null
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
				render: this[`render${Direction}Label`],
				isGroup: sides[direction].includes('Grp')
			}

			if (!s.transpose) {
				if (`${d}Label` == 'sampleLabel' && s.colw < 8) layout[direction].display = 'none'
			}
		}

		const yOffset = layout.top.offset + s.margin.top
		const xOffset = layout.left.offset + s.margin.left
		const dx = s.colw + s.colspace
		const nx = this[`${col}s`].length
		const dy = s.rowh + s.rowspace
		const ny = this[`${row}s`].length
		const mainw =
			nx * dx + (this[`${col}Grps`].length - 1) * s.colgspace + (this[`${col}s`].slice(-1)[0]?.totalHtAdjustments || 0)
		const mainh =
			ny * dy + (this[`${row}Grps`].length - 1) * s.rowgspace + (this[`${row}s`].slice(-1)[0]?.totalHtAdjustments || 0)

		const topFontSize =
			_t_ == 'Grp' ? s.grpLabelFontSize : Math.max(s.colw + s.colspace - 2 * s.collabelpad, s.minLabelFontSize)
		layout.top.attr = {
			boxTransform: `translate(${xOffset}, ${yOffset - s.collabelgap})`,
			labelTransform: 'rotate(-90)',
			labelAnchor: 'start',
			labelGY: 0,
			labelGTransform: this[`col${_t_}LabelGTransform`],
			fontSize: topFontSize,
			textpos: { coord: 'y', factor: -1 },
			axisFxn: axisTop
		}

		const btmFontSize =
			_b_ == 'Grp' ? s.grpLabelFontSize : Math.max(s.colw + s.colspace - 2 * s.collabelpad, s.minLabelFontSize)
		layout.btm.attr = {
			boxTransform: `translate(${xOffset}, ${yOffset + mainh + s.collabelgap})`,
			labelTransform: 'rotate(-90)',
			labelAnchor: 'end',
			labelGY: 0,
			labelGTransform: this[`col${_b_}LabelGTransform`],
			fontSize: btmFontSize,
			textpos: { coord: 'y', factor: 1 },
			axisFxn: axisBottom
		}

		const leftFontSize =
			_l_ == 'Grp' ? s.grpLabelFontSize : Math.max(s.rowh + s.rowspace - 2 * s.rowlabelpad, s.minLabelFontSize)
		layout.left.attr = {
			boxTransform: `translate(${xOffset - s.rowlabelgap}, ${yOffset})`,
			labelTransform: '',
			labelAnchor: 'end',
			labelGX: 0,
			labelGTransform: this[`row${_l_}LabelGTransform`],
			fontSize: leftFontSize,
			textpos: { coord: 'x', factor: -1 },
			axisFxn: axisLeft
		}

		const rtFontSize =
			_r_ == 'Grp' ? s.grpLabelFontSize : Math.max(s.rowh + s.rowspace - 2 * s.rowlabelpad, s.minLabelFontSize)
		layout.right.attr = {
			boxTransform: `translate(${xOffset + mainw + s.rowlabelgap}, ${yOffset})`,
			labelTransform: '',
			labelAnchor: 'start',
			labelGX: 0,
			labelGTransform: this[`row${_r_}LabelGTransform`],
			fontSize: rtFontSize,
			textpos: { coord: 'x', factor: 1 },
			axisFxn: axisRight
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
		const legendGroups = {}

		for (const { totalIndex, grpIndex, row } of this.sampleOrder) {
			const series = {
				row,
				cells: [],
				x: !s.transpose ? totalIndex * dx + grpIndex * s.colgspace : 0,
				y: !s.transpose ? 0 : totalIndex * dy + grpIndex * s.rowgspace
			}

			for (const t of this.termOrder) {
				const $id = t.tw.$id
				if (row[$id]?.filteredValues && !row[$id]?.filteredValues.length) continue
				const anno = row[$id]
				if (!anno) continue
				const termid = 'id' in t.tw.term ? t.tw.term.id : t.tw.term.name
				const key = anno.key
				const values = anno.filteredValues || anno.values || [anno.value]
				const height = !s.transpose ? s.rowh / values.length : s.colw
				const width = !s.transpose ? s.colw : s.colw / values.length

				for (const [i, value] of values.entries()) {
					const cell = {
						sample: row.sample,
						_SAMPLENAME_: data.refs.bySampleId[row.sample],
						tw: t.tw,
						term: t.tw.term,
						termid,
						$id,
						key,
						x: !s.transpose
							? 0
							: t.totalIndex * dx + t.visibleGrpIndex * s.colgspace + width * i + t.totalHtAdjustments,
						y: !s.transpose
							? t.totalIndex * dy + t.visibleGrpIndex * s.rowgspace + height * i + t.totalHtAdjustments
							: 0
					}

					// will assign fill, label, order, etc
					const legend = setCellProps[t.tw.term.type](cell, t.tw, anno, value, s, t, this)
					if (legend) {
						if (!legendGroups[legend.group]) legendGroups[legend.group] = { ref: legend.ref, values: {} }
						if (!legendGroups[legend.group].values[legend.value])
							legendGroups[legend.group].values[legend.value] = legend.entry
					}

					series.cells.push(cell)
				}
			}
			serieses.push(series)
		}

		this.setLegendData(legendGroups, data.refs)

		return serieses
	}

	sampleKey(series) {
		return series.row.sample
	}

	sampleLabel(series) {
		return series._SAMPLENAME_ || series.row.sample
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
		return t.label
	}

	termGrpKey(t) {
		return t.grp.name
	}

	termGrpLabel(t) {
		return t.grp.name || `configure`
	}

	setLegendData(legendGroups, refs) {
		this.colorScaleByTermId = {}
		const legendData = []

		for (const $id in legendGroups) {
			const legend = legendGroups[$id]

			if ($id == 'Mutation Types') {
				const keys = Object.keys(legend.values)
				if (!keys.length) continue
				legendData.unshift({
					name: 'Mutation Types',
					items: keys.map((key, i) => {
						const item = legend.values[key]
						return {
							termid: 'Mutation Types',
							key,
							text: item.label,
							color: item.fill,
							order: i,
							border: '1px solid #ccc'
						}
					})
				})
				continue
			}

			const t = this.termOrder.find(t => t.tw.$id == $id || t.tw.legend?.group == $id)
			const grp = $id
			const term = t.tw.term
			const keys = Object.keys(legend.values)
			const ref = legend.ref
			if (ref.bins)
				keys.sort((a, b) => ref.bins.findIndex(bin => bin.name === a) - ref.bins.findIndex(bin => bin.name === b))
			else if (ref.keyOrder) keys.sort((a, b) => ref.keyOrder.indexOf(a) - ref.keyOrder.indexOf(b))

			if (!this.colorScaleByTermId[grp])
				this.colorScaleByTermId[grp] =
					keys.length < 11 ? scaleOrdinal(schemeCategory10) : scaleOrdinal(schemeCategory20)

			legendData.push({
				name: t.tw.legend?.group || t.tw.label || term.name,
				items: keys.map((key, i) => {
					const item = legend.values[key]
					return {
						termid: term.id,
						key,
						text: item.label,
						color: item.fill || this.colorScaleByTermId[grp](key),
						order: i
					}
				})
			})
		}

		this.legendData = legendData
	}
}

/*
	cell: a matrix cell data
	tw: termwrapper
	anno: the current annotation
	values: the available annotation values for a term
	t: an entry in this.termOrder
	s: plotConfig.settings.matrix
*/
function setNumericCellProps(cell, tw, anno, value, s, t) {
	const key = anno.key
	const values = tw.term.values || {}
	cell.label = 'label' in anno ? anno.label : values[key]?.label ? values[key].label : key
	cell.fill = anno.color || values[anno.key]?.color

	cell.order = t.ref.bins ? t.ref.bins.findIndex(bin => bin.name == key) : 0
	if (tw.q?.mode == 'continuous') {
		if (!tw.settings) tw.settings = {}
		if (!tw.settings.barh) tw.settings.barh = 30
		if (!('gap' in tw.settings)) tw.settings.gap = 0
		// TODO: may use color scale instead of bars
		if (s.transpose) {
			cell.width = t.scale(cell.key)
			cell.x += tw.settings.gap // - cell.width
		} else {
			cell.height = t.scale(cell.key)
			cell.y += tw.settings.barh + t.tw.settings.gap - cell.height
		}
	} else {
		const group = tw.legend?.group || tw.$id
		return { ref: t.ref, group, value: key, entry: { key, label: cell.label, fill: cell.fill } }
	}
}

function setCategoricalCellProps(cell, tw, anno, value, s, t) {
	const values = tw.term.values || {}
	const key = anno.key
	cell.label = 'label' in anno ? anno.label : values[key]?.label ? values[key].label : key
	cell.fill = anno.color || values[key]?.color
	const group = tw.legend?.group || tw.$id
	return { ref: t.ref, group, value, entry: { key, label: cell.label, fill: cell.fill } }
}

// NOTE: may move these code by term.type to matrix.[categorical|*].js
// if more term.type specific logic becomes harder to maintain here

/*
  Arguments
	cell: a matrix cell data
	tw: termwrapper
	anno: the current annotation
	value
	t: an entry in this.termOrder
	s: plotConfig.settings.matrix
*/
const setCellProps = {
	categorical: setCategoricalCellProps,
	integer: setNumericCellProps,
	float: setNumericCellProps,
	/* !!! TODO: later, may allow survival terms as a matrix row in server/shared/termdb.usecase.js, 
	   but how - quantitative, categorical, etc? */
	//survival: setNumericCellProps,
	geneVariant: (cell, tw, anno, value, s, t, self) => {
		const values = anno.filteredValues || anno.values || [anno.value]
		cell.height = !s.transpose ? s.rowh / values.length : s.colw
		cell.width = !s.transpose ? s.colw : s.colw / values.length
		cell.label = value.label || self.mclass[value.class].label
		const colorFromq = tw.q?.values && tw.q?.values[value.class]?.color
		cell.fill = colorFromq || value.color || self.mclass[value.class]?.color
		cell.class = value.class
		cell.value = value

		const group = tw.legend?.group || 'Mutation Types'
		return { ref: t.ref, group, value: value.class, entry: { key: value.class, label: cell.label, fill: cell.fill } }
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

				// set any dataset-defined sample limits and sort priority, otherwise undefined
				// put in settings, so that later may be overridden by a user (TODO)
				maxSample: app.vocabApi.termdbConfig.matrix?.maxSample,
				sortPriority: app.vocabApi.termdbConfig.matrix?.sortPriority,

				sampleNameFilter: '',
				sortSamplesBy: 'selectedTerms',
				sortSamplesTieBreakers: [{ $id: 'sample', sortSamples: {} /*split: {char: '', index: 0}*/ }],
				sortTermsBy: 'sampleCount', // or 'as listed'
				samplecount4gene: true,
				cellbg: '#ececec',
				colw: 0,
				colspace: 1,
				colgspace: 8,
				collabelpos: 'bottom',
				collabelvisible: true,
				colglabelpos: true,
				collabelgap: 5,
				collabelpad: 1,
				rowh: 18,
				rowspace: 1,
				rowgspace: 8,
				rowlabelpos: 'left', // | 'right'
				rowlabelgap: 5,
				rowlabelvisible: true,
				rowglabelpos: true,
				rowlabelgap: 5,
				rowlabelpad: 1,
				grpLabelFontSize: 12,
				minLabelFontSize: 6,
				transpose: false,
				sampleLabelOffset: 120,
				sampleGrpLabelOffset: 120,
				termLabelOffset: 80,
				termGrpLabelOffset: 80,
				duration: 100
			}
		}
	}

	const s = config.settings
	const fontsize = Math.max(s.matrix.rowh + s.matrix.rowspace - 3 * s.matrix.rowlabelpad, 12)

	s.legend = {
		ontop: false,
		lineh: 25,
		padx: 5,
		padleft: 0, //150,
		padright: 20,
		padbtm: 30,
		fontsize,
		iconh: fontsize - 2,
		iconw: fontsize - 2,
		hangleft: 1,
		linesep: false
	}

	// may apply term-specific changes to the default object
	copyMerge(config, opts)
	const promises = []
	for (const grp of config.termgroups) {
		for (const tw of grp.lst) {
			// force the saved session to request the most up-to-data dictionary term data from server
			if (tw.id) delete tw.term
			promises.push(fillTermWrapper(tw, app.vocabApi))
		}
	}
	if (config.divideBy) promises.push(fillTermWrapper(config.divideBy, app.vocabApi))
	await Promise.all(promises)
	return config
}

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/
	chartsInstance.dom.tip.clear()
	const menuDiv = holder.append('div')
	if (chartsInstance.state.termdbConfig.matrixplots) {
		for (const plot of chartsInstance.state.termdbConfig.matrixplots) {
			/* plot: 
			{
				name=str
			}
			*/
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(plot.name)
				.on('click', async () => {
					const config = await dofetch3('termdb', {
						body: {
							for: 'matrix',
							getPlotDataByName: plot.name,
							genome: chartsInstance.state.vocab.genome,
							dslabel: chartsInstance.state.vocab.dslabel
						}
					})
					chartsInstance.app.dispatch({
						type: 'plot_create',
						config
					})
				})
		}
	}
	menuDiv
		.append('div')
		.datum({
			label: 'Term tree & search',
			clickTo: chartsInstance.showTree_selectlst,
			chartType: 'matrix',
			usecase: { target: 'matrix', detail: 'termgroups' },
			processSelection: lst => {
				return [
					{
						name: '',
						lst: lst.map(term => {
							return { term }
						})
					}
				]
			}
		})
		.attr('class', 'sja_menuoption sja_sharp_border')
		.text(d => d.label)
		.on('click', (event, chart) => chartsInstance.showTree_selectlst(chart))

	menuDiv
		.append('div')
		.datum({
			label: 'Text input',
			chartType: 'matrix',
			clickTo: showTextAreaInput,
			usecase: { target: 'matrix', detail: 'termgroups' },
			placeholder: 'term\tgroup',
			processInput: async text => {
				const lines = text.split('\n').map(line => line.split('\t'))
				const ids = lines.map(cols => cols[0]).filter(t => !!t)
				const terms = await chartsInstance.app.vocabApi.getTermTypes(ids)
				const groups = {}
				for (const [id, name] of lines) {
					if (!(id in terms)) continue
					if (!(name in groups)) groups[name] = { name, lst: [] }
					groups[name].lst.push({ term: terms[id] })
				}
				return Object.values(groups)
			}
		})
		.attr('class', 'sja_menuoption sja_sharp_border')
		.text(d => d.label)
		.on('click', (event, chart) => showTextAreaInput(chart, chartsInstance))
}

function showTextAreaInput(opt, self) {
	self.dom.tip.clear()
	self.dom.submenu = self.dom.tip.d.append('div').style('text-align', 'center')

	self.dom.submenu.append('span').html(opt.label)

	self.dom.submenu
		.append('button')
		.style('margin', '0 5px')
		.html('Submit')
		.on('click', async () => {
			const data = await opt.processInput(ta.property('value'))
			self.dom.tip.hide()
			const action = {
				type: 'plot_create',
				id: getId(),
				config: {
					chartType: opt.usecase.target,
					[opt.usecase.detail]: data
				}
			}
			self.app.dispatch(action)
		})

	const ta = self.dom.submenu
		.append('div')
		.style('text-align', 'left')
		.append('textarea')
		.attr('placeholder', opt.placeholder)
		.style('width', '300px')
		.style('height', '300px')
		.style('margin', '5px')
		.style('padding', '5px')
		.on('keydown', event => {
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

// to assign chart ID to distinguish between chart instances
const idPrefix = '_CHART_AUTOID_' // to distinguish from user-assigned chart IDs
let id = Date.now()

function getId() {
	return idPrefix + id++
}
