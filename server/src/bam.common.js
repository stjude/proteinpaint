// group types
export const type_all = 'all'
export const type_supportref = 'support_ref'
export const type_supportalt = 'support_alt'
export const type_supportno = 'support_no'
export const type_supportamb = 'support_amb'
export const type_supportsv = 'support_sv'

export function make_type2group(q) {
	// different type setting for variant and sv
	const type2group = {}
	if (q.variant) {
		if (q.grouptype) {
			// only return data for one group
			type2group[q.grouptype] = { partstack: q.partstack }
		} else {
			// resulting groups array will follow the order: 1) alt; 2) ref; 3) no
			//type2group[type_supportalt] = {}
			type2group[type_supportref] = {}
			type2group[type_supportno] = {}
			type2group[type_supportamb] = {}
			for (let i = 0; i < q.variant.length; i++) {
				type2group[type_supportalt + i.toString()] = {}
			}
		}
	} else if (q.sv) {
		if (q.grouptype) {
			// only return data for one group
			type2group[q.grouptype] = { partstack: q.partstack }
		} else {
			type2group[type_supportsv] = {}
			type2group[type_supportref] = {}
		}
	} else {
		throw 'q.variant or q.sv missing'
	}
	for (const k in type2group) {
		// fill each group
		const g = type2group[k]
		g.type = k
		g.templates = []
		g.regions = duplicateRegions(q.regions)
		g.messages = []
	}
	return type2group
}

export function duplicateRegions(regions) {
	// each read group needs to keep its own list of regions
	// to keep track of group-specific rendering parameters
	return regions.map(i => {
		return {
			x: i.x,
			scale: i.scale,
			ntwidth: i.ntwidth
		}
	})
}

/*
Validate user-supplied per-allele arrays (e.g. q.leftflankseqs) sent by client.
Must be a real array of expected length with all elements of expected type, so that
an object such as {length: 1e9} or a scalar cannot be used as a loop bound.
	obj: object holding the arrays
	names: array of keys to check
	n: expected array length (number of variants)
	type: 'string' or 'number'
*/
export function validateAlleleArrays(obj, names, n, type) {
	for (const name of names) {
		const arr = obj[name]
		if (!Array.isArray(arr)) throw name + ' is not an array'
		if (arr.length != n) throw name + ' length does not match number of variants'
		for (const v of arr) {
			if (type == 'number' ? !Number.isFinite(Number(v)) : typeof v != 'string') throw name + ' has invalid element'
		}
	}
}
