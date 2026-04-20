function getFilteredSamples(sampleAnno, filter) {
	setDatasetAnnotations(filter)
	const samples = /* @__PURE__ */ new Set()
	for (const anno of sampleAnno) {
		if (samples.has(anno.sample)) continue
		const data = anno.s || anno.data
		if (data && sample_match_termvaluesetting(data, filter)) {
			samples.add(anno.sample)
		}
	}
	return samples
}
function sample_match_termvaluesetting(
	row,
	filter,
	_term = null,
	sample = null
) {
	const lst = filter.type == "tvslst" ? filter.lst : [filter]
	let numberofmatchedterms = 0
	for (const item of lst) {
		if ("type" in item && item.type == "tvslst") {
			if (sample_match_termvaluesetting(row, item, _term, sample)) {
				numberofmatchedterms++
			}
		} else {
			const itemCopy = JSON.parse(JSON.stringify(item))
			const t = itemCopy.tvs
			if (_term && t.term) {
				if (!(_term.name == t.term.name && _term.type == t.term.type)) {
					numberofmatchedterms++
					continue
				}
			}
			let samplevalue
			if (_term && !t.term) {
				if (t.term$type && t.term$type !== _term.type) {
					numberofmatchedterms++
					continue
				}
				t.term = _term
				samplevalue =
					typeof row === "object" && t.term.id in row ? row[t.term.id] : row
			} else if (sample && t.term.$id) {
				samplevalue = sample[t.term.$id].value
			} else {
				samplevalue = t.term.id in row ? row[t.term.id] : row
			}
			setDatasetAnnotations(itemCopy)
			let thistermmatch
			if (t.term.type == "categorical") {
				if (samplevalue === void 0) continue
				thistermmatch = t.valueset.has(samplevalue)
			} else if (t.term.type == "integer" || t.term.type == "float") {
				if (samplevalue === void 0) continue
				for (const range of t.ranges) {
					if ("value" in range) {
						thistermmatch = samplevalue === range.value
						if (thistermmatch) break
					} else if (samplevalue == range.name) {
						thistermmatch = true
						break
					} else {
						if (t.term.values) {
							const v = t.term.values[samplevalue.toString()]
							if (v && v.uncomputable) {
								continue
							}
						}
						let left, right
						if (range.startunbounded) {
							left = true
						} else if ("start" in range) {
							if (range.startinclusive) {
								left = samplevalue >= range.start
							} else {
								left = samplevalue > range.start
							}
						}
						if (range.stopunbounded) {
							right = true
						} else if ("stop" in range) {
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
			} else if (t.term.type == "condition") {
				const key = getPrecomputedKey(t)
				const anno = samplevalue && samplevalue[key]
				if (anno) {
					thistermmatch = Array.isArray(anno)
						? t.values.find((d) => anno.includes(d.key))
						: t.values.find((d) => d.key == anno)
				}
			} else if (t.term.type == "geneVariant") {
				const svalues = samplevalue.values || [samplevalue]
				for (const sv of svalues) {
					thistermmatch =
						t.values.find(
							(v) =>
								v.dt == sv.dt &&
								(!v.origin || sv.origin == v.origin) &&
								(!v.mclasslst || v.mclasslst.includes(sv.class))
						) && true
					if (thistermmatch) break
				}
			} else {
				throw "unknown term type [sample_match_termvaluesetting() shared/utils/src/filter.ts]"
			}
			if (t.isnot) {
				thistermmatch = !thistermmatch
			}
			if (thistermmatch) numberofmatchedterms++
		}
		if (filter.join == "or") {
			if (numberofmatchedterms && filter.in) return true
			if (!numberofmatchedterms && !filter.in) return true
		}
	}
	if (!("in" in filter)) filter.in = true
	return filter.in == (numberofmatchedterms == lst.length)
}
function setDatasetAnnotations(item, ds = null) {
	if (item.type == "tvslst") {
		for (const subitem of item.lst) {
			setDatasetAnnotations(subitem, ds)
		}
	} else {
		if (ds && typeof ds.setAnnoByTermId == "function") {
			ds.setAnnoByTermId(item.tvs.term.id)
		}
		if (item.tvs.term.type == "categorical") {
			const tvsAny = item.tvs
			tvsAny.valueset = new Set(tvsAny.values.map((i) => i.key))
		}
	}
}
function getPrecomputedKey(q) {
	const precomputedKey =
		q.bar_by_children && q.value_by_max_grade
			? "childrenAtMaxGrade"
			: q.bar_by_children && q.value_by_most_recent
			? "childrenAtMostRecent"
			: q.bar_by_children && q.value_by_computable_grade
			? "children"
			: q.bar_by_grade && q.value_by_max_grade
			? "maxGrade"
			: q.bar_by_grade && q.value_by_most_recent
			? "mostRecentGrades"
			: q.bar_by_grade && q.value_by_computable_grade
			? "computableGrades"
			: ""
	if (!precomputedKey) throw `unknown condition term bar_by_* and/or value_by_*`
	return precomputedKey
}
function filterJoin(lst) {
	if (!lst || lst.length == 0) return
	let f = JSON.parse(JSON.stringify(lst[0]))
	if (lst.length == 1) return f
	if (f.lst.length < 2) {
		if (f.join !== "")
			throw 'filter.join must be an empty string "" when filter.lst.length < 2'
		f.join = "and"
	} else if (f.join == "or") {
		f = {
			type: "tvslst",
			join: "and",
			in: true,
			lst: [f],
		}
	} else if (f.join != "and") {
		throw 'filter.join must be either "and" or "or" when .lst length > 1'
	}
	for (let i = 1; i < lst.length; i++) {
		const f2 = JSON.parse(JSON.stringify(lst[i]))
		if (f2.join == "or") f.lst.push(f2)
		else f.lst.push(...f2.lst)
	}
	if (f.lst.length == 1 && f.lst[0].type == "tvs") {
		f.join = ""
	}
	return f
}
function getWrappedTvslst(lst = [], join = "", $id = null) {
	const filter = {
		type: "tvslst",
		in: true,
		join,
		lst,
	}
	if ($id !== null) filter.$id = $id
	return filter
}
function validateTermCollectionTvs(lst1, lst2) {
	if (!Array.isArray(lst1)) throw new Error("numerator not array")
	if (!Array.isArray(lst2)) throw new Error("denominator not array")
	if (lst1.length == 0) throw new Error("numerator empty")
	if (lst2.length == 0) throw new Error("denominator empty")
	if (lst1.length > lst2.length)
		throw new Error("numerator longer than denominator")
	for (const s of lst1) {
		if (typeof s != "string") throw new Error("one of numerator not string")
		if (!s) throw new Error("empty string in numerator")
		if (!lst2.includes(s))
			throw new Error("one of numerator not in denominator")
	}
}
export {
	filterJoin,
	getFilteredSamples,
	getWrappedTvslst,
	sample_match_termvaluesetting,
	setDatasetAnnotations,
	validateTermCollectionTvs,
}
