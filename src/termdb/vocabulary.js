import { dofetch3 } from '../client'
import { getBarchartData } from './barchart.data'
import { termsetting_fill_q } from '../common/termsetting'
import { getNormalRoot } from '../common/filter'

const graphableTypes = new Set(['categorical', 'integer', 'float', 'condition'])

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
	} else {
		//throw `unsupported vocab.route =='${vocab.route}'`
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
		const route = config.settings.currViews.includes('scatter') ? '/termdb' : '/termdb-barsql'
		const url = route + dataName + '&genome=' + this.vocab.genome + '&dslabel=' + this.vocab.dslabel
		const data = await dofetch3(url, {}, this.app.opts.fetchOpts)
		if (data.error) throw data.error
		return data
	}

	// from termdb/search
	async findTerm(str, cohortStr) {
		const lst = [
			'genome=' + this.vocab.genome,
			'dslabel=' + this.vocab.dslabel,
			'findterm=' + encodeURIComponent(str),
			'cohortStr=' + cohortStr
		]
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

	async getDensityPlotData(term_id, num_obj) {
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

		if (this.state.termfilter && typeof this.state.termfilter.filter != 'undefined') {
			const filterRoot = getNormalRoot(this.state.termfilter.filter)
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
		this.state = this.opts.state
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

	async getDensityPlotData(term_id, num_obj) {
		const countsByVal = new Map()
		let minvalue,
			maxvalue,
			samplecount = 0
		for (const sample in this.vocab.sampleannotation) {
			if (!(term_id in this.vocab.sampleannotation[sample])) continue
			const v = this.vocab.sampleannotation[sample][term_id]
			samplecount += 1
			if (minvalue === undefined || v < minvalue) minvalue = v
			if (maxvalue === undefined || v > maxvalue) maxvalue = v
			if (!countsByVal.has(v)) countsByVal.set(v, [v, 0])
			countsByVal.get(v)[1] += 1
		}

		const density = [...countsByVal.values()]
		return {
			density,
			densitymax: density.reduce((maxv, v, i) => (i === 0 || v[1] > maxv ? v[1] : maxv), 0),
			minvalue,
			maxvalue,
			samplecount
		}

		throw 'ToDo: custom vocab getDensityPlotData(term_id, num_obj)'
	}

	async getterm(termid) {
		if (!termid) throw 'getterm: termid missing'
		return this.vocab.terms.find(d => d.id == termid)
	}

	graphable(term) {
		if (!term) throw 'graphable: term is missing'
		// term.isgenotype??
		return graphableTypes.has(term.type)
	}
}
