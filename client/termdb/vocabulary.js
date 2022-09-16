import { dofetch3, isInSession } from '../common/dofetch'
import { getBarchartData, getCategoryData } from '../plots/barchart.data'
import { nonDictionaryTermTypes } from '../termsetting/termsetting'
import { getNormalRoot } from '../filter/filter'
import { scaleLinear } from 'd3-scale'
import { sample_match_termvaluesetting } from '../common/termutils'
import initBinConfig from '#shared/termdb.initbinconfig'
import { deepEqual } from '../rx'
import { isUsableTerm, graphableTypes } from '#shared/termdb.usecase'

const qCacheByTermId = {}

export function vocabInit(opts) {
	/*** start legacy support for state.genome, .dslabel ***/
	if (opts.vocab && !opts.state) {
		opts.state = { vocab: opts.vocab }
	}
	if (!opts.state) throw 'missing opts.state'
	if (!opts.state.vocab) {
		opts.state.vocab = opts.vocab ? opts.vocab : {}
	}
	const vocab = opts.state.vocab
	if (opts.state.genome) {
		vocab.genome = opts.state.genome
		delete opts.state.genome
	}
	if (opts.state.dslabel) {
		vocab.dslabel = opts.state.dslabel
		delete opts.state.dslabel
	}
	/*** end legacy support ***/

	if (vocab.dslabel) {
		return new TermdbVocab(opts)
	} else if (vocab.terms) {
		return new FrontendVocab(opts)
	}
}

class Vocab {
	constructor(opts) {
		this.app = opts.app
		this.opts = opts
		this.state = opts.state
		this.vocab = opts.state.vocab
		this.currAnnoData = { samples: {}, refs: { byTermId: {} }, lastTerms: [], lastFilter: {} }
		/*
			some categorical terms may not have an initial term.values object,
			but is expected to be filled from data requests such as nestedChartSeriesData()
			TODO: 
			- add values-filling logic to other data requests besides nestedChartSeriesData()
			- instead of this workaround, should query all available values in getterm()
		*/
		this.missingCatValsByTermId = {}
	}

	async main(stateOverride = null) {
		if (stateOverride) Object.assign(this.state, stateOverride)
		else this.state = this.app?.getState() || this.opts.state

		// frontend vocab may replace the vocab object reference
		if (this.state.vocab) this.vocab = this.state.vocab
		// may or may not need a verified token for a dslabel, based on genome response.dsAuth
		this.verifiedToken = isInSession(this.state.dslabel)

		// secured plots need to confirm that a verified token exists
		if (this.state.dslabel) await this.maySetVerifiedToken()
	}

	async maySetVerifiedToken() {
		// strict true boolean value means no auth required
		if (this.verifiedToken === true) return this.verifiedToken
		const token = this.opts.getDatasetAccessToken?.()
		if (this.verifedToken && token === this.verifiedToken) return this.verifiedToken
		try {
			const dslabel = this.state.dslabel
			const auth = this.state.termdbConfig?.requiredAuth
			if (!auth) {
				this.verifiedToken = true
				return
			}
			if (auth.type === 'jwt') {
				if (!token) {
					delete this.verifiedToken
					return
				}
				const data = await dofetch3('/jwt-status', {
					method: 'POST',
					headers: {
						[auth.headerKey]: token
					},
					body: {
						dslabel,
						embedder: location.hostname
					}
				})
				// TODO: later may check against expiration time in response if included
				this.verifiedToken = data.status === 'ok' && token
				if (data.error) throw data.error
				else {
					delete this.tokenVerificationMessage
				}
			} else {
				throw `unsupported requiredAuth='${auth.type}'`
			}
		} catch (e) {
			this.tokenVerificationMessage = e.message || e.reason || e
			if (typeof e == 'object') console.log(e)
		}
	}

	hasVerifiedToken() {
		return !!this.verifiedToken
	}

	cacheTermQ(term, q) {
		// only save q with a user or automatically assigned name
		if (!q.reuseId) throw `missing term q.reuseId for term.id='${term.id}'`
		this.app.dispatch({
			type: 'cache_termq',
			termId: term.id,
			q
		})
	}

	async uncacheTermQ(term, q) {
		await this.app.dispatch({
			type: 'uncache_termq',
			term,
			q
		})
	}

	getCustomTermQLst(term) {
		if (term.id) {
			const cache = this.state.reuse.customTermQ.byId[term.id] || {}
			const qlst = Object.values(cache).map(q => JSON.parse(JSON.stringify(q)))
			// find a non-conflicting reuseId for saving a new term.q
			for (let i = qlst.length + 1; i < 1000; i++) {
				const nextReuseId = `Setting #${i}`
				if (!qlst.find(q => q.reuseId === nextReuseId)) {
					qlst.nextReuseId = nextReuseId
					break
				}
			}
			// last resort to use a random reuseId that is harder to read
			if (!qlst.nextReuseId) {
				qlst.nextReuseId = btoa((+new Date()).toString()).slice(10, -3)
			}
			return qlst
		} else return []
	}
}

class TermdbVocab extends Vocab {
	// migrated from termdb/store
	async getTermdbConfig() {
		const data = await dofetch3(
			'termdb?genome=' +
				this.vocab.genome +
				'&dslabel=' +
				this.vocab.dslabel +
				'&gettermdbconfig=1' +
				`&embedder=${window.location.hostname}`
		)
		// note: in case of error such as missing dataset, supply empty object
		this.termdbConfig = data.termdbConfig || {}
		return this.termdbConfig
	}

	// migrated from termdb/tree
	async getTermChildren(term, cohortValuelst) {
		const lst = [
			'genome=' + this.vocab.genome,
			'dslabel=' + this.vocab.dslabel,
			term.__tree_isroot ? 'default_rootterm=1' : 'get_children=1&tid=' + term.id
		]
		if (cohortValuelst) {
			lst.push(
				'cohortValues=' +
					cohortValuelst
						.slice()
						.sort()
						.join(',')
			)
		}
		if (this.state.treeFilter) {
			lst.push('treeFilter=' + encodeURIComponent(JSON.stringify(this.state.treeFilter)))
		}
		const data = await dofetch3('/termdb?' + lst.join('&'), {}, this.opts.fetchOpts)
		if (data.error) throw data.error
		for (const term of data.lst) {
			if (term.type == 'integer' || term.type == 'float') {
				if (term.bins.rounding) term.bins.default.rounding = term.bins.rounding
				if (term.bins.label_offset && !term.bins.default.label_offset)
					term.bins.default.label_offset = term.bins.label_offset
			}
		}
		return data
	}

	/* from termdb/plot
	Input:
	opts{}
		.term={}
			.id=str
			.term={}
			.q={}
		.term2={}
			id/term/q
		.term0={}
			id/term/q
		.filter={}
	Output:
		a structure from the termdb-barsql route
	*/
	async getNestedChartSeriesData(opts) {
		const url = this.getTdbDataUrl(opts)
		const data = await dofetch3(url, {}, this.opts.fetchOpts)
		if (data.error) throw data.error

		const valuesByTermId = {}

		// TODO: instead of this workaround to fill in missing categorical term.values,
		// should query all available values in getterm()
		if (data.charts) {
			for (const chart of data.charts) {
				this.mayFillInMissingCatValues(opts.term0, chart.chartId, chart.total)

				for (const series of chart.serieses) {
					this.mayFillInMissingCatValues(opts.term, series.seriesId, series.total)

					for (const data of series.data) {
						this.mayFillInMissingCatValues(opts.term2, data.dataId, data.total)
					}
				}
			}
		}

		return data
	}

	mayFillInMissingCatValues(term, key, total) {
		if (!key) return
		if (!(term.id in this.missingCatValsByTermId)) return
		const t = this.missingCatValsByTermId[term.id]
		if (!(key in t.values)) {
			// TODO: assign color here so that the same color is used for a value even as the chart gets updated or reused
			t.values[key] = { key, label: key /*color: */ }
			t.samplecount[key] = { samplecount: 0, key, label: key }
		}
		// !!! NOTE: assumes a sample may only have at most one value by term
		// and so can add samplecount totals for an overlay term across charts and serieses
		t.samplecount[key].samplecount += total
	}

	/*
		Create URL parameters for charts that use the 
		`/termdb*` server route, which expects the  
		term0, term, term2 variable naming convention

		Arguments:
		opts
		- chart configuration object with termwrappers of
			term (required), term0 (optional) and term2 (optional)
		
		.term 
			required, {term, q}
		.term2
			optional overlay term, {term, q}
		.term0
			optional divide-by term, {term, q}
		.filter
			optional filter object 
		.ssid 
			optional genotype parameter {ssid, mname, chr, pos}
	*/
	getTdbDataUrl(opts) {
		const params = []

		if (opts.chartType == 'scatter') params.push('scatter=1')
		if (opts.chartType == 'cuminc') params.push('getcuminc=1')
		if (opts.chartType == 'survival') params.push('getsurvival=1')

		for (const _key of ['term0', 'term', 'term2']) {
			// "term" on client is "term1" at backend
			const term = opts[_key]
			if (!term) continue
			const key = _key == 'term' ? 'term1' : _key
			if ('id' in term.term) {
				params.push(key + '_id=' + encodeURIComponent(term.term.id))
			} else if (term.term.type == 'geneVariant') {
				params.push(key + '=' + encodeURIComponent(JSON.stringify(term.term)))
			}

			if (!term.q) throw 'plot.' + _key + '.q{} missing: ' + term.term.id
			params.push(key + '_q=' + q_to_param(term.q))
		}

		if (opts.filter) {
			const filter = getNormalRoot(opts.filter)
			if (filter.lst.length) {
				params.push('filter=' + encodeURIComponent(JSON.stringify(filter)))
			}
		}

		if (opts.ssid) {
			params.push(
				'term2_is_genotype=1',
				'ssid=' + opts.ssid.ssid,
				'mname=' + opts.ssid.mutation_name,
				'chr=' + opts.ssid.chr,
				'pos=' + opts.ssid.pos
			)
		}

		if ('grade' in opts) params.push(`grade=${opts.grade}`)
		if ('minSampleSize' in opts) params.push(`minSampleSize=${opts.minSampleSize}`)

		// start of mds3 parameters for variant2sample query
		if (opts.get) params.push('get=' + opts.get)
		// end of mds3 parameters

		const route = opts.chartType ? 'termdb' : 'termdb-barsql'
		return `/${route}?${params.join('&')}&genome=${this.vocab.genome}&dslabel=${this.vocab.dslabel}`
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
	syncTermData(config, data, prevConfig = {}) {
		if (!data || !data.refs) return
		for (const [i, key] of ['term0', 'term', 'term2'].entries()) {
			const term = config[key]
			const persistTerm = !prevConfig[key] || prevConfig[key].term?.id === term?.term?.id
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
					// FIGURE OUT: when will q equal term.q?
					if (q !== term.q || !persistTerm) {
						for (const key in term.q) {
							// persist hiddenValues if it exists, but may be overridden by the server data's q
							if (key != 'hiddenValues' || !persistTerm) delete term.q[key]
						}
						Object.assign(term.q, q)
					}
				}
			}
			if (!term.q) term.q = {}
			if (!term.q.groupsetting) term.q.groupsetting = {}
		}
	}

	/* 
		Generate regression analysis results
		config{}
		.regressionType: 'linear' | 'logistic'
		.outcome {id, term, q, refGrp}
		.independent[ {id, term, q, refGrp}, ... ]
	*/
	async getRegressionData(opts) {
		const outcome = { id: opts.outcome.id, q: JSON.parse(JSON.stringify(opts.outcome.q)) }
		if (!outcome.q.mode && opts.regressionType == 'linear') outcome.q.mode = 'continuous'
		const contQkeys = ['mode', 'scale']
		outcome.refGrp = outcome.q.mode == 'continuous' ? 'NA' : opts.outcome.refGrp

		if (outcome.q.mode == 'continuous') {
			// remove unneeded parameters from q
			for (const key in outcome.q) {
				if (!contQkeys.includes(key)) delete outcome.q[key]
			}
		}

		const params = [
			'getregression=1',
			`regressionType=${opts.regressionType}`,
			`outcome=${encodeURIComponent(JSON.stringify(outcome))}`,
			'independent=' +
				encodeURIComponent(
					JSON.stringify(
						opts.independent.map(t => {
							const q = JSON.parse(JSON.stringify(t.q))
							delete q.values
							delete q.totalCount
							if (t.q.mode == 'continuous') {
								// remove unneeded parameters from q
								for (const key in q) {
									if (!contQkeys.includes(key)) delete q[key]
								}
							}
							return {
								id: t.id,
								q,
								type: t.term.type,
								refGrp: t.q.mode == 'continuous' ? 'NA' : t.refGrp,
								interactions: t.interactions || [],
								values: t.term.values
							}
						})
					)
				)
		]

		const filterData = getNormalRoot(opts.filter)
		if (filterData.lst.length) {
			params.push('filter=' + encodeURIComponent(JSON.stringify(filterData))) //encodeNestedFilter(state.termfilter.filter))
		}
		const url = `/termdb?${params.join('&')}&genome=${this.vocab.genome}&dslabel=${this.vocab.dslabel}`
		const data = await dofetch3(url, {}, this.opts.fetchOpts)
		if (data.error) throw data.error
		return data
	}

	// from termdb/search
	async findTerm(str, cohortStr, usecase = null, type = '') {
		const lst = [
			'genome=' + this.vocab.genome,
			'dslabel=' + this.vocab.dslabel,
			'findterm=' + encodeURIComponent(str),
			'cohortStr=' + cohortStr
		]
		if (usecase) {
			lst.push('usecase=' + encodeURIComponent(JSON.stringify(usecase)))
		}
		if (this.state.treeFilter) {
			lst.push('treeFilter=' + encodeURIComponent(JSON.stringify(this.state.treeFilter)))
		}
		if (type) {
			lst.push('type=' + type)
		}
		const data = await dofetch3('termdb?' + lst.join('&'))
		if (data.error) throw data.error
		return data
	}

	// from termdb/terminfo
	async getTermInfo(id) {
		const args = ['genome=' + this.vocab.genome + '&dslabel=' + this.vocab.dslabel + '&getterminfo=1&tid=' + id]
		const data = await dofetch3('/termdb?' + args.join('&'), {}, this.opts.fetchOpts)
		if (data.error) throw data.error
		return data
	}

	// from termdb/nav
	async getCohortSampleCount(cohortName) {
		if (!cohortName) return
		const lst = [
			'genome=' + this.vocab.genome,
			'dslabel=' + this.vocab.dslabel,
			'getcohortsamplecount=' + cohortName,
			'cohortValues=' + cohortName
		]
		const data = await dofetch3('termdb?' + lst.join('&'), {}, this.opts.fetchOpts)
		if (!data) throw `missing data`
		else if (data.error) throw data.error
		else {
			return data[0].samplecount
		}
	}

	async getFilteredSampleCount(cohortName, filterJSON) {
		if (!cohortName) return
		const lst = [
			'genome=' + this.vocab.genome,
			'dslabel=' + this.vocab.dslabel,
			'getsamplecount=' + cohortName,
			'filter=' + encodeURIComponent(filterJSON)
		]
		const data = await dofetch3('termdb?' + lst.join('&'), {}, this.opts.fetchOpts)
		if (!data) throw `missing data`
		else if (data.error) throw data.error
		else {
			return data[0].samplecount
		}
	}

	async getDensityPlotData(term_id, num_obj, filter) {
		let density_q =
			'/termdb?density=1' +
			'&genome=' +
			this.vocab.genome +
			'&dslabel=' +
			this.vocab.dslabel +
			'&termid=' +
			term_id +
			'&width=' +
			num_obj.plot_size.width +
			'&height=' +
			num_obj.plot_size.height +
			'&xpad=' +
			num_obj.plot_size.xpad +
			'&ypad=' +
			num_obj.plot_size.ypad

		// must use the filter as supplied from a tvs pill,
		// since that filter excludes the tvs itself in order
		// to show all available values for its term
		if (filter) {
			const filterRoot = getNormalRoot(filter)
			density_q = density_q + '&filter=' + encodeURIComponent(JSON.stringify(filterRoot))
		}
		const density_data = await dofetch3(density_q)
		if (density_data.error) throw density_data.error
		return density_data
	}

	async getPercentile(term_id, percentile_lst, filter) {
		// for a numeric term, convert a percentile to an actual value, with respect to a given filter
		const lst = [
			'termdb?getpercentile=' + percentile_lst,
			'tid=' + term_id,
			'genome=' + this.vocab.genome,
			'dslabel=' + this.vocab.dslabel
		]
		if (filter) {
			lst.push('filter=' + encodeURIComponent(JSON.stringify(getNormalRoot(filter))))
		}
		return await dofetch3(lst.join('&'))
	}

	async getterm(termid, dslabel = null, genome = null) {
		if (!termid) throw 'getterm: termid missing'
		if (this && this.state && this.state.vocab) {
			if (this.state.vocab.dslabel) dslabel = this.state.vocab.dslabel
			if (this.state.vocab.genome) genome = this.state.vocab.genome
		}
		if (!dslabel) throw 'getterm: dslabel missing'
		if (!genome) throw 'getterm: genome missing'
		const data = await dofetch3(`termdb?dslabel=${dslabel}&genome=${genome}&gettermbyid=${encodeURIComponent(termid)}`)
		if (data.error) throw 'getterm: ' + data.error
		if (!data.term) throw 'no term found for ' + termid
		if (data.term.type == 'categorical' && !data.term.values && !data.term.groupsetting?.inuse) {
			// TODO: instead of this workaround to create an empty term.values to be filled in by other data requests,
			// the data response should already have the filled in term.values
			data.term.values = {}
			data.term.samplecount = {}
			this.missingCatValsByTermId[data.term.id] = data.term
		}
		return data.term
	}

	graphable(term) {
		if (!term) throw 'graphable: term is missing'
		return isUsableTerm(term).has('plot')
	}

	async getCategories(term, filter, lst = []) {
		if (term.samplecount) return { lst: Object.values(term.samplecount) }

		// works for both dictionary and non-dict term types
		// for non-dict terms, will handle each type individually
		// for dictionary terms, use same method to query backend termdb
		// return number of samples per category/bin/grade/group etc
		// optionally, caller can supply parameter "term1_q=stringifiedJSON" in lst[]
		// as this function does not deal with q by default

		if (term.type == 'snplst' || term.type == 'snplocus') {
			const args = [
				'validateSnps=1',
				'sumSamples=1',
				'genome=' + this.state.vocab.genome,
				'dslabel=' + this.state.vocab.dslabel,
				...lst
			]
			if (filter) {
				args.push('filter=' + encodeURIComponent(JSON.stringify(getNormalRoot(filter))))
			}
			return await dofetch3('/termdb?' + args.join('&'))
		}
		if (term.category2samplecount) {
			// grab directly from term and not the server
		}

		// use same query method for all dictionary terms
		const args = [
			'getcategories=1',
			'genome=' + this.state.vocab.genome,
			'dslabel=' + this.state.vocab.dslabel,
			'tid=' + term.id,
			...lst
		]
		if (filter) {
			args.push('filter=' + encodeURIComponent(JSON.stringify(getNormalRoot(filter))))
		}

		try {
			const data = await dofetch3('/termdb?' + args.join('&'))
			if (data.error) throw data.error
			return data
		} catch (e) {
			window.alert(e.message || e)
		}
	}

	async getNumericUncomputableCategories(term, filter) {
		// for numeric term
		// return number of samples per uncomputable categories
		const args = [
			'getnumericcategories=1',
			'genome=' + this.state.vocab.genome,
			'dslabel=' + this.state.vocab.dslabel,
			'tid=' + term.id
		]
		if (filter) {
			args.push('filter=' + encodeURIComponent(JSON.stringify(getNormalRoot(filter))))
		}
		try {
			const data = await dofetch3('/termdb?' + args.join('&'))
			if (data.error) throw data.error
			return data
		} catch (e) {
			window.alert(e.message || e)
		}
	}

	/* when arg.text is true, arg should only be {text} from a snplst term;
	else, it should be the q{} of snplocus term: {chr,start,stop,variant_filter}
	to generate snp-sample gt matrix cache file and return file name
	*/
	async validateSnps(arg) {
		const lst = ['validateSnps=1', 'genome=' + this.state.vocab.genome, 'dslabel=' + this.state.vocab.dslabel]
		if (arg.text) {
			lst.push('snptext=' + encodeURIComponent(arg.text))
		} else if (arg.chr) {
			lst.push('chr=' + arg.chr)
			lst.push('start=' + arg.start)
			lst.push('stop=' + arg.stop)
			if (arg.variant_filter) lst.push('variant_filter=' + encodeURIComponent(JSON.stringify(arg.variant_filter)))
		}
		return await dofetch3('/termdb?' + lst.join('&'))
	}

	async get_variantFilter() {
		// used for snplocus term type
		const args = ['getvariantfilter=1', 'genome=' + this.state.vocab.genome, 'dslabel=' + this.state.vocab.dslabel]
		return await dofetch3('/termdb?' + args.join('&'))
	}

	/*
	This will fill-in this.currAnnoData{} with annotations by sample ID.
	It will only request annotations for terms that have changed,
	or when the filter has changed, using rx.deepEqual(). 

	The server data sample annotations and refs are both indexed 
	by term id, but will be remapped to be annotated instead with 
	tw.$id. This will prevent conflicts when the same term.id is used
	multiple times in the terms[] argument, such as for the matrix plot.

	Other tracking data are attached to this.currAnnoData{}, to be able to
	compare the previous version of term wrappers against future
	server requests.

	Arguments:

	opts{}
	.filter        a filter object
	.terms[tw{}]   an array of termWrapper objects
		tw.$id       id to disambugate when multiple terms
		             with the same ID are in terms[],
								 such as in matrix plot
		
	Returns 
	undefined
	
	Expected server-data response
	{}
	.samples{}
		.sampleId{}
			.sample: the sample ID
			.$id: {key, value || values[]}	
		}
	
	.refs{}
		.byTermId{}
			.$id: {bins, etc}   metadata for processed terms, useful
													for specifying value order, colors, etc.
	*/
	async getAnnotatedSampleData(opts) {
		// may check against required auth credentials for the server route
		const auth = this.termdbConfig.requiredAuth
		if (auth && !this.verifiedToken) {
			this.tokenVerificationMessage = `requires login for this data`
			return
		}
		const headers = auth ? { [auth.headerKey]: this.verifiedToken } : {}

		const filter = getNormalRoot(opts.filter)
		const isNewFilter = !deepEqual(this.currAnnoData.lastFilter, filter)
		if (isNewFilter) {
			this.currAnnoData = { samples: {}, refs: { byTermId: {}, bySampleId: {} }, lastTerms: [], lastFilter: {} }
		}
		const termsToUpdate = opts.terms.filter(tw => {
			const lastTw = this.currAnnoData.lastTerms.find(lt => lt.$id === tw.$id)
			return !lastTw || !deepEqual(lastTw, tw)
		})
		/* NOTE: ok to continue processing with unchanged currAnnoData  */
		//if (!termsToUpdate.length) return

		const currSampleIds = Object.keys(this.currAnnoData.samples)
		const promises = []
		// TODO: do not apply the filter to the term data request,
		// so that a term will have annotated samples, while a
		// separate request to a filtered sample list can be applied on the client side
		const samplesToShow = isNewFilter || !this.currAnnoData.samplesToShow ? new Set() : this.currAnnoData.samplesToShow
		while (termsToUpdate.length) {
			const copies = this.getCopiesToUpdate(termsToUpdate)
			const init = {
				headers,
				body: {
					for: 'matrix',
					genome: this.vocab.genome,
					dslabel: this.vocab.dslabel,
					terms: copies.map(c => c.copy),
					filter
				}
			}

			if (auth) init.body.embedder = window.location.hostname

			promises.push(
				dofetch3('termdb', init, this.opts.fetchOpts).then(data => {
					if (data.error) throw data.error
					for (const sampleId in data.samples) {
						samplesToShow.add(sampleId)
						const sample = data.samples[sampleId]
						if (!(sampleId in this.currAnnoData.samples)) {
							this.currAnnoData.samples[sampleId] = { sample: sampleId }
						}
						const row = this.currAnnoData.samples[sampleId]
						for (const tw of copies) {
							if (tw.idn in sample) {
								row[tw.$id] = sample[tw.idn]
							}
						}
					}

					for (const sampleId in data.refs.bySampleId) {
						this.currAnnoData.refs.bySampleId[sampleId] = data.refs.bySampleId[sampleId]
					}

					for (const tw of copies) {
						if (tw.idn in data.refs.byTermId) {
							this.currAnnoData.refs.byTermId[tw.$id] = data.refs.byTermId[tw.idn]
						}
					}
				})
			)
		}

		try {
			await Promise.all(promises)
		} catch (e) {
			this.tokenVerificationMessage = e
			throw e
		}

		const dictTerm$ids = opts.terms.filter(tw => !nonDictionaryTermTypes.has(tw.term.type)).map(tw => tw.$id)
		if (!dictTerm$ids.length) {
			this.currAnnoData.lst = Object.values(this.currAnnoData.samples)
		} else {
			this.currAnnoData.lst = []
			for (const sampleId in this.currAnnoData.samples) {
				const row = this.currAnnoData.samples[sampleId]
				for (const $id in row) {
					if (dictTerm$ids.includes($id)) {
						this.currAnnoData.lst.push(row)
						break
					}
				}
			}
		}

		this.currAnnoData.lastFilter = filter
		this.currAnnoData.lastTerms = opts.terms
		this.currAnnoData.samplesToShow = samplesToShow

		const sampleFilter = new RegExp(opts.sampleNameFilter || '.*')
		const data = {
			lst: this.currAnnoData.lst.filter(
				row => this.currAnnoData.samplesToShow.has(row.sample) && sampleFilter.test(row.sample)
			),
			refs: this.currAnnoData.refs
		}
		data.samples = data.lst.reduce((obj, row) => {
			obj[row.sample] = row
			return obj
		}, {})

		return data
	}

	getCopiesToUpdate(terms) {
		const usedIdsOrNames = new Set()
		const copies = []
		const next = []
		while (terms.length) {
			const tw = terms.shift()
			const idn = 'id' in tw.term ? tw.term.id : tw.term.name
			// force only 1 tw copy at a time to benchmark
			if (usedIdsOrNames.has(idn)) next.push(tw)
			else {
				usedIdsOrNames.add(idn)
				const copy = { term: {}, q: tw.q }
				if ('id' in tw) copy.term.id = tw.term.id
				else {
					copy.term.name = tw.term.name
					copy.term.type = tw.term.type
				}
				copies.push({ copy, idn, $id: tw.$id, tw })
			}
		}
		terms.push(...next)
		return copies
	}

	// ids: [str], where str are string term IDS or names
	async getTermTypes(ids) {
		const init = {
			body: {
				for: 'termTypes',
				genome: this.vocab.genome,
				dslabel: this.vocab.dslabel,
				ids: JSON.stringify(ids)
			}
		}
		const data = await dofetch3('termdb', init, this.opts.fetchOpts)
		if (data.error) throw data.error
		return data
	}

	async getLDdata(tkname, m) {
		const args = [
			'getLDdata=1',
			'genome=' + this.state.vocab.genome,
			'dslabel=' + this.state.vocab.dslabel,
			'ldtkname=' + tkname,
			'm=' + JSON.stringify({ chr: m.chr, pos: m.pos, ref: m.ref, alt: m.alt })
		]
		return await dofetch3('termdb?' + args.join('&'))
	}
}

function q_to_param(q) {
	// exclude certain attributes of q from dataName
	const q2 = JSON.parse(JSON.stringify(q))
	delete q2.hiddenValues
	return encodeURIComponent(JSON.stringify(q2))
}

// to-do
// class Mds3Vocab {}

class FrontendVocab extends Vocab {
	constructor(opts) {
		super(opts)
		this.datarows = []
		if (opts.state.vocab.sampleannotation) {
			const anno = opts.state.vocab.sampleannotation
			Object.keys(anno).forEach(sample => this.datarows.push({ sample, data: anno[sample] }))
		}
	}

	getTermdbConfig() {
		return { selectCohort: this.vocab.selectCohort, supportedChartTypes: [] }
	}

	getTermChildren(term, cohortValuelst) {
		const cohortValuestr = (cohortValuelst || [])
			.slice()
			.sort()
			.join(',')
		// TODO: handle treeFilter
		const parent_id = term.__tree_isroot ? null : term.id
		return {
			lst: this.vocab.terms.filter(
				t =>
					t.parent_id === parent_id &&
					(!cohortValuestr.length || cohortValuestr === t.cohortValues.slice().sort.join(','))
			)
		}
	}

	// from termdb/plot
	async getNestedChartSeriesData(opts) {
		const q = {
			term1: opts.term ? opts.term.term : {},
			term1_q: opts.term ? opts.term.q : undefined,
			term0: opts.term0 ? opts.term0.term : undefined,
			term0_q: opts.term0 ? opts.term0.q : undefined,
			term2: opts.term2 ? opts.term2.term : undefined,
			term2_q: opts.term2 ? opts.term2.q : undefined,
			filter: this.state.termfilter && this.state.termfilter.filter
		}
		return getBarchartData(q, this.datarows)
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
	syncTermData(config, data, prevConfig = {}) {
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
			if (!term.q.groupsetting) term.q.groupsetting = {}
		}
	}

	// from termdb/search
	async findTerm(str, cohortStr, usecase = null) {
		return {
			lst: this.vocab.terms.filter(
				t => t.name.includes(str) && (!cohortStr || cohortStr === t.cohortValues.slice().sort.join(','))
			)
		}
	}

	// from termdb/terminfo
	async getTermInfo(id) {
		const term = this.vocab.find(t => t.id === id)
		if (!term) return undefined
		return { terminfo: t.info }
	}

	// from termdb/nav
	async getCohortSampleCount(cohortName) {
		if (!cohortName) return
		const term = this.vocab.find(t => t.id === id)
		if (!term || !term.cohortValues.includes(cohortName)) return
		if (!term.samplecount) term.samplecount = {}
		if (!(cohortName in term.samplecount)) {
			term.samplecount[cohortName] = Object.keys(this.vocab.sampleannotation).length
		}
		return { samplecount: term.samplecount[cohortName] }
	}

	/*** To-Do ***/
	async getFilteredSampleCount(cohortName, filterJSON) {
		if (!cohortName) return
		const term = this.vocab.find(t => t.id === id)
		if (!term || !term.cohortValues.includes(cohortName)) return
		if (!term.samplecount) term.samplecount = {}
		if (!(cohortName in term.samplecount)) {
			term.samplecount[cohortName] = Object.keys(this.vocab.sampleannotation).length
		}
		return { samplecount: 'TBD' }
	}

	async getDensityPlotData(term_id, num_obj, filter) {
		if (!this.datarows || !this.datarows.length) {
			// support adhoc dictionary or vocab terms without sample annotations
			const term = this.vocab.terms.find(t => t.id === term_id)
			const minvalue = term.range && term.range
			return {
				minvalue: term.range && term.range.start,
				maxvalue: term.range && term.range.stop
			}
		}

		const values = []
		const distinctValues = new Set()
		let minvalue,
			maxvalue,
			samplecount = 0
		let samples = {}
		for (const anno of this.datarows) {
			if (samples[anno.sample]) continue
			const data = anno.s || anno.data
			if (data && sample_match_termvaluesetting(data, filter)) {
				samples[anno.sample] = this.vocab.sampleannotation[anno.sample]
			}
		}

		for (const sample in samples) {
			if (!(term_id in this.vocab.sampleannotation[sample])) continue
			const _v = this.vocab.sampleannotation[sample][term_id]
			if (isNumeric(_v)) {
				const v = +_v
				samplecount += 1
				if (minvalue === undefined || v < minvalue) minvalue = v
				if (maxvalue === undefined || v > maxvalue) maxvalue = v
				values.push(v)
				distinctValues.add(v)
			}
		}

		const term = this.vocab.terms.find(t => t.id == term_id)
		const default_ticks_n = 40
		const ticks_n =
			term.type == 'integer' && maxvalue - minvalue < default_ticks_n
				? maxvalue - minvalue
				: term.type == 'float' && distinctValues.size < default_ticks_n
				? distinctValues
				: default_ticks_n
		const xscale = scaleLinear()
			.domain([minvalue, maxvalue])
			.range([num_obj.plot_size.xpad, num_obj.plot_size.width - num_obj.plot_size.xpad])
		const density = get_histogram(xscale.ticks(ticks_n))(values)

		return {
			density,
			densitymax: density.reduce((maxv, v, i) => (i === 0 || v[1] > maxv ? v[1] : maxv), 0),
			minvalue,
			maxvalue,
			samplecount
		}
	}

	async getPercentile(term_id, percentile, filter) {
		// for a numeric term, convert a percentile to an actual value, with respect to a given filter
		throw 'getPercentile() is not implemented yet for front-end vocab, should be easy...'
	}

	async getterm(termid) {
		if (!termid) throw 'getterm: termid missing'
		return this.vocab.terms.find(d => d.id == termid)
	}

	async getCategories(term, filter, lst = null) {
		const q = { term, filter }
		const data = getCategoryData(q, this.datarows)
		return data
	}
	getNumericUncomputableCategories(term, filter) {
		throw 'to be implemented!! getNumericUncomputableCategories'
	}

	graphable(term) {
		if (!term) throw 'graphable: term is missing'
		return isUsableTerm(term).has('plot')
	}

	q_to_param(q) {
		// exclude certain attributes of q from dataName
		const q2 = JSON.parse(JSON.stringify(q))
		delete q2.hiddenValues
		return encodeURIComponent(JSON.stringify(q2))
	}
}

export function getVocabFromSamplesArray({ samples, sample_attributes }) {
	const terms = {
		__root: {
			id: 'root',
			name: 'root',
			__tree_isroot: true
		}
	}
	const sanno = {}
	for (const a of samples) {
		const s = a.sample
		if (!sanno[s]) sanno[s] = {}
		// in case a sample has more than one annotation object in the array
		Object.assign(sanno[s], a.s)

		// generate term definitions from
		for (const key in a.s) {
			if (!terms[key]) {
				const name = sample_attributes[key] && sample_attributes[key].label ? sample_attributes[key].label : key
				terms[key] = {
					id: key,
					name,
					parent_id: null,
					type:
						sample_attributes[key].type == 'float'
							? 'float'
							: sample_attributes[key].type == 'integer'
							? 'integer'
							: // need to work with the cloud/PROPEL team to define type for legacy scatterplot usage
							  'categorical',
					values: {},
					isleaf: true
				}
			}
			const t = terms[key]
			if (!('id' in t)) t.id = key
			if (!('parent_id' in t)) t.parent_id = null
			if (!('values' in t)) t.values = {}
			if (!('isleaf' in t)) t.isleaf = true
			if (!t.computableVals && (t.type == 'float' || t.type == 'integer')) {
				t.computableVals = [] // will be used to initialize binconfig for numeric terms
			}

			const value = a.s[key]
			if (t.type == 'categorical') {
				t.groupsetting = { disabled: true }
				if (!(value in t.values)) {
					t.values[value] = { key: value, label: value }
				}
			} else if (t.type == 'integer' || t.type == 'float') {
				// may need to auto-detect more string values that
				// can be assumed to be non-numeric here, like "N/A"
				if (value === 'Not Available' && !(value in t.values)) {
					t.values[value] = { label: value, uncomputable: true }
				}
				if (!(value in t.values)) {
					if (!isNumeric(a.s[key])) throw `non-numeric term value='${value}' for term='${key}'`
					a.s[key] = Number(a.s[key])
					const val = a.s[key]
					t.computableVals.push(val)
				}
			} else if (t.type == 'condition') {
				//TODO: add logic for conditional terms
			} else {
				throw 'Term type not supported:' + t.type
			}
		}
	}

	for (const key in terms) {
		const t = terms[key]
		if ((t.type == 'integer' || t.type == 'float') && !t.bins) {
			t.bins = {
				default: initBinConfig(t.computableVals)
			}
			delete t.computableVals
		}
	}

	return {
		sampleannotation: sanno,
		terms: Object.values(terms)
	}
}

function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n)
}

function get_histogram(ticks) {
	return values => {
		// array of {value}
		const bins = []
		for (let i = 0; i < ticks.length; i++) bins.push([ticks[i], 0])
		for (const v of values) {
			for (let i = 1; i < ticks.length; i++) {
				if (v <= ticks[i]) {
					bins[i - 1][1]++
					break
				}
			}
		}
		return bins
	}
}
