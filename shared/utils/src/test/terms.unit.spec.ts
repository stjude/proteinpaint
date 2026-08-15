import tape from 'tape'
import { DTCNV, DTFUSION, DTITD, DTSNVINDEL, DTSV, TermTypes } from '#types'
import { dtTermTypes, setGroupsetParentTerms, trimGvTermsForSave } from '../terms.js'

/* test sections

dt term types are declared in TermTypes
trimGvTermsForSave()
setGroupsetParentTerms()
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
