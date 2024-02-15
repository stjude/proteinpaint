import { getCompInit, copyMerge, deepEqual } from '../rx'
import { sample_match_termvaluesetting } from '../common/termutils'

// track state diff to be able to skip server data request
// and term/sample order recomputation, as needed
//
// !!! NOTE !!!
// May have to add properties in getState() or
// in one of the "diffs" below, if the matrix does not react
// to data, ordering, sorting changes
//
export function computeStateDiff() {
	const s = this.settings.matrix
	const prevState = structuredClone(this.prevState)
	const currState = structuredClone(this.state)
	// these request bodies will be used to detect the need to make another server request
	this.currRequestOpts = {
		matrix: this.getMatrixRequestOpts(currState),
		hierCluster: this.getHCRequestBody?.(currState)
	}

	delete prevState.config?.settings
	delete prevState.isVisible
	delete currState.config.settings
	delete currState.isVisible
	const p = this.prevState.config.settings?.matrix || {}
	const c = this.state.config.settings.matrix
	const phc = this.prevState.config.settings.hierCluster || {}
	const chc = this.state.config.settings.hierCluster || {}

	this.stateDiff = {
		// state diff that should trigger a different server request
		nonsettings: !deepEqual(this.prevRequestOpts, this.currRequestOpts),
		// state/config/settings diffs that trigger re-sorting
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
				rowh: p.rowh,
				clusterMethod: phc.clusterMethod
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
				rowh: c.rowh,
				clusterMethod: chc.clusterMethod
			}
		),
		// state/config/settings that trigger canvas re-rendering
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

	// must remember the previous state right away, so that subsequent computeStateDiffs
	// has the correct reference in case of errors
	this.prevState = this.state
	this.prevRequestOpts = structuredClone(this.currRequestOpts)
}

export function mayRequireToken(tokenMessage = '') {
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

export function getMatrixRequestOpts(state) {
	/* requests data for all terms shown in matrix,
		by creating request argument for getAnnotatedSampleData and run it
		NOTE this excludes the term group used for hierCluster, as its data request is done separately
		*/
	const terms = []

	const termgroups =
		this.chartType == 'hierCluster'
			? state.config.termgroups.filter(grp => grp.type != 'hierCluster')
			: state.config.termgroups

	for (const grp of termgroups) {
		terms.push(...getNormalizedTwLstCopy(grp.lst))
	}
	if (state.config.divideBy) terms.push(normalizeTwForRequest(state.config.divideBy))

	const opts = {
		terms,
		filter: state.filter,
		filter0: state.filter0,
		maxGenes: state.config.settings.matrix.maxGenes
		//termsPerRequest: 100 // this is just for testing
	}

	if (this.chartType == 'hierCluster') {
		/* quick fix, only needed for gdc
			so backend case query will know this context and pull cases with gene exp data
			is ignored by non-gdc datasets
			*/
		opts.isHierCluster = 1
	}

	return opts
}

function getNormalizedTwLstCopy(twlst) {
	const lst = structuredClone(twlst)
	lst.forEach(normalizeTwForRequest)
	lst.sort(sortTwLst)
	return lst
}

function normalizeTwForRequest(tw) {
	if (!tw?.term) return
	// These props are cohort-dependent and should be ignored like termfilter.filter0.
	// Note that state filter, filter0 are always sent to the server for dataset-related requests,
	// which indirectly covers the computed properties below that are being deleted.
	delete tw.term.category2samplecount
	// for GDC, the term.values may not be known ahead of time
	// and only filled in as data comes in, should ignore this
	// computed value as to avoid affecting tracked state
	delete tw.term.values
	return tw
}

function sortTwLst(twa, twb) {
	const a = twa?.$id || twa.term?.id || twa?.term?.name
	const b = twb?.$id || twb.term?.id || twb?.term?.name
	return a < b ? -1 : 1
}

export async function setData(_data) {
	const opts = this.currRequestOpts?.matrix || this.getMatrixRequestOpts(this.state)
	this.numTerms = opts.terms.length
	const abortCtrl = new AbortController()
	opts.signal = abortCtrl.signal
	opts.loadingDiv = this.chartType != 'hierCluster' && this.dom.loadingDiv

	const [data, stale] = await this.api.detectStale(() => this.app.vocabApi.getAnnotatedSampleData(opts, _data), {
		abortCtrl
	})
	if (stale) throw `stale sequenceId`
	this.data = data
	this.origData = structuredClone(this.data)
	this.sampleIdMap = {}
	for (const d of this.data.lst) {
		// mapping of sample string name to integer id
		// TODO: not able to find matching sample names between ASH and termdb?
		this.sampleIdMap[d.sample] = d._ref_.label
	}
}

export function applyLegendValueFilter() {
	const self = this
	if (!self.config.legendValueFilter.lst.length && !self.config.legendGrpFilter.lst.length) return

	for (const grpFilter of self.config.legendGrpFilter.lst) {
		if (grpFilter.dt) {
			for (const oneSampleData of self.origData.lst) {
				for (const annoForOneTerm of Object.values(oneSampleData)) {
					if (annoForOneTerm.values)
						annoForOneTerm.values = annoForOneTerm.values.filter(
							v => !(v.dt == grpFilter.dt && (!grpFilter.origin || v.origin == grpFilter.origin))
						)
					if (annoForOneTerm.countedValues)
						annoForOneTerm.countedValues = annoForOneTerm.countedValues.filter(
							v => !(v.dt == grpFilter.dt && (!grpFilter.origin || v.origin == grpFilter.origin))
						)
					if (annoForOneTerm.filteredValues)
						annoForOneTerm.filteredValues = annoForOneTerm.filteredValues.filter(
							v => !(v.dt == grpFilter.dt && (!grpFilter.origin || v.origin == grpFilter.origin))
						)
					if (annoForOneTerm.renderedValues)
						annoForOneTerm.renderedValues = annoForOneTerm.renderedValues.filter(
							v => !(v.dt == grpFilter.dt && (!grpFilter.origin || v.origin == grpFilter.origin))
						)
				}
			}

			for (const oneSampleData of Object.values(self.origData.samples)) {
				for (const annoForOneTerm of Object.values(oneSampleData)) {
					if (annoForOneTerm.values)
						annoForOneTerm.values = annoForOneTerm.values.filter(
							v => !(v.dt == grpFilter.dt && (!grpFilter.origin || v.origin == grpFilter.origin))
						)
					if (annoForOneTerm.countedValues)
						annoForOneTerm.countedValues = annoForOneTerm.countedValues.filter(
							v => !(v.dt == grpFilter.dt && (!grpFilter.origin || v.origin == grpFilter.origin))
						)
					if (annoForOneTerm.filteredValues)
						annoForOneTerm.filteredValues = annoForOneTerm.filteredValues.filter(
							v => !(v.dt == grpFilter.dt && (!grpFilter.origin || v.origin == grpFilter.origin))
						)
					if (annoForOneTerm.renderedValues)
						annoForOneTerm.renderedValues = annoForOneTerm.renderedValues.filter(
							v => !(v.dt == grpFilter.dt && (!grpFilter.origin || v.origin == grpFilter.origin))
						)
				}
			}
		} else {
			for (const oneSampleData of self.origData.lst) {
				delete oneSampleData[grpFilter.$id]
			}
			for (const oneSampleData of Object.values(self.origData.samples)) {
				delete oneSampleData[grpFilter.$id]
			}
		}
	}

	const geneVariant$ids = Object.values(self.data.refs.byTermId)
		.filter(v => v.term?.type == 'geneVariant')
		.map(v => v.$id)
	const data = { samples: {}, lst: [], refs: self.data.refs }

	for (const row of self.origData.lst) {
		const include = sample_match_termvaluesetting(row, self.config.legendValueFilter, geneVariant$ids)
		if (include || self.chartType == 'hierCluster') {
			// for hierCluster, should not filter out any samples by sample_match_termvaluesetting
			// samples are filtered out by joining legendValueFilter with filter in setHierClusterData
			data.samples[row.sample] = row
			data.lst.push(row)
		}
	}

	for (const valFilter of self.config.legendValueFilter.lst) {
		// after applying each soft filter, hide the remaining targetted mclass
		if (valFilter.tvs.legendFilterType !== 'geneVariant_soft') continue
		const tvsV = valFilter.tvs.values[0]

		for (const oneSampleData of data.lst) {
			for (const annoForOneTerm of Object.values(oneSampleData)) {
				if (annoForOneTerm.values)
					annoForOneTerm.values = annoForOneTerm.values.filter(
						v => !(v.dt == tvsV.dt && (!tvsV.origin || v.origin == tvsV.origin) && tvsV.mclasslst.includes(v.class))
					)
				if (annoForOneTerm.countedValues)
					annoForOneTerm.countedValues = annoForOneTerm.countedValues.filter(
						v => !(v.dt == tvsV.dt && (!tvsV.origin || v.origin == tvsV.origin) && tvsV.mclasslst.includes(v.class))
					)
				if (annoForOneTerm.filteredValues)
					annoForOneTerm.filteredValues = annoForOneTerm.filteredValues.filter(
						v => !(v.dt == tvsV.dt && (!tvsV.origin || v.origin == tvsV.origin) && tvsV.mclasslst.includes(v.class))
					)
				if (annoForOneTerm.renderedValues)
					annoForOneTerm.renderedValues = annoForOneTerm.renderedValues.filter(
						v => !(v.dt == tvsV.dt && (!tvsV.origin || v.origin == tvsV.origin) && tvsV.mclasslst.includes(v.class))
					)
			}
		}
		for (const oneSampleData of Object.values(data.samples)) {
			for (const annoForOneTerm of Object.values(oneSampleData)) {
				if (annoForOneTerm.values)
					annoForOneTerm.values = annoForOneTerm.values.filter(
						v => !(v.dt == tvsV.dt && (!tvsV.origin || v.origin == tvsV.origin) && tvsV.mclasslst.includes(v.class))
					)
				if (annoForOneTerm.countedValues)
					annoForOneTerm.countedValues = annoForOneTerm.countedValues.filter(
						v => !(v.dt == tvsV.dt && (!tvsV.origin || v.origin == tvsV.origin) && tvsV.mclasslst.includes(v.class))
					)
				if (annoForOneTerm.filteredValues)
					annoForOneTerm.filteredValues = annoForOneTerm.filteredValues.filter(
						v => !(v.dt == tvsV.dt && (!tvsV.origin || v.origin == tvsV.origin) && tvsV.mclasslst.includes(v.class))
					)
				if (annoForOneTerm.renderedValues)
					annoForOneTerm.renderedValues = annoForOneTerm.renderedValues.filter(
						v => !(v.dt == tvsV.dt && (!tvsV.origin || v.origin == tvsV.origin) && tvsV.mclasslst.includes(v.class))
					)
			}
		}
	}
	if (self.chartType !== 'hierCluster') remove_empty_sample(data)
	self.data = data
}

// each time gene legend soft filter or gene legend group filter is applied (when cell gene values updated), remove
// the samples that have empty cells (not even WT or BLANK)
function remove_empty_sample(data) {
	for (const oneSampleData of data.lst) {
		let removeSample = true
		for (const [key, annoForOneTerm] of Object.entries(oneSampleData)) {
			if (!annoForOneTerm.values) continue
			const annoType = data.refs.byTermId[key].term.type
			if (annoType != 'geneVariant') continue
			if (annoForOneTerm.values.length) removeSample = false
		}
		if (removeSample) {
			data.lst = data.lst.filter(dl => dl.sample !== oneSampleData.sample)
			delete data.samples[parseInt(oneSampleData.sample)]
		}
	}
	return data
}
