import { getCompInit, copyMerge, deepEqual } from '../rx'

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
		nonsettings: !deepEqual(prevState, currState),
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

export async function setData(_data) {
	/* requests data for all terms shown in matrix,
		by creating request argument for getAnnotatedSampleData and run it
		NOTE this excludes the term group used for hierCluster, as its data request is done separately
		*/
	const terms = []

	const termgroups =
		this.chartType == 'hierCluster'
			? this.config.termgroups.filter(grp => grp != this.hcTermGroup)
			: this.config.termgroups
	for (const grp of termgroups) {
		terms.push(...grp.lst)
	}
	if (this.config.divideBy) terms.push(this.config.divideBy)
	this.numTerms = terms.length

	const opts = {
		terms,
		filter: this.state.filter,
		filter0: this.state.filter0,
		loadingDiv: this.dom.loadingDiv,
		maxGenes: this.state.config.settings.matrix.maxGenes
	}

	if (this.chartType == 'hierCluster') {
		/* quick fix, only needed for gdc
			so backend case query will know this context and pull cases with gene exp data
			is ignored by non-gdc datasets
			*/
		opts.isHierCluster = 1
	}

	this.data = await this.app.vocabApi.getAnnotatedSampleData(opts, _data)
	this.sampleIdMap = {}
	for (const d of this.data.lst) {
		// mapping of sample string name to integer id
		// TODO: not able to find matching sample names between ASH and termdb?
		const name = d.sampleName.split('_')[0]
		this.sampleIdMap[name] = d.sample
	}
}
