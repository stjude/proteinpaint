import { TermTypes } from '#shared/terms.js'
import { dofetch3 } from '../src/client'

/*
to retrieve the termjson object of one term, using its id
only works for a termdb-enabled dataset

if the function is attached to an instance with .state{ dslabel, genome }, then simply call:
	await instance.getterm( ? )

otherwise, do:
	await getterm( id, dslabel, genome )

*/

const cache = { serverData: {} }

/*
	Given data of a sample and a filter, return if the sample match the filter
		row:{} data of a sample
		filter
		geneVariant$ids: [] array of $id of the geneVariant terms (in the matrix)
*/
export function sample_match_termvaluesetting(row, filter, geneVariant$ids) {
	const lst = !filter ? [] : filter.type == 'tvslst' ? filter.lst : [filter]
	let numberofmatchedterms = 0

	/* for AND, require all terms to match */
	for (const item of lst) {
		if (item.type == 'tvslst') {
			if (sample_match_termvaluesetting(row, item)) {
				numberofmatchedterms++
			}
		} else {
			const t = item.tvs
			let samplevalue
			if (t.term.type == 'geneVariant') {
				samplevalue = geneVariant$ids.map(g => row[g]).filter(s => s) // filter out the genes that are not annotated for the sample
			} else if (
				t.term.type == 'integer' ||
				t.term.type == 'float' ||
				t.term.type == TermTypes.GENE_EXPRESSION ||
				t.term.type == TermTypes.METABOLITE_INTENSITY
			) {
				samplevalue = row[t.term.id] || row[t.term.$id]?.key
			} else if (t.term.type == 'survival') {
				samplevalue = row[t.term.$id]?.key
			} else {
				samplevalue = row[t.term.id] || row[t.term.$id]?.value
			}
			let thistermmatch

			if (t.term.type == 'categorical') {
				if (samplevalue === undefined) {
					// this sample has no anno for this term, check isnot
					if (t.isnot) thistermmatch = !thistermmatch
					if (thistermmatch) numberofmatchedterms++
					continue
					// t may be frozen, should not modify to attach valueset if missing
				}
				const valueset = t.valueset ? t.valueset : new Set(t.values.map(i => i.key))
				thistermmatch = valueset.has(samplevalue)
			} else if (
				t.term.type == 'integer' ||
				t.term.type == 'float' ||
				t.term.type == TermTypes.GENE_EXPRESSION ||
				t.term.type == TermTypes.METABOLITE_INTENSITY
			) {
				if (samplevalue === undefined) {
					// this sample has no anno for this term, check isnot
					if (t.isnot) thistermmatch = !thistermmatch
					if (thistermmatch) numberofmatchedterms++
					continue
				}

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
			} else if (t.term.type == 'survival') {
				if (samplevalue === undefined) {
					// this sample has no anno for this term, check isnot
					if (t.isnot) thistermmatch = !thistermmatch
					if (thistermmatch) numberofmatchedterms++
					continue
					// t may be frozen, should not modify to attach valueset if missing
				}
				const valueset = t.valueset ? t.valueset : new Set(t.values.map(i => i.key))
				thistermmatch = valueset.has(samplevalue)
			} else if (t.term.type == 'geneVariant' && t.legendFilterType == 'geneVariant_hard') {
				// handle a matrix legend hard filter
				// values: [{ dt, origin, mclasslst:[key] }]
				const f = t.values[0] //matrix geneVariant legend filter only has one item in tvs.values
				thistermmatch =
					samplevalue.find(s => {
						for (const v of s.values) {
							if (v.dt == f.dt && (!v.origin || v.origin == f.origin) && f.mclasslst.includes(v.class)) return true
						}
					}) && true
			} else if (t.term.type == TermTypes.SINGLECELL_GENE_EXPRESSION) {
			} else {
				throw 'unknown term type'
			}

			if (t.isnot) {
				thistermmatch = !thistermmatch
			}
			if (thistermmatch) numberofmatchedterms++
		}

		// if one tvslst is matched with an "or" (Set UNION), then sample is okay
		if (filter.join == 'or' && numberofmatchedterms) return true
	}

	// for join="and" (Set intersection)
	if (numberofmatchedterms == lst.length) return true
}
