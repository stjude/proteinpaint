import { dofetch3 } from '../client'
import { getBarchartData, getCategoryData } from '../plots/barchart.data'
import { nonDictionaryTermTypes } from '../common/termsetting'
import { getNormalRoot } from '../common/filter'
import { scaleLinear } from 'd3-scale'
import { sample_match_termvaluesetting } from '../common/termutils'
import initBinConfig from '../../shared/termdb.initbinconfig'

const graphableTypes = new Set(['categorical', 'integer', 'float', 'condition', 'survival', 'snplst'])

export function vocabInit(opts) {
	/*** start legacy support for state.genome, .dslabel ***/
	if (!opts.state) return // let termdb/store handle error
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
	if (!vocab.route && vocab.dslabel) {
		vocab.route = 'termdb'
	}
	/*** end legacy support ***/

	if (vocab.route == 'termdb') {
		return new TermdbVocab(opts)
	} else if (!vocab.route && vocab.terms) {
		return new FrontendVocab(opts)
	}
}

class TermdbVocab {
	constructor(opts) {
		this.app = opts.app
		this.opts = opts
		this.state = opts.state
		this.vocab = opts.state.vocab
	}

	main(stateOverride = null) {
		if (stateOverride) Object.assign(this.state, stateOverride)
		else this.state = this.app ? this.app.getState() : this.opts.state
		this.vocab = this.state.vocab
	}

	// migrated from termdb/store
	async getTermdbConfig() {
		const data = await dofetch3(
			'termdb?genome=' + this.vocab.genome + '&dslabel=' + this.vocab.dslabel + '&gettermdbconfig=1'
		)
		// note: in case of error such as missing dataset, supply empty object
		return data.termdbConfig || {}
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
		return data
	}

	// from termdb/plot
	async getNestedChartSeriesData(opts) {
		const url = this.getTdbDataUrl(opts)
		const data = await dofetch3(url, {}, this.opts.fetchOpts)
		if (data.error) throw data.error
		return data
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

		for (const _key of ['term', 'term2', 'term0']) {
			// "term" on client is "term1" at backend
			const term = opts[_key]
			if (!term) continue
			const key = _key == 'term' ? 'term1' : _key
			params.push(key + '_id=' + encodeURIComponent(term.term.id))
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
		// TODO: may support user input for minimum years_to_event for cuminc plot
		// if ('minYearsToEvent' in opts) params.push(`minYearsToEvent=${opts.minYearsToEvent}`)

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
	syncTermData(config, data) {
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
	async findTerm(str, cohortStr, exclude_types = []) {
		const lst = [
			'genome=' + this.vocab.genome,
			'dslabel=' + this.vocab.dslabel,
			'findterm=' + encodeURIComponent(str),
			'cohortStr=' + cohortStr
		]
		if (exclude_types.length) {
			lst.push('exclude_types=' + encodeURIComponent(JSON.stringify(exclude_types)))
		}
		if (this.state.treeFilter) {
			lst.push('treeFilter=' + encodeURIComponent(JSON.stringify(this.state.treeFilter)))
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
		const data = await dofetch3(`termdb?dslabel=${dslabel}&genome=${genome}&gettermbyid=${termid}`)
		if (data.error) throw 'getterm: ' + data.error
		if (!data.term) throw 'no term found for ' + termid
		return data.term
	}

	graphable(term) {
		if (!term) throw 'graphable: term is missing'
		// term.isgenotype??
		return graphableTypes.has(term.type)
	}

	async getCategories(term, filter, lst = []) {
		// works for both dictionary and non-dict term types
		// for non-dict terms, will handle each type individually
		// for dictionary terms, use same method to query backend termdb
		// return number of samples per category/bin/grade/group etc
		// optionally, caller can supply parameter "term1_q=stringifiedJSON" in lst[]
		// as this function does not deal with q by default

		if (term.type == 'snplst') {
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

	/* when arg.text is true, it should only contain .text
	else, it should be the q{} of snplocus term, with {chr,start,stop}
	used for snplst and snplocus term types.
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
		}
		return await dofetch3('/termdb?' + lst.join('&'))
	}

	async get_infofields() {
		// used for snplocus term type
		const args = ['getinfofields=1', 'genome=' + this.state.vocab.genome, 'dslabel=' + this.state.vocab.dslabel]
		return await dofetch3('/termdb?' + args.join('&'))
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

class FrontendVocab {
	constructor(opts) {
		this.app = opts.app
		this.opts = opts
		this.state = opts.state
		this.vocab = opts.state.vocab
		this.datarows = []
		if (opts.state.vocab.sampleannotation) {
			const anno = opts.state.vocab.sampleannotation
			Object.keys(anno).forEach(sample => this.datarows.push({ sample, data: anno[sample] }))
		}
	}

	main(vocab) {
		if (vocab) Object.assign(this.vocab, vocab)
		this.state = this.app.getState()
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
	syncTermData(config, data) {
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
	async findTerm(str, cohortStr) {
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
		// term.isgenotype??
		return graphableTypes.has(term.type)
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
