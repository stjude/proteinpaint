import type { RouteApi } from '#types'
import { FilterTermValuesPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'
import { authApi } from '#src/auth.js'
import { filterJoin } from '#shared/filter.js'
import { get_samples } from '../src/termdb.sql.js'

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
			res.send(await getFilters(req.query, ds))
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

/*
Given a set of terms and filters per term, this route returns the list of possible values per term. The possible values
is based on the current selection of samples. If a value is not available it is shown as disabled. Each term/dropdown is populated with the values 
from the samples that match the term's filter. The term filter is a filter that combines all the other term filters but excludes its own. 
For example, lets say the user selects region Africa and country Cameroon. To populate the countries we build the country filter that selects the samples from 
the Africa region (the region filter) without restricting them to be Cameroon (the country filter). Therefore this filter excludes the country filter, 
in order to list all the other possible choices. Currently this endpoint is used to fill the filter dropdowns in the profile plots.
*/
async function getFilters(query, ds) {
	// safe to process this client-submitted query.filterByUserSites flag,
	// which only affects aggregation levels (not revealed sample-level data),
	// as performed by this route code, and since query.terms would still
	// be matched against a dataset's hiddenTermIds[]

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
	return { ...tw2List }
}

async function getSamplesPerFilter(q, ds) {
	q.ds = ds
	const samples = {}
	const userFilter = q.filter ? structuredClone(q.filter) : null
	//Adjust q filter to not apply user site filter if not requested
	if (!q.filterByUserSites) {
		//ignoreTermIds is used when building the user filter to exclude these terms from the filter
		//When getting the samples per filter, is ok to not apply the user filter unless the filter is the facility term, in which case it must be applied
		q.__protected__.ignoredTermIds.push(q.facilityTW.term.id)
		authApi.mayAdjustFilter(q, ds, q.terms)
	}
	for (const id in q.filters) {
		// Use site filter only for facility term otherwise use q filter
		const termfilter = id == q.facilityTW.term.id ? userFilter : q.filter
		let filter = q.filters[id]
		if (q.filter) filter = filterJoin([termfilter, q.filters[id]])
		const result = (await get_samples({ filter, __protected__: q.__protected__ }, q.ds)).map(i => i.id)
		samples[id] = Array.from(new Set(result))
	}
	return samples
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
		let label = value.label.replace(/["']/g, '') // remove quotes from the label if found, some datasets have quotes in the labels
		if (label.length > 50) label = label.slice(0, 47) + '...' //truncate long labels
		const disabled = !sampleValues.includes(value.key || value.label) //if the value is not in the sample values, disable it
		if (!showAll && disabled) continue //skip disabled values
		filteredValues.push({ value: value.key || value.label, label, disabled })
	}
	filteredValues.unshift({ label: '', value: '' })
	filteredValues.sort((a, b) => a.label.localeCompare(b.label))
	return filteredValues
}
