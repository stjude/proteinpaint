import { get_samples } from './termdb.sql'

/*
input:
param={}
	.tid2value = { term1id: v1, term2id:v2, ... }
		if present, return list of samples matching the given k/v pairs, assuming AND
	.filterObj = pp filter
	.filter = pp filter
allSamples=[]
	whole list of samples, each ele: {name: int}
	presumably the set of samples from a bcf file or tabix file
	NOTE new format is list of integer sample ids!
ds={}

output:
if filter is applied, return set of sample id
if not filtering, undefined
*/
export async function mayLimitSamples(param, allSamples, ds) {
	if (!allSamples) return // no samples from this big file

	// later should be param.filter, no need for conversion
	const filter = param2filter(param, ds)
	if (!filter) {
		// no filtering, use all samples
		return
	}

	// get_samples() return [{id:int}] with possibly duplicated items, deduplicate and return list of integer ids
	const filterSamples = [...new Set((await get_samples({ filter }, ds)).map(i => i.id))]

	// filterSamples is the list of samples retrieved from termdb that are matching filter
	// as allSamples (from bcf etc) may be a subset of what's in termdb
	// must only use those from allSamples
	let set
	if (Number.isInteger(allSamples[0])) set = new Set(allSamples)
	else set = new Set(allSamples.map(i => i.name))
	const useSet = new Set()
	for (const i of filterSamples) {
		if (set.has(i)) useSet.add(i)
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
