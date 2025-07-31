/***********************
 Utilities
*************************/

import { getWrappedTvslst } from '#shared/filter.js'
export { getWrappedTvslst } from '#shared/filter.js'

// find the first filter item that has a matching term.id
export function findItemByTermId(item, id) {
	if (item.type === 'tvs' && item.tvs.term.id === id) return item
	if (item.type !== 'tvslst') return
	for (const subitem of item.lst) {
		const matchingItem = findItemByTermId(subitem, id)
		if (matchingItem) return matchingItem
	}
}

// find filter item by the sequential $id
// assigned at the time of adding a filter entry
export function findItem(item, $id) {
	if (item.$id === $id) return item
	if (item.type !== 'tvslst') return
	for (const subitem of item.lst) {
		const matchingItem = findItem(subitem, $id)
		if (matchingItem) return matchingItem
	}
}

export function findParent(parent, $id) {
	if (parent.$id === $id) return parent
	if (!parent.lst) return
	for (const item of parent.lst) {
		if (item.$id === $id) return parent
		else if (item.type == 'tvslst') {
			const matchingParent = findParent(item, $id)
			if (matchingParent) return matchingParent
		}
	}
}

export function getFilterItemByTag(item, tag) {
	if (item.tag === tag) return item
	if (item.type !== 'tvslst') return
	for (const subitem of item.lst) {
		const matchingItem = getFilterItemByTag(subitem, tag)
		if (matchingItem) return matchingItem
	}
}

/*
	get valid filter data to be used for server requests
	will use normalizeFilter recursively as needed

	.filter{} the raw filter root
*/
export function getNormalRoot(rawFilter) {
	if (!rawFilter) return getWrappedTvslst([])
	const filter = JSON.parse(JSON.stringify(rawFilter))
	const processedFilter = normalizeFilter(filter)
	return processedFilter.type == 'tvslst' ? processedFilter : getWrappedTvslst([processedFilter])
}

/* 
	Potentially
	- restructure the filter data in a shape 
	allowed by the server, such as by
  removing an empty tvslst or converting a 
	single-entry tvslst into a tvs
	- also will remove unnecessary filter properties
	via normalizeProps()

	.filter{} the raw filter root or a subnested filter
*/
function normalizeFilter(filter) {
	delete filter.$id
	delete filter.tag
	if (filter.type != 'tvslst') return filter

	const lst = filter.lst
		// keep non-tvslst entries or tvslst with non-empty lst.length
		.filter(f => f.type !== 'tvslst' || f.lst.length > 0)
		// do not reformat an entry unless it is a tvslst with only one entry,
		// in which case just return that filter's first lst entry and negated as needed,
		// instead of returning the filter itself
		.map(f => {
			if (f.type !== 'tvslst' || f.lst.length > 1) return f
			// f.in defaults to true if missing, negation requires a strict boolean false
			if (f.in !== false) return f.lst[0]
			if (f.lst[0].type !== 'tvs') throw `unable to handle filter entry type='${f.lst[0].type}'`
			if (!f.lst[0].tvs) throw `missing filter entry tvs`
			// handle a single-entry tvslst where filter.in != true, which is not created from the filter UI,
			// but may be created internally by non-UI code, so need to support under the hood
			f.lst[0].tvs.isnot = !f.lst[0].tvs.isnot
			// return the single entry after applying the tvslst negation to the tvs itself
			return f.lst[0]
		})

	lst.forEach(normalizeProps)

	if (!lst.length) {
		// return a default empty filter = {type: 'tvslst', lst:[], ...}
		return getWrappedTvslst([], '', filter.$id)
	} else if (lst.length == 1) {
		// return the only lst entry after normalizing
		if (lst[0].type === 'tvslst') {
			return normalizeFilter(lst[0])
		} else {
			return normalizeProps(lst[0])
		}
	} else {
		// reset and fill-in filter.lst with normalized entries
		filter.lst = []
		for (const item of lst) {
			if (item.type === 'tvslst') {
				const normalItem = normalizeFilter(item)
				if (normalItem.type !== 'tvslst' || normalItem.join != filter.join || normalItem.in != filter.in) {
					filter.lst.push(normalItem)
				} else if (normalItem.lst.length) {
					// can flatten and level up the subnested filter.lst items with matching join, in
					filter.lst.push(...normalItem.lst)
				}
			} else {
				filter.lst.push(item)
			}
		}
		return filter
	}
}

/*
	will remove unnecessary filter properties
	that are not expected in a server request

	.filter{} the raw filter root or a subnested filter
*/
export function normalizeProps(filter, callback = null) {
	delete filter.$id
	if (typeof callback == 'function') callback(filter)
	if (filter.type == 'tvslst') {
		for (const item of filter.lst) {
			normalizeProps(item, callback)
		}
	}
	return filter
}

/* join a list of filters into the first filter with "and", return joined filter
to be used by caller app to join hidden filters into a visible filter

lst:[]
  a list of filters
  the function returns a (modified) copy of the first filter, and will not modify it
  rest of the array will be joined to the first one under "and"
*/
export function filterJoin(lst) {
	if (!Array.isArray(lst)) throw 'filterJoin() arg is not array'
	if (!lst[0]) return
	let f = JSON.parse(JSON.stringify(lst[0]))
	if (lst.length == 1) return getNormalRoot(f) // TODO: are there cases where non-normalize shape is needed from filterJoin()?
	// more than 1 item, will join
	if (f.lst.length < 2) {
		if (f.join !== '') throw 'filter.join must be an empty string "" when filter.lst.length < 2'
		f.join = 'and'
	} else if (f.join == 'or') {
		// f is "or", wrap it with another root layer of "and"
		f = {
			type: 'tvslst',
			join: 'and',
			in: true,
			lst: [f]
		}
	} else if (f.join != 'and') {
		throw 'filter.join must be either "and" or "or" when .lst length > 1'
	}
	// now, f.join should be "and"
	// if the argument lst[0].join == "and",
	// then the f.in boolean value is reused
	for (let i = 1; i < lst.length; i++) {
		const f2 = JSON.parse(JSON.stringify(lst[i]))
		if (f2.join == 'or') f.lst.push(f2)
		else f.lst.push(...f2.lst)
	}
	// if f ends up single-tvs item (from joining single tvs to empty filter), need to set join to '' per filter spec
	if (f.lst.length == 1 && f.lst[0].type == 'tvs') {
		f.join = ''
	}
	return getNormalRoot(f) // TODO: are there cases where non-normalize shape is needed from filterJoin()?
}

/* make copy of input filter, return negated copy
if tag=filterUiRoot is found, negate that;
else, assume is tvslst of single tvs an negate at tvs level

allow other tags for future use
*/
export function negateFilter(f0, tag = 'filterUiRoot') {
	const f = structuredClone(f0)
	const fui = getFilterItemByTag(f, tag)
	if (fui) {
		if (typeof fui.in != 'boolean') throw 'filterUiRoot f.in is not boolean'
		fui.in = !fui.in
		return f
	}
	// tag not found, try root

	if (f.lst?.length == 1 && f.lst[0].type == 'tvs' && typeof f.lst[0].tvs == 'object') {
		// is a tvslst containing a single tvs. negate at tvs level
		f.lst[0].tvs.isnot = !f.lst[0].tvs.isnot
		return f
	}
	if (f.lst?.length > 1 && typeof f.in == 'boolean') {
		// is a tvslst with multiple tvs. maybe from a subfilter nested somewhere
		f.in = !f.in
		return f
	}
	throw 'cannot negate filter'
}

export function getCombinedTermFilter(appState, reportFilter) {
	if (!reportFilter) return appState.termfilter
	let filter = reportFilter
	if (appState.termfilter.filter) filter = filterJoin([appState.termfilter.filter, reportFilter])
	return { filter, filter0: appState.termfilter.filter0 }
}

/*
This function is used where ever you need to build a group of categorical filters related.
 It builds the filter needed to retrieve a term values after filtering out samples according to the other filters provided.
 The profile filters, for example, use this function to get the filters needed to call filterTermValues, that populate the dropdowns in the controls.
 If no tw is provided it returns a filter that is the combination of all the categorical filters provided in the filterTWs array.
 Input:
 - filterTWs: list of term wrappers (tw) that are used to filter the samples
 - values: an object with term ids as keys and the values to filter by
 - excludedTw: The term wrapper for which the filter is being built. If provided, it will be excluded from the filter.
 Output:
 - a filter object that can be used to filter term values based on the provided term wrappers and values.

NOTE: Consumer code should submit the global filter in the request payload, so that the server code
      can combine it with each of the generated filter here.
*/
export function getCategoricalTermFilter(filterTWs, values, excludedTw) {
	const lst = []
	for (const tw of filterTWs) {
		if (excludedTw && tw.id === excludedTw.id) continue
		processTW(tw, values, lst)
	}
	// returning null to represent empty filter value since
	// - tvslst filter bloats the payload and clutters the server log
	// - undefined value would be left out during JSON-encoding of an object-as-data
	return !lst.length
		? null
		: {
				type: 'tvslst',
				in: true,
				join: lst.length > 1 ? 'and' : '',
				lst
		  }
}

function processTW(tw, values, lst) {
	const value = values[tw.term.id]
	if (value !== undefined) {
		if (Array.isArray(value)) {
			const tvs = {
				type: 'tvs',
				tvs: {
					term: tw.term,
					values: []
				}
			}
			for (const item of value) tvs.tvs.values.push({ key: item })
			lst.push(tvs)
		} else
			lst.push({
				type: 'tvs',
				tvs: {
					term: tw.term,
					values: [{ key: value }]
				}
			})
	}
}
