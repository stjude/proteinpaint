import { getCompInit, copyMerge, deepEqual } from '../rx'
import { setMatrixDom } from './matrix.dom'
import { setInteractivity } from './matrix.interactivity'
import { setRenderers } from './matrix.renderers'
import { MatrixCluster } from './matrix.cluster'
import { MatrixControls } from './matrix.controls'
import { setCellProps, getEmptyCell, maySetEmptyCell } from './matrix.cells'
import { select } from 'd3-selection'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { schemeCategory10, interpolateReds, interpolateBlues } from 'd3-scale-chromatic'
import { schemeCategory20 } from '#common/legacy-d3-polyfill'
import { axisLeft, axisTop, axisRight, axisBottom } from 'd3-axis'
import svgLegend from '#dom/svg.legend'
import { mclass, dt2label, morigin } from '#shared/common'
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
		this.setDom = setMatrixDom
		this.setDom(opts)

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
			},
			settings: {
				isExcludedAttr: 'isExcluded'
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
		Levels of mclass overrides, from more general to more specific. Same logic for dt2label

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
		const commonKeys = { mclass, dt2label, morigin }
		for (const k in commonKeys) {
			const v = commonKeys[k]
			this[k] = copyMerge({}, v, appState.termdbConfig[k] || {}, appState.termdbConfig.matrix?.[k] || {})
		}
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
			vocab: appState.vocab,
			termdbConfig: appState.termdbConfig
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
			this.dom.loadingDiv.html('').style('display', '').style('position', 'absolute').style('left', '45%')

			// skip data requests when changes are not expected to affect the request payload
			if (this.stateDiff.nonsettings) {
				// get the data
				const reqOpts = await this.getDataRequestOpts()
				this.data = await this.app.vocabApi.getAnnotatedSampleData(reqOpts)
				this.dom.loadingDiv.html('Processing data ...')
				// tws in the config may be filled-in based on applicable server response data;
				// these filled-in config, such as tw.term.values|category2samplecount, will need to replace
				// the corresponding tracked state values in the app store, without causing unnecessary
				// dispatch notifications, so use app.save()
				this.app.save({ type: 'plot_edit', id: this.id, config: this.config })
			}
			this.dom.loadingDiv.html('Updating ...').style('display', '')

			if (this.stateDiff.nonsettings || this.stateDiff.sorting) {
				this.termOrder = this.getTermOrder(this.data)
				this.sampleGroups = this.getSampleGroups(this.data)
				this.sampleOrder = this.getSampleOrder(this.data)
			}

			if (!this.sampleOrder.length) {
				this.dom.loadingDiv.html('No matching sample data').style('display', '')
				this.dom.svg.style('display', 'none')
				return
			}

			this.setLayout()
			this.serieses = this.getSerieses(this.data)

			// render the data
			this.dom.loadingDiv.html('Rendering ...')
			this.render()
			this.dom.loadingDiv.style('display', 'none')
			this.dom.svg.style('display', '')

			const [xGrps, yGrps] = !this.settings.matrix.transpose ? ['sampleGrps', 'termGrps'] : ['termGrps', 'sampleGrps']
			const d = this.dimensions
			this.clusterRenderer.main({
				settings: this.settings.matrix,
				xGrps: this[xGrps],
				yGrps: this[yGrps],
				dimensions: d
			})

			this.legendRenderer(this.legendData, {
				settings: Object.assign({}, this.settings.legend, {
					svgw: Math.max(400, d.mainw + d.xOffset - this.settings.matrix.margin.right),
					svgh: d.mainh + d.yOffset,
					dimensions: d,
					padleft: this.settings.legend.padleft //+ d.xOffset
				})
			})

			await this.adjustSvgDimensions(prevTranspose)
			this.controlsRenderer.main()
		} catch (e) {
			// a new token message error may have been triggered by the data request here,
			// even if the initial state did not have a token message at the start of a dispatch
			const message = this.app.vocabApi.tokenVerificationMessage
			this.mayRequireToken(message)
			if (!message) {
				this.app.tip.hide()
				this.dom.loadingDiv.style('display', 'none')
				throw e
			}
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
					sampleNameFilter: p.sampleNameFilter,
					sortSamplesBy: p.sortSamplesBy,
					sortSampleGrpsBy: p.sortSampleGrpsBy,
					sortSamplesTieBreakers: p.sortSamplesTieBreakers,
					sortTermsBy: p.sortTermsBy,
					// TODO: take out dimension related computations in setTermOrder,
					// so that sorting is not affected by rowh
					rowh: p.rowh
				},
				{
					maxSample: c.maxSample,
					sortPriority: c.sortPriority,
					sampleNameFilter: c.sampleNameFilter,
					sortSamplesBy: c.sortSamplesBy,
					sortSampleGrpsBy: c.sortSampleGrpsBy,
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

	getSampleGroups(data) {
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
				const key = row[$id].key
				const name = key in values && values[key].label ? values[key].label : key
				if (!sampleGroups.has(key)) {
					const grp = {
						name: `${name}`, // convert to a string
						id: key,
						lst: [],
						tw: this.config.divideBy,
						legendGroups: {},
						isExcluded: exclude.includes(key)
					}
					if (ref.bins) grp.order = ref.bins.findIndex(bin => bin.name == key)
					sampleGroups.set(key, grp)
				}
				sampleGroups.get(key).lst.push(row)
			} else {
				defaultSampleGrp.lst.push(row)
			}
		}

		const n = sampleGroups.size
		if (n > 100 && sampleGrpsArr.filter(sg => sg.lst.length < 3).length > 0.8 * n) {
			const l = s.controlLabels
			throw `Did not group ${l.samples} by "${term.name}": too many ${l.sample} groups (${n}), with the majority of groups having <= 2 ${l.samples} per group.`
		}

		if (defaultSampleGrp.lst.length && !sampleGroups.size) {
			sampleGroups.set(undefined, defaultSampleGrp)
		}

		const sampleGrpsArr = [...sampleGroups.values()]
		const selectedDictTerms = this.termOrder.filter(t => t.tw.sortSamples && t.tw.term.type != 'geneVariant')
		// initial sorting for ungrouped samples, prioritizes grouping by gene variant, skippin other sorters at this step
		const noGrpSampleSorter = getSampleSorter(this, s, data.lst, {
			skipSorter: (p, tw) => !p.types?.includes('geneVariant') && selectedDictTerms.find(t => t.tw.$id === tw.$id)
		})
		const noGrpSampleOrder = data.lst.sort(noGrpSampleSorter)
		// truncate the samples based on the initial sorting
		const allowedSamples = noGrpSampleOrder.slice(0, s.maxSample)
		// do not include samples that are not in the truncated allowedSamples
		const dataFilter = d => allowedSamples.includes(d)
		// these hits counter functions may be used for sortSampleGrpsBy = 'hits'
		const hitsPerSample = (t, c) => t + (typeof c == 'object' && c.countedValues?.length ? c.countedValues?.length : 0)
		const countHits = (total, d) => total + Object.values(d).reduce(hitsPerSample, 0)
		// this second sorter will be applied within each group of samples
		const grpLstSampleSorter = getSampleSorter(this, s, data.lst)
		for (const grp of sampleGrpsArr) {
			grp.lst = grp.lst.filter(dataFilter)
			grp.totalCountedValues = grp.lst.reduce(countHits, 0)
			grp.lst.sort(grpLstSampleSorter)
		}

		// TODO: sort sample groups, maybe by sample count, value order, etc
		return sampleGrpsArr.sort((a, b) => {
			// NOTE: should not reorder by isExcluded, in order to maintain the assigned legend item order, colors, etc
			//if (a.isExcluded && !b.isExcluded) return 1
			//if (!a.isExcluded && b.isExcluded) return -1
			if (a.lst.length && !b.lst.length) return -1
			if (!a.lst.length && b.lst.length) return 1
			if ('order' in a && 'order' in b) return a.order - b.order
			if ('order' in a) return -1
			if ('order' in b) return 1
			if (s.sortSampleGrpsBy == 'sampleCount' && a.lst.length != b.lst.length) return b.lst.length - a.lst.length
			if (s.sortSampleGrpsBy == 'hits') return b.totalCountedValues - a.totalCountedValues
			return a.name < b.name ? -1 : 1
		})
	}

	getSampleOrder(data) {
		const s = this.settings.matrix
		this.visibleSampleGrps = new Set()
		const sampleOrder = []
		let total = 0,
			numHiddenGrps = 0
		for (const [grpIndex, grp] of this.sampleGroups.entries()) {
			if (!grp.lst.length) continue
			if (grp.isExcluded) numHiddenGrps++
			let processedLst = grp.lst
			for (const [index, row] of processedLst.entries()) {
				sampleOrder.push({
					grp,
					grpIndex: grpIndex - numHiddenGrps, // : this.sampleGroups.length,
					row,
					index,
					prevGrpTotalIndex: total,
					totalIndex: total + index,
					totalHtAdjustments: 0, // may be required when transposed???
					grpTotals: { htAdjustment: 0 }, // may be required when transposed???
					_SAMPLENAME_: row.sampleName,
					processedLst
				})
			}
			if (!grp.isExcluded) total += processedLst.length
			this.visibleSampleGrps.add(grp)
			//if (s.maxSample && total >= s.maxSample) break // *** Apply group sorting before column truncation ????? ****
		}
		this.unfilteredSampleOrder = sampleOrder
		return sampleOrder.filter(so => !so.grp.isExcluded)
	}

	getTermOrder(data) {
		const s = this.settings.matrix
		this.termSorter = getTermSorter(this, s)
		this.termGroups = JSON.parse(JSON.stringify(this.config.termgroups))
		const termOrder = []
		let totalIndex = 0,
			visibleGrpIndex = 0
		for (const [grpIndex, grp] of this.termGroups.entries()) {
			const lst = [] // will derive a mutable copy of grp.lst
			for (const [index, tw] of grp.lst.entries()) {
				const counts = { samples: 0, hits: 0 }
				const countedSamples = new Set()
				// sd = sample data, s = this.settings.matrix
				for (const sd of data.lst) {
					if (countedSamples.has(sd.sample)) continue
					countedSamples.add(sd.sample)
					const anno = sd[tw.$id]
					if (anno) {
						const { filteredValues, countedValues, renderedValues } = this.classifyValues(anno, tw, grp, s)
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
				termOrder.push({
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
		return termOrder
	}

	classifyValues(anno, tw, grp, s) {
		const values = 'value' in anno ? [anno.value] : anno.values
		if (!values) return { filteredValues: null, countedValues: null, renderedValues: null }
		const valueFilter = tw.valueFilter || grp.valueFilter
		const filteredValues = values.filter(v => {
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
		// group stacked cell values to avoid striped pattern
		if (tw.term.type == 'geneVariant') renderedValues.sort(this.stackSiblingCellsByClass)

		return {
			filteredValues,
			countedValues: filteredValues.filter(v => {
				/*** do not count wildtype and not tested as hits ***/
				if (tw.term.type == 'geneVariant') {
					if (v.class == 'WT' || v.class == 'Blank') return false
					if (s.geneVariantCountSamplesSkipMclass.includes(v.class)) return false
				}
				return true
			}),
			renderedValues
		}
	}

	stackSiblingCellsByClass(a, b) {
		return a.class === b.class ? 0 : a.class === 'Blank' ? 1 : b.class == 'Blank' ? -1 : a.class < b.class ? -1 : 1
	}

	setAutoDimensions(xOffset) {
		const m = this.state.config.settings.matrix
		if (!this.autoDimensions) this.autoDimensions = new Set()

		if (!m.colw) this.autoDimensions.add('colw')
		else this.autoDimensions.delete('colw')
		if (!m.rowh) this.autoDimensions.add('rowh')
		else this.autoDimensions.delete('rowh')

		const s = this.settings.matrix
		this.computedSettings = {
			useCanvas: this.sampleOrder.length > m.svgCanvasSwitch
		}

		if (s.availContentWidth) {
			this.availContentWidth = s.availContentWidth
		} else {
			let boundingWidth = this.dom.contentNode.getBoundingClientRect().width
			if (boundingWidth < 600) boundingWidth = window.document.body.clientWidth

			const padding = 65
			// should be estimated based on label-fontsize and longest label
			// const labelOffset = !s.transpose
			// 	? s.termLabelOffset + s.termGrpLabelOffset
			// 	: s.sampleLabelOffset + s.sampleGrpLabelOffset

			this.availContentWidth = boundingWidth - padding - s.margin.right - xOffset //- 0.5*labelOffset
		}

		if (this.autoDimensions.has('colw')) {
			const totalColgspace = s.colgspace * Math.max(0, this.visibleSampleGrps.size - 1)
			const tentativeGaps = this.sampleOrder.length * s.colspace + totalColgspace
			const spacedColw = (this.availContentWidth - tentativeGaps) / this.sampleOrder.length
			const tentativeColw = Math.max(s.colwMin, Math.min(spacedColw, s.colwMax))
			// detect if using colspace will cause the tentative computed widths to be exceeded
			if (s.zoomLevel * tentativeColw < 2) {
				this.computedSettings.colw = (this.availContentWidth - totalColgspace) / this.sampleOrder.length
				this.computedSettings.colspace =
					s.zoomLevel <= 1 || s.zoomLevel * this.computedSettings.colw < 2 ? 0 : s.colspace
			} else {
				this.computedSettings.colw = tentativeColw
				this.computedSettings.colspace = s.colspace
			}
		}

		if (this.autoDimensions.has('rowh')) {
			this.computedSettings.rowh = Math.max(5, Math.round(screen.availHeight / this.numTerms))
		}

		copyMerge(this.settings.matrix, this.computedSettings)
	}

	setLabelsAndScales() {
		const s = this.settings.matrix
		this.cnvValues = {}
		// ht: standard cell dimension for term row or column
		const ht = s.transpose ? s.colw : s.rowh
		const grpTotals = {}
		const processedLabels = { sampleGrpByName: {}, termGrpByName: {} }
		let totalHtAdjustments = 0

		for (const t of this.termOrder) {
			const countedSamples = new Set()
			t.counts = { samples: 0, hits: 0 }
			if (!processedLabels.termGrpByName[t.grp.name || '']) {
				const name = t.grp.name || ''
				t.grp.label = name.length < s.termGrpLabelMaxChars ? name : name.slice(0, s.termGrpLabelMaxChars) + '...'
				processedLabels.termGrpByName[name] = t.grp.label
			}

			for (const sample of this.sampleOrder) {
				if (countedSamples.has(sample.row.sample)) continue
				const name = sample.grp.name || ''
				if (!(name in processedLabels.sampleGrpByName)) {
					sample.grp.label =
						name.length < s.sampleGrpLabelMaxChars ? name : name.slice(0, s.sampleGrpLabelMaxChars) + '...'
					if (this.config.divideBy) sample.grp.label += ` (${sample.grp.lst.length})`
					processedLabels.sampleGrpByName[name] = sample.grp.label
				}
				const sampleName = sample.row.sampleName || sample.row.sample || ''
				sample.label =
					sampleName.length < s.collabelmaxchars ? sampleName : sampleName.slice(0, s.collabelmaxchars) + '...'

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
						if (!t.tw.term.values?.[v]?.uncomputable) {
							if (!('minval' in t.counts) || t.counts.minval > v) t.counts.minval = v
							if (!('maxval' in t.counts) || t.counts.maxval < v) t.counts.maxval = v
						}
					}
					if (t.tw.term.type == 'geneVariant' && anno.values) {
						for (const val of anno.values) {
							if (val.dt != 4 || !('value' in val) || s.ignoreCnvValues) continue
							const v = val.value
							const minKey = v < 0 ? 'minLoss' : 'minGain'
							const maxKey = v < 0 ? 'maxLoss' : 'maxGain'
							if (!(minKey in this.cnvValues) || this.cnvValues[minKey] > v) this.cnvValues[minKey] = v
							if (!(maxKey in this.cnvValues) || this.cnvValues[maxKey] < v) this.cnvValues[maxKey] = v
						}
					}
				}
			}

			t.label = t.tw.label || t.tw.term.name
			if (t.label.length > s.rowlabelmaxchars) t.label = t.label.slice(0, s.rowlabelmaxchars) + '...'
			if (s.samplecount4gene && t.tw.term.type.startsWith('gene')) {
				const count =
					s.samplecount4gene === 'abs'
						? t.counts.samples
						: ((100 * t.counts.samples) / this.sampleOrder.length).toFixed(1) + '%'
				t.label = `${t.label} (${count})`
			}

			if (t.tw.q?.mode == 'continuous') {
				if (!t.tw.settings) t.tw.settings = {}
				if (!t.tw.settings.barh) t.tw.settings.barh = s.barh
				if (!('gap' in t.tw.settings)) t.tw.settings.gap = 4
				const barh = t.tw.settings.barh
				const absMin = Math.abs(t.counts.minval)
				const ratio = t.counts.minval >= 0 ? 1 : t.counts.maxval / (absMin + t.counts.maxval)
				t.counts.posMaxHt = ratio * barh
				const tickValues =
					t.counts.minVal < 0 && t.counts.maxval > 0
						? [t.counts.minval, t.counts.maxval]
						: t.counts.maxval <= 0
						? [0, t.counts.minval]
						: [t.counts.maxval, 0]

				t.scales = {
					tickValues,
					full: scaleLinear().domain(tickValues).range([1, barh])
				}
				if (t.counts.maxval >= 0) {
					t.scales.pos = scaleLinear().domain([0, t.counts.maxval]).range([1, t.counts.posMaxHt])
				}
				if (t.counts.minval < 0) {
					t.scales.neg = scaleLinear()
						.domain([0, t.counts.minval])
						.range([1, barh - t.counts.posMaxHt - 5])
				}
			} else if (t.tw.term.type == 'geneVariant' && ('maxLoss' in this.cnvValues || 'maxGain' in this.cnvValues)) {
				const maxVals = []
				if ('maxLoss' in this.cnvValues) maxVals.push(this.cnvValues.maxLoss)
				if ('maxGain' in this.cnvValues) maxVals.push(this.cnvValues.maxGain)
				t.scales = {
					loss: interpolateBlues,
					gain: interpolateReds,
					max: Math.max(...maxVals)
				}
			}

			t.totalHtAdjustments = totalHtAdjustments
			t.rowHt = t.tw.settings ? t.tw.settings.barh + 2 * t.tw.settings.gap : ht
			const adjustment = t.rowHt - ht
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
			Math.max(colw + s.colspace - 2 * s.collabelpad - s.colspace, s.minLabelFontSize),
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
		if (layout.btm.prefix == 'sample') layout.btm.display = colw >= s.minLabelFontSize ? '' : 'none'

		const leftFontSize =
			_l_ == 'Grp'
				? s.grpLabelFontSize
				: Math.max(s.rowh + s.rowspace - 2 * s.rowlabelpad - s.rowspace, s.minLabelFontSize)
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

		this.dom.sampleLabelsPG.attr('clip-path', s.transpose ? '' : `url(#${this.seriesClipId})`)
		this.dom.termLabelsPG.attr('clip-path', s.transpose ? `url(#${this.seriesClipId})` : '')

		this.layout = layout
		if (!s.zoomCenterPct) {
			s.zoomCenterPct = 0.5
			s.zoomIndex = Math.round((s.zoomCenterPct * mainw) / dx)
			s.zoomGrpIndex = this.sampleOrder[s.zoomIndex]?.grpIndex || 0
		}
		// zoomCenter relative to mainw
		const zoomCenter = s.zoomCenterPct * mainw
		const centerCellX = s.zoomIndex * dx + s.zoomGrpIndex * s.colgspace
		const zoomedMainW = nx * dx + (this[`${col}Grps`].length - 1) * s.colgspace
		const seriesXoffset =
			s.zoomLevel <= 1 && mainw >= zoomedMainW ? 0 : Math.max(zoomCenter - centerCellX, mainw - zoomedMainW)

		//
		// canvas-related dimensions, computed to not exceed an ultrawide, zoomed-in
		// image width limit that causes the canvas to not render, and also
		// the possibly narrowed image must be positioned correctly
		//
		// for a canvas-generated image, the image is sharper when the image width is not an integer,
		// so subtract a negligible decimal value to have a numeric real/float width value
		const imgW = (s.imgWMax > zoomedMainW ? zoomedMainW : s.imgWMax) - 0.0000001
		const halfImgW = 0.5 * imgW
		// determine how the canvas image will be offset relative to the center of mainw (the visible width)
		const unwantedRightOvershoot = Math.max(0, centerCellX + halfImgW - zoomedMainW)
		const imgLeftMin = Math.max(0, centerCellX - Math.min(halfImgW, imgW) - unwantedRightOvershoot)
		// canvas cells with x posistions that fall outside of xMin and xMax will not be rendered,
		// since they will be outside the computed allowed image width
		const xMin = s.zoomLevel <= 1 && mainw >= zoomedMainW ? 0 : imgLeftMin
		const xMax = imgW + xMin
		// console.log({ imgW, mainw, xMin, xMax, seriesXoffset, imgLeftMin, xOffset, centerCellX, zoomedMainW, imgWMax: s.imgWMax })

		this.dimensions = {
			xMin,
			xMax,
			dx,
			dy,
			xOffset,
			yOffset,
			mainw,
			mainh,
			colw,
			zoomedMainW,
			seriesXoffset: seriesXoffset > 0 ? 0 : seriesXoffset,
			maxMainW: Math.max(mainwByColDimensions, this.availContentWidth),
			imgW,
			// recompute the resolvable "pixel width", in case the pixel ratio changes
			// when moving the browser window to a different monitor,
			// will be used to sharpen canvas shapes that are smaller than this pixel width
			pxw: 1 / window.devicePixelRatio
		}
	}

	getSerieses(data) {
		const s = this.settings.matrix
		const serieses = []
		const { colw, dx, dy, xMin, xMax } = this.dimensions
		const dvt = this.config.divideBy || {}
		const divideByTermId = 'id' in dvt ? dvt.id : dvt.name
		const legendGroups = {}
		this.colorScaleByTermId = {}

		for (const t of this.termOrder) {
			const $id = t.tw.$id
			const termid = 'id' in t.tw.term ? t.tw.term.id : t.tw.term.name
			const isDivideByTerm = termid === divideByTermId
			const emptyGridCells = []
			const y = !s.transpose ? t.totalIndex * dy + t.visibleGrpIndex * s.rowgspace + t.totalHtAdjustments : 0
			const hoverY0 = t.tw.settings?.gap || y
			const series = {
				t,
				tw: t.tw,
				cells: [],
				y,
				hoverY0,
				hoverY1: hoverY0 + (t.tw.settings?.barh || dy)
			}

			for (const so of this.unfilteredSampleOrder) {
				const { totalIndex, grpIndex, row } = so
				series.x = !s.transpose ? 0 : t.totalIndex * dx + t.visibleGrpIndex * s.colgspace

				const anno = row[$id]
				const cellTemplate = {
					s: so,
					sample: row.sample,
					_SAMPLENAME_: row.sampleName,
					tw: t.tw,
					term: t.tw.term,
					termid,
					$id,
					totalIndex,
					grpIndex,
					row,
					t
				}

				if (!anno || !anno.renderedValues?.length) {
					if (!so.grp.isExcluded && (s.useCanvas || so.grp)) {
						const cell = getEmptyCell(cellTemplate, s, this.dimensions)
						series.cells.push(cell)
					}
					continue
				}

				const key = anno.key
				const values = anno.renderedValues || anno.values || [anno.value]
				const numRects = s.cellEncoding == 'oncoprint' ? 1 : values.length
				const height = !s.transpose ? s.rowh / numRects : colw
				const width = !s.transpose ? colw : colw / values.length
				const siblingCells = []
				for (const [i, value] of values.entries()) {
					const cell = Object.assign({ key, siblingCells }, cellTemplate)
					cell.valueIndex = i

					// will assign x, y, width, height, fill, label, order, etc
					const legend = setCellProps[t.tw.term.type](cell, t.tw, anno, value, s, t, this, width, height, dx, dy, i)
					if (!s.useCanvas && (cell.x + cell.width < xMin || cell.x - cell.width > xMax)) continue
					if (legend) {
						for (const l of [legendGroups, so.grp.legendGroups]) {
							if (!l) continue
							if (!l[legend.group]) l[legend.group] = { ref: legend.ref, values: {}, order: legend.order }
							const lg = l[legend.group]
							if (!lg.values[legend.value]) {
								lg.values[legend.value] = legend.entry
							}
							if (!lg.values[legend.value].samples) lg.values[legend.value].samples = new Set()
							lg.values[legend.value].samples.add(row.sample)
							if (isDivideByTerm) {
								lg.values[legend.value].isExcluded = so.grp.isExcluded
							}
						}
					}

					if (!so.grp.isExcluded) {
						series.cells.push(cell)
						siblingCells.push(cell)
					}
				}

				if (s.showGrid == 'rect' && !so.grp.isExcluded) {
					const cell = maySetEmptyCell[t.tw.term.type]?.(siblingCells, cellTemplate, s, this.dimensions)
					if (cell) emptyGridCells.push(cell)
				}
			}
			if (emptyGridCells.length) series.cells.unshift(...emptyGridCells)
			if (series.cells.length) serieses.push(series)
		}

		this.legendData = this.getLegendData(legendGroups, data.refs)
		for (const grp of this.sampleGroups) {
			grp.legendData = this.getLegendData(grp.legendGroups, data.refs)
		}
		return serieses
	}

	sampleKey(s) {
		return s.row.sample
	}

	sampleLabel(s) {
		return s.label || s.row.label || s.row.sampleName || s.row.sample || ''
	}

	sampleGrpKey(s) {
		return s.grp.name
	}

	sampleGrpLabel(s) {
		return s.grp.label || s.grp.name || ''
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
		return t.grp.label || t.grp.name || [{ text: '⋮', dx: 3, cls: 'sjpp-exclude-svg-download' }]
	}

	getLegendData(legendGroups, refs) {
		const s = this.settings.matrix
		const legendData = []
		const dvt = this.config.divideBy || {}
		const dvtId = dvt && 'id' in dvt ? dvt.id : dvt.name
		for (const $id in legendGroups) {
			const legend = legendGroups[$id]

			if ($id == 'Mutation Types') {
				const keys = Object.keys(legend.values)
				if (!keys.length) continue
				legendData.unshift({
					name: 'Mutation Types',
					order: legend.order,
					items: keys.map((key, i) => {
						const item = legend.values[key]
						const count = item.samples.size
						return {
							termid: 'Mutation Types',
							key,
							text: this.getLegendItemText(item, count, {}, s),
							color: item.fill,
							order: i,
							border: '1px solid #ccc',
							count,
							isLegendItem: true
						}
					})
				})
				continue
			}

			const t =
				$id == dvtId
					? { tw: dvt }
					: this.termOrder.find(t => t.tw.$id == $id || t.tw.legend?.group == $id) || {
							tw: { term: { id: $id, name: $id, type: $id === 'CNV' ? 'geneVariant' : '' } }
					  }
			const keys = Object.keys(legend.values).sort((a, b) => legend.values[a].order - legend.values[b].order)
			const hasScale = Object.values(legend.values).find(v => v.scale)
			if (hasScale) {
				legendData.push({
					name: $id,
					order: legend.order,
					hasScale,
					items: keys.map((key, i) => {
						const item = legend.values[key]
						const count = item.samples?.size
						if (item.scale) {
							return {
								termid: $id,
								key,
								text: this.getLegendItemText(item, count, t, s),
								width: 100,
								scale: item.scale,
								domain: item.domain,
								minLabel: item.minLabel,
								maxLabel: item.maxLabel,
								order: 'order' in item ? item.order : i,
								count,
								isLegendItem: true
							}
						} else {
							return {
								termid: $id,
								key,
								text: this.getLegendItemText(item, count, t, s),
								color: item.fill || this.colorScaleByTermId[$id](key),
								order: 'order' in item ? item.order : i,
								count,
								isLegendItem: true
							}
						}
					})
				})
			} else {
				const grp = $id
				const term = t.tw.term
				const ref = legend.ref
				if (ref.bins)
					keys.sort((a, b) => ref.bins.findIndex(bin => bin.name === a) - ref.bins.findIndex(bin => bin.name === b))
				else if (ref.keyOrder) keys.sort((a, b) => ref.keyOrder.indexOf(a) - ref.keyOrder.indexOf(b))

				if (!this.colorScaleByTermId[grp])
					this.colorScaleByTermId[grp] =
						keys.length < 11 ? scaleOrdinal(schemeCategory10) : scaleOrdinal(schemeCategory20)

				const name = t.tw.legend?.group || t.tw.label || term.name
				legendData.push({
					name: name.length < s.rowlabelmaxchars ? name : name.slice(0, s.rowlabelmaxchars) + '...',
					order: legend.order,
					items: keys.map((key, i) => {
						const item = legend.values[key]
						const count = item.samples?.size
						return {
							termid: term.id,
							key,
							text: this.getLegendItemText(item, count, t, s),
							color: t.scale || item.fill || this.colorScaleByTermId[grp](key),
							order: 'order' in item ? item.order : i,
							count,
							isExcluded: item.isExcluded,
							onClickCallback: this.handleLegendItemClick,
							isLegendItem: true
						}
					})
				})
			}
		}

		return legendData.sort((a, b) => (a.order && b.order ? a.order - b.order : a.order ? -1 : b.order ? 1 : 0))
	}

	getLegendItemText(item, count, t, s) {
		let text = item.label
		const notes = [count]
		if (item.isExcluded) notes.push('hidden')
		if (t?.tw?.term?.type == 'geneVariant' && s.geneVariantCountSamplesSkipMclass.includes(item.key))
			notes.push('not counted')
		if (!notes.length) return text
		return (text += ` (${notes.join(', ')})`)
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
					chartsInstance.dom.tip.hide()
					const config = await chartsInstance.app.vocabApi.getMatrixByName(plot.name)
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
