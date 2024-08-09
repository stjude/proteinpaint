import { getNormalRoot } from '#filter'

/*
	Create URL parameters for charts that use the 
	`/termdb` server route, which expects the  
	term0, term, term2 variable naming convention

	Arguments:
	config
	- chart configuration object with termwrappers of
		term (required), term0 (optional) and term2 (optional)

	vocabApi

	termfilter
	- the wrapper object for filter root
	- see the termdb or mass app.state.termfilter
*/
export function getTermFilterParams(config, vocabApi, termfilter = null) {
	const params = []

	for (const _key of ['term', 'term2', 'term0']) {
		// "term" on client is "term1" at backend
		const term = config[_key]
		if (!term) continue
		const key = _key == 'term' ? 'term1' : _key
		params.push(key + '_id=' + encodeURIComponent(term.term.id))
		if (!term.q) throw 'plot.' + _key + '.q{} missing: ' + term.term.id
		params.push(key + '_q=' + vocabApi.q_to_param(term.q))
	}

	if (termfilter) {
		const filter = getNormalRoot(termfilter.filter)
		if (filter.lst.length) {
			params.push('filter=' + encodeURIComponent(JSON.stringify(filter)))
		}
	}

	return params
}

/*
	May override certain term-related configuration (like bins),
	from the server response data to the corresponding term's 
	current state.

	Arguments
	config
	- chart configuration object with termwrappers of
		term (required), term0 (optional) and term2 (optional)

	- data
		server response data in the format of 
		{
			charts: [{
				chartId: '...',
				serieses: [{
					seriesId: '...',
					data: [{
						dataId: '...',
						total: *samplecount*
					}, ...],
					total: *samplecount*
				}, ...],
				total: *samplecount*
			}, ...],

			refs: {...}
		}
*/
export function syncParams(config, data) {
	if (!data || !data.refs) return
	for (const [i, key] of ['term0', 'term', 'term2'].entries()) {
		const term = config[key]
		if (term == 'genotype') return
		if (!term) {
			if (key == 'term') throw `missing plot.term{}`
			return
		}
		if (data.refs.bins) {
			term.bins = data.refs.bins[i]
			if (data.refs.q && data.refs.q[i]) {
				if (!term.q) term.q = {}
				const q = data.refs.q[i]
				if (q !== term.q) {
					for (const key in term.q) delete term.q[key]
					Object.assign(term.q, q)
				}
			}
		}
		if (!term.q) term.q = {}
	}
}
