import { get_samples } from './termdb.sql.js'
import { filterJoin } from '#shared/filter.js'

/*
input:
param={}
	.tid2value = { term1id: v1, term2id:v2, ... }
		if present, return list of samples matching the given k/v pairs, assuming AND
	.filterObj = pp filter
	.filter = pp filter
	.filter0 = gdc/mmrf filter
	.mapParent2Children = whether to map parent term annotations onto child samples
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

	const filter = combinePPfilterAndTid2value(param, ds) // pp filter
	const filter0 = getFilter0(param, ds)

	if (!filter && !filter0) {
		// no filters specified, use all samples
		return
	}

	let filterSamples
	if (ds.cohort?.db) {
		// dataset has sqlite db
		if (!filter) {
			// no filtering, use all samples
			return
		}
		// get samples that match filter
		// get_samples() return [{id:int}] with possibly duplicated items, deduplicate and return list of integer ids
		const q = { filter, mapParent2Children: param.mapParent2Children }
		filterSamples = new Set((await get_samples(q, ds)).map(i => i.id))
	} else if (typeof ds.cohort?.termdb?.filterSamples === 'function') {
		// ds-supplied filter method
		const q = { filter, filter0, mapParent2Children: param.mapParent2Children }
		filterSamples = await ds.cohort.termdb.filterSamples(q, ds)
	} else {
		throw new Error('no method available to get samples')
	}

	if (!filterSamples) {
		// no filtering performed, use all samples
		return
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

/*
detect and harmonize following optional filter-related constructs from q{}.
.filterObj
.filter
.tid2value

if only one present, return the single filter; if more than 1, return joined filter
note they are pp filters, and are not filter0
*/
export function combinePPfilterAndTid2value(q, ds) {
	const lst = []
	if (q.filterObj) {
		if (!Array.isArray(q.filterObj.lst)) throw new Error('filterObj.lst is not an array')
		if (q.filterObj.lst.length) lst.push(q.filterObj)
	}
	if (q.filter) {
		if (!Array.isArray(q.filter.lst)) throw new Error('filter.lst is not an array')
		if (q.filter.lst.length) lst.push(q.filter)
	}
	if (q.tid2value) {
		if (typeof q.tid2value !== 'object' || Array.isArray(q.tid2value)) throw new Error('q.tid2value must be an object')
		lst.push(tid2value2filter(q.tid2value, ds))
	}
	if (lst.length == 0) return
	if (lst.length == 1) return lst[0]
	return filterJoin(lst)
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
function getFilter0(param, ds) {
	if (!param.filter0) return
	// has filter0. ds must supply the validator
	if (typeof ds.validate_filter0 != 'function') throw new Error('filter0 used but ds.validate_filter0 not func')
	return ds.validate_filter0(param.filter0)
}
