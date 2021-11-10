// group types
export const type_all = 'all'
export const type_supportref = 'support_ref'
export const type_supportalt = 'support_alt'
export const type_supportno = 'support_no'
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
			type2group[type_supportalt] = {}
			type2group[type_supportref] = {}
			type2group[type_supportno] = {}
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
