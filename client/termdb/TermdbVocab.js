import { q_to_param } from './vocabulary'
import { Vocab } from './Vocab'
import { dofetch3, isInSession } from '../common/dofetch'
import { nonDictionaryTermTypes } from '#shared/termdb.usecase'
import { getNormalRoot } from '#filter'
import { isUsableTerm, graphableTypes } from '#shared/termdb.usecase'
import { throwMsgWithFilePathAndFnName } from '../dom/sayerror'

export class TermdbVocab extends Vocab {
	// migrated from termdb/store
	async getTermdbConfig() {
		const data = await dofetch3('termdb', {
			body: {
				genome: this.vocab.genome,
				dslabel: this.vocab.dslabel,
				gettermdbconfig: 1,
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
		const headers = this.mayGetAuthHeaders('termdb')
		const data = await dofetch3(url, { headers }, this.opts.fetchOpts)
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
		const params = [`embedder=${window.location.hostname}`]
		if (opts.chartType == 'cuminc') params.push('getcuminc=1')
		if (opts.chartType == 'survival') params.push('getsurvival=1')

		for (const _key of ['term0', 'term', 'term2']) {
			// "term" on client is "term1" at backend
			const term = opts[_key]
			if (!term) continue
			const key = _key == 'term' ? 'term1' : _key
			if ('id' in term.term) {
				params.push(key + '_id=' + encodeURIComponent(term.term.id))
			}
			//we'll assume that it is okay to handle all nonDictionaryTerms this way, not just geneVariant term //if (term.term.type == 'geneVariant')
			else {
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
			params.push(`hiddenValues=${encodeURIComponent(JSON.stringify(hiddenValues))}`)
		}
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

		const body = {
			getregression: 1,
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel,
			regressionType: opts.regressionType,
			outcome,
			independent: opts.independent.map(t => {
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
		}

		const filterData = getNormalRoot(opts.filter)
		if (filterData.lst.length) body.filter = filterData
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
			getcohortsamplecount: 1,
			cohort
		}
		const data = await dofetch3('termdb', { body }, this.opts.fetchOpts)
		if (!data) throw 'missing data'
		if (data.error) throw data.error
		return data[0]?.samplecount || data.count || 0
	}

	/** opts: 
	 	filterJSON: JSON || string, required
		getSampleLst: STR, optional
			- 'count' (default) returns sample count
			- 'list' returns sample list in array of [{id, name}....]
			- '*' returns sample list array of [{samplecount, subcohort}]
	 */
	async getFilteredSampleCount(filterJSON, getSampleLst) {
		const body = {
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel,
			getsamplecount: getSampleLst || 'count',
			filter: typeof filterJSON == 'string' ? filterJSON : getNormalRoot(filterJSON)
		}
		const data = await dofetch3('termdb', { body }, this.opts.fetchOpts)
		if (!data) throw `missing data`
		if (data.error) throw data.error
		if (getSampleLst) {
			if (!Array.isArray(data)) throw 'data is not array'
			return data
		}
		return data[0]?.samplecount || data.count || 0
	}

	/*
    Inputs:

    arg{}
        .termid=str
            main term to create violin/boxplot with
        .divideTw={}
            optional termwrapper of 2nd term to divide cohort
            if given, will result in multiple plots, and pvalue computed for each pair of plots
            if missing, will result in one plot
        .filter={}
            optional
        .svgw=int
            required
        .orientation='horizontal'
        .datasymbol='bean'
        .radius=5
        .strokeWidth=0.2
        .axisHeight=80
        .rightMargin=50

    additionalArgs{}
        optional bag of key:value pairs
	
    Output: {}
        min:num
        max:num
        pvalues[] array of pvalues, empty if just one plot
        plots[ {} ]
            plotValueCount:int
                total number of samples plotted
            median:num
            label:str
            biggestBin: int
                as the thickest point of the violin plot
            bins[]
                x0: number
                x1: number
                binValueCount: int
        plotThickness: Number
    */
	async getViolinPlotData(arg, _body = {}) {
		// the violin plot may still render when not in session,
		// but not have an option to list samples
		const headers = this.mayGetAuthHeaders('termdb')
		const body = Object.assign(
			{
				getViolinPlotData: 1,
				genome: this.vocab.genome,
				dslabel: this.vocab.dslabel,
				embedder: window.location.hostname,
				devicePixelRatio: window.devicePixelRatio,
				maxThickness: 150,
				screenThickness: arg.screenThickness
			},
			arg,
			_body
		)

		if (body.filter) body.filter = getNormalRoot(body.filter)
		const d = await dofetch3('termdb/violin', { headers, body })

		return d
	}

	async getPercentile(term_id, percentile_lst, filter) {
		// for a numeric term, convert a percentile to an actual value, with respect to a given filter
		if (percentile_lst.find(p => !Number.isInteger(p))) throw 'non-integer percentiles found'
		if (Math.max(...percentile_lst) > 99 || Math.min(...percentile_lst) < 1) throw 'percentiles must be between 1-99'
		const body = {
			getpercentile: percentile_lst,
			tid: term_id,
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel
		}
		if (filter) {
			body.filter = getNormalRoot(filter)
		}
		return await dofetch3('termdb/getpercentile', { body })
	}

	async getDescrStats(term_id, filter, settings) {
		// for a numeric term, get descriptive statistics
		// mean, median, standard deviation, min, max
		const body = {
			getdescrstats: 1,
			tid: term_id,
			genome: this.vocab.genome,
			dslabel: this.vocab.dslabel,
			settings
		}
		if (filter) {
			body.filter = getNormalRoot(filter)
		}
		return await dofetch3('/termdb/descrstats', { body })
	}

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
			if (term.type == 'categorical' && !term.values && !term.groupsetting?.inuse)
				this.missingCatValsByTermId[term.id] = term
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

	async getCategories(term, filter, _body = {}) {
		// works for both dictionary and non-dict term types
		// for non-dict terms, will handle each type individually
		// for dictionary terms, use same method to query backend termdb
		// return number of samples per category/bin/grade/group etc
		// optionally, caller can supply a {term1_q: {...}} key-object value in _body
		// as this function does not deal with q by default
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

		// use same query method for all dictionary terms
		const body = {
			getcategories: 1,
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel,
			tid: term.type == 'geneVariant' ? term.name : term.id,
			..._body
		}
		if (term.type == 'geneVariant') {
			body.type = 'geneVariant'
		}
		if (filter) {
			body.filter = getNormalRoot(filter)
		}

		try {
			const data = await dofetch3('termdb/categories', { headers, body })
			if (data.error) throwMsgWithFilePathAndFnName(data.error)
			return data
		} catch (e) {
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
            [$id]: { // $id is tw id, not term id
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
		const currentGeneNames = opts.isHierCluster
			? null
			: opts.terms
					.filter(tw => tw.term.type === 'geneVariant')
					.map(tw => tw.term.name)
					.sort() // sort the gene names by the default alphanumeric order to improve cache reuse even when terms are resorted

		const allTerms2update = opts.terms.slice() // make copy of array as it will be truncated to empty. do not modify original

		let numResponses = 0
		if (opts.loadingDiv) opts.loadingDiv.html('Updating data ...')

		while (true) {
			const copies = getTerms2update(allTerms2update, opts.termsPerRequest || 1) // list of unique terms to update in this round
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
			if (opts.filter0) init.body.filter0 = opts.filter0 // avoid adding "undefined" value
			if (opts.isHierCluster) init.body.isHierCluster = true // special arg from matrix, just pass along
			if (this.vocab.dslabel == 'GDC' && copies.find(tw => tw.term.id) && currentGeneNames?.length) {
				/* term.id is present meaning term is dictionary term (FIXME if this is unreliable)
				and there are gene terms, add this to limit to mutated cases
				*/
				init.body.currentGeneNames = currentGeneNames
			}
			promises.push(
				dofetch3('termdb', init).then(data => {
					if (data.error) throw data.error
					if (!data.refs.bySampleId) data.refs.bySampleId = {}
					for (const tw of copies) {
						const idn = 'id' in tw.term ? tw.term.id : tw.term.name

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
							const row = samples[sampleId]
							if (idn in sample) row[tw.$id] = sample[idn]
						}

						for (const sampleId in data.refs.bySampleId) {
							refs.bySampleId[sampleId] = data.refs.bySampleId[sampleId]
						}

						refs.byTermId[tw.$id] = tw
						if (idn in data.refs.byTermId) {
							refs.byTermId[tw.$id] = Object.assign({}, refs.byTermId[tw.$id], data.refs.byTermId[idn])
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
			this.tokenVerificationMessage = e
			throw e
		}
		try {
			opts.loadingDiv?.html(`Processing data ...`)
			const dictTerm$ids = opts.terms.filter(tw => !nonDictionaryTermTypes.has(tw.term.type)).map(tw => tw.$id)
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

	// get a tw copy with the correct identifier and without $id
	// for better GET caching by the browser
	getTwMinCopy(tw) {
		const idn = 'id' in tw.term ? tw.term.id : tw.term.name
		const copy = { term: {}, q: tw.q }
		if ('id' in tw || 'id' in tw.term) {
			copy.term.id = tw.id || tw.term.id
			if (tw.term.type == 'snplst' || tw.term.type == 'snplocus') {
				// added following so getData will not break
				copy.term.type = tw.term.type
				copy.term.name = tw.term.name
			}
		} else {
			copy.term.name = tw.term.name
			copy.term.type = tw.term.type
			copy.term.values = tw.term.values
		}

		// geneVariant term may have term.chr/start/stop, must add those to copy
		if (tw.term.chr) {
			copy.term.chr = tw.term.chr
			copy.term.start = tw.term.start
			copy.term.stop = tw.term.stop
		}

		return copy
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
			coordTWs: opts.coordTWs,
			filter: getNormalRoot(opts.filter),
			embedder: window.location.hostname
		}
		if (opts.colorTW) body.colorTW = opts.colorTW
		if (opts.shapeTW) body.shapeTW = opts.shapeTW
		if (opts.divideByTW) body.divideByTW = opts.divideByTW
		if (opts.scaleDotTW) body.scaleDotTW = opts.scaleDotTW

		return await dofetch3('termdb', { headers, body })
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

	async getAllSamplesByName(opts) {
		// the scatter plot may still render when not in session,
		// but not have an option to list samples
		const headers = this.mayGetAuthHeaders('termb')

		// dofetch* mayAdjustRequest() will automatically
		// convert to GET query params or POST body, as needed
		const body = {
			for: 'getAllSamplesByName',
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

	async getCohortsData(opts) {
		const body = {
			getCohortsData: 1,
			genome: this.state.vocab.genome,
			dslabel: this.state.vocab.dslabel
		}
		return await dofetch3('termdb', { body })
	}

	async getMds3queryDetails() {
		return await dofetch3('termdb', {
			body: {
				for: 'mds3queryDetails',
				genome: this.state.vocab.genome,
				dslabel: this.state.vocab.dslabel
			}
		})
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

	// following two methods are hardcoded at /gdc/*. TODO change to generic method to work for all datasets
	async getTopMutatedGenes(arg) {
		return await dofetch3('gdc/topMutatedGenes', { method: 'GET', body: arg })
	}
	async getTopVariablyExpressedGenes(arg) {
		return await dofetch3('termdb/topVariablyExpressedGenes', { method: 'GET', body: arg })
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

	async runDEanalysis(config) {
		return await dofetch3('termdb', {
			body: {
				for: 'DEanalysis',
				genome: this.state.vocab.genome,
				dslabel: this.state.vocab.dslabel,
				samplelst: config.samplelst
			}
		})
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
