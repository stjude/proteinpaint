import tape from 'tape'
import { divideTerms, id2sampleRef, setSampleLstData } from '../termdb.matrix.js'
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
divideTerms: termCollection visibility decided by member terms (term.termlst)
setSampleLstData: annotates group members, adds missing samples
setSampleLstData: negated group covers the samples that are not listed
setSampleLstData: an explicit membership is not overwritten by a later negated group
setSampleLstData: accepts value.sample as well as value.sampleId
setSampleLstData: handles multiple samplelst terms and empty/missing group values
setSampleLstData: throws when q.groups is not an array
*/

tape('id2sampleRef(): prefers id2sampleRefs, else id2sampleName raw-then-Number, no NaN on string ids', test => {
	// dataset exposing id2sampleRefs -> its object is returned as-is (raw id passed through)
	const dsRefs = { cohort: { termdb: { q: { id2sampleRefs: id => ({ label: 'R' + id, extra: 1 }) } } } }
	test.deepEqual(id2sampleRef('abc', dsRefs), { label: 'Rabc', extra: 1 }, 'id2sampleRefs wins and gets the raw id')

	// integer-keyed id2sampleName (native-like): a stringified samples{} key resolves via the Number() fallthrough
	const ints = new Map([[7, 'seven']])
	const dsInt = { cohort: { termdb: { q: { id2sampleName: id => ints.get(id) } } } }
	test.deepEqual(
		id2sampleRef('7', dsInt),
		{ label: 'seven' },
		'integer-keyed id2sampleName resolves stringified key via Number()'
	)

	// string-keyed id2sampleName (uuid): raw lookup works, never coerced to NaN (regression guard for the review)
	const strs = new Map([['case-uuid', 'CASE-1']])
	const dsStr = { cohort: { termdb: { q: { id2sampleName: id => strs.get(id) } } } }
	test.deepEqual(id2sampleRef('case-uuid', dsStr), { label: 'CASE-1' }, 'non-numeric string id resolves raw, not NaN')

	// neither method -> undefined (caller skips assignment)
	test.equal(id2sampleRef('x', { cohort: { termdb: { q: {} } } }), undefined, 'no method -> undefined')
	test.equal(id2sampleRef('x', {}), undefined, 'missing termdb.q -> undefined, no throw')

	test.end()
})

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
				isTermVisible(_clientAuth, term) {
					return term.id !== 'blocked'
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
				isTermVisible(_clientAuth, term) {
					return term.id !== 'blocked'
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
				isTermVisible(auth, _term) {
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
termCollection terms have no scalar .id — they're identified by .name + their member terms.
Passing the collection term to isTermVisible yields false for any role consulting an
allowlist (no id to match), silently dropping the collection. The fix decides visibility
from the members instead: visible iff every member term is visible to the role. term.termlst
(the list of member term objects, populated server-side) is the source of truth; the legacy
termIds[] is not consulted. Each member term object is forwarded to isTermVisible as-is.
*/
function buildRestrictedDs(allowlist) {
	const allow = new Set(allowlist)
	return {
		cohort: {
			termdb: {
				isTermVisible(_auth, term) {
					return allow.has(term.id)
				}
			}
		}
	}
}

tape('divideTerms: termCollection visible when every member term is visible', t => {
	const collection = {
		term: {
			type: 'termCollection',
			name: 'Yes/No flags',
			termlst: [{ id: 'A' }, { id: 'B' }, { id: 'C' }]
		}
	}
	const ds = buildRestrictedDs(['A', 'B', 'C'])
	const [dict] = divideTerms({ terms: [collection], __protected__: { clientAuthResult: { role: 'public' } } }, ds)
	t.deepEqual(dict, [collection], 'termCollection passes through to dict when all members are visible')
	t.end()
})

tape('divideTerms: termCollection dropped when any member term is not visible', t => {
	const collection = {
		term: {
			type: 'termCollection',
			name: 'Yes/No flags',
			termlst: [{ id: 'A' }, { id: 'B' }, { id: 'C' }]
		}
	}
	// 'C' is missing from the allowlist
	const ds = buildRestrictedDs(['A', 'B'])
	const [dict] = divideTerms({ terms: [collection], __protected__: { clientAuthResult: { role: 'public' } } }, ds)
	t.deepEqual(dict, [], 'termCollection is dropped when any member is not visible')
	t.end()
})

tape('divideTerms: termCollection forwards the full member term object to isTermVisible', t => {
	// Locks in the review contract: members come from termlst as term objects, and each is
	// passed to the hook as-is (the same instance, not reduced to an id), so future non-dict
	// members keeping visibility state on other props still work.
	const member = { id: 'A', type: 'categorical' }
	const collection = {
		term: {
			type: 'termCollection',
			name: 'Members',
			termlst: [member]
		}
	}
	const received = []
	const ds = {
		cohort: {
			termdb: {
				isTermVisible(_auth, term) {
					received.push(term)
					return true
				}
			}
		}
	}
	divideTerms({ terms: [collection], __protected__: { clientAuthResult: { role: 'public' } } }, ds)
	t.equal(received.length, 1, 'hook called once for the single member')
	t.equal(received[0], member, 'the exact member instance from termlst is forwarded, not a structural copy')
	t.end()
})

tape('divideTerms: empty-member termCollection is dropped (fail-closed)', t => {
	// A collection with no resolvable members cannot be authorized for a restricted role.
	// Better to drop it than to expose a query whose membership is unknown.
	const collection = {
		term: {
			type: 'termCollection',
			name: 'Empty',
			termlst: []
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
			termlst: [{ id: 'A' }, { id: 'B' }]
		}
	}
	const [dict] = divideTerms({ terms: [collection] }, emptyDs)
	t.deepEqual(dict, [collection], 'termCollection passes through unconditionally when no hook is declared')
	t.end()
})

tape('divideTerms: malformed termCollection (termlst is not an array) is dropped, not thrown', t => {
	// A payload that arrives with termlst as a string/object must not crash the whole request
	// with a TypeError. Fail-closed: drop the collection instead.
	const collection = {
		term: {
			type: 'termCollection',
			name: 'Bad termlst',
			termlst: { id: 'A' } // not an array
		}
	}
	const ds = buildRestrictedDs(['A'])
	const q = { terms: [collection], __protected__: { clientAuthResult: { role: 'public' } } }
	t.doesNotThrow(() => divideTerms(q, ds), 'does not throw on non-array termlst')
	const [dict] = divideTerms(q, ds)
	t.deepEqual(dict, [], 'malformed termCollection is dropped under a restricted role')
	t.end()
})

tape('divideTerms: termCollection normalizes bare id-string members to { id }', t => {
	// The payload is client-supplied; an older client may list members as bare id strings.
	// Each is normalized to { id } so the visibility hook always receives a term object.
	const collection = {
		term: {
			type: 'termCollection',
			name: 'String members',
			termlst: ['A', 'B']
		}
	}
	const ds = buildRestrictedDs(['A', 'B'])
	const q = { terms: [collection], __protected__: { clientAuthResult: { role: 'public' } } }
	const [dict] = divideTerms(q, ds)
	t.deepEqual(dict, [collection], 'string members are normalized and authorized when visible')
	t.end()
})

tape('divideTerms: termCollection with a non-object member is dropped, not thrown', t => {
	// null/number entries carry no resolvable identity. A hook that reads term.id would throw
	// on null; normalization drops such members and the collection fails closed instead.
	const collection = {
		term: {
			type: 'termCollection',
			name: 'Bad member',
			termlst: [{ id: 'A' }, null, 42]
		}
	}
	const ds = buildRestrictedDs(['A'])
	const q = { terms: [collection], __protected__: { clientAuthResult: { role: 'public' } } }
	t.doesNotThrow(() => divideTerms(q, ds), 'does not throw on null/number member')
	const [dict] = divideTerms(q, ds)
	t.deepEqual(dict, [], 'collection with an unresolvable member is dropped')
	t.end()
})

/* setSampleLstData() annotates a samplelst term from its own tw.q.groups[], for datasets
that cannot express those groups in SQL. It must match what sampleLstSql.getCTE() produces
for a ds with a sqlite db, so these specs pin the group semantics rather than the mechanics. */

tape('setSampleLstData: annotates group members, adds missing samples', t => {
	const tw = {
		$id: 'grp',
		term: { type: 'samplelst', name: 'Male vs Female' },
		q: {
			groups: [
				{ name: 'Male', in: true, values: [{ sampleId: 'c1' }, { sampleId: 'c2' }] },
				{ name: 'Female', in: true, values: [{ sampleId: 'c3' }] }
			]
		}
	}
	// c1 and c3 already carry a value from another term of the same request; c2 does not
	const samples = {
		c1: { sample: 'c1', geneExp: { key: 1, value: 1 } },
		c3: { sample: 'c3', geneExp: { key: 3, value: 3 } }
	}
	setSampleLstData([tw], samples)

	t.deepEqual(samples.c1.grp, { key: 'Male', value: 'Male' }, 'listed sample is annotated with its group name')
	t.deepEqual(samples.c3.grp, { key: 'Female', value: 'Female' }, 'second group is annotated too')
	t.deepEqual(
		samples.c2,
		{ sample: 'c2', grp: { key: 'Male', value: 'Male' } },
		'a group member absent from samples{} is added, mirroring the sqlite CTE'
	)
	t.deepEqual(samples.c1.geneExp, { key: 1, value: 1 }, 'values from other terms are left alone')
	t.end()
})

tape('setSampleLstData: negated group covers the samples that are not listed', t => {
	// in:false is the SQL "NOT IN" group. Without a db there is no sample universe to negate
	// against, so it resolves against the samples the rest of the request returned.
	const tw = {
		$id: 'grp',
		term: { type: 'samplelst', name: 'In vs out' },
		q: { groups: [{ name: 'Others', in: false, values: [{ sampleId: 'c1' }] }] }
	}
	const samples = { c1: { sample: 'c1' }, c2: { sample: 'c2' }, c3: { sample: 'c3' } }
	setSampleLstData([tw], samples)

	t.equal(samples.c1.grp, undefined, 'a listed sample is excluded from a negated group')
	t.deepEqual(samples.c2.grp, { key: 'Others', value: 'Others' }, 'unlisted sample joins the negated group')
	t.deepEqual(samples.c3.grp, { key: 'Others', value: 'Others' }, 'every other queried sample joins it')
	t.end()
})

tape('setSampleLstData: an explicit membership is not overwritten by a later negated group', t => {
	const tw = {
		$id: 'grp',
		term: { type: 'samplelst', name: 'Cases vs rest' },
		q: {
			groups: [
				{ name: 'Cases', in: true, values: [{ sampleId: 'c1' }] },
				{ name: 'Rest', in: false, values: [{ sampleId: 'c2' }] }
			]
		}
	}
	const samples = { c1: { sample: 'c1' }, c2: { sample: 'c2' }, c3: { sample: 'c3' } }
	setSampleLstData([tw], samples)

	t.deepEqual(samples.c1.grp, { key: 'Cases', value: 'Cases' }, 'c1 keeps the group it was explicitly listed in')
	t.equal(samples.c2.grp, undefined, 'c2 is excluded by the negated group it is listed in')
	t.deepEqual(samples.c3.grp, { key: 'Rest', value: 'Rest' }, 'c3 falls into the negated group')
	t.end()
})

tape('setSampleLstData: accepts value.sample as well as value.sampleId', t => {
	// sampleLstSql.getCTE() reads value.sampleId || value.sample; both shapes reach the server
	const tw = {
		$id: 'grp',
		term: { type: 'samplelst', name: 'One group' },
		q: { groups: [{ name: 'G1', values: [{ sample: 'c1' }, { sampleId: 'c2' }] }] }
	}
	const samples = {}
	setSampleLstData([tw], samples)

	t.deepEqual(samples.c1.grp, { key: 'G1', value: 'G1' }, 'value.sample is read')
	t.deepEqual(samples.c2.grp, { key: 'G1', value: 'G1' }, 'value.sampleId is read')
	t.end()
})

tape('setSampleLstData: handles multiple samplelst terms and empty/missing group values', t => {
	const tw1 = {
		$id: 'a',
		term: { type: 'samplelst', name: 'A' },
		q: { groups: [{ name: 'A1', values: [{ sampleId: 'c1' }] }] }
	}
	const tw2 = {
		$id: 'b',
		term: { type: 'samplelst', name: 'B' },
		q: { groups: [{ name: 'B1', values: [{ sampleId: 'c1' }] }, { name: 'B2' }, { name: 'B3', values: [] }] }
	}
	const samples = { c1: { sample: 'c1' } }
	t.doesNotThrow(() => setSampleLstData([tw1, tw2], samples), 'a group without values[] does not throw')

	t.deepEqual(samples.c1.a, { key: 'A1', value: 'A1' }, 'first term is annotated under its own $id')
	t.deepEqual(samples.c1.b, { key: 'B1', value: 'B1' }, 'second term is annotated independently')
	t.equal(Object.keys(samples).length, 1, 'empty groups add no samples')
	t.end()
})

tape('setSampleLstData: throws when q.groups is not an array', t => {
	const samples = {}
	t.throws(
		() => setSampleLstData([{ $id: 'grp', term: { type: 'samplelst' }, q: {} }], samples),
		/groups/,
		'missing q.groups is reported, not silently skipped'
	)
	t.throws(
		() => setSampleLstData([{ $id: 'grp', term: { type: 'samplelst' }, q: { groups: {} } }], samples),
		/groups/,
		'non-array q.groups is reported'
	)
	t.deepEqual(setSampleLstData([], samples), undefined, 'an empty tw list is a no-op')
	t.end()
})
