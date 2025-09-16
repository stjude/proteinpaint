import { getBarchartData, getCategoryData } from '../plots/barchart.data'
import { scaleLinear } from 'd3-scale'
import { sample_match_termvaluesetting } from '#common/termutils'
import { isUsableTerm } from '#shared/termdb.usecase.js'
import { roundValue } from '#shared/roundValue.js'
import { isNumeric } from '#shared/helpers.js'
import computePercentile from '#shared/compute.percentile.js'
import { Vocab } from './Vocab'
import { summaryStats } from '#shared/descriptive.stats.js'

export class FrontendVocab extends Vocab {
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
		const cohortValuestr = (cohortValuelst || []).slice().sort().join(',')
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

	async getCohortsData(opts) {
		return null
	}

	async getFilteredSampleCount(filterJSON) {
		/*
		if (!cohortName) return
		const term = this.vocab.find(t => t.id === id)
		if (!term || !term.cohortValues.includes(cohortName)) return
		if (!term.samplecount) term.samplecount = {}
		if (!(cohortName in term.samplecount)) {
			term.samplecount[cohortName] = Object.keys(this.vocab.sampleannotation).length
		}
		*/
		return 'TBD'
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

	async getPercentile(term, percentile_lst, filter) {
		// for a numeric term, convert a percentile to an actual value, with respect to a given filter
		if (percentile_lst.find(p => !Number.isInteger(p))) throw 'non-integer percentiles found'
		if (Math.max(...percentile_lst) > 99 || Math.min(...percentile_lst) < 1) throw 'percentiles must be between 1-99'
		const perc_values = []
		const values = []
		const samples = {}
		for (const anno of this.datarows) {
			if (samples[anno.sample]) continue
			const data = anno.s || anno.data
			if (data && sample_match_termvaluesetting(data, filter)) {
				samples[anno.sample] = this.vocab.sampleannotation[anno.sample]
			}
		}
		for (const sample in samples) {
			if (!(term.id in this.vocab.sampleannotation[sample])) continue
			const _v = Number(this.vocab.sampleannotation[sample][term.id])
			if (!Number.isFinite(_v)) throw 'non-numeric value'
			values.push(_v)
		}

		// compute percentiles
		// source: https://www.dummies.com/article/academics-the-arts/math/statistics/how-to-calculate-percentiles-in-statistics-169783/
		values.sort((a, b) => a - b)
		for (const percentile of percentile_lst) {
			const index = Math.abs((percentile / 100) * values.length - 1)
			const perc_value = Number.isInteger(index) ? (values[index] + values[index + 1]) / 2 : values[Math.ceil(index)]
			perc_values.push(perc_value)
		}
		return { values: perc_values }
	}

	async getDescrStats(term_id, filter, settings) {
		//TODO add in case for settings?
		// for a numeric term, get descriptive statistics
		// mean, median, standard deviation, min, max

		const values = []
		const samples = {}

		for (const anno of this.datarows) {
			if (samples[anno.sample]) continue
			const data = anno.s || anno.data
			if (data && sample_match_termvaluesetting(data, filter)) {
				samples[anno.sample] = this.vocab.sampleannotation[anno.sample]
			}
		}

		for (const sample in samples) {
			if (!(term_id in this.vocab.sampleannotation[sample])) continue
			const _v = Number(this.vocab.sampleannotation[sample][term_id])
			if (!Number.isFinite(_v)) throw 'non-numeric value'
			values.push(_v)
		}

		return summaryStats(values)
	}

	async getTerms(ids, _dslabel = null, _genome = null) {
		if (!ids) throw 'getTerms: ids missing'
		if (!Array.isArray(ids)) throw `invalid ids` // should use typescript
		const terms = {}
		for (const id of ids) {
			const term = this.vocab.terms.find(t => t.id === id)
			if (term) terms[id] = term
		}
		return terms
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
