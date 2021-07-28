import { dofetch3 } from '../client'
import { getBarchartData, getCategoryData } from './barchart.data'
import { termsetting_fill_q } from '../common/termsetting'
import { getNormalRoot } from '../common/filter'
import { scaleLinear } from 'd3-scale'
import { sample_match_termvaluesetting } from '../common/termutils'

const graphableTypes = new Set(['categorical', 'integer', 'float', 'condition', 'survival'])

export function vocabInit(app, opts) {
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
		return new TermdbVocab(app, opts)
	} else if (!vocab.route && vocab.terms) {
		return new FrontendVocab(app, opts)
	}
}

class TermdbVocab {
	constructor(app, opts) {
		this.app = app
		this.opts = opts
		this.state = opts.state
		this.vocab = opts.state.vocab
	}

	main() {
		this.state = this.app ? this.app.getState() : this.opts.state
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
			'&dslabel=' + this.vocab.dslabel,
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
		const data = await dofetch3('/termdb?' + lst.join('&'), {}, this.app.opts.fetchOpts)
		if (data.error) throw data.error
		return data
	}

	// from termdb/plot
	async getPlotData(plotId, dataName) {
		const config = this.state.tree.plots[plotId]
		const displayAsSurvival =
			config.term.term.type == 'survival' || (config.term2 && config.term2.term.type == 'survival')
		const route =
			config.settings.currViews.includes('scatter') || config.settings.currViews.includes('cuminc') || displayAsSurvival
				? '/termdb'
				: '/termdb-barsql'
		const url = route + dataName + '&genome=' + this.vocab.genome + '&dslabel=' + this.vocab.dslabel
		const data = await dofetch3(url, {}, this.app.opts.fetchOpts)
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
		const data = await dofetch3('termdb?' + lst.join('&'))
		if (data.error) throw data.error
		return data
	}

	// from termdb/terminfo
	async getTermInfo(id) {
		const args = ['genome=' + this.vocab.genome + '&dslabel=' + this.vocab.dslabel + '&getterminfo=1&tid=' + id]
		const data = await dofetch3('/termdb?' + args.join('&'), {}, this.app.opts.fetchOpts)
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
		const data = await dofetch3('termdb?' + lst.join('&'), {}, this.app.opts.fetchOpts)
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
		const data = await dofetch3('termdb?' + lst.join('&'), {}, this.app.opts.fetchOpts)
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

	async getCategories(term, filter, lst = null) {
		const param = lst ? 'getcategories' : 'getnumericcategories'
		const args = [
			`${param}=1`,
			'genome=' + this.state.vocab.genome,
			'dslabel=' + this.state.vocab.dslabel,
			'tid=' + term.id,
			'filter=' + encodeURIComponent(JSON.stringify(filter))
		]

		if (lst && lst.length) args.push(...lst)

		try {
			const data = await dofetch3('/termdb?' + args.join('&'))
			if (data.error) throw data.error
			return lst ? data : data.lst
		} catch (e) {
			window.alert(e.message || e)
		}
	}
}

// to-do
// class Mds3Vocab {}

class FrontendVocab {
	constructor(app, opts) {
		this.app = app
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
		return { termdbConfig: { selectCohort: this.vocab.selectCohort } }
	}

	getTermChildren(term, cohortValuelst) {
		const cohortValuestr = (cohortValuelst || [])
			.slice()
			.sort()
			.join(',')
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
	async getPlotData(plotId, dataName) {
		if (!(plotId in this.state.tree.plots)) {
			const term = this.vocab.terms.find(t => t.id === plotId)
			const q = {}
			termsetting_fill_q(q, term)
			this.state.tree.plots[plotId] = {
				term: { term, q }
			}
		}
		const config = this.state.tree.plots[plotId]
		const q = {
			term1: config.term ? config.term.term : {},
			term1_q: config.term ? config.term.q : undefined,
			term0: config.term0 ? config.term0.term : undefined,
			term0_q: config.term0 ? config.term0.q : undefined,
			term2: config.term2 ? config.term2.term : undefined,
			term2_q: config.term2 ? config.term2.q : undefined,
			filter: this.state.termfilter && this.state.termfilter.filter
		}
		return getBarchartData(q, this.datarows)
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

	async getterm(termid) {
		if (!termid) throw 'getterm: termid missing'
		return this.vocab.terms.find(d => d.id == termid)
	}

	async getCategories(term, filter, lst = null) {
		const q = { term, filter }
		const data = getCategoryData(q, this.datarows)
		return data
	}

	graphable(term) {
		if (!term) throw 'graphable: term is missing'
		// term.isgenotype??
		return graphableTypes.has(term.type)
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
					if (!('min' in t) || val < t.min) t.min = val
					if (!('max' in t) || val > t.max) t.max = val
					if (!('maxdecimals' in t)) t.maxdecimals = 0
					const numdecimals = a.s[key].toString().split('.')[1]
					if (numdecimals && numdecimals.length > t.maxdecimals) {
						t.maxdecimals = numdecimals.length
					}
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
		if (t.type !== 'categorical') {
			const bin_size = (t.max - t.min) / 10
			t.bins = {
				default: {
					bin_size,
					stopinclusive: true,
					first_bin: { startunbounded: true, stop: t.min + bin_size, stopinclusive: true },
					rounding: '.' + t.maxdecimals + 'f'
				}
			}
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
