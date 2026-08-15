import tape from 'tape'
import { DTCNV, DTFUSION, DTITD, DTSNVINDEL, DTSV, TermTypes } from '#types'
import { dtTermTypes, trimGvTermsForSave } from '../terms.js'

/* test sections

dt term types are declared in TermTypes
trimGvTermsForSave()
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
	t.ok(
		state.plots[0].term.q.customset.groups[0].filter.lst[0].tvs.term.parentTerm,
		'should keep the parentTerm of a customset tvs term'
	)
	t.ok(state.termfilter.filter.lst[0].tvs.term.parentTerm, 'should keep the parentTerm of a filter tvs term')
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
