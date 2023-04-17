import { getCompInit, copyMerge, deepEqual } from '../rx'
import { setInteractivity } from './matrix.interactivity'
import { setRenderers } from './matrix.renderers'
import { MatrixCluster } from './matrix.cluster'
import { MatrixControls } from './matrix.controls'
import { setCellProps } from './matrix.cells'
import { select } from 'd3-selection'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { schemeCategory10 } from 'd3-scale-chromatic'
import { schemeCategory20 } from '#common/legacy-d3-polyfill'
import { axisLeft, axisTop, axisRight, axisBottom } from 'd3-axis'
import svgLegend from '#dom/svg.legend'
import { mclass } from '#shared/common'
import { Menu } from '#dom/menu'
import { getSampleSorter, getTermSorter } from './matrix.sort'
import { dofetch3 } from '../common/dofetch'
export { getPlotConfig } from './matrix.config'

class Matrix {
	constructor(opts) {
		this.type = 'matrix'
		this.optionalFeatures = JSON.parse(sessionStorage.getItem('optionalFeatures')).matrix || []
		this.prevState = { config: { settings: {} } }
		setInteractivity(this)
		setRenderers(this)
	}

	async init(appState) {
		const opts = this.opts
		const holder = opts.controls ? opts.holder : opts.holder.append('div')
		holder.style('position', 'relative')
		const controls = this.opts.controls || holder.append('div')
		const loadingDiv = holder
			.append('div')
			.style('position', 'absolute')
			.style('top', this.opts.controls ? 0 : '50px')
			.style('left', '50px')
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

		this.seriesClipId = `sjpp_clip_${this.id}`
		this.clusterClipId = `sjpp_clip_cluster_${this.id}`

		const mainG = svg
			.append('g')
			//.style('overflow', 'hidden')
			.on('mouseover', this.showCellInfo)
			.on('mousemove', this.showCellInfo)
			.on('mouseout', this.mouseout)

		const tip = new Menu({ padding: '5px' })
		this.dom = {
			header: opts.header,
			holder,
			contentNode: opts.holder.node().closest('.sjpp-output-sandbox-content') || opts.holder.node().parentNode,
			errdiv,
			controls,
			loadingDiv,
			svg,
			mainG,
			sampleGrpLabelG: mainG
				.append('g')
				.attr('class', 'sjpp-matrix-series-group-label-g')
				.on('click', this.showSampleGroupMenu)
				.on('mousedown.sjppMatrixLabelText', this.enableTextHighlight)
				.on('mouseup.sjppMatrixLabelText', this.disableTextHighlight),
			termGrpLabelG: mainG
				.append('g')
				.attr('class', 'sjpp-matrix-term-group-label-g')
				.on('mouseover', this.termGrpLabelMouseover)
				.on('mouseout', this.termGrpLabelMouseout)
				.on('mousedown', this.termGrpLabelMousedown)
				.on('mousemove', this.termGrpLabelMousemove)
				.on('mouseup', this.termGrpLabelMouseup)
				.on('mousedown.sjppMatrixLabelText', this.enableTextHighlight)
				.on('mouseup.sjppMatrixLabelText', this.disableTextHighlight),
			cluster: mainG
				.append('g')
				.attr('class', 'sjpp-matrix-cluster-g')
				.on('mousedown', this.seriesesGMousedown)
				.on('mousemove', this.seriesesGMousemove),
			//.on('mouseup', this.seriesesGMouseup),
			seriesesG: mainG
				.append('g')
				.attr('class', 'sjpp-matrix-serieses-g')
				.attr('clip-path', `url(#${this.seriesClipId})`)
				.on('mousedown', this.seriesesGMousedown),
			//.on('mousemove', this.seriesesGMousemove)
			//.on('mouseup', this.seriesesGMouseup),
			sampleLabelG: mainG
				.append('g')
				.attr('class', 'sjpp-matrix-series-label-g')
				.on('mousedown.sjppMatrixLabelText', this.enableTextHighlight)
				.on('mouseup.sjppMatrixLabelText', this.disableTextHighlight),
			/* // TODO: sample label drag to move
				.on('mouseover', this.sampleLabelMouseover)
				.on('mouseout', this.sampleLabelMouseout)
				.on('mousedown', this.sampleLabelMousedown)
				.on('mousemove', this.sampleLabelMousemove)
				.on('mouseup', this.sampleLabelMouseup)*/
			termLabelG: mainG
				.append('g')
				.attr('class', 'sjpp-matrix-term-label-g')
				.on('mouseover', this.termLabelMouseover)
				.on('mouseout', this.termLabelMouseout)
				.on('mousedown', this.termLabelMousedown)
				.on('mousemove', this.termLabelMousemove)
				.on('mouseup', this.termLabelMouseup)
				.on('mousedown.sjppMatrixLabelText', this.enableTextHighlight)
				.on('mouseup.sjppMatrixLabelText', this.disableTextHighlight),
			scroll: mainG.append('g'),
			//legendDiv: holder.append('div').style('margin', '5px 5px 15px 50px'),
			legendG: mainG.append('g'),
			tip,
			menutop: tip.d.append('div'),
			menubody: tip.d.append('div')
		}

		this.dom.clipRect = svg
			.append('clipPath')
			.attr('id', this.seriesClipId)
			.attr('clipPathUnits', 'objectBoundingBox')
			//.attr('clipPathUnits', 'userSpaceOnUse')
			.append('rect')
			.attr('display', 'block')

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

		/*
		Levels of mclass overrides, from more general to more specific.

		1. server-level:
		  - specified as serverconfig.commonOverrides
		  - applied to the mclass from #shared/common on server startup
		  - applies to all datasets and charts
		  - overrides are applied to the static common.mclass object
		
		2. dataset-level: 
		  - specified as termdb.mclass in the dataset's js file
		  - applied to the termdbConfig.mclass payload as returned from the /termdb?getTermdbConfig=1 route
		  - applies to all charts rendered for only the dataset/dslabel
		  - overrides are applied to a copy of common.mclass, not the original "static" object

		3. chart-level: 
		  - specified as termdb[chartType].mclass in the dataset's js file
		  - applied to the termdbConfig[chartType].mclass payload as returned from the /termdb?getTermdbConfig=1 route
		  - applies to only the specific chart type as rendered for the dataset/dslabel
		  - overrides are applied to a copy of common.mclass + termdb.mclass

		!!! NOTE: 
			Boolean configuration flags for mutually exclusive values may cause conflicting configurations
			in the resulting merged overrides, as outputted by rx.copyMerge()
		!!!
		*/
		this.mclass = copyMerge({}, mclass, appState.termdbConfig.mclass || {}, appState.termdbConfig.matrix?.mclass || {})
	}

	setControls(appState) {
		//if (this.opts.controls) return
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
			tokenVerificationMessage: this.app.vocabApi.tokenVerificationMessage,
			geneVariantCountSamplesSkipMclass: this.app.vocabApi.termdbConfig.matrix?.geneVariantCountSamplesSkipMclass || []
		}
	}

	async main() {
		try {
			this.config = JSON.parse(JSON.stringify(this.state.config))
			if (this.mayRequireToken()) return

			const prevTranspose = this.settings.transpose
			// controlsRenderer.getSettings() supplies settings that are not tracked in the global app and plot state
			Object.assign(this.settings, this.config.settings, this.controlsRenderer.getSettings())

			this.computeStateDiff()

			this.dom.loadingDiv.html('').style('display', '')
			if (this.stateDiff.nonsettings) {
				// get the data
				const reqOpts = await this.getDataRequestOpts()
				this.data = await this.app.vocabApi.getAnnotatedSampleData(reqOpts)
				this.dom.loadingDiv.html('Processing data ...')
			}

			if (this.stateDiff.nonsettings || this.stateDiff.sorting) {
				this.setSampleGroups(this.data)
				this.setTermOrder(this.data)
				this.setSampleOrder(this.data)
			}

			this.setLayout()
			this.serieses = this.getSerieses(this.data)

			// render the data
			this.dom.loadingDiv.html('Rendering ...')
			this.render()
			this.dom.loadingDiv.style('display', 'none')

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
						svgw: Math.max(400, d.mainw + d.xOffset - this.settings.matrix.margin.right),
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

		this.prevState = this.state
		this.resetInteractions()
	}

	// track state diff to be able to skip server data request
	// and term/sample order recomputation, as needed
	computeStateDiff() {
		const s = this.settings.matrix
		const prevState = structuredClone(this.prevState)
		const currState = structuredClone(this.state)
		delete prevState.config?.settings
		delete prevState.isVisible
		delete currState.config.settings
		delete currState.isVisible
		const p = this.prevState.config.settings?.matrix || {}
		const c = this.state.config.settings.matrix
		this.stateDiff = {
			nonsettings: !deepEqual(prevState, currState),
			sorting: !deepEqual(
				{
					maxSample: p.maxSample,
					sortPriority: p.sortPriority,
					truncatePriority: p.truncatePriority,
					sampleNameFilter: p.sampleNameFilter,
					sortSamplesBy: p.sortSamplesBy,
					sortSamplesTieBreakers: p.sortSamplesTieBreakers,
					sortTermsBy: p.sortTermsBy,
					// TODO: take out dimension related computations in setTermOrder,
					// so that sorting is not affected by rowh
					rowh: p.rowh
				},
				{
					maxSample: c.maxSample,
					sortPriority: c.sortPriority,
					truncatePriority: c.truncatePriority,
					sampleNameFilter: c.sampleNameFilter,
					sortSamplesBy: c.sortSamplesBy,
					sortSamplesTieBreakers: c.sortSamplesTieBreakers,
					sortTermsBy: c.sortTermsBy,
					// TODO: take out dimension related computations in setTermOrder,
					// so that sorting is not affected by rowh
					rowh: c.rowh
				}
			),
			cellDimensions: !deepEqual(
				{
					transpose: p.transpose,
					zoomLevel: p.zoomLevel,
					rowh: p.rowh,
					rowspace: p.rowspace,
					rowgspace: p.rowgspace,
					colw: p.colw,
					colspace: p.colspace,
					colgspace: p.colgspace
				},
				{
					transpose: c.transpose,
					zoomLevel: c.zoomLevel,
					rowh: c.rowh,
					rowspace: c.rowspace,
					rowgspace: c.rowgspace,
					colw: c.colw,
					colspace: c.colspace,
					colgspace: c.colgspace
				}
			)
		}
	}

	mayRequireToken(tokenMessage = '') {
		const message = tokenMessage || this.state.tokenVerificationMessage
		if (!message && this.state.hasVerifiedToken) {
			this.dom.errdiv.style('display', 'none').html()
			this.dom.controls.style('display', this.opts.controls ? 'inline-block' : '')
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
		this.truncateSorter = s.truncatePriority && getSampleSorter(this, s, data.lst, 'truncatePriority')
		let total = 0
		for (const [grpIndex, grp] of this.sampleGroups.entries()) {
			let processedLst = grp.lst

			if (this.truncateSorter) {
				processedLst.sort(this.truncateSorter)
				if (s.maxSample && total + processedLst.length > s.maxSample) {
					processedLst = processedLst.slice(0, s.maxSample - total)
				}
			}

			processedLst.sort(this.sampleSorter)
			if (!this.truncateSorter && s.maxSample && total + processedLst.length > s.maxSample) {
				processedLst = processedLst.slice(0, s.maxSample - total)
			}

			for (const [index, row] of processedLst.entries()) {
				this.sampleOrder.push({
					grp,
					grpIndex,
					row,
					index,
					prevGrpTotalIndex: total,
					totalIndex: total + index,
					totalHtAdjustments: 0, // may be required when transposed???
					grpTotals: { htAdjustment: 0 }, // may be required when transposed???
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
		this.termSorter = getTermSorter(this, s)
		this.termGroups = JSON.parse(JSON.stringify(this.config.termgroups))
		this.termOrder = []
		let totalIndex = 0,
			visibleGrpIndex = 0
		for (const [grpIndex, grp] of this.termGroups.entries()) {
			const lst = [] // will derive a mutable copy of grp.lst
			for (const [index, tw] of grp.lst.entries()) {
				const counts = { samples: 0, hits: 0 }
				const countedSamples = new Set()
				for (const sgrp of this.sampleGroups) {
					for (const s of sgrp.lst) {
						if (countedSamples.has(s.sample)) continue
						countedSamples.add(s.sample)
						const anno = data.samples[s.sample][tw.$id]
						if (anno) {
							const { filteredValues, countedValues, renderedValues } = this.classifyValues(
								anno,
								tw,
								grp,
								this.settings.matrix
							)
							anno.filteredValues = filteredValues
							anno.countedValues = countedValues
							anno.renderedValues = renderedValues
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
					ref,
					allCounts: counts
					// note: term label will be assigned after sample counts are known
					// label: t.tw.label || t.tw.term.name,
				})
			}

			totalIndex += processedLst.length
			visibleGrpIndex += 1
		}
	}

	classifyValues(anno, tw, grp, s) {
		const values = 'value' in anno ? [anno.value] : anno.values
		if (!values) return { filteredValues: null, countedValues: null, renderedValues: null }
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

		const renderedValues = []
		if (tw.term.type != 'geneVariant' || s.cellEncoding != 'oncoprint') renderedValues.push(...filteredValues)
		else {
			// dt=1 are SNVindels, dt=4 CNV
			// will render only one matching value per dt
			for (const dt of [4, 1]) {
				const v = filteredValues.find(v => v.dt === dt)
				if (v) renderedValues.push(v)
			}
		}

		return {
			filteredValues,
			countedValues: filteredValues.filter(v => {
				/*** do not count wildtype and not tested as hits ***/
				if (tw.term.type == 'geneVariant') {
					if (v.class == 'WT' || v.class == 'Blank') return false
					if (this.state.geneVariantCountSamplesSkipMclass.includes(v.class)) return false
				}
				return true
			}),
			renderedValues
		}
	}

	setAutoDimensions(xOffset) {
		const m = this.state.config.settings.matrix
		if (!this.autoDimensions) this.autoDimensions = new Set()

		if (!m.colw) this.autoDimensions.add('colw')
		else this.autoDimensions.delete('colw')
		if (!m.rowh) this.autoDimensions.add('rowh')
		else this.autoDimensions.delete('rowh')

		const s = this.settings.matrix
		this.computedSettings = {}
		// TODO: the additional 65 space should not be hardcoded, but determined based on matrix holder/config
		this.availContentWidth = this.dom.contentNode.getBoundingClientRect().width - 65 - s.margin.right - xOffset
		if (this.autoDimensions.has('colw')) {
			const offset = !s.transpose
				? s.termLabelOffset + s.termGrpLabelOffset
				: s.sampleLabelOffset + s.sampleGrpLabelOffset
			// TODO: the additional 80 space should not be hardcoded, but determined on matrix holder/config
			const colw = (this.availContentWidth - 80) / this.sampleOrder.length
			this.computedSettings.colw = Math.max(s.colwMin, Math.min(colw, s.colwMax))
		}
		this.computedSettings.colspace = s.zoomLevel * this.computedSettings.colw < 2 ? 0 : s.colspace

		if (this.autoDimensions.has('rowh')) {
			this.computedSettings.rowh = Math.max(5, Math.round(screen.availHeight / this.numTerms))
		}

		copyMerge(this.settings.matrix, this.computedSettings)
	}

	setLabelsAndScales() {
		const s = this.settings.matrix

		// ht: standard cell dimension for term row or column
		const ht = s.transpose ? s.colw : s.rowh
		const grpTotals = {}
		let totalHtAdjustments = 0

		for (const t of this.termOrder) {
			const countedSamples = new Set()
			t.counts = { samples: 0, hits: 0 }

			for (const sample of this.sampleOrder) {
				if (countedSamples.has(sample.row.sample)) continue
				const anno = sample.row[t.tw.$id]
				if (!anno) continue
				const { filteredValues, countedValues, renderedValues } = this.classifyValues(
					anno,
					t.tw,
					t.grp,
					this.settings.matrix
				)
				anno.filteredValues = filteredValues
				anno.countedValues = countedValues
				anno.renderedValues = renderedValues
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

			t.label = t.tw.label || t.tw.term.name
			if (s.samplecount4gene && t.tw.term.type.startsWith('gene')) {
				t.label = `${t.label} (${t.counts.samples})`
			}

			t.scale =
				t.tw.q?.mode == 'continuous'
					? scaleLinear()
							.domain([t.counts.minval, t.counts.maxval])
							.range([1, t.tw.settings.barh])
					: null

			t.totalHtAdjustments = totalHtAdjustments
			const adjustment = (t.tw.settings ? t.tw.settings.barh + 2 * t.tw.settings.gap : ht) - ht
			totalHtAdjustments += adjustment
			if (!(t.visibleGrpIndex in grpTotals)) grpTotals[t.visibleGrpIndex] = { htAdjustment: 0 }
			grpTotals[t.visibleGrpIndex].htAdjustment += adjustment
			t.grpTotals = grpTotals[t.visibleGrpIndex]
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
				prefix: d,
				data: this[`${d}s`],
				offset: s[`${d}LabelOffset`],
				box: this.dom[`${d}LabelG`],
				key: this[`${d}Key`],
				label: this[`${d}Label`],
				render: this[`render${Direction}Label`],
				isGroup: sides[direction].includes('Grp')
			}
		}

		const yOffset = layout.top.offset + s.margin.top + s.scrollHeight
		const xOffset = layout.left.offset + s.margin.left

		this.setAutoDimensions(xOffset)
		this.setLabelsAndScales()

		const colw = Math.max(s.colwMin, Math.min(s.colwMax, s.colw * s.zoomLevel))
		const dx = colw + s.colspace
		const nx = this[`${col}s`].length
		const dy = s.rowh + s.rowspace
		const ny = this[`${row}s`].length
		const mainwByColDimensions =
			nx * (colw + s.colspace) +
			this[`${col}Grps`].length * s.colgspace +
			(this[`${col}s`].slice(-1)[0]?.totalHtAdjustments || 0)
		const mainw = Math.min(mainwByColDimensions, this.availContentWidth)

		const mainh =
			ny * dy + (this[`${row}Grps`].length - 1) * s.rowgspace + (this[`${row}s`].slice(-1)[0]?.totalHtAdjustments || 0)

		const colLabelFontSize = Math.min(
			Math.max(colw + s.colspace - 2 * s.collabelpad, s.minLabelFontSize),
			s.maxLabelFontSize
		)

		const topFontSize = _t_ == 'Grp' ? s.grpLabelFontSize : colLabelFontSize
		layout.top.attr = {
			boxTransform: `translate(${xOffset}, ${yOffset - s.collabelgap})`,
			adjustBoxTransform: dx =>
				layout.top.box.attr('transform', `translate(${xOffset + dx}, ${yOffset - s.collabelgap})`),
			labelTransform: 'rotate(-90)',
			labelAnchor: 'start',
			labelGY: 0,
			labelGTransform: this[`col${_t_}LabelGTransform`],
			fontSize: topFontSize,
			textpos: { coord: 'y', factor: -1 },
			axisFxn: axisTop
		}
		layout.top.box.attr('clip-path', layout.top.isGroup ? `url(#${this.clusterClipId})` : `url(#${this.seriesClipId})`)
		if (layout.top.prefix == 'sample') layout.top.display = colw >= s.minLabelFontSize ? '' : 'none'

		const btmFontSize = _b_ == 'Grp' ? s.grpLabelFontSize : colLabelFontSize
		layout.btm.attr = {
			boxTransform: `translate(${xOffset}, ${yOffset + mainh + s.collabelgap})`,
			adjustBoxTransform: dx =>
				layout.btm.box.attr('transform', `translate(${xOffset + dx}, ${yOffset + mainh + s.collabelgap})`),
			labelTransform: 'rotate(-90)',
			labelAnchor: 'end',
			labelGY: 0,
			labelGTransform: this[`col${_b_}LabelGTransform`],
			fontSize: btmFontSize,
			textpos: { coord: 'y', factor: 1 },
			axisFxn: axisBottom
		}
		layout.btm.box.attr('clip-path', layout.btm.isGroup ? `url(#${this.clusterClipId})` : `url(#${this.seriesClipId})`)
		if (layout.btm.prefix == 'sample') layout.btm.display = colw >= s.minLabelFontSize ? '' : 'none'

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
		layout.left.box.attr('clip-path', '')

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
		layout.right.box.attr('clip-path', '')

		this.layout = layout
		if (!s.zoomCenterPct) {
			s.zoomCenterPct = 0.5
			s.zoomIndex = Math.round((s.zoomCenterPct * mainw) / dx)
			s.zoomGrpIndex = this.sampleOrder[s.zoomIndex].grpIndex
		}
		// zoomCenter relative to mainw
		const zoomCenter = s.zoomCenterPct * mainw //console.log(831, 's.zoomIndex=', s.zoomIndex)
		const centerCellX = s.zoomIndex * dx + s.zoomGrpIndex * s.colgspace //console.log(832, centerCellX)
		const zoomedMainW = nx * dx + (this[`${col}Grps`].length - 1) * s.colgspace
		const seriesXoffset =
			s.zoomLevel <= 1 && mainw >= zoomedMainW ? 0 : Math.max(zoomCenter - centerCellX, mainw - zoomedMainW)
		this.dimensions = {
			dx,
			dy,
			xOffset,
			yOffset,
			mainw,
			mainh,
			colw,
			zoomedMainW,
			seriesXoffset: seriesXoffset > 0 ? 0 : seriesXoffset,
			maxMainW: Math.max(mainwByColDimensions, this.availContentWidth)
		}
	}

	getSerieses(data) {
		const s = this.settings.matrix
		const serieses = []
		const colw = this.dimensions.colw
		const dx = this.dimensions.dx
		const dy = this.dimensions.dy
		const legendGroups = {}

		for (const t of this.termOrder) {
			const $id = t.tw.$id
			const series = {
				t,
				tw: t.tw,
				cells: [],
				y: !s.transpose ? t.totalIndex * dy + t.visibleGrpIndex * s.rowgspace + t.totalHtAdjustments : 0
			}

			for (const so of this.sampleOrder) {
				const { totalIndex, grpIndex, row } = so
				series.x = !s.transpose ? 0 : t.totalIndex * dx + t.visibleGrpIndex * s.colgspace

				if (row[$id]?.filteredValues && !row[$id]?.filteredValues.length) continue
				const anno = row[$id]
				if (!anno) continue
				const termid = 'id' in t.tw.term ? t.tw.term.id : t.tw.term.name
				const key = anno.key
				const values = anno.renderedValues || anno.values || [anno.value]
				const numRects = s.cellEncoding == 'oncoprint' ? 1 : values.length
				const height = !s.transpose ? s.rowh / numRects : colw
				const width = !s.transpose ? colw : colw / values.length
				const siblingCells = []
				for (const [i, value] of values.entries()) {
					const cell = {
						s: so,
						sample: row.sample,
						_SAMPLENAME_: data.refs.bySampleId[row.sample],
						tw: t.tw,
						term: t.tw.term,
						termid,
						$id,
						key,
						totalIndex,
						grpIndex,
						//row,
						siblingCells,
						t
					}

					// will assign x, y, width, height, fill, label, order, etc
					const legend = setCellProps[t.tw.term.type](cell, t.tw, anno, value, s, t, this, width, height, dx, dy, i)
					if (legend) {
						if (!legendGroups[legend.group]) legendGroups[legend.group] = { ref: legend.ref, values: {} }
						if (!legendGroups[legend.group].values[legend.value])
							legendGroups[legend.group].values[legend.value] = legend.entry
					}

					series.cells.push(cell)
					siblingCells.push(cell)
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
		return series.row.sampleName || ''
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
		return t.grp.name || [{ text: '⋮', dx: 3, cls: 'sjpp-exclude-svg-download' }]
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

export const matrixInit = getCompInit(Matrix)
// this alias will allow abstracted dynamic imports
export const componentInit = matrixInit

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
