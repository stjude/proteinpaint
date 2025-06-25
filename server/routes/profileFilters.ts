import type { RouteApi } from '#types'
import { ProfileFiltersPayload } from '#types/checkers'
import { getData, getSamplesPerFilter } from '../src/termdb.matrix.js'

/*
Given a set of terms and filters per term, this route returns the list of samples that match each term filter.
It allows to fill the filter dropdowns in the profile plots. 
*/

export const api: RouteApi = {
	endpoint: 'profileFilters',
	methods: {
		get: {
			...ProfileFiltersPayload,

			init
		},
		post: {
			...ProfileFiltersPayload,
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
			getFilters(req.query, ds, g, res)
		} catch (e: any) {
			console.log(e)
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

function getList(samplesPerFilter, filtersData, tw) {
	const values: any = Object.values(tw.term.values)
	values.sort((v1: any, v2: any) => v1.label.localeCompare(v2.label))
	const twSamples = samplesPerFilter[tw.term.id]
	const data: any[] = []
	for (const sample of twSamples) {
		data.push(filtersData.samples[sample])
	}
	//select samples with data for that term
	const sampleValues = Array.from(new Set(data.map(sample => sample[tw.$id]?.value)))
	for (const value of values) {
		value.value = value.label
		value.disabled = !sampleValues.includes(value.label)
	}
	values.unshift({ label: '', value: '' })
	return values
}

async function getFilters(query, ds, genome, res) {
	try {
		//Dictionary with samples applying all the filters but not the one from the current term id
		const samplesPerFilter = await getSamplesPerFilter(query, ds)
		const filtersData = await getData(
			{
				terms: query.terms
			},
			ds,
			genome
		)
		const tw2List = {}
		for (const tw of query.terms) {
			tw2List[tw.term.id] = getList(samplesPerFilter, filtersData, tw)
		}
		res.send({ ...tw2List })
	} catch (e: any) {
		console.log(e)
		res.send({ error: e.message || e })
	}
}
