import tape from 'tape'
import { divideTerms } from '../termdb.matrix.js'
import { init } from './load.testds.js'
import { server_init_db_queries } from '../termdb.server.init.ts'

/*
test sections:

divideTerms: sorts terms by type
divideTerms: assigns $id if missing
divideTerms: assigns $id from term.name if id missing
divideTerms: drops role-restricted dict terms via isTermVisible
divideTerms: shorthand dict terms (no type, just id) are also gated by isTermVisible
divideTerms: q.__protected__ is forwarded to the isTermVisible hook
divideTerms: termCollection visibility decided by member ids
*/

tape('\n', function (test) {
	test.comment('-***- modules/termdb.matrix specs -***-')
	test.end()
})

const emptyDs = { cohort: { termdb: {} } }

tape('divideTerms: sorts terms by type', t => {
	const dictTerm = { term: { type: 'categorical', id: 'd1' } }
	const dictTerm2 = { term: { type: 'float', id: 'd1' } }
	const geneVariantTerm = { term: { type: 'geneVariant', id: 'g1' } }
	const nonDictTerm = { term: { type: 'geneExpression', id: 'n1' } }
	const unknownTypeTerm = { term: { id: 'u1' } }
	const noTerm = {}

	const q = {
		terms: [dictTerm, dictTerm2, geneVariantTerm, nonDictTerm, unknownTypeTerm, noTerm]
	}
	const [dict, geneVariant, nonDict] = divideTerms(q, emptyDs)

	t.deepEqual(dict, [dictTerm, dictTerm2, unknownTypeTerm], 'Dictionary terms and terms with only id go to dict')
	t.deepEqual(geneVariant, [geneVariantTerm], 'Gene variant terms go to geneVariantTws')
	t.deepEqual(nonDict, [nonDictTerm, noTerm], 'Non-dictionary and unknown terms go to nonDict')
	t.end()
})

tape('divideTerms: assigns $id if missing', t => {
	const term = { term: { type: 'dict', id: 'd2' } }
	const [dict] = divideTerms({ terms: [term] }, emptyDs)
	t.equal(dict[0].$id, 'd2', 'Should assign $id from term.id')
	t.end()
})

tape('divideTerms: assigns $id from term.name if id missing', t => {
	const term = { term: { type: 'dict', name: 'foo' } }
	const [dict] = divideTerms({ terms: [term] }, emptyDs)
	t.equal(dict[0].$id, 'foo', 'Should assign $id from term.name if id missing')
	t.end()
})

tape('divideTerms: drops role-restricted dict terms via isTermVisible', t => {
	const visible = { term: { type: 'categorical', id: 'ok' } }
	const hidden = { term: { type: 'categorical', id: 'blocked' } }
	const ds = {
		cohort: {
			termdb: {
				isTermVisible(_clientAuth, id) {
					return id !== 'blocked'
				}
			}
		}
	}
	const q = { terms: [visible, hidden], __protected__: { clientAuthResult: { role: 'public' } } }
	const [dict] = divideTerms(q, ds)
	t.deepEqual(dict, [visible], 'Only terms passing isTermVisible reach the dict list')
	t.end()
})

tape('divideTerms: shorthand dict terms (no type, just id) are also gated by isTermVisible', t => {
	// Covers the `else if (tw.term?.id)` branch — terms posted without an explicit type
	// fall back to the dict list, and that fallback must run through the same role gate.
	const shorthandVisible = { term: { id: 'ok' } }
	const shorthandHidden = { term: { id: 'blocked' } }
	const ds = {
		cohort: {
			termdb: {
				isTermVisible(_clientAuth, id) {
					return id !== 'blocked'
				}
			}
		}
	}
	const q = {
		terms: [shorthandVisible, shorthandHidden],
		__protected__: { clientAuthResult: { role: 'public' } }
	}
	const [dict, , nonDict] = divideTerms(q, ds)
	t.deepEqual(dict, [shorthandVisible], 'Visible shorthand term reaches dict')
	t.deepEqual(nonDict, [], 'Hidden shorthand term is dropped, not redirected to nonDict')
	t.end()
})

tape('divideTerms: q.__protected__ is forwarded to the isTermVisible hook', t => {
	// Locks in the call convention: the hook receives the full __protected__ payload
	// (clientAuthResult, activeCohort, ignoredTermIds), not just clientAuthResult, so
	// cohort-aware datasets like profile can destructure activeCohort.
	let receivedAuth
	const ds = {
		cohort: {
			termdb: {
				isTermVisible(auth, _id) {
					receivedAuth = auth
					return true
				}
			}
		}
	}
	const expectedAuth = { clientAuthResult: { role: 'public' }, activeCohort: 'full' }
	divideTerms({ terms: [{ term: { type: 'categorical', id: 'x' } }], __protected__: expectedAuth }, ds)
	t.equal(receivedAuth, expectedAuth, 'Hook called with q.__protected__ object by reference')
	t.end()
})

/*
termCollection terms have no scalar .id — they're identified by .name + .termIds[].
Previous behavior called isTermVisible(undefined) and silently dropped the collection
for any role consulting an allowlist. The fix decides visibility from the members
instead: visible iff every member id is visible to the role.
*/
function buildRestrictedDs(allowlist) {
	const allow = new Set(allowlist)
	return {
		cohort: {
			termdb: {
				isTermVisible(_auth, id) {
					return allow.has(id)
				}
			}
		}
	}
}

tape('divideTerms: termCollection visible when every member id is visible', t => {
	const collection = {
		term: {
			type: 'termCollection',
			name: 'Yes/No flags',
			termIds: ['A', 'B', 'C']
		}
	}
	const ds = buildRestrictedDs(['A', 'B', 'C'])
	const [dict] = divideTerms({ terms: [collection], __protected__: { clientAuthResult: { role: 'public' } } }, ds)
	t.deepEqual(dict, [collection], 'termCollection passes through to dict when all members are visible')
	t.end()
})

tape('divideTerms: termCollection dropped when any member id is not visible', t => {
	const collection = {
		term: {
			type: 'termCollection',
			name: 'Yes/No flags',
			termIds: ['A', 'B', 'C']
		}
	}
	// 'C' is missing from the allowlist
	const ds = buildRestrictedDs(['A', 'B'])
	const [dict] = divideTerms({ terms: [collection], __protected__: { clientAuthResult: { role: 'public' } } }, ds)
	t.deepEqual(dict, [], 'termCollection is dropped when any member is not visible')
	t.end()
})

tape('divideTerms: termCollection falls back to termlst[].id when termIds is absent', t => {
	const collection = {
		term: {
			type: 'termCollection',
			name: 'From termlst',
			termlst: [{ id: 'A' }, { id: 'B' }]
		}
	}
	const ds = buildRestrictedDs(['A', 'B'])
	const [dict] = divideTerms({ terms: [collection], __protected__: { clientAuthResult: { role: 'public' } } }, ds)
	t.deepEqual(dict, [collection], 'termCollection uses termlst[].id when termIds is missing')
	t.end()
})

tape('divideTerms: empty-member termCollection is dropped (fail-closed)', t => {
	// A collection with no resolvable member ids cannot be authorized for a restricted role.
	// Better to drop it than to expose a query whose membership is unknown.
	const collection = {
		term: {
			type: 'termCollection',
			name: 'Empty',
			termIds: []
		}
	}
	const ds = buildRestrictedDs(['A', 'B'])
	const [dict] = divideTerms({ terms: [collection], __protected__: { clientAuthResult: { role: 'public' } } }, ds)
	t.deepEqual(dict, [], 'empty-member termCollection is dropped under a restricted role')
	t.end()
})

tape('divideTerms: termCollection flows through when dataset has no isTermVisible hook', t => {
	// Datasets that don't opt into role-based visibility are unaffected by the new branch.
	const collection = {
		term: {
			type: 'termCollection',
			name: 'No-hook collection',
			termIds: ['A', 'B']
		}
	}
	const [dict] = divideTerms({ terms: [collection] }, emptyDs)
	t.deepEqual(dict, [collection], 'termCollection passes through unconditionally when no hook is declared')
	t.end()
})
