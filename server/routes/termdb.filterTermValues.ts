import type { RouteApi } from '#types'
import { FilterTermValuesPayload } from '#types/checkers'
import { getData, getSamplesPerFilter } from '../src/termdb.matrix.js'
import { authApi } from '../src/auth.js'

/*
Given a set of terms and filters per term, this route returns the list of samples that match each term filter.
It allows to fill the filter dropdowns in the profile plots. 
*/

export const api: RouteApi = {
	endpoint: 'termdb/filterTermValues',
	methods: {
		get: {
			...FilterTermValuesPayload,

			init
		},
		post: {
			...FilterTermValuesPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets?.[req.query.dslabel]
			getFilters(req.query, ds, res)
		} catch (e: any) {
			console.log(e)
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

async function getFilters(query, ds, res) {
	// safe to process this client-submitted query.filterByUserSites flag,
	// which only affects aggregation levels (not revealed sample-level data),
	// as performed by this route code, and since query.terms would still
	// be matched against a dataset's hiddenTermIds[]
	if (!query.filterByUserSites) authApi.mayAdjustFilter(query, ds, query.terms)

	try {
		//Dictionary with samples applying all the filters but not the one from the current term id
		const samplesPerFilter = await getSamplesPerFilter(query, ds)
		const filtersData = await getData(
			{
				terms: query.terms,
				__protected__: query.__protected__
			},
			ds
		)
		const tw2List = {}
		for (const tw of query.terms) {
			// related to auth: make sure the returned list are not sensitive !!!
			tw2List[tw.term.id] = getList(samplesPerFilter, filtersData, tw, query.showAll)
		}
		res.send({ ...tw2List })
	} catch (e: any) {
		console.log(e)
		res.send({ error: e.message || e })
	}
}

function getList(samplesPerFilter, filtersData, tw, showAll) {
	const values: any = Object.values(tw.term.values)
	values.sort((v1: any, v2: any) => v1.label.localeCompare(v2.label))
	const twSamples = samplesPerFilter[tw.term.id]
	const data: any[] = []
	for (const sample of twSamples) {
		data.push(filtersData.samples[sample])
	}
	//select samples with data for that term
	const annotations = data.filter(s => s != undefined).map(sample => sample[tw.$id]?.value)
	const sampleValues = Array.from(new Set(annotations))
	const filteredValues: any[] = []
	for (const value of values) {
		const label = value.label.replace(/["']/g, '') // remove quotes from the label if found, some datasets have quotes in the labels
		const disabled = !sampleValues.includes(value.key || value.label) //if the value is not in the sample values, disable it
		if (!showAll && disabled) continue //skip disabled values
		filteredValues.push({ value: value.key || value.label, label, disabled })
	}
	filteredValues.unshift({ label: '', value: '' })
	filteredValues.sort((a, b) => a.label.localeCompare(b.label))
	return filteredValues
}
