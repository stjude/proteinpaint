import tape from 'tape'
import { DTCNV, DTFUSION, DTITD, DTSNVINDEL, DTSV, TermTypes } from '#types'
import {
	dtTermTypes,
	getGvQueryKey,
	internGvQueryEntry,
	restoreGvQueryEntry,
	setGroupsetParentTerms,
	trimGvTermsForSave
} from '../terms.js'

/* test sections

dt term types are declared in TermTypes
trimGvTermsForSave()
setGroupsetParentTerms()
query entry wire format: round trip
query entry wire format: values without an entry
*/

// a filled-in geneVariant tw, reduced to the properties the trim reads
function getFilledGvTw() {
	const parentTerm = {
		type: 'geneVariant',
		id: 'TP53',
		name: 'TP53',
		genes: [{ kind: 'gene', id: 'TP53', gene: 'TP53', name: 'TP53', type: 'geneVariant' }]
	}
	const dtTerm = {
		id: 'snvindel_somatic',
		name: 'SNV/indel (somatic)',
		type: 'dtsnvindel',
		dt: DTSNVINDEL,
		origin: 'somatic',
		values: { M: { key: 'M', label: 'MISSENSE' } },
		parentTerm: structuredClone(parentTerm)
	}
	return {
		isAtomic: true,
		type: 'GvPredefinedGsTW',
		$id: 'TwBase_0',
		term: {
			...structuredClone(parentTerm),
			childTerms: [dtTerm],
			groupsetting: {
				disabled: false,
				lst: [
					{
						name: 'SNV/indel (somatic)',
						dt: DTSNVINDEL,
						origin: 'somatic',
						groups: [
							{
								name: 'TP53 SNV/indel Mutated (somatic)',
								type: 'filter',
								filter: {
									type: 'tvslst',
									in: true,
									join: '',
									lst: [{ type: 'tvs', tvs: { term: dtTerm, values: [] } }]
								}
							}
						]
					},
					{ name: 'CNV', dt: DTCNV }
				]
			}
		},
		q: {
			type: 'predefined-groupset',
			predefined_groupset_idx: 0,
			isAtomic: true,
			dtLst: [DTSNVINDEL],
			hiddenValues: {}
		}
	}
}

tape('\n', function (test) {
	test.comment('-***- terms specs -***-')
	test.end()
})

tape('dt term types are declared in TermTypes', t => {
	// TermTypes must list every dt term type at declaration, instead of being filled in at runtime from dtTerms[],
	// so that consumers importing TermTypes from '#types' see the same keys regardless of module load order
	t.deepEqual(
		[...dtTermTypes].sort(),
		[DTCNV, DTFUSION, DTITD, DTSNVINDEL, DTSV].sort(),
		'the dt term types in dtTerms[] match the DT* constants'
	)
	const termTypeValues = new Set(Object.values(TermTypes))
	for (const dtTermType of dtTermTypes) {
		t.ok(termTypeValues.has(dtTermType), `TermTypes has an entry for '${dtTermType}'`)
	}
	t.end()
})

tape('trimGvTermsForSave()', t => {
	const state = { plots: [{ chartType: 'summary', term: getFilledGvTw() }] }
	trimGvTermsForSave(state)
	const tw = state.plots[0].term

	t.equal(tw.term.childTerms, undefined, 'should remove term.childTerms[]')
	t.equal(tw.term.groupsetting, undefined, 'should remove term.groupsetting')
	t.deepEqual(
		tw.term.genes,
		[{ kind: 'gene', id: 'TP53', gene: 'TP53', name: 'TP53', type: 'geneVariant' }],
		'should keep term.genes[], which fill() cannot rebuild'
	)
	t.deepEqual(
		tw.q,
		{ type: 'predefined-groupset', predefined_groupset_idx: 0, isAtomic: true, dtLst: [DTSNVINDEL], hiddenValues: {} },
		'should not touch q, which carries the groupset selection'
	)
	t.equal(tw.$id, 'TwBase_0', 'should keep tw.$id')
	t.end()
})

tape('trimGvTermsForSave(): terms it must not trim', t => {
	// a custom groupset is user-authored and no fill() rebuilds it
	const customTw: any = getFilledGvTw()
	const dtTerm = customTw.term.childTerms[0]
	customTw.q = {
		type: 'custom-groupset',
		customset: {
			groups: [
				{
					name: 'my group',
					type: 'filter',
					filter: { type: 'tvslst', in: true, join: '', lst: [{ type: 'tvs', tvs: { term: dtTerm, values: [] } }] }
				}
			]
		}
	}
	// a tvs holds a term{} without a q{}, and its dt term needs the parentTerm that
	// get_dtTerm() reads in server/src/termdb.filter.js
	const filterTvs = { type: 'tvs', tvs: { term: structuredClone(dtTerm), values: [] } }
	const state = { plots: [{ chartType: 'summary', term: customTw }], termfilter: { filter: { lst: [filterTvs] } } }
	trimGvTermsForSave(state)

	t.ok(state.plots[0].term.q.customset.groups.length, 'should keep q.customset of a custom groupset')
	t.equal(
		state.plots[0].term.q.customset.groups[0].filter.lst[0].tvs.term.parentTerm,
		undefined,
		'should drop the parentTerm of a customset tvs term, which GvCustomGS.fill() re-attaches'
	)
	t.ok(state.termfilter.filter.lst[0].tvs.term.parentTerm, 'should keep the parentTerm of a filter tvs term')
	t.end()
})

tape('setGroupsetParentTerms()', t => {
	const tw: any = getFilledGvTw()
	// a customset built against another term, as a termsetting instance reused across
	// terms produces (see makeGroupUI() in client/termsetting/handlers/geneVariant.ts)
	const staleTerm = { type: 'geneVariant', id: 'KRAS', name: 'KRAS', genes: [{ kind: 'gene', gene: 'KRAS' }] }
	/* a snvindel tvs of a dataset with a maf filter nests a tvs of its own, over a maf term
	rather than a dt term. it is not part of the groupset structure and must be left alone,
	see getNonCnvGroupset() in client/tw/geneVariant.ts */
	const mafFilter = {
		type: 'tvslst',
		join: '',
		in: true,
		lst: [{ type: 'tvs', tvs: { term: { id: 'AD', type: 'float' }, ranges: [{ start: 0.6 }] } }]
	}
	const tvs1: any = { term: { type: 'dtsnvindel', dt: DTSNVINDEL, parentTerm: staleTerm }, values: [], mafFilter }
	const tvs2: any = { term: { type: 'dtcnv', dt: DTCNV }, values: [] }
	const customset = {
		groups: [
			{ name: 'g1', type: 'filter', filter: { type: 'tvslst', in: true, join: '', lst: [{ type: 'tvs', tvs: tvs1 }] } },
			{
				name: 'g2',
				type: 'filter',
				filter: {
					type: 'tvslst',
					in: true,
					join: 'or',
					// a tvs nested in a sublist must be reached too
					lst: [{ type: 'tvslst', in: true, join: '', lst: [{ type: 'tvs', tvs: tvs2 }] }]
				}
			}
		]
	}
	setGroupsetParentTerms(customset, tw.term)

	t.equal(tvs1.term.parentTerm.name, 'TP53', 'should replace a parentTerm of another term')
	t.equal(tvs2.term.parentTerm.name, 'TP53', 'should attach a parentTerm to a tvs of a sublist')
	t.equal(tvs1.term.parentTerm.childTerms, undefined, 'should not nest childTerms[] in the parentTerm')
	t.equal(tvs1.term.parentTerm.groupsetting, undefined, 'should not nest groupsetting in the parentTerm')
	t.equal(tvs1.term.parentTerm, tvs2.term.parentTerm, 'should share one parentTerm across the tvs')
	t.notEqual(tvs1.term.parentTerm, tw.term, 'should attach a copy, not the term itself')
	t.equal(
		tvs1.mafFilter.lst[0].tvs.term.parentTerm,
		undefined,
		'should not reach the tvs of a maf filter nested in a tvs'
	)

	const notDt = {
		groups: [
			{
				name: 'g',
				type: 'filter',
				filter: {
					type: 'tvslst',
					in: true,
					join: '',
					lst: [{ type: 'tvs', tvs: { term: { id: 'sex', type: 'categorical' }, values: [] } }]
				}
			}
		]
	}
	t.throws(
		() => setGroupsetParentTerms(notDt, tw.term),
		/not a dt term/,
		'should throw on a groupset tvs that does not filter by dt'
	)
	t.end()
})

tape('trimGvTermsForSave(): leaves other term types alone', t => {
	const state = {
		plots: [
			{ term: { term: { id: 'sex', type: 'categorical', values: { 1: { label: 'M' } } }, q: { type: 'values' } } }
		]
	}
	const copy = structuredClone(state)
	trimGvTermsForSave(state)
	t.deepEqual(state, copy, 'should not modify a non-geneVariant tw')
	t.end()
})

/* The geneVariant query entry is stripped from every value on the way out of
termdb.get_matrix.js and put back on the way in by TermdbVocab.js. The two halves are
exercised together here, over a term holding BOTH gene and coordinate entries, which is
what distinguishes the format from the single-gene-per-term keying it replaced. */

// values of a term over KRAS, NRAS and a region, as mayGetGeneVariantData() emits them
function getMixedValues() {
	const kras = { chr: 'chr12', start: 25205245, stop: 25250928 }
	const nras = { chr: 'chr1', start: 114704468, stop: 114716770 }
	const tal1 = { chr: 'chr1', start: 47213990, stop: 47318918 }
	return [
		{ dt: DTSNVINDEL, class: 'M', mname: 'G12D', gene: 'KRAS', region: { ...kras } },
		{ dt: DTCNV, class: 'CNV_loss', value: -0.4, start: 25200000, stop: 25260000, gene: 'KRAS', region: { ...kras } },
		{ dt: DTSNVINDEL, class: 'M', mname: 'G12D', gene: 'NRAS', region: { ...nras } },
		// a coord entry has no gene at all, which is the case the old keying could not carry
		{ dt: DTCNV, class: 'CNV_loss', value: -0.6, start: 47220000, stop: 47230000, region: { ...tal1 } },
		{ dt: DTSNVINDEL, class: 'insertion', region: { ...tal1 } },
		// a second value of an entry already seen must reuse its index, not add one
		{ dt: DTSNVINDEL, class: 'M', mname: 'G12V', gene: 'KRAS', region: { ...kras } }
	]
}

tape('query entry wire format: round trip', t => {
	const original = getMixedValues()
	const values = structuredClone(original)

	// --- server half, as termdb.get_matrix.js applies it
	const queries: any[] = []
	const idxByKey = new Map()
	const interned = values.map(v => internGvQueryEntry(v, queries, idxByKey))

	t.ok(interned.every(Boolean), 'should intern every value that records a query entry')
	t.deepEqual(
		queries,
		[
			{ gene: 'KRAS', region: { chr: 'chr12', start: 25205245, stop: 25250928 } },
			{ gene: 'NRAS', region: { chr: 'chr1', start: 114704468, stop: 114716770 } },
			{ region: { chr: 'chr1', start: 47213990, stop: 47318918 } }
		],
		'should collect one entry per distinct gene or region, in first-seen order'
	)
	t.deepEqual(
		values.map(v => v.$q),
		// KRAS, KRAS, NRAS, region, region, KRAS
		[0, 0, 1, 2, 2, 0],
		'should index each value to its own entry, reusing an index already seen'
	)
	t.ok(
		values.every(v => !('gene' in v) && !('region' in v)),
		'should strip the query entry from every value'
	)

	// --- client half, as TermdbVocab.js applies it
	const restored = values.map(v => restoreGvQueryEntry(v, queries))
	t.ok(restored.every(Boolean), 'should restore every interned value')
	t.ok(
		values.every(v => !('$q' in v)),
		'should leave no index behind'
	)
	t.deepEqual(values, original, 'should round trip to exactly the values the server produced')

	// the region objects are shared with queries[] after a restore, so a term over one
	// region no longer pays for a copy per value
	t.equal(values[3].region, values[4].region, 'values of one entry should share its region object')
	t.end()
})

tape('query entry wire format: values without an entry', t => {
	// a non-geneVariant term's values record no query entry and must pass through untouched
	const values: any[] = [
		{ key: 'F', value: 1 },
		{ key: 'M', value: 2 }
	]
	const before = structuredClone(values)
	const queries: any[] = []
	const idxByKey = new Map()

	t.equal(values.map(v => internGvQueryEntry(v, queries, idxByKey)).filter(Boolean).length, 0, 'should intern nothing')
	t.equal(queries.length, 0, 'should not create a queries[] entry')
	t.deepEqual(values, before, 'should leave the values untouched')

	t.equal(restoreGvQueryEntry(values[0], queries), false, 'should restore nothing')
	t.equal(restoreGvQueryEntry({ $q: 0 }, undefined), false, 'should restore nothing without queries[]')
	t.equal(getGvQueryKey({}), '', 'a value with no entry has no key')
	t.end()
})
