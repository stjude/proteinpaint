import type { Filter, Tvs } from '#types'

/**
 * Sample annotation structure
 */
export interface SampleAnnotation {
	sample: string | number
	s?: Record<string, any>
	data?: Record<string, any>
}

/**
 * Dataset with annotation functionality
 */
export interface Dataset {
	setAnnoByTermId?: (termId: string) => void
}

/**
 * Filters an array of sample annotations and returns a Set of matching sample names
 * @param sampleAnno Array of sample annotations
 * @param filter Nested filter structure as used in the termdbapp
 * @returns Set of sample names that match the filter
 */
export function getFilteredSamples(sampleAnno: SampleAnnotation[], filter: Filter): Set<string | number> {
	setDatasetAnnotations(filter)

	const samples = new Set<string | number>()
	for (const anno of sampleAnno) {
		if (samples.has(anno.sample)) continue
		const data = anno.s || anno.data
		if (data && sample_match_termvaluesetting(data, filter)) {
			samples.add(anno.sample)
		}
	}
	return samples
}

/**
 * Given a value from a sample's annotation of a term, return true if a value matches the filter
 * @param row Sample annotation data
 * @param filter Filter structure or single tvs item
 * @param _term Optional term to filter by
 * @param sample Optional sample data
 * @returns True if the sample matches the filter
 */
export function sample_match_termvaluesetting(
	row: any,
	filter: Filter | any,
	_term: any = null,
	sample: any = null
): boolean {
	const lst = filter.type == 'tvslst' ? filter.lst : [filter]
	let numberofmatchedterms = 0

	/* for AND, require all terms to match */
	for (const item of lst) {
		if ('type' in item && item.type == 'tvslst') {
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
				samplevalue = typeof row === 'object' && t.term.id in row ? row[t.term.id] : row
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
						thistermmatch = samplevalue === range.value
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
						? t.values.find((d: any) => anno.includes(d.key))
						: t.values.find((d: any) => d.key == anno)
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
							(v: any) =>
								v.dt == sv.dt &&
								(!v.origin || sv.origin == v.origin) &&
								(!v.mclasslst || v.mclasslst.includes(sv.class))
						) && true
					if (thistermmatch) break
				}
			} else {
				throw 'unknown term type [sample_match_termvaluesetting() shared/utils/src/filter.ts]'
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
}

/**
 * Recursively processes filter items and sets dataset annotations
 * @param item Filter item to process
 * @param ds Optional dataset with annotation functionality
 */
export function setDatasetAnnotations(item: Filter | { type: 'tvs'; tvs: Tvs }, ds: Dataset | null = null): void {
	if (item.type == 'tvslst') {
		for (const subitem of item.lst) {
			setDatasetAnnotations(subitem, ds)
		}
	} else {
		if (ds && typeof ds.setAnnoByTermId == 'function') {
			ds.setAnnoByTermId(item.tvs.term.id)
		}
		if (item.tvs.term.type == 'categorical') {
			const tvsAny = item.tvs as any
			tvsAny.valueset = new Set(tvsAny.values.map((i: any) => i.key))
		}
	}
}

/**
 * Gets the precomputed key for a condition term based on bar_by and value_by settings
 */
function getPrecomputedKey(q: any): string {
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

/**
 * Joins a list of filters into the first filter with "and", returns joined filter
 * Used by caller app to join hidden filters into a visible filter
 * @param lst List of filters to join
 * @returns The joined filter
 */
export function filterJoin(lst: Filter[]): Filter | undefined {
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

/**
 * Creates a wrapped tvslst (term value settings list) filter object
 * @param lst List of filter items
 * @param join Join operation (and/or)
 * @param $id Optional filter ID
 * @returns Wrapped filter object
 */
export function getWrappedTvslst(lst: Filter['lst'] = [], join: string = '', $id: string | null = null): Filter {
	const filter: Filter = {
		type: 'tvslst',
		in: true,
		join,
		lst
	}
	if ($id !== null) (filter as any).$id = $id
	return filter
}

/**
 * Validates numerator and denominator term collections
 * @param lst1 Numerator list of term ids
 * @param lst2 Denominator list of term ids
 * @throws Error if validation fails
 */
export function validateTermCollectionTvs(lst1: any[], lst2: any[]): void {
	// lst1/lst2: numerator and denominator. both are lists of term ids
	if (!Array.isArray(lst1)) throw new Error('numerator not array')
	if (!Array.isArray(lst2)) throw new Error('denominator not array')
	if (lst1.length == 0) throw new Error('numerator empty')
	if (lst2.length == 0) throw new Error('denominator empty')
	if (lst1.length > lst2.length) throw new Error('numerator longer than denominator')
	for (const s of lst1) {
		if (typeof s != 'string') throw new Error('one of numerator not string')
		if (!s) throw new Error('empty string in numerator')
		if (!lst2.includes(s)) throw new Error('one of numerator not in denominator')
	}
}
