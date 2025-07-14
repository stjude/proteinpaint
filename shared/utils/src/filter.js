/*
	sampleAnno[anno{}] array of sample annotations
		anno.sample 
			- string or number sample name
		
		anno.s || anno.data
			- the annotation object {[key1]: value1, ...}
		
	filter: nested filter structure as used in the termdbapp, see docs
*/
export function getFilteredSamples(sampleAnno, filter) {
	setDatasetAnnotations(filter)

	const samples = new Set()
	for (const anno of sampleAnno) {
		if (samples.has(anno.sample)) continue
		const data = anno.s || anno.data
		if (data && sample_match_termvaluesetting(data, filter)) {
			samples.add(anno.sample)
		}
	}
	return samples // return as a Set, or maybe as an array later
}

/*
given a value from a sample's anno of a term, return true if a value matches the filter
*/
export function sample_match_termvaluesetting(row, filter, _term = null, sample = null) {
	const lst = filter.type == 'tvslst' ? filter.lst : [filter]
	let numberofmatchedterms = 0

	/* for AND, require all terms to match */
	for (const item of lst) {
		if (item.type == 'tvslst') {
			if (sample_match_termvaluesetting(row, item, _term, sample)) {
				numberofmatchedterms++
			}
		} else {
			const itemCopy = JSON.parse(JSON.stringify(item))
			const t = itemCopy.tvs

			if (_term && t.term) {
				if (!(_term.name == t.term.name && _term.type == t.term.type)) {
					// for an filter from "this.config.legendValueFilter", if the filter is not for the tw
					// (not the same type and name), ignore the filter.
					numberofmatchedterms++
					continue
				}
			}

			let samplevalue
			if (_term && !t.term) {
				if (t.term$type && t.term$type !== _term.type) {
					//when the filter is not for the term being tested, ignore the filter
					numberofmatchedterms++
					continue
				}
				t.term = _term
				samplevalue = typeof row === 'object' && t.term.id in row ? row[t.term.id] : row //'tumorWES'
			} else if (sample && t.term.$id) {
				samplevalue = sample[t.term.$id].value
			} else {
				samplevalue = t.term.id in row ? row[t.term.id] : row
			}
			setDatasetAnnotations(itemCopy)
			let thistermmatch

			if (t.term.type == 'categorical') {
				if (samplevalue === undefined) continue // this sample has no anno for this term, do not count
				thistermmatch = t.valueset.has(samplevalue)
			} else if (t.term.type == 'integer' || t.term.type == 'float') {
				if (samplevalue === undefined) continue // this sample has no anno for this term, do not count
				for (const range of t.ranges) {
					if ('value' in range) {
						thistermmatch = samplevalue === range.value // || ""+samplevalue == range.value || samplevalue == ""+range.value //; if (thistermmatch) console.log(i++)
						if (thistermmatch) break
					} else if (samplevalue == range.name) {
						thistermmatch = true
						break
					} else {
						// actual range
						if (t.term.values) {
							const v = t.term.values[samplevalue.toString()]
							if (v && v.uncomputable) {
								continue
							}
						}
						let left, right
						if (range.startunbounded) {
							left = true
						} else if ('start' in range) {
							if (range.startinclusive) {
								left = samplevalue >= range.start
							} else {
								left = samplevalue > range.start
							}
						}
						if (range.stopunbounded) {
							right = true
						} else if ('stop' in range) {
							if (range.stopinclusive) {
								right = samplevalue <= range.stop
							} else {
								right = samplevalue < range.stop
							}
						}
						thistermmatch = left && right
					}
					if (thistermmatch) break
				}
			} else if (t.term.type == 'condition') {
				const key = getPrecomputedKey(t)
				const anno = samplevalue && samplevalue[key]
				if (anno) {
					thistermmatch = Array.isArray(anno)
						? t.values.find(d => anno.includes(d.key))
						: t.values.find(d => d.key == anno)
				}
			} else if (t.term.type == 'geneVariant') {
				/*
				samplevalue.values here can be an array or only one of the entries 
				[
					{ dt: 1, class: 'WT', _SAMPLEID_: 21, origin: 'germline' },
					{ dt: 1, class: 'WT', _SAMPLEID_: 21, origin: 'somatic' },
					{ dt: 2, class: 'Blank', _SAMPLEID_: 21 },
					{ dt: 4, class: 'WT', _SAMPLEID_: 21 }
				]
				*/
				/* tvs.values is an array that stores classes (for each available dt) that have/haven't been crossed out by the user at this round of edit-and-apply, e.g.
          [
            {dt: 1, mclassLst: ['WT'], mclassExcludeLst: ['Blank'], origin: 'germline'}
            {dt: 1, mclassLst: ['Blank', 'WT', 'M'], mclassExcludeLst:[], origin:'somatic'},
            {dt: 2, mclassLst: ['Blank', 'WT'], mclassExcludeLst:[]}
            {dt: 4, mclassLst: ['WT', 'CNV_loss'], mclassExcludeLst:[]}
          ]
        */
				const svalues = samplevalue.values || [samplevalue]
				for (const sv of svalues) {
					thistermmatch =
						t.values.find(
							v =>
								v.dt == sv.dt &&
								(!v.origin || sv.origin == v.origin) &&
								(!v.mclasslst || v.mclasslst.includes(sv.class))
						) && true //; console.log(114, t.values[0].dt, samplevalue.dt, thistermmatch)
				}
			} else {
				throw 'unknown term type [sample_match_termvaluesetting() shared/utils/src/filter.js]'
			}

			if (t.isnot) {
				thistermmatch = !thistermmatch
			}
			if (thistermmatch) numberofmatchedterms++
		}

		// if one tvslst is matched with an "or" (Set UNION), then sample is okay
		if (filter.join == 'or') {
			if (numberofmatchedterms && filter.in) return true
			if (!numberofmatchedterms && !filter.in) return true
		}
	}
	// for join="and" (Set intersection)
	if (!('in' in filter)) filter.in = true
	return filter.in == (numberofmatchedterms == lst.length)
	// if (filter.in && numberofmatchedterms == lst.length) return true
	// if (!filter.in && numberofmatchedterms != lst.length) return true
}

export function setDatasetAnnotations(item, ds = null) {
	if (item.type == 'tvslst') {
		for (const subitem of item.lst) {
			setDatasetAnnotations(subitem, ds)
		}
	} else {
		if (ds && typeof ds.setAnnoByTermId == 'function') {
			ds.setAnnoByTermId(item.tvs.term.id)
		}
		if (item.tvs.term.type == 'categorical') {
			item.tvs.valueset = new Set(item.tvs.values.map(i => i.key))
		}
	}
}

function getPrecomputedKey(q) {
	const precomputedKey =
		q.bar_by_children && q.value_by_max_grade
			? 'childrenAtMaxGrade'
			: q.bar_by_children && q.value_by_most_recent
			? 'childrenAtMostRecent'
			: q.bar_by_children && q.value_by_computable_grade
			? 'children'
			: q.bar_by_grade && q.value_by_max_grade
			? 'maxGrade'
			: q.bar_by_grade && q.value_by_most_recent
			? 'mostRecentGrades'
			: q.bar_by_grade && q.value_by_computable_grade
			? 'computableGrades'
			: ''
	if (!precomputedKey) throw `unknown condition term bar_by_* and/or value_by_*`
	return precomputedKey
}

/* join a list of filters into the first filter with "and", return joined filter
to be used by caller app to join hidden filters into a visible filter

lst:[]
  a list of filters
  the function returns a (modified) copy of the first filter, and will not modify it
  rest of the array will be joined to the first one under "and"
*/
export function filterJoin(lst) {
	if (!lst || lst.length == 0) return
	let f = JSON.parse(JSON.stringify(lst[0]))
	if (lst.length == 1) return f
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
	return f
}

export function getWrappedTvslst(lst = [], join = '', $id = null) {
	const filter = {
		type: 'tvslst',
		in: true,
		join,
		lst
	}
	if ($id !== null && filter.$id !== undefined) filter.$id = $id
	return filter
}
/*
This function is used where ever you need to build a group of categorical filters related.
 It builds the filter needed to retrieve a term values after filtering out samples according to the other filters provided.
 The profile filters, for example, use this function to get the filters needed to call filterTermValues, that populate the dropdowns in the controls.
 If no tw is provided it returns a filter that is the combination of all the categorical filters provided in the filterTWs array.
 Input:
 - filterTWs: list of term wrappers (tw) that are used to filter the samples
 - values: an object with term ids as keys and the values to filter by
 - tw: The term wrapper for which the filter is being built. If provided, it will be excluded from the filter.
 - globalFilter: an optional filter that will be joined with the generated filter
 Output:
 - a filter object that can be used to filter term values based on the provided term wrappers and values.
*/
export function getCategoricalTermFilter(filterTWs, values, tw, globalFilter) {
	const excluded = []
	if (tw) excluded.push(tw.term.id)
	const lst = []
	for (const tw of filterTWs) processTW(tw, values, excluded, lst)

	let filter = {
		type: 'tvslst',
		in: true,
		join: lst.length > 1 ? 'and' : '',
		lst
	}
	if (globalFilter?.lst.length > 0) filter = filterJoin([globalFilter, filter])
	return filter

	function processTW(tw, values, excluded, lst) {
		const value = values[tw.term.id]
		if (value && !excluded.includes(tw.term.id))
			lst.push({
				type: 'tvs',
				tvs: {
					term: tw.term,
					values: [{ key: value }]
				}
			})
	}
}
