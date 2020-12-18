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

export function sample_match_termvaluesetting(row, filter) {
	const lst = filter.type == 'tvslst' ? filter.lst : [filter]
	let numberofmatchedterms = 0

	/* for AND, require all terms to match */
	for (const item of lst) {
		if (item.type == 'tvslst') {
			if (sample_match_termvaluesetting(row, item)) {
				numberofmatchedterms++
			}
		} else {
			const t = item.tvs
			const samplevalue = row[t.term.id]

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
			} else {
				throw 'unknown term type'
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
