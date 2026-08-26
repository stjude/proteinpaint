import tape from 'tape'
import {
	divideTerms,
	getData,
	id2sampleRef,
	setSampleLstData,
	isNegatedSampleLstOnlyRequest,
	hasFilterTermsUnsupportedByFilterSamples
} from '../termdb.matrix.js'
import { getAuthApi, authApi } from '../auth.js'
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
setSampleLstData: annotates group members, adds missing samples when unfiltered
setSampleLstData: scopedSamples bounds which missing samples may be added
setSampleLstData: negated group covers the samples that are not listed
setSampleLstData: an explicit membership is not overwritten by a later negated group
setSampleLstData: accepts value.sample as well as value.sampleId
setSampleLstData: normalizes ids and ignores values without one
setSampleLstData: a prototype-named sample id cannot write outside samples{}
setSampleLstData: handles multiple samplelst terms and empty/missing group values
setSampleLstData: throws when q.groups is not an array
isNegatedSampleLstOnlyRequest: only fires when a negation has no universe to subtract from
hasFilterTermsUnsupportedByFilterSamples: detects filter terms filterSamples() cannot resolve
getData: samplelst overlay resolves on a dataset without a sqlite db
getData: an untrustworthy scope adds no absent group member
getData: a request of only a negated samplelst group is rejected
getData: custom bins of a non-dict numeric term come back colored and distinct
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

tape('setSampleLstData: annotates group members, adds missing samples when unfiltered', t => {
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
	// undefined scope = the ds reported that no filter applies, so every member is in scope
	setSampleLstData([tw], samples, undefined)

	t.deepEqual(samples.c1.grp, { key: 'Male', value: 'Male' }, 'listed sample is annotated with its group name')
	t.deepEqual(samples.c3.grp, { key: 'Female', value: 'Female' }, 'second group is annotated too')
	t.deepEqual(
		samples.c2,
		{ sample: 'c2', grp: { key: 'Male', value: 'Male' } },
		'with no filter applied, a group member absent from samples{} is added'
	)
	t.deepEqual(samples.c1.geneExp, { key: 1, value: 1 }, 'values from other terms are left alone')
	t.end()
})

tape('setSampleLstData: scopedSamples bounds which missing samples may be added', t => {
	// the group lists are client-supplied. The sqlite path intersects them with q.filter in the
	// samplelst CTE, so a no-db ds must not invent a row for a sample the filter excluded.
	const makeTw = () => ({
		$id: 'grp',
		term: { type: 'samplelst', name: 'G' },
		q: { groups: [{ name: 'Cases', in: true, values: [{ sampleId: 'inScope' }, { sampleId: 'outOfScope' }] }] }
	})

	const samples = {}
	setSampleLstData([makeTw()], samples, new Set(['inScope']))
	t.deepEqual(Object.keys(samples), ['inScope'], 'only the in-scope member is added')
	t.deepEqual(samples.inScope.grp, { key: 'Cases', value: 'Cases' }, 'the in-scope member is annotated')

	// a sample the filtered queries already returned is in scope by construction
	const returned = { outOfScope: { sample: 'outOfScope', geneExp: { key: 2, value: 2 } } }
	setSampleLstData([makeTw()], returned, new Set(['inScope']))
	t.deepEqual(
		returned.outOfScope.grp,
		{ key: 'Cases', value: 'Cases' },
		'a sample already in samples{} is annotated regardless of the scope set'
	)

	// an empty set is how getSampleData fails closed for a ds that cannot report its scope
	const none = {}
	setSampleLstData([makeTw()], none, new Set())
	t.deepEqual(none, {}, 'an empty scope set adds nothing')

	// a ds that keys its scope by integer still matches the stringified group id
	const numericScope = {}
	setSampleLstData(
		[
			{
				$id: 'grp',
				term: { type: 'samplelst', name: 'G' },
				q: { groups: [{ name: 'Cases', values: [{ sampleId: 7 }, { sampleId: 8 }] }] }
			}
		],
		numericScope,
		new Set([7])
	)
	t.deepEqual(Object.keys(numericScope), ['7'], 'an integer-keyed scope set matches the stringified id')
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

tape('setSampleLstData: normalizes ids and ignores values without one', t => {
	// for..in below yields string keys, so a numeric sample id must be compared as a string or a
	// listed sample would fall into its own negated group
	const negated = {
		$id: 'g',
		term: { type: 'samplelst', name: 'N' },
		q: { groups: [{ name: 'Others', in: false, values: [{ sampleId: 1 }] }] }
	}
	const samples = { 1: { sample: '1' }, 2: { sample: '2' } }
	setSampleLstData([negated], samples)
	t.equal(samples[1].g, undefined, 'a numeric id listed in a negated group is excluded from it')
	t.deepEqual(samples[2].g, { key: 'Others', value: 'Others' }, 'the unlisted sample still joins')

	// a value carrying neither sampleId nor sample must not become an "undefined" row
	const blanks = {
		$id: 'g',
		term: { type: 'samplelst', name: 'B' },
		q: { groups: [{ name: 'G1', values: [{}, null, { sampleId: 3 }] }] }
	}
	const samples2 = {}
	setSampleLstData([blanks], samples2)
	t.deepEqual(Object.keys(samples2), ['3'], 'blank values are dropped, numeric id is keyed as a string')

	/* the falsy-fallback rule is sampleLstSql.getCTE()'s: '' falls through to value.sample, and a
	0 id resolves to nothing on either path. '' must never become a row -- no sampleidmap row can
	carry it */
	const fallback = {
		$id: 'g',
		term: { type: 'samplelst', name: 'E' },
		q: { groups: [{ name: 'G1', values: [{ sampleId: '', sample: 'c1' }, { sampleId: 0 }, { sample: '' }] }] }
	}
	const samples3 = {}
	setSampleLstData([fallback], samples3)
	t.deepEqual(
		Object.keys(samples3),
		['c1'],
		'an empty sampleId falls through to value.sample, and 0 / blank ids create no row'
	)
	t.end()
})

tape('setSampleLstData: a prototype-named sample id cannot write outside samples{}', t => {
	// sampleId and $id are unvalidated request data on this route
	const tw = name => ({
		$id: 'polluted',
		term: { type: 'samplelst', name: 'P' },
		q: { groups: [{ name: 'G', values: [{ sampleId: name }] }] }
	})

	const samples = {}
	setSampleLstData([tw('__proto__')], samples)
	t.equal({}.polluted, undefined, '__proto__ as a sample id does not reach Object.prototype')
	t.equal(Object.getPrototypeOf(samples), Object.prototype, 'and does not re-point the prototype of samples{}')
	t.deepEqual(samples, {}, 'no row is created for it')

	const samples2 = {}
	setSampleLstData([tw('constructor')], samples2)
	t.equal(Object.polluted, undefined, 'constructor as a sample id does not write onto the Object constructor')
	t.deepEqual(
		samples2.constructor,
		{ sample: 'constructor', polluted: { key: 'G', value: 'G' } },
		'it becomes an ordinary own row instead'
	)
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

tape('isNegatedSampleLstOnlyRequest: only fires when a negation has no universe to subtract from', t => {
	const negated = { q: { groups: [{ name: 'Others', in: false, values: [] }] } }
	const listed = { q: { groups: [{ name: 'Cases', in: true, values: [] }] } }
	const geneExp = { term: { type: 'geneExpression' } }

	t.equal(isNegatedSampleLstOnlyRequest([negated], [negated]), true, 'a lone negated samplelst term is rejected')
	t.equal(
		isNegatedSampleLstOnlyRequest([negated, geneExp], [negated]),
		false,
		'another term in the request supplies the universe, so it is allowed'
	)
	t.equal(isNegatedSampleLstOnlyRequest([listed], [listed]), false, 'a lone in:true samplelst term is fine')
	t.equal(
		isNegatedSampleLstOnlyRequest([negated, listed], [negated, listed]),
		true,
		'a second samplelst term is not a universe either'
	)
	t.equal(isNegatedSampleLstOnlyRequest([geneExp], []), false, 'no samplelst term, nothing to reject')
	t.end()
})

tape('hasFilterTermsUnsupportedByFilterSamples: detects filter terms filterSamples() cannot resolve', t => {
	const tvs = type => ({ type: 'tvs', tvs: { term: { type, id: 'x' } } })

	t.equal(hasFilterTermsUnsupportedByFilterSamples(undefined), false, 'no filter is supported')
	t.equal(hasFilterTermsUnsupportedByFilterSamples({ lst: [] }), false, 'an empty filter is supported')
	t.equal(
		hasFilterTermsUnsupportedByFilterSamples({ lst: [tvs('categorical'), tvs('float')] }),
		false,
		'dictionary terms are resolved by filterSamples'
	)
	// filter2GDCfilter() skips each of these and defers them to post-processing
	for (const type of ['geneVariant', 'geneExpression', 'survival']) {
		t.equal(
			hasFilterTermsUnsupportedByFilterSamples({ lst: [tvs('categorical'), tvs(type)] }),
			true,
			`${type} makes the scope untrustworthy`
		)
	}
	t.equal(
		hasFilterTermsUnsupportedByFilterSamples({ lst: [{ type: 'tvslst', lst: [tvs('geneVariant')] }] }),
		true,
		'a nested filter is inspected too'
	)
	t.equal(
		hasFilterTermsUnsupportedByFilterSamples({ lst: [{ type: 'tvs', tvs: {} }] }),
		false,
		'a tvs without a term type is skipped rather than thrown on'
	)
	t.end()
})

/* ---- getData() orchestration for a dataset without a sqlite db ----
The helper specs above cover the pieces in isolation; these drive the whole path the way a
violin request off the DE volcano does: samplelst is split out of dictTerms, the gene-expression
query supplies the samples, the scope is resolved, and the groups are annotated onto the result.
*/

// getData calls authApi.mayAdjustFilter(). Assign the shared open-access api once, the same
// idempotent way omnisearch.unit.spec.ts does -- for a ds with no credentials it is a no-op.
async function ensureOpenAuth() {
	if (authApi) return
	const app = { doNotFreezeAuthApi: true, get() {}, post() {}, all() {}, use() {} }
	await getAuthApi(app, {}, {}, true)
}

const geneTw = () => ({
	$id: 'exp',
	term: { gene: 'CLN8', name: 'CLN8', type: 'geneExpression' },
	q: { mode: 'continuous' }
})

// 'outsider' is listed by the client but is not in the dataset's filtered scope below
const sampleLstTw = () => ({
	$id: 'grp',
	term: {
		name: 'Male vs Female',
		type: 'samplelst',
		values: { Male: { key: 'Male', label: 'Male' }, Female: { key: 'Female', label: 'Female' } }
	},
	q: {
		type: 'custom-samplelst',
		groups: [
			{ name: 'Male', in: true, values: [{ sampleId: 'c1' }, { sampleId: 'c2' }] },
			{ name: 'Female', in: true, values: [{ sampleId: 'c3' }, { sampleId: 'outsider' }] }
		]
	}
})

/* a gdc-like ds: no cohort.db, dictionary terms come from a ds getter, gene expression from
ds.queries, and the authorized sample scope from ds.cohort.termdb.filterSamples() */
function makeNoDbDs({ scope = new Set(['c1', 'c2', 'c3']), expValues = { c1: 5, c2: 6, c3: 7 }, dictCalls } = {}) {
	return {
		label: 'MockNoDb',
		genomename: 'hg38',
		cohort: {
			termdb: {
				dictionary: {
					get: async (q, twLst) => {
						dictCalls?.push(twLst.map(tw => tw.term.type))
						return [{}, {}]
					}
				},
				filterSamples: async () => scope,
				q: { id2sampleName: id => 'submitter-' + id }
			}
		},
		queries: {
			geneExpression: {
				get: async args => ({ term2sample2value: new Map([[args.terms[0].$id, expValues]]) })
			}
		}
	}
}

const emptyFilter = () => ({ type: 'tvslst', in: true, join: '', lst: [] })

tape('getData: samplelst overlay resolves on a dataset without a sqlite db', async t => {
	await ensureOpenAuth()
	const dictCalls = []
	const q = { terms: [geneTw(), sampleLstTw()], filter: emptyFilter() }
	const data = await getData(q, makeNoDbDs({ dictCalls }))

	t.equal(data.error, undefined, 'no error')
	// the original bug: samplelst reached the ds dictionary getter, which cannot know the term,
	// so every sample came back without a group and the overlay matched nothing
	t.deepEqual(dictCalls, [], 'the samplelst term is never handed to the dictionary getter')
	t.deepEqual(
		data.samples.c1,
		{ sample: 'c1', exp: { key: 5, value: 5 }, grp: { key: 'Male', value: 'Male' } },
		'a sample carries both its expression value and its group'
	)
	t.equal(data.samples.c3.grp.key, 'Female', 'the second group is annotated')
	t.deepEqual(Object.keys(data.samples).sort(), ['c1', 'c2', 'c3'], 'only in-scope samples are returned')
	t.equal('outsider' in data.samples, false, 'a listed member outside the authorized scope is not added')
	t.equal('outsider' in data.refs.bySampleId, false, 'and it cannot be echoed back through bySampleId')
	t.equal(data.refs.bySampleId.c1.label, 'submitter-c1', 'in-scope samples still resolve their display ref')
	t.end()
})

tape('getData: an untrustworthy scope adds no absent group member', async t => {
	await ensureOpenAuth()
	// c4 is in the dataset scope but has no expression value, so it is only ever added by the
	// samplelst annotation itself
	const scope = new Set(['c1', 'c2', 'c3', 'c4'])
	const withC4 = () => {
		const tw = sampleLstTw()
		tw.q.groups[0].values.push({ sampleId: 'c4' })
		return tw
	}

	const ok = await getData({ terms: [geneTw(), withC4()], filter: emptyFilter() }, makeNoDbDs({ scope }))
	t.equal(ok.samples.c4?.grp?.key, 'Male', 'an in-scope member with no other data is still added')

	/* filterSamples() cannot resolve a geneVariant tvs -- gdc defers it to post-processing -- so the
	scope it reports is wider than the request's real result set and must not be trusted */
	const filter = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [{ type: 'tvs', tvs: { term: { type: 'geneVariant', id: 'TP53' } } }]
	}
	const guarded = await getData({ terms: [geneTw(), withC4()], filter }, makeNoDbDs({ scope }))
	t.equal('c4' in guarded.samples, false, 'with such a filter active, no absent member is added')
	t.equal(guarded.samples.c1.grp.key, 'Male', 'samples the queries did return are still annotated')
	t.end()
})

tape('getData: a request of only a negated samplelst group is rejected', async t => {
	await ensureOpenAuth()
	const tw = sampleLstTw()
	tw.q.groups = [{ name: 'Others', in: false, values: [{ sampleId: 'c1' }] }]
	const data = await getData({ terms: [tw], filter: emptyFilter() }, makeNoDbDs())

	// nothing in the request defines the universe to subtract from, so this would otherwise
	// resolve to an empty result with no explanation
	t.ok(data.error, 'an error is returned')
	t.ok(/not in/.test(data.error), `the error names the unsupported shape: ${data.error}`)
	t.end()
})

tape('getData: custom bins of a non-dict numeric term come back colored and distinct', async t => {
	await ensureOpenAuth()
	const tw = geneTw()
	tw.q = {
		mode: 'binary',
		type: 'custom-bin',
		lst: [
			{ startunbounded: true, stopinclusive: false, stop: 6, label: '<6' },
			{ start: 6, startinclusive: true, stopunbounded: true, label: '≥6' }
		]
	}
	const data = await getData({ terms: [tw], filter: emptyFilter() }, makeNoDbDs())
	const bins = data.refs.byTermId.exp.bins

	/* custom bins are used as given and never go through compute_bins(), which is where bins are
	colored. without a color of their own, consumers that color by bin (e.g. the scatter color
	legend) fall back to a scheme of their own that can yield nearly identical bin colors */
	t.equal(bins.filter(b => b.color).length, 2, 'every bin carries a color')
	t.equal(new Set(bins.map(b => b.color)).size, 2, 'the two bins are colored differently')
	// the other half of what the bin list feeds: sample values are keyed by their bin label
	t.equal(data.samples.c1.exp.key, '<6', 'a sample below the cutoff is keyed by the first bin')
	t.equal(data.samples.c3.exp.key, '≥6', 'a sample at or above the cutoff is keyed by the last bin')
	t.end()
})
