import { Vocab } from './Vocab'
import { dofetch3 } from '../common/dofetch'
import { getNormalRoot } from '#filter'
import { isUsableTerm } from '#shared/termdb.usecase.js'
import { throwMsgWithFilePathAndFnName } from '../dom/sayerror'
import { isDictionaryType, dtTermTypes } from '#shared/terms.js'
import { getCategoryData } from '../plots/barchart.data'

export class TermdbVocab extends Vocab {
	// migrated from termdb/store
	async getTermdbConfig() {
		if (this.opts.getDatasetAccessToken) {
			// mass app init may need clientAuthResult, so need to trigger
			// login so termdb/config response would match the user log-in status

			try {
				// sets this.app.vocabApi.verifiedToken to false if the token was not valid. nav.js checks this value and throws an error
				// when the token is not valid no error is thrown but a response with an error message is sent
				await this.maySetVerifiedToken(this.state.vocab.dslabel)
			} catch (e) {
				console.log(e)
			}
		}

		const headers = this.mayGetAuthHeaders('termdb')
		const data = await dofetch3('termdb/config', {
			headers,
			body: {
				genome: this.vocab.genome,
				dslabel: this.vocab.dslabel,
				embedder: window.location.hostname
			}
		})

		if (data.error) throw data.error

		// note: in case of error such as missing dataset, supply empty object
		this.termdbConfig = data.termdbConfig || {}
		return this.termdbConfig
	}

	async getTermChildren(term, cohortValuelst) {
		let data
		const body = {
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel
		}
		if (cohortValuelst) {
			body.cohortValues = cohortValuelst.slice().sort().join(',')
		}
		if (this.state.treeFilter) {
			body.treeFilter = this.state.treeFilter
		}
		if (term.__tree_isroot) {
			body.default_rootterm = 1
			data = await dofetch3('termdb/rootterm', { body }, this.opts.fetchOpts)
		} else {
			body.get_children = 1
			body.tid = term.id
			data = await dofetch3('termdb/termchildren', { body }, this.opts.fetchOpts)
		}
		if (data.error) throw data.error
		for (const term of data.lst) {
			if (term.type == 'integer' || term.type == 'float') {
				if (term.bins?.rounding) term.bins.default.rounding = term.bins.rounding
				if (term.bins?.label_offset && !term.bins?.default?.label_offset)
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
        a structure from the termdb/barsql route
    */
	async getNestedChartSeriesData(opts) {
		const [route, body] = this.getTdbDataUrl(opts)
		const headers = this.mayGetAuthHeaders('termdb')
		const data = await dofetch3(route, { headers, body }, this.opts.fetchOpts)
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

		this.mayFillCategories(opts, data.categories)

		return data
	}

	mayFillInMissingCatValues(term, key, total) {
		if (!key) return
		if (!(term?.id in this.missingCatValsByTermId)) return
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

	// fill in term.categories with
	// categories computed from the data
	mayFillCategories(opts, categories) {
		if (!categories) return
		if (!Array.isArray(categories)) throw 'categories is not array'
		for (const [i, k] of ['term0', 'term', 'term2'].entries()) {
			const tw = opts[k]
			if (!tw) continue
			const c = categories[i]
			if (!Object.keys(c).length) continue
			tw.term.categories = c
		}
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
        .filter0
            optional gdc filter
    */
	getTdbDataUrl(opts) {
		const body = {
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel,
			embedder: window.location.hostname
		}
		if (opts.chartType == 'cuminc') body.getcuminc = 1
		if (opts.chartType == 'survival') body.getsurvival = 1

		for (const _key of ['term0', 'term', 'term2']) {
			// "term" on client is "term1" at backend
			const tw = this.getTwMinCopy(opts[_key])
			if (!tw) continue
			const key = _key == 'term' ? 'term1' : _key
			body[key + '_$id'] = tw.$id
			// will need to generalize to also consider type=geneExpression
			if ('id' in tw.term && (!tw.term?.type || isDictionaryType(tw.term.type))) {
				body[key + '_id'] = tw.term.id
			} else {
				body[key] = tw.term
			}
			if (!tw.q) throw 'plot.' + _key + '.q{} missing: ' + tw.term.id
			body[key + '_q'] = tw.q //q_to_param(tw.q) ????
		}

		if (opts.filter) {
			const filter = getNormalRoot(opts.filter)
			if (filter.lst.length) {
				body.filter = filter
			}
		}
		if (opts.filter0) body.filter0 = opts.filter0

		if ('grade' in opts) body.grade = opts.grade
		if ('minSampleSize' in opts) body.minSampleSize = opts.minSampleSize

		if (opts.term2) {
			//send the hidden group labels to server to ignore them when computing association test pvalues
			const hiddenValues = {
				term1: opts.term.q.hiddenValues
					? Object.keys(opts.term.q.hiddenValues).map(h => opts.term.term.values?.[h]?.label || h)
					: [],
				term2: opts.term2.q.hiddenValues
					? Object.keys(opts.term2.q.hiddenValues).map(h => opts.term2.term.values?.[h]?.label || h)
					: []
			}
			body.hiddenValues = hiddenValues
		}

		// start of mds3 parameters for variant2sample query
		if (opts.get) body.get = opts.get
		// end of mds3 parameters

		return [opts.chartType ? 'termdb' : 'termdb/barsql', body]
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
		// must maintain the order of term* string values in the looped array,
		// so that the entry index must matches the data.refs.bins[], q[] order
		for (const [i, key] of ['term0', 'term', 'term2'].entries()) {
			const term = config[key]
			const persistTerm = !prevConfig[key] || prevConfig[key].term?.id === term?.term?.id
			if (term == 'genotype') continue
			if (!term) {
				if (key == 'term') throw `missing plot.term{}`
				continue
			}
			if (data.refs.bins) {
				term.bins = data.refs.bins[i]
				if (data.refs.q && data.refs.q[i]) {
					if (!term.q) term.q = {}
					const q = data.refs.q[i]
					// FIGURE OUT: when will q equal term.q?
					if (q !== term.q || !persistTerm) {
						if (q.type != term.q.type || q.mode != term.q.mode) {
							for (const key in term.q) {
								// persist hiddenValues if it exists, but may be overridden by the server data's q
								if (key != 'hiddenValues' || !persistTerm) delete term.q[key]
							}
						}
						Object.assign(term.q, q)
					}
				}
			}
			if (!term.q) term.q = {}
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
		if (!isDictionaryType(opts.outcome.term.type)) throw 'outcome must be dictionary term'
		const outcome = this.getTwMinCopy(opts.outcome)
		outcome.id = outcome.term.id
		outcome.q = JSON.parse(JSON.stringify(opts.outcome.q))
		outcome.type = outcome.term.type // TODO: refactor backend to not require outcome.type (similar issue with independent variables, see below)
		if (!outcome.q.mode && opts.regressionType == 'linear') outcome.q.mode = 'continuous'
		const contQkeys = ['mode', 'scale']
		outcome.refGrp = outcome.q.mode == 'continuous' ? 'NA' : opts.outcome.refGrp
		if (opts.outcome.nonRefGrp) outcome.nonRefGrp = opts.outcome.nonRefGrp

		if (outcome.q.mode == 'continuous') {
			// remove unneeded parameters from q
			for (const key in outcome.q) {
				if (!contQkeys.includes(key)) delete outcome.q[key]
			}
		}

		const body = {
			getregression: 1,
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel,
			regressionType: opts.regressionType,
			outcome,
			independent: opts.independent.map(tw => {
				const t = this.getTwMinCopy(tw)
				t.refGrp = tw.refGrp
				t.interactions = tw.interactions
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
					// TODO: refactor backend code to not have to pass
					// term.id, term.type, and term.values separately
					$id: tw.$id,
					id: t.term.id,
					q,
					term: t.term,
					type: t.term.type,
					refGrp: t.q.mode == 'continuous' ? 'NA' : t.refGrp,
					interactions: t.interactions || [],
					values: t.term.values
				}
			})
		}

		const filterData = getNormalRoot(opts.filter)
		if (filterData.lst.length) body.filter = filterData
		if (opts.includeUnivariate) body.includeUnivariate = opts.includeUnivariate
		const data = await dofetch3('termdb', { body }, this.opts.fetchOpts)
		if (data.error) throw data.error
		return data
	}

	/*
	str: search phrase
	cohorStr
	usecase
	targetType
		snp = find if str matches with dbsnp
		category = match with catgory of a term (not implemented yet)
		blank string for default behavior of matching with dict term or gene names
	*/
	async findTerm(str, cohortStr = '', usecase = null, targetType = '') {
		const body = {
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel,
			findterm: encodeURIComponent(str),
			cohortStr
		}
		if (usecase) body.usecase = usecase
		if (this.state.treeFilter) body.treeFilter = this.state.treeFilter
		if (targetType) body.targetType = targetType
		const data = await dofetch3('termdb', { body })
		if (data.error) throw data.error
		// sort results
		const n = str.toUpperCase()
		const r = { equals: [], startsWith: [], startsWord: [], includes: [] }
		for (const i of data.lst) {
			const name = i.name.toUpperCase()
			if (name === n) r.equals.push(i)
			else if (name.startsWith(n)) r.startsWith.push(i)
			else if (name.includes(' ' + n)) r.startsWord.push(i)
			else r.includes.push(i)
		}
		data.lst = [...r.equals, ...r.startsWith, ...r.startsWord, ...r.includes]
		return data
	}

	// from termdb/terminfo
	async getTermInfo(id) {
		if (!id) throw '.getTermInfo: Missing term id' //If missing doesn't throw as expected in later calls
		const args = ['genome=' + this.vocab.genome + '&dslabel=' + this.vocab.dslabel + '&getterminfo=1&tid=' + id]
		const data = await dofetch3('/termdb?' + args.join('&'), {}, this.opts.fetchOpts)
		if (data.error) throw data.error
		return data
	}

	async getCohortSampleCount(cohort) {
		// if dataset does not use subchort, cohortName=null and total number of samples is returned
		const body = {
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel,
			cohort
		}
		const data = await dofetch3('termdb/cohort/summary', { body }, this.opts.fetchOpts)
		if (!data) throw 'missing data'
		if (data.error) throw data.error
		return data.count
	}

	/** opts: 
	 	filterJSON: JSON || string, required
		returns sample list in array of [{id, name}....]
	 */
	async getFilteredSampleList(filterJSON) {
		const body = {
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel,
			getsamplelist: 1,
			filter: typeof filterJSON == 'string' ? filterJSON : getNormalRoot(filterJSON)
		}
		const data = await dofetch3('termdb', { body }, this.opts.fetchOpts)
		if (!data) throw `missing data`
		if (data.error) throw data.error
		if (!Array.isArray(data)) throw 'data is not array'
		return data
	}
	/** opts: 
	 	filterJSON: JSON || string, required
		returns sample count per type
	 */
	async getFilteredSampleCount(filterJSON) {
		const body = {
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel,
			getsamplecount: 1,
			filter: getNormalRoot(filterJSON)
		}
		const data = await dofetch3('termdb', { body }, this.opts.fetchOpts)
		if (!data) throw `missing data`
		if (data.error) throw data.error
		return data.count
	}

	async getViolinPlotData(arg, _body = {}) {
		const headers = this.mayGetAuthHeaders('termdb')
		arg.tw = this.getTwMinCopy(arg.tw)
		if (arg.overlayTw) arg.overlayTw = this.getTwMinCopy(arg.overlayTw)
		if (arg.divideTw) arg.divideTw = this.getTwMinCopy(arg.divideTw)
		const body = Object.assign(
			{
				genome: this.vocab.genome,
				dslabel: this.vocab.dslabel,
				filter: this.state.termfilter.filter,
				filter0: this.state.termfilter.filter0,
				embedder: window.location.hostname,
				devicePixelRatio: window.devicePixelRatio,
				isKDE: 'isKDE' in arg ? arg.isKDE : true,
				ticks: arg.ticks,
				datasymbol: arg.datasymbol || 'rug',
				orientation: arg.orientation || 'horizontal',
				radius: arg.radius || 8,
				svgw: arg.svgw || 200,
				unit: arg.unit || 'abs'
			},
			arg,
			_body
		)
		if (body.filter) body.filter = getNormalRoot(body.filter)
		return await dofetch3('termdb/violin', { headers, body })
	}

	async getBoxPlotData(arg, _body = {}) {
		const headers = this.mayGetAuthHeaders('termdb')
		arg.tw = this.getTwMinCopy(arg.tw)

		if (arg.overlayTw) arg.overlayTw = this.getTwMinCopy(arg.overlayTw)
		if (arg.divideTw) arg.divideTw = this.getTwMinCopy(arg.divideTw)
		const body = Object.assign(
			{
				genome: this.vocab.genome,
				dslabel: this.vocab.dslabel
			},
			arg,
			_body
		)
		if (body.filter) body.filter = getNormalRoot(body.filter)
		const d = await dofetch3('termdb/boxplot', { headers, body })

		return d
	}

	async getPercentile(term, percentile_lst, termfilter) {
		// for a numeric term, convert a percentile to an actual value, with respect to a given filter
		if (percentile_lst.find(p => !Number.isInteger(p))) throw 'non-integer percentiles found'
		if (Math.max(...percentile_lst) > 99 || Math.min(...percentile_lst) < 1) throw 'percentiles must be between 1-99'
		const body = {
			getpercentile: percentile_lst,
			term,
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel
		}
		if (termfilter) {
			if (termfilter.filter) body.filter = getNormalRoot(termfilter.filter)
			if (termfilter.filter0) body.filter0 = termfilter.filter0
		}
		return await dofetch3('termdb/getpercentile', { body })
	}

	async getDescrStats(tw, termfilter, logScale) {
		// for a numeric term, get descriptive statistics e.g mean, median, standard deviation, min, max
		// logScale is boolean
		const body = {
			tw,
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel
		}
		if (logScale) body.logScale = true
		if (termfilter) {
			if (termfilter.filter) body.filter = getNormalRoot(termfilter.filter)
			if (termfilter.filter0) body.filter0 = termfilter.filter0
		}
		return await dofetch3('/termdb/descrstats', { body })
	}

	/**
	 * Retrieve terms by ids from the term database.
	 * @param {Array} ids - The array of term ids to retrieve
	 * @param {string} [_dslabel=null] - The dataset label (optional)
	 * @param {string} [_genome=null] - The genome identifier (optional)
	 * @return {Object} The terms data retrieved based on the provided ids
	 */
	async getTerms(ids, _dslabel = null, _genome = null) {
		if (!ids) throw 'getTerms: ids missing'
		if (!Array.isArray(ids)) throw `invalid ids` // should use typescript
		const dslabel = _dslabel || this.state.vocab?.dslabel // this.vocab is guaranteed to exist?
		const genome = _genome || this.state.vocab?.genome // this.vocab is guaranteed to exist?
		if (!dslabel) throw 'getTerms: dslabel missing'
		if (!genome) throw 'getTerms: genome missing'

		const body = {
			genome,
			dslabel,
			ids,
			embedder: window.location.hostname
		}

		const data = await dofetch3(`termdb/termsbyids`, { body })
		if (data.error) throw 'getTerm: ' + data.error
		for (const id in data.terms) {
			const term = data.terms[id]
			if (term.type == 'categorical' && !term.values) this.missingCatValsByTermId[term.id] = term
		}
		return data.terms
	}

	async getterm(termid, dslabel = null, genome = null) {
		if (!termid) throw 'getterm: termid missing'

		const result = await this.getTerms([termid], dslabel, genome)
		const term = result[termid]
		if (!term) throw 'no term found for ' + termid

		return term
	}

	graphable(term) {
		if (!term) throw 'graphable: term is missing'
		return isUsableTerm(term).has('plot')
	}

	/*
	accepts one term of any type, including categorical, non-categorical, and non-dictionary
	return number of samples per category/bin/grade/group etc
	optionally, caller can supply a {term1_q: {...}} key-object value in _body to customize categories
	*/
	async getCategories(term, filter, _body = {}) {
		const headers = this.mayGetAuthHeaders()
		if (term.type == 'snplst' || term.type == 'snplocus') {
			const body = Object.assign(
				{
					validateSnps: 1,
					sumSamples: 1,
					genome: this.state.vocab.genome,
					dslabel: this.state.vocab.dslabel
				},
				_body
			)

			if (filter) {
				body.filter = getNormalRoot(filter)
			}
			return await dofetch3('/termdb', { headers, body })
		}

		if (dtTermTypes.has(term.type)) {
			// dt term, grab categories directly from term
			const data = getCategoryData({ term })
			return data
		}

		if (term.category2samplecount) {
			// grab directly from term and not the server
			// { categoryKey: count }
			const l2 = []
			for (const key in term.category2samplecount) {
				l2.push({
					key,
					label: term?.values?.[key]?.label || key,
					samplecount: term.category2samplecount[key]
				})
			}
			return { lst: l2 }
		}

		if (_body.categories) {
			// grab directly from body and not server
			return _body.categories
		}

		if (_body.skip_categories) {
			// do not query server
			return { lst: [] }
		}

		// no need to supply tw.$id: 1) this method is one term only and no need to distinguish multiple terms 2) backend will auto fill $id before retrieving data
		const tw = { term, q: _body.term1_q || {} }
		delete _body.term1_q // is now tw.q, so no longer needed
		const body = {
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			tw: this.getTwMinCopy(tw),
			..._body
		}

		if (filter) {
			body.filter = getNormalRoot(filter)
		}
		// when calling getCategories(), external code does not supply filter0. to avoid much code changes, use this step to detect filter0 from this.state and supply to request
		// TODO if this filter0 can be properly updated when api.update() is called from pp launcher on GFF cohort change
		if (this.state.termfilter?.filter0) body.filter0 = this.state.termfilter.filter0

		try {
			const data = await dofetch3('termdb/categories', { headers, body })
			if (data.error) throwMsgWithFilePathAndFnName(data.error)
			return data
		} catch (e) {
			// TODO: should handle this error more gracefully, maybe show only in the termsetting pill;
			//       right now, this alert pops up even when this data or related pill is not visible
			window.alert(e.message || e)
		}
	}

	async getNumericUncomputableCategories(term, filter) {
		// for numeric term
		// return number of samples per uncomputable categories
		const body = {
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			tid: term.id
		}
		if (filter) {
			body.filter = getNormalRoot(filter)
		}
		try {
			const data = await dofetch3('/termdb/numericcategories', { body })
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
		return await dofetch3('termdb', {
			body: { getvariantfilter: 1, genome: this.state.vocab.genome, dslabel: this.state.vocab.dslabel }
		})
	}

	async getSamplesPerFilter(opts) {
		return await dofetch3('termdb', {
			body: {
				for: 'getSamplesPerFilter',
				genome: this.state.vocab.genome,
				dslabel: this.state.vocab.dslabel,
				filters: opts.filters
			}
		})
	}

	/*
    The server data sample annotations and refs are both indexed 
    by term id, but will be remapped to be annotated instead with 
    tw.$id. This will prevent conflicts when the same term.id is used
    multiple times in the terms[] argument, such as for the matrix plot.

    Arguments:

    opts{}
    .filter        a filter object
    .filter0       read-only json object, only used for gdc dataset to store the cohort filter obj built by CohortBuilder
    .terms[{}]     an array of termWrapper objects
        tw.$id       id to disambugate when multiple terms
                     with the same ID are in terms[], such as in matrix plot
    .termsPerRequest optional, a number greater than 1;
	                 when provided, a request includes the number of terms specified, improving the response times
    Returns 
    {
        lst: [{
            sample, 
            term1: {key, value}, 
            term2: {key, values}, 
            ...
        }],
        refs: {
            byTermId: {termIdorName1: {term, q}},
            bySampleId: {...}
        }
    }
	
	
    Expected server-data response
    {}
    .samples{}
        [sample]{}
            sample: the sample ID
            [$id]: {} // $id is tw id, not term id
				key, value, // only used for dict term
				values:[]
					// used for non-dict term e.g. gene mutation
					{sample, ...mutation properties...}
	
    .refs{}
        .byTermId{}
            [$id]: {bins, etc}   metadata for processed terms, useful
                                                    for specifying value order, colors, etc.
		.bySampleId{}
			[sample]: {
				label:str, // required, the display name of this sample
				otherLabels:[ {map to sjcloud}, {link to pbtp},] // optional, to define later
			}
			available sample name(s) mapped to each sample, for display only

    !!! NOTE !!!
    May fill in following attributes on term object if missing or met conditions:
    (the modifications are on term object and not tracked in state)

    tw.term.category2samplecount = {}
    tw.term.values={}
    */
	async getAnnotatedSampleData(opts, _refs = {}) {
		// may check against required auth credentials for the server route
		const headers = this.mayGetAuthHeaders('termdb')
		// unlike scatter and violin, the matrix plot will NOT display anything
		// if sample names are not allowed to be displayed
		// TODO: may allow a request to proceed, but not display sampleNames???
		// Answer: showing multiple term values aligned for a sample can be considered identifying.
		// thus simply disable matrix plot if sample name is now allowed to show
		if (!headers) return
		const filter = getNormalRoot(opts.filter)
		const samples = {}
		const refs = { byTermId: _refs.byTermId || {}, bySampleId: _refs.bySampleId || {} }
		const promises = []
		const samplesToShow = new Set()

		/************** tricky
        need list of gene names of current geneVariant terms from opts.terms[]
		assumption is that if this array is not empty,
        request for a dictionary term also from opts.terms[] will only retrieve samples mutated on this gene list, rather than whole cohort
		if currentGeneNames[] is empty, then dict term data return will not be restricted
		(even when this is needed, this is a poor fix as flat list of gene names does not allow restricting mclass or use genomic region)

		*************** and trickier
		do not supply gene list if opts.isHierCluster is set!!! (doing hierarchical clustering)
		in such case, samples requested for dictionary term are based on those with data for hierCluster,
		but not by mutation status of gene list
        */
		const currentGeneNames =
			opts.isHierCluster || opts.isSummary
				? null
				: opts.terms
						.filter(tw => tw.term.type === 'geneVariant')
						.map(tw => (tw.term.chr ? `${tw.term.chr}:${tw.term.start}-${tw.term.stop}` : tw.term.name))
						.sort() // sort the gene names by the default alphanumeric order to improve cache reuse even when terms are resorted
		const allTerms2update = opts.terms.slice().sort((a, b) => (a.term.name < b.term.name ? -1 : 1)) // make copy of array as it will be truncated to empty. do not modify original
		// TODO: do not hardcode, detect from termdbConfig, if this approach is preferred
		const maxNumTerms = opts.terms.length // this.vocab.dslabel === 'GDC' ? opts.terms.length : 1 // revert back to 1 to revert to previous behavior
		let numResponses = 0
		if (opts.loadingDiv) opts.loadingDiv.html('Updating data ...')

		while (true) {
			const copies = getTerms2update(allTerms2update, maxNumTerms) // list of unique terms to update in this round
			if (copies.length == 0) break // at the end of list, break loop
			const init = {
				headers,
				credentials: 'include',
				body: {
					for: 'matrix',
					genome: this.vocab.genome,
					dslabel: this.vocab.dslabel,
					// one request per term
					terms: copies.map(this.getTwMinCopy),
					filter,
					embedder: window.location.hostname
				}
			}
			if (opts.signal) init.signal = opts.signal // an AbortController.signal to trigger a fetch cancellation
			if (opts.filter0) init.body.filter0 = opts.filter0 // avoid adding "undefined" value
			if (opts.isHierCluster) init.body.isHierCluster = true // special arg from matrix, just pass along
			if (
				this.vocab.dslabel == 'GDC' &&
				copies.find(tw => tw.term.id && (!tw.term?.type || isDictionaryType(tw.term.type))) &&
				currentGeneNames?.length
			) {
				//term is dictionary term and there are gene terms,
				//add this to limit to mutated cases
				init.body.currentGeneNames = currentGeneNames
			}
			promises.push(
				dofetch3('termdb', init, { cacheAs: 'decoded' }).then(data => {
					if (data.error) throw data.error
					if (!data.refs.bySampleId) data.refs.bySampleId = {}
					for (const tw of copies) {
						for (const sampleId in data.samples) {
							const sample = data.samples[sampleId]
							// ignore sample objects that are not annotated by other keys besides 'sample'
							if (!Object.keys(sample).filter(k => k != 'sample').length) continue
							samplesToShow.add(sampleId)
							if (!(sampleId in samples)) {
								// normalize the expected data shape
								if (!data.refs.bySampleId[sampleId]) data.refs.bySampleId[sampleId] = {}
								if (typeof data.refs.bySampleId[sampleId] == 'string')
									data.refs.bySampleId[sampleId] = { label: data.refs.bySampleId[sampleId] }

								const _ref_ = data.refs.bySampleId[sampleId]
								// assign default sample ref values here
								// TODO: may assign an empty string value if not allowed to display sample IDs or names ???
								if (!_ref_.label) _ref_.label = sampleId
								const s = {
									sample: sampleId,
									// must reserve _ref -> should not be used as a term.id or tw.$id
									_ref_
								}
								samples[sampleId] = s
							}
							if (tw.$id in sample) samples[sampleId][tw.$id] = sample[tw.$id]
						}

						for (const sampleId in data.refs.bySampleId) {
							refs.bySampleId[sampleId] = data.refs.bySampleId[sampleId]
						}

						refs.byTermId[tw.$id] = tw
						if (tw.$id in data.refs.byTermId) {
							refs.byTermId[tw.$id] = Object.assign({}, refs.byTermId[tw.$id], data.refs.byTermId[tw.$id])
						}
					}
					numResponses++
					if (opts.loadingDiv) opts.loadingDiv.html(`Updating data (${numResponses}/${promises.length}) ...`)
				})
			)
		}
		try {
			if (opts.loadingDiv) opts.loadingDiv.html(`Updating data (0/${promises.length})`)
			await Promise.all(promises)
			if (opts.loadingDiv) opts.loadingDiv.html('')
		} catch (e) {
			if (typeof e == 'string') {
				const _e = e.toLowerCase()
				// TODO: standardize the auth error message across all SJ viz tools/portals,
				// which may be difficult since embedders can specify custom auth error messages,
				// or use an error object with separate code and string message
				if (
					e.includes('token') ||
					e.includes('jwt') ||
					e.includes('login') ||
					e.includes('sign') ||
					e.includes('auth') ||
					e.includes('credential')
				) {
					//
					// do not track non-auth related errors as a tokenVerificationMessage
					// only applies in SJ-portals where password or JWT auth tokens are used by embedders
					//
					// - app/viz must use vocabApi.hasVerifiedToken() method to verify access to tool features,
					//   instead of relying on an empty string value for tokenVerificationMessage
					//
					// - !!! not used in the GDC portal, where auth is handled in the tool react wrapper + domain-based cookie session !!!
					//
					this.tokenVerificationMessage = e
				}
			}
			throw e
		}
		try {
			if (opts.loadingDiv) opts.loadingDiv.html(`Processing data ...`)
			const dictTerm$ids = opts.terms.filter(tw => isDictionaryType(tw.term.type)).map(tw => tw.$id)
			// const lst = Object.values(samples)

			// NOTE: Reactivated so that filtering works as expectd for pnet, mbmeta, etc
			//       verified to work with two GDC matrix examples
			// TODO: verify with other GDC examples???
			const lst = []
			if (!dictTerm$ids.length) {
				// If there are no dictionary terms, okay to show any samples with geneVariants
				lst.push(...Object.values(samples))
			} else {
				// If there are dictionary terms, only show samples that have been annotated
				// for at least one dictionary term, otherwise do NOT show samples that
				// are only annotated for non-dictionary terms like gene variants
				// NOTE: there is an exception when using matrix?.settings?.displayDictRowWithNoValues
				for (const sampleId in samples) {
					const row = samples[sampleId]
					for (const $id in row) {
						if (dictTerm$ids.includes($id)) {
							lst.push(row)
							break
						}
					}
				}
				if (!lst.length && this.termdbConfig?.matrix?.settings?.displayDictRowWithNoValues) {
					// this prevents the display of 'no matching sample data for the current gene list',
					// which may be confusing if there is data for genes but not for dictionary terms
					lst.push(...Object.values(samples))
				}
			}

			const sampleFilter = new RegExp(opts.sampleNameFilter || '.*')
			const data = {
				lst: lst.filter(row => samplesToShow.has(row.sample) && sampleFilter.test(row.sample)),
				refs
			}
			data.samples = data.lst.reduce((obj, row) => {
				obj[row.sample] = row
				return obj
			}, {})

			for (const tw of opts.terms) {
				mayFillInCategory2samplecount4term(tw, data.lst, this.termdbConfig)
			}
			return data
		} catch (e) {
			throw e
		}
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
		const body = {
			getLDdata: 1,
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			ldtkname: tkname,
			m: { chr: m.chr, pos: m.pos, ref: m.ref, alt: m.alt }
		}
		return await dofetch3('termdb', { body })
	}

	async getScatterData(opts) {
		// the scatter plot may still render when not in session,
		// but not have an option to list samples
		const headers = this.mayGetAuthHeaders('termdb')

		// dofetch* mayAdjustRequest() will automatically
		// convert to GET query params or POST body, as needed
		const body = {
			for: 'scatter',
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			plotName: opts.name,
			coordTWs: opts.coordTWs.map(tw => this.getTwMinCopy(tw)),
			filter: getNormalRoot(opts.filter),
			filter0: opts.filter0,
			embedder: window.location.hostname
		}
		if (opts.colorColumn) body.colorColumn = opts.colorColumn
		if (opts.colorTW) body.colorTW = this.getTwMinCopy(opts.colorTW)
		if (opts.shapeTW) body.shapeTW = this.getTwMinCopy(opts.shapeTW)
		if (opts.divideByTW) body.divideByTW = this.getTwMinCopy(opts.divideByTW)
		if (opts.scaleDotTW) body.scaleDotTW = this.getTwMinCopy(opts.scaleDotTW)
		body.excludeOutliers = opts.excludeOutliers

		return await dofetch3('termdb', { headers, body })
	}

	async getDefaultBins(opts) {
		// the scatter plot may still render when not in session,
		// but not have an option to list samples
		const headers = this.mayGetAuthHeaders('termdb')
		const body = {
			for: 'getDefaultBins',
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			tw: opts.tw,
			embedder: window.location.hostname
		}
		const tf = this.opts?.state?.termfilter
		if (tf) {
			if (tf.filter) body.filter = getNormalRoot(tf.filter)
			if (tf.filter0) body.filter0 = tf.filter0
		}
		return await dofetch3('termdb', { headers, body })
	}

	// it's safer to separately treat term and q as persisted objects but not tw,
	// since tw may have been constructed only as an argument for this function
	// and not as a persisted object elsewhere
	async setTermBins({ $id, term, q }) {
		//TODO use the PresetNumericBins type for presetBins
		const presetBins = await this.getDefaultBins({ tw: { $id, term, q } })
		if ('error' in presetBins) throw presetBins.error
		// NOTE: if term is frozen, creating an unfrozen copy here will
		// not propagate changes to the original term
		term.bins = presetBins
		if (q.mode == 'discrete' && !q.type) {
			// only fill-in q if missing values are detected
			const currMode = q.mode // record current mode before q{} is overriden
			for (const key in q) {
				if (key != 'isAtomic') delete q[key]
			}
			Object.assign(q, term.bins.default)
			q.mode = currMode
		}
	}

	async getSingleSampleData(opts) {
		// the scatter plot may still render when not in session,
		// but not have an option to list samples
		const headers = this.mayGetAuthHeaders('termdb')

		// dofetch* mayAdjustRequest() will automatically
		// convert to GET query params or POST body, as needed
		const body = {
			for: 'singleSampleData',
			sampleId: opts.sampleId,
			term_ids: opts.term_ids,
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			embedder: window.location.hostname
		}
		const data = await dofetch3('termdb', { headers, body })
		const byTermId = {}
		if ('error' in data) return data
		for (const row of data) {
			const term = JSON.parse(row.jsondata)
			byTermId[row.term_id] = { value: row.value, term }
		}
		return byTermId
	}

	async getAllSamples() {
		// the scatter plot may still render when not in session,
		// but not have an option to list samples
		const headers = this.mayGetAuthHeaders('termdb')

		// dofetch* mayAdjustRequest() will automatically
		// convert to GET query params or POST body, as needed
		const body = {
			for: 'getAllSamples',
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			embedder: window.location.hostname
		}
		const data = await dofetch3('termdb', { headers, body })
		return data
	}

	async getSamplesByName(opts) {
		// the scatter plot may still render when not in session,
		// but not have an option to list samples
		const headers = this.mayGetAuthHeaders('termdb')

		// dofetch* mayAdjustRequest() will automatically
		// convert to GET query params or POST body, as needed
		const body = {
			for: 'getSamplesByName',
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			embedder: window.location.hostname
		}
		if (opts?.filter) body.filter = opts.filter
		const data = await dofetch3('termdb', { headers, body })
		return data
	}

	async getProfileFacilities() {
		// the scatter plot may still render when not in session,
		// but not have an option to list samples
		const headers = this.mayGetAuthHeaders('termb')

		// dofetch* mayAdjustRequest() will automatically
		// convert to GET query params or POST body, as needed
		const body = {
			for: 'getProfileFacilities',
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			embedder: window.location.hostname
		}
		const data = await dofetch3('termdb', { headers, body })
		const result = []
		for (const row of data) result.push(row.name)
		return result
	}

	async getLowessCurve(opts) {
		// the scatter plot may still render when not in session,
		// but not have an option to list samples
		const headers = this.mayGetAuthHeaders('termb')

		// dofetch* mayAdjustRequest() will automatically
		// convert to GET query params or POST body, as needed
		const body = {
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			getLowessCurve: 1,
			coords: opts.coords
		}

		return await dofetch3('termdb', { headers, body })
	}

	async getMultivalueTWs(opts) {
		const headers = this.mayGetAuthHeaders('termb')

		// dofetch* mayAdjustRequest() will automatically
		// convert to GET query params or POST body, as needed
		const body = {
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			for: 'getMultivalueTWs',
			parent_id: opts.parent_id
		}
		return await dofetch3('termdb', { headers, body })
	}

	async getCohortsData(opts) {
		const body = {
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel
		}
		return await dofetch3('termdb/cohorts', { body })
	}

	async getMatrixByName(name) {
		// find a pre-built matrix by name from this dataset
		return await dofetch3('termdb', {
			body: {
				for: 'matrix',
				getPlotDataByName: name,
				genome: this.state.vocab.genome,
				dslabel: this.state.vocab.dslabel
			}
		})
	}

	async getNumericDictTermClusterByName(name) {
		// find a pre-built numericDictTermCluster by name from this dataset
		return await dofetch3('termdb', {
			body: {
				for: 'numericDictTermCluster',
				getPlotDataByName: name,
				genome: this.state.vocab.genome,
				dslabel: this.state.vocab.dslabel
			}
		})
	}

	async getTopVariablyExpressedGenes(arg) {
		return await dofetch3('termdb/topVariablyExpressedGenes', { method: 'GET', body: arg })
	}

	async getTopTermsByType(args) {
		args.genome = this.state.vocab.genome
		args.dslabel = this.state.vocab.dslabel
		if (args.filter) args.filter = getNormalRoot(args.filter)
		return await dofetch3('termdb/getTopTermsByType', { method: 'GET', body: args })
	}

	async getSampleImages(sampleId) {
		const args = {}
		args.genome = this.state.vocab.genome
		args.dslabel = this.state.vocab.dslabel
		args.sampleId = sampleId
		return await dofetch3('termdb/getSampleImages', { method: 'GET', body: args })
	}

	/* 
		samples[]					!!! CRITICAL: the samples data must not be modified !!!
			sample{} 			  the source sample object, will not be changed directly
				[attr.from]   any collection of keys from the attributes[] argument

		attributes[]
			.attr{}
				.from         string, the object to map from, required
				.to           string, the object to map to, optional
				.convert      optional step, somehow the caller must know this is needed?
	*/
	async convertSampleId(samples, attributes) {
		// first pass of attributes[] and perform id conversion
		const byAttr = new Map()
		const bySample = []
		// !!! do NOT modify the sample object or samples array
		for (const sample of samples) {
			const obj = {}
			bySample.push(obj)
			for (const attr of attributes) {
				if (!('to' in attr)) attr.to = attr.from
				if (!attr.convert) {
					// can be filled-in without a server request
					obj[attr.to] = sample[attr.from]
					continue
				}
				// this attr requires conversion;
				// collect all values from all samples and later call server for each attribute? //once to convert
				if (!byAttr.has(attr)) byAttr.set(attr, {})
				const fromValMap = byAttr.get(attr)
				const v = sample[attr.from]
				if (!fromValMap[v]) fromValMap[v] = []
				fromValMap[v].push({ obj, sample })
			}
		}

		// perform the required conversion of sample attributes
		const promises = []
		for (const [attr, fromValMap] of byAttr) {
			const inputs = Object.keys(fromValMap)
			promises.push(
				await dofetch3('termdb', {
					body: {
						for: 'convertSampleId',
						inputs,
						genome: this.state.vocab.genome,
						dslabel: this.state.vocab.dslabel
					}
				}).then(r => {
					for (const v of inputs) {
						for (const { sample, obj } of fromValMap[v]) {
							obj[attr.to] = r.mapping[v]
						}
					}
				})
			)
		}

		await Promise.all(promises)
		return bySample
	}

	async getCorrelationVolcanoData(arg, _body = {}) {
		// Is this auth needed for this plot??
		const headers = this.mayGetAuthHeaders('termdb')

		//Add more args here (e.g. filter, etc. )
		arg.featureTw = this.getTwMinCopy(arg.featureTw)
		for (const tw of arg.variableTwLst) {
			this.getTwMinCopy(tw)
		}

		const body = Object.assign(
			{
				genome: this.vocab.genome,
				dslabel: this.vocab.dslabel
			},
			arg,
			_body
		)

		if (body.filter) body.filter = getNormalRoot(body.filter)
		const d = await dofetch3('termdb/correlationVolcano', { headers, body })

		return d
	}

	async filterTermValues(args) {
		const body = {
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel,
			...args
		}
		if (body.filter) body.filter = getNormalRoot(body.filter)
		if (body.terms) {
			body.terms = structuredClone(body.terms)
			for (const tw of body.terms) {
				this.mayStripTwProps(tw)
			}
		}
		return await dofetch3('termdb/filterTermValues', { body })
	}

	async getProfileScores(args) {
		const body = {
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel,
			...args
		}
		if (body.filter) body.filter = getNormalRoot(body.filter)
		body.facilityTW = structuredClone(body.facilityTW)
		this.mayStripTwProps(body.facilityTW)
		if (body.scoreTerms) {
			// replace with a mutable copy
			body.scoreTerms = structuredClone(body.scoreTerms)
			for (const t of body.scoreTerms) {
				if (typeof t.maxScore != 'number') this.mayStripTwProps(t.maxScore)
				this.mayStripTwProps(t.score)
			}
		}
		return await dofetch3('termdb/profileScores', { body })
	}

	async getProfileFormScores(args) {
		const body = {
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel,
			...args
		}
		if (body.filter) body.filter = getNormalRoot(body.filter)
		if (body.terms) {
			for (const t of body.terms) {
				if (t.term.id) t.term = { id: t.term.id }
			}
		}
		return await dofetch3('termdb/profileFormScores', { body })
	}

	// strip some tw properties that
	// - are not used in the server (relevant to only client-side code),
	// - may recovered on the server side such as for dictionary terms
	mayStripTwProps(tw) {
		if (!tw) return
		delete tw.type // TODO: may keep this if needed by the backend code
		delete tw.isAtomic
		delete tw.hiddenValues
		delete tw.q.isAtomic
		delete tw.q.hiddenValues
		// the full term object may be sql-queried on the server side,
		// no need to include the full body in the request payload
		if (tw.term.id && (!tw.term.type || isDictionaryType(tw.term.type))) tw.term = { id: tw.term.id }
	}

	async buildAdHocDictionary() {
		const body = {
			dslabel: this.vocab.dslabel,
			genome: this.vocab.genome,
			for: 'buildAdHocDictionary'
		}
		return await dofetch3('termdb', { method: 'GET', body })
	}

	async getFilteredAiImages(project, filter) {
		const body = {
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel,
			// make a copy of the project object
			project: Object.assign({}, project, { filter: getNormalRoot(filter) }),
			for: 'filterImages'
		}

		return await dofetch3('aiProjectAdmin', { body })
	}
}

/*
Input:
    tw {
        $id
        term { type }
    }
    lst[]
        each element is annotation object for a sample
        sample: samplename
        [$termid] : {}
            .key
                category key for this category?
            .value
                category label for this category?
            .filteredValues[]
Output:
    none

if a term is eligible, modify term object as below:
- create tw.term.category2samplecount = {categoryKey: count}
- fill in tw.term.values{}, see below
*/
function mayFillInCategory2samplecount4term(tw, lst, termdbConfig) {
	// define conditions when not to do it
	if (tw.term.type != 'categorical') {
		// for now only do it for categorical term
		return
	}
	if (!('$id' in tw)) {
		// tw.$id not found
		return
	}
	const k2c = {} // key: category key, value: sample count annotated to this category
	const k2label = {} // key: category key, value: category label
	for (const s of lst) {
		if (!s[tw.$id]) continue // sample is not annotated by this term
		const categoryKey = s[tw.$id].key
		k2c[categoryKey] = 1 + (k2c[categoryKey] || 0)
		k2label[categoryKey] = { key: categoryKey, label: categoryKey }
	}
	tw.term.category2samplecount = k2c

	/* one of three conditions on whether to fill tw.term.values{}
	- with the flag from termdbConfig, e.g. all gdc categorical terms are with blank "values{}" and should be refilled everytime
	  refilling everytime data is loaded helps with groupsetting changes, when a refill is needed to flush out old settings
	  e.g. canceling groupsetting
	- missing term.values{}
	- blank term.values{}
	*/
	if (termdbConfig.alwaysRefillCategoricalTermValues || !tw.term.values || Object.keys(tw.term.values).length == 0) {
		tw.term.values = k2label
	}
}

/*
from input list of termwrappers, get up to "count" number of unique tw and return in new list; original lst will be truncated
copies cannot contain multiple tw of same term, e.g. matrix can have same age term in two rows as continuous and discrete, having 2 age tw will confuse downstream code of getAnnotatedSampleData()
duplicating tw will be pushed to the end of lst and are returned one at a time
*/
function getTerms2update(lst, count) {
	const copies = []
	let i = 0,
		n = lst.length
	while (i < n) {
		i++
		const tw = lst.shift() // first of lst[]
		if (
			copies.find(
				c =>
					c.term.type === tw.term.type &&
					((('id' in c.term || 'id' in tw.term) && c.term.id === tw.term.id) || c.term.name === tw.term.name)
			)
		) {
			// tw already exists in copies[], do not put into copies[], put it at the end of lst to be processed later
			lst.push(tw)
		} else {
			// tw is not in copies[], which should only contain up to "count" of unique terms
			copies.push(tw)
		}
		if (copies.length >= count) break
	}
	return copies
}
