import { getBarchartData, getCategoryData } from '../plots/barchart.data'
import { scaleLinear } from 'd3-scale'
import { sample_match_termvaluesetting } from '#common/termutils'
import { isUsableTerm } from '#shared/termdb.usecase.js'
import { isNumeric } from '#shared/helpers.js'
import computePercentile from '#shared/compute.percentile.js'
import { roundValueAuto } from '#shared/roundValue.js'
import { Vocab } from './Vocab'

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

		values.sort((a, b) => a - b)
		for (const percentile of percentile_lst) {
			const perc_value = computePercentile(values, percentile, true)
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

		return computeDescrStats(values)
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

// function to compute descriptive statistics for an
// array of numeric values
function computeDescrStats(values, showOutlierRange = false) {
	if (!values.length) {
		// no values, do not get stats as it breaks code
		// set result to blank obj to avoid "missing response.header['content-type']" err on client
		return {}
	}

	if (values.some(v => !Number.isFinite(v))) throw new Error('non-numeric values found')

	//compute total
	const sorted_arr = values.sort((a, b) => a - b)
	const n = sorted_arr.length

	//compute median
	const median = computePercentile(sorted_arr, 50, true)
	//compute mean
	const mean = getMean(sorted_arr)
	// compute variance
	const variance = getVariance(sorted_arr)
	// compute standard deviation
	const stdDev = Math.sqrt(variance)

	//compute percentile ranges
	const p25 = computePercentile(sorted_arr, 25, true)
	const p75 = computePercentile(sorted_arr, 75, true)

	//compute IQR
	const IQR = p75 - p25
	const min = sorted_arr[0]
	const max = sorted_arr[sorted_arr.length - 1]

	// Calculate outlier boundaries
	const outlierMin = p25 - 1.5 * IQR //p25 is same as q1
	const outlierMax = p75 + 1.5 * IQR //p75 is same as q3

	const stats = {
		total: { label: 'Total', value: n },
		min: { label: 'Minimum', value: min },
		p25: { label: '1st quartile', value: p25 },
		median: { label: 'Median', value: median },
		p75: { label: '3rd quartile', value: p75 },
		max: { label: 'Maximum', value: max },
		mean: { label: 'Mean', value: mean },
		stdDev: { label: 'Standard deviation', value: stdDev }
		//variance: { label: 'Variance', value: variance }, // not necessary to report, as it is just stdDev^2
		//iqr: { label: 'Inter-quartile range', value: IQR } // not necessary to report, as it is just p75-p25
	}

	if (showOutlierRange) {
		stats.outlierMin = { label: 'Outlier minimum', value: outlierMin }
		stats.outlierMax = { label: 'Outlier maximum', value: outlierMax }
	}

	for (const v of Object.values(stats)) {
		const rounded = roundValueAuto(v.value)
		v.value = rounded
	}

	return stats
}

function getMean(data) {
	return data.reduce((sum, value) => sum + value, 0) / data.length
}

function getVariance(data) {
	const meanValue = getMean(data)
	const squaredDifferences = data.map(value => Math.pow(value - meanValue, 2))
	//Using n−1 compensates for the fact that we're basing variance on a sample mean,
	// which tends to underestimate true variability. The correction is especially important with small sample sizes,
	// where dividing by n would significantly distort the variance estimate.
	// For more details see https://en.wikipedia.org/wiki/Bessel%27s_correction
	return squaredDifferences.reduce((sum, value) => sum + value, 0) / (data.length - 1)
}
