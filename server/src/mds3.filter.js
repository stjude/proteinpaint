import { get_samples } from './termdb.sql.js'

/*
input:
param={}
	.tid2value = { term1id: v1, term2id:v2, ... }
		if present, return list of samples matching the given k/v pairs, assuming AND
	.filterObj = pp filter
	.filter = pp filter
	.filter0 = gdc/mmrf filter
_allSamples=[]
	whole list of samples, each ele: {name: int}
	presumably the set of samples from a bcf file or tabix file
	NOTE new format is list of integer sample ids!
ds={}

output:
if filter is applied, return set of sample id
if not filtering, undefined
*/
export async function mayLimitSamples(param, _allSamples, ds) {
	if (!_allSamples) return // no samples from this big file
	const allSamples = typeof _allSamples[0] === 'object' ? new Set(_allSamples.map(i => i.name)) : new Set(_allSamples)

	let filterSamples
	if (ds.cohort?.db) {
		// dataset has sqlite db
		// get samples that match param.filter
		if (typeof ds.cohort?.db?.connection?.prepare !== 'function')
			throw new Error('db.connection.prepare() is not a function')
		const filter = param2filter(param, ds) // TODO: use param.filter directly, no need for conversion
		if (!filter) {
			// no filtering, use all samples
			return
		}
		// get samples that match filter
		// get_samples() return [{id:int}] with possibly duplicated items, deduplicate and return list of integer ids
		filterSamples = new Set((await get_samples({ filter }, ds)).map(i => i.id))
	} else {
		// dataset is api-based
		// get samples that match param.filter/filter0
		// TODO: currently only considering filter0, later will merge in filter
		if (typeof ds.cohort?.termdb?.getSamples !== 'function') throw new Error('getSamples() is not a function')
		const filter0 = param2filter0(param) // TODO: use param.filter0 directly, no need for conversion
		if (!filter0) {
			// no filtering, use all samples
			return
		}
		// get samples that match filter0
		filterSamples = await ds.cohort.termdb.getSamples(filter0, ds)
	}

	// filterSamples is the set of samples in dataset that match filter/filter0
	// allSamples (from bcf etc) may be a subset of what's in dataset, so must
	// only use those from allSamples
	const useSet = new Set()
	for (const i of filterSamples) {
		if (allSamples.has(i)) useSet.add(i)
	}
	return useSet
}

function param2filter(param, ds) {
	{
		const f = param.filter || param.filterObj
		if (f) {
			if (!Array.isArray(f.lst)) throw 'filterObj.lst is not array'
			if (f.lst.length == 0) {
				// blank filter, do not return obj as that will break get_samples()
				return null
			}
			return f
		}
	}
	if (param.tid2value) {
		if (typeof param.tid2value != 'object') throw 'q.tid2value{} not object'
		return tid2value2filter(param.tid2value, ds)
	}
}

function param2filter0(param) {
	const f = param.filter0
	return f
}

// temporary function to convert tid2value={} to filter, can delete later when it's replaced by filter
export function tid2value2filter(t, ds) {
	const f = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: []
	}
	for (const k in t) {
		const term = ds.cohort.termdb.q.termjsonByOneid(k)
		if (!term) continue
		const v = t[k]
		f.lst.push({
			type: 'tvs',
			tvs: {
				term,
				// assuming only categorical
				values: [{ key: v }]
			}
		})
	}
	return f
}
