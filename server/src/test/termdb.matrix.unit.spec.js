import tape from 'tape'
import Database from 'better-sqlite3'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { dirname, relative, join } from 'node:path'
import {
	divideTerms,
	getData,
	getSamples,
	getSampleData_dictionaryTerms_cached,
	getSampleData_dictionaryTerms_termdb,
	getAnnotationRows,
	id2sampleRef,
	setSampleLstData,
	isNegatedSampleLstOnlyRequest,
	hasFilterTermsUnsupportedByFilterSamples,
	resolveSampleMapping,
	shouldMapParent2Children,
	dropRowsWithoutAnnotation,
	shouldMapChildren2Parent,
	mayMapNonDictionaryData
} from '../termdb.matrix.js'
import { getAuthApi, authApi } from '../auth.js'
import { init } from './load.testds.js'
import { server_init_db_queries } from '../termdb.server.init.ts'
import { sql, guardDb } from '../sql.ts'
import { getFilterCTEs } from '../termdb.filter.js'
import { trigger_getDefaultBins } from '../termdb.getDefaultBins.js'
import { makeCacheid } from '../termdb.snp.js'
import { snpgtCacheFile } from '../utils.js'
import { validate_query_geneExpression } from '../routes/termdb.cluster.ts'
import serverconfig from '../serverconfig.js'

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
getData: a categorical groupset with filter groups is assigned by each group filter
getData: an untrustworthy scope adds no absent group member
getData: a request of only a negated samplelst group is rejected
shouldMapParent2Children: handles object sample type metadata with child sample types
getData: custom bins of a non-dict numeric term come back colored and distinct
getData: custom bins of a single-cell gene expression term come back colored and distinct
getData: single-cell terms take precedence over configured sample type labels
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

tape('resolveSampleMapping: explicit direction overrides automatic inference', t => {
	const ds = {
		cohort: {
			termdb: {
				hasSampleAncestry: true,
				sampleTypes: {
					1: { name: 'Root', parent_id: null },
					2: { name: 'Child A', parent_id: 1 },
					3: { name: 'Child B', parent_id: 1 }
				}
			}
		}
	}

	const query = {
		sampleMapping: 'parentToChildren',
		terms: [{ term: { id: 'gene', sampleTypes: [2, 3] } }]
	}
	resolveSampleMapping(query, ds)
	t.equal(query.sampleMapping, 'parentToChildren', 'an explicit direction is preserved')
	t.deepEqual(query.sampleTypes, [2, 3], 'sample types are derived from the query')

	const unmapped = {
		terms: [{ term: { id: 'gene', sampleTypes: [2, 3] } }]
	}
	resolveSampleMapping(unmapped, ds)
	t.notOk(Object.hasOwn(unmapped, 'sampleMapping'), 'a single term leaves the mapping property absent')
	t.deepEqual(unmapped.sampleTypes, [2, 3], 'the same query-derived sample types are preserved')
	t.end()
})

tape('resolveSampleMapping: does not invent sample types without a query scope', t => {
	const ds = {
		cohort: {
			termdb: {
				hasSampleAncestry: true,
				sampleTypes: {
					1: { name: 'Root', parent_id: null },
					2: { name: 'Child A', parent_id: 1 },
					3: { name: 'Child B', parent_id: 1 }
				}
			}
		}
	}

	const mapParents = { sampleMapping: 'parentToChildren' }
	resolveSampleMapping(mapParents, ds)
	t.equal(mapParents.sampleMapping, 'parentToChildren', 'explicit intent is preserved without a query scope')
	t.equal(mapParents.sampleTypes, undefined, 'no sample types are synthesized without a query scope')
	const automatic = {}
	resolveSampleMapping(automatic, ds)
	t.notOk(Object.hasOwn(automatic, 'sampleMapping'), 'an empty query leaves the mapping property absent')
	t.end()
})

tape('resolveSampleMapping: maps sister sample types to their common parent', t => {
	const ds = {
		cohort: {
			termdb: {
				hasSampleAncestry: true,
				sampleTypes: {
					1: { name: 'Root', parent_id: null },
					2: { name: 'Child A', parent_id: 1 },
					3: { name: 'Child B', parent_id: 1 },
					4: { name: 'Unrelated', parent_id: 5 },
					5: { name: 'Other root', parent_id: null }
				}
			}
		}
	}

	const sisterTerms = {
		terms: [{ term: { id: 'a', sampleTypes: [2] } }, { term: { id: 'b', sampleTypes: [3] } }]
	}
	resolveSampleMapping(sisterTerms, ds)
	t.equal(sisterTerms.sampleMapping, 'childrenToParent', 'sister sample types enable mapping')
	t.deepEqual(sisterTerms.sampleTypes, [1], 'query sample type becomes the common parent')

	const oneTerm = { terms: [{ term: { id: 'a', sampleTypes: [2] } }] }
	resolveSampleMapping(oneTerm, ds)
	t.notOk(Object.hasOwn(oneTerm, 'sampleMapping'), 'one term does not enable mapping')
	resolveSampleMapping(oneTerm, ds)
	t.notOk(Object.hasOwn(oneTerm, 'sampleMapping'), 'repeated resolution still leaves mapping absent')
	t.deepEqual(oneTerm.sampleTypes, [2], 'repeated resolution preserves the sample types')

	const unrelatedTerms = {
		terms: [{ term: { id: 'a', sampleTypes: [2] } }, { term: { id: 'b', sampleTypes: [4] } }]
	}
	t.throws(
		() => resolveSampleMapping(unrelatedTerms, ds),
		/unable to infer sample mapping/,
		'unrelated sample types without a common parent reject automatic mapping'
	)
	t.end()
})

tape('resolveSampleMapping: childrenToParent targets the common parent of the sample types that have one', t => {
	const ds = {
		cohort: {
			termdb: {
				hasSampleAncestry: true,
				sampleTypes: {
					1: { name: 'Root', parent_id: null },
					2: { name: 'Child A', parent_id: 1 },
					3: { name: 'Child B', parent_id: 1 },
					4: { name: 'Grandchild', parent_id: 2 },
					5: { name: 'Other root', parent_id: null }
				}
			}
		}
	}
	const resolve = types => {
		const q = {
			sampleMapping: 'childrenToParent',
			terms: types.map((sampleTypes, i) => ({ term: { id: 't' + i, sampleTypes } }))
		}
		resolveSampleMapping(q, ds)
		return q
	}
	t.deepEqual(resolve([[2], [3]]).sampleTypes, [1], 'sister sample types map to their common parent')
	t.deepEqual(resolve([[2]]).sampleTypes, [1], 'a single child-level term maps to its parent')
	t.deepEqual(
		resolve([[1], [2]]).sampleTypes,
		[1],
		'a term without a parent is not mapped and does not change the target'
	)
	t.deepEqual(resolve([[4], [1]]).sampleTypes, [2], 'the target is the parent of the deepest term, not the root')
	t.deepEqual(resolve([[1], [1]]).sampleTypes, [1], 'nothing is mapped when no sample type has a parent')
	t.throws(() => resolve([[1], [5]]), /unexpected q.sampleTypes.length/, 'several unmapped sample types are rejected')
	t.throws(() => resolve([[2], [4]]), /multiple parent sample types found/, 'different parents are rejected')
	t.equal(resolve([[2], [3]]).sampleMapping, 'childrenToParent', 'the explicit mapping is preserved')
	t.end()
})

tape('resolveSampleMapping: sampleMapping none bypasses the sample hierarchy mapping', t => {
	const ds = {
		cohort: {
			termdb: {
				hasSampleAncestry: true,
				sampleTypes: { 1: { parent_id: null }, 2: { parent_id: 1 }, 3: { parent_id: 1 } }
			}
		}
	}
	const terms = [{ term: { sampleTypes: [1] } }, { term: { sampleTypes: [2] } }]
	const q = { terms, sampleMapping: 'none' }
	resolveSampleMapping(q, ds)
	t.equal(q.sampleMapping, 'none', 'the mapping stays none')
	t.deepEqual(q.sampleTypes, [1, 2], 'the sample types of the terms are queried')
	const inferred = { terms }
	resolveSampleMapping(inferred, ds)
	t.equal(inferred.sampleMapping, 'parentToChildren', 'the mapping is still inferred when omitted')
	t.end()
})

tape('resolveSampleMapping: resolves automatic and explicit mapping with validated target types', t => {
	const ds = {
		cohort: {
			termdb: {
				hasSampleAncestry: true,
				sampleTypes: {
					1: { parent_id: null },
					2: { parent_id: 1 },
					3: { parent_id: 1 }
				}
			}
		}
	}
	const terms = [{ term: { sampleTypes: [1] } }, { term: { sampleTypes: [2] } }]
	const automatic = { terms }
	resolveSampleMapping(automatic, ds)
	t.equal(automatic.sampleMapping, 'parentToChildren', 'parent and child terms infer downward mapping')
	t.deepEqual(automatic.sampleTypes, [2], 'only the queried child type is targeted')

	const upward = { terms: [{ term: { sampleTypes: [2] } }], sampleMapping: 'childrenToParent' }
	resolveSampleMapping(upward, ds)
	t.equal(upward.sampleMapping, 'childrenToParent', 'explicit upward mapping overrides single-term inference')
	t.deepEqual(upward.sampleTypes, [1], 'explicit upward mapping targets the parent')
	const sisters = { terms: [{ term: { sampleTypes: [2, 3] } }], sampleMapping: 'childrenToParent' }
	resolveSampleMapping(sisters, ds)
	t.deepEqual(sisters.sampleTypes, [1], 'explicit upward mapping accepts several sample types with the same parent')

	const noAncestry = { terms, sampleMapping: 'parentToChildren' }
	resolveSampleMapping(noAncestry, emptyDs)
	t.notOk(Object.hasOwn(noAncestry, 'sampleMapping'), 'datasets without ancestry leave the mapping property absent')
	for (const sampleMapping of [true, false, null, 'invalid', {}, []]) {
		t.throws(
			() => resolveSampleMapping({ terms, sampleMapping }, ds),
			/invalid sampleMapping/,
			'invalid intent rejected'
		)
	}
	const mixed = { terms, sampleMapping: 'childrenToParent' }
	resolveSampleMapping(mixed, ds)
	t.deepEqual(mixed.sampleTypes, [1], 'a term without a parent is left as is when mapping the other terms upward')
	t.end()
})

tape('resolveSampleMapping: compares type sets across terms, filter, and filter0', t => {
	const ds = {
		cohort: {
			termdb: {
				hasSampleAncestry: true,
				sampleTypes: {
					1: { parent_id: null },
					2: { parent_id: 1 },
					3: { parent_id: 1 },
					4: { parent_id: 5 },
					5: { parent_id: null }
				}
			}
		},
		getFilter0SampleTypesLst: filter0 => filter0 || []
	}
	const tw = sampleTypes => ({ term: { sampleTypes } })
	const filter = (...sets) => ({
		type: 'tvslst',
		lst: sets.map(sampleTypes => ({ type: 'tvs', tvs: tw(sampleTypes) }))
	})
	const cases = [
		['one mixed-level term', { terms: [tw([1, 2])] }, undefined, [1, 2]],
		['identical mixed-level terms', { terms: [tw([1, 2]), tw([2, 1, 2])] }, undefined, [1, 2]],
		['identical sibling terms', { terms: [tw([2, 3]), tw([3, 2])] }, undefined, [2, 3]],
		[
			'matching mixed-level filters without terms',
			{ filter: filter([1, 2]), filter0: [{ sampleTypes: [2, 1] }] },
			undefined,
			[1, 2]
		],
		[
			'matching terms and both filters',
			{ terms: [tw([2, 3])], filter: filter([3, 2]), filter0: [{ sampleTypes: [2, 3] }] },
			undefined,
			[2, 3]
		],
		['a term and a sibling filter', { terms: [tw([2])], filter: filter([3]) }, 'childrenToParent', [1]],
		['a term and a sibling filter0', { terms: [tw([2])], filter0: [{ sampleTypes: [3] }] }, 'childrenToParent', [1]],
		[
			'sibling filters without terms',
			{ filter: filter([2]), filter0: [{ sampleTypes: [3] }] },
			'childrenToParent',
			[1]
		],
		['nested sibling filter terms', { filter: { type: 'tvslst', lst: [filter([2], [3])] } }, 'childrenToParent', [1]],
		[
			'sibling filter0 terms without chart terms',
			{ filter0: [{ sampleTypes: [2] }, { sampleTypes: [3] }] },
			'childrenToParent',
			[1]
		],
		['different multi-type sibling sets', { terms: [tw([2, 3]), tw([2])] }, 'childrenToParent', [1]],
		[
			'different multi-type sets containing parent and child',
			{ terms: [tw([1, 2]), tw([2, 3])] },
			'parentToChildren',
			[2, 3]
		],
		['a child term and parent filter', { terms: [tw([2])], filter: filter([1]) }, 'parentToChildren', [2]],
		['a parent term and child filter0', { terms: [tw([1])], filter0: [{ sampleTypes: [3] }] }, 'parentToChildren', [3]],
		['unrelated type sets', { terms: [tw([2])], filter: filter([4]) }, undefined, [2, 4]],
		['unknown sample types prevent inference', { terms: [tw([2]), tw([])] }, undefined, [2]],
		['empty type metadata', { terms: [tw([2, 3])], filter0: [{}, { sampleTypes: [] }] }, undefined, [2, 3]],
		[
			'explicit direction with sibling sets',
			{ terms: [tw([2]), tw([3])], sampleMapping: 'childrenToParent' },
			'childrenToParent',
			[1]
		]
	]
	for (const [label, q, mapping, sampleTypes] of cases) {
		resolveSampleMapping(q, ds)
		t.equal(q.sampleMapping, mapping, `${label}: mapping direction`)
		t.deepEqual(q.sampleTypes, sampleTypes, `${label}: target types`)
		if (mapping === undefined) t.notOk(Object.hasOwn(q, 'sampleMapping'), `${label}: mapping remains absent`)
	}
	t.end()
})

tape('shouldMapChildren2Parent: maps annotations from child term types to queried parent types', t => {
	const ds = {
		cohort: {
			termdb: {
				sampleTypes: {
					1: { name: 'Parent', parent_id: null },
					2: { name: 'Child', parent_id: 1 },
					4: { name: 'Unrelated', parent_id: null }
				}
			}
		}
	}
	t.equal(
		shouldMapChildren2Parent({ term: { id: 'child', sampleTypes: [2] } }, ds, 'childrenToParent', [1]),
		true,
		'a child term maps to its queried parent type'
	)
	t.equal(
		shouldMapChildren2Parent({ term: { id: 'unrelated', sampleTypes: [4] } }, ds, 'childrenToParent', [1]),
		false,
		'unrelated term types do not map'
	)
	t.equal(
		shouldMapChildren2Parent({ term: { id: 'child', sampleTypes: [2] } }, ds, undefined, [1]),
		false,
		'absent mapping never maps'
	)
	t.end()
})

tape('getAnnotationRows: maps child annotations onto parent samples', async t => {
	let preparedQuery
	const ds = {
		cohort: {
			db: {
				connection: {
					prepare(query) {
						preparedQuery = query
						return { all: () => [] }
					}
				}
			},
			termdb: {
				sampleTypes: {
					1: { name: 'Parent', parent_id: null },
					2: { name: 'Child A', parent_id: 1 },
					3: { name: 'Child B', parent_id: 1 }
				}
			}
		}
	}
	const termWrappers = [
		{ $id: 'a', term: { id: 'a', sampleTypes: [2] } },
		{ $id: 'b', term: { id: 'b', sampleTypes: [3] } }
	]
	const CTEs = [
		{ tablename: 'anno_categorical', sql: sql`SELECT sample, key, value FROM anno_categorical` },
		{ tablename: 'anno_categorical', sql: sql`SELECT sample, key, value FROM anno_categorical` }
	]
	const filter = { CTEname: 'filter_samples', filters: sql`filter_samples AS (SELECT 1 AS sample)` }
	await getAnnotationRows({ ds, sampleMapping: 'childrenToParent', sampleTypes: [1] }, termWrappers, filter, CTEs)
	t.ok(preparedQuery.text.includes('SELECT sa.ancestor_id as sample'), 'selects the parent sample id')
	t.ok(preparedQuery.text.includes('JOIN "anno_categorical" ON sa.sample_id = sample'), 'joins child annotations')
	t.ok(preparedQuery.text.includes('JOIN sampleidmap sm ON sa.ancestor_id = sm.id'), 'checks the parent sample type')
	t.ok(preparedQuery.text.includes('AND sa.ancestor_id IN "filter_samples"'), 'filters by parent sample ids')
	t.deepEqual(preparedQuery.values, ['a', 1, 'b', 1], 'both terms bind their term id and queried parent sample type')
	t.end()
})

tape('getAnnotationRows: resolved direction maps actual annotations and omission keeps their original ids', async t => {
	const connection = guardDb(new Database(':memory:'), 'off')
	connection.exec(`
		CREATE TABLE sampleidmap (id INTEGER, sample_type INTEGER);
		CREATE TABLE sample_ancestry (sample_id INTEGER, ancestor_id INTEGER);
		CREATE TABLE anno_categorical (sample INTEGER, term_id TEXT, value TEXT);
		INSERT INTO sampleidmap VALUES (10, 1), (20, 2), (30, 3);
		INSERT INTO sample_ancestry VALUES (20, 10), (30, 10);
		INSERT INTO anno_categorical VALUES (10, 'p', 'P');
	`)
	const ds = {
		cohort: {
			db: { connection },
			termdb: {
				hasSampleAncestry: true,
				sampleTypes: { 1: { parent_id: null }, 2: { parent_id: 1 }, 3: { parent_id: 1 } }
			}
		}
	}
	try {
		const parentTw = { $id: 'p', term: { sampleTypes: [1] } }
		const childTw = { $id: 'c', term: { sampleTypes: [2] } }
		const CTEs = [
			{ tablename: 'p', sql: sql`p AS (SELECT 10 AS sample, 'P' AS key, 'P' AS value)` },
			{ tablename: 'c', sql: sql`c AS (SELECT 20 AS sample, 'C' AS key, 'C' AS value)` }
		]
		for (const [sampleMapping, sampleTypes, expected] of [
			['parentToChildren', [2], [20, 20]],
			['childrenToParent', [1], [10, 10]],
			[undefined, [1, 2], [10, 20]]
		]) {
			const rows = await getAnnotationRows({ ds, sampleMapping, sampleTypes }, [parentTw, childTw], undefined, CTEs)
			t.deepEqual(
				rows.map(row => row.sample),
				expected,
				`${sampleMapping} returns the expected annotation ids`
			)
		}
		const filter = {
			type: 'tvslst',
			in: true,
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: { id: 'p', name: 'Parent', type: 'categorical', sampleTypes: [1] },
						values: [{ key: 'P' }]
					}
				}
			]
		}
		for (const [sampleMapping, expected] of [
			['parentToChildren', [20]],
			[undefined, [10]]
		]) {
			const cte = await getFilterCTEs(filter, ds, sampleMapping, [2])
			const rows = connection.prepare(sql`WITH ${cte.filters} SELECT sample FROM ${sql.id(cte.CTEname)}`).all()
			t.deepEqual(
				rows.map(row => row.sample),
				expected,
				`${sampleMapping} also controls filter sample ids`
			)
		}
	} finally {
		connection.close()
	}
	t.end()
})

tape('shouldMapParent2Children: handles object sample type metadata with child sample types', t => {
	const ds = {
		cohort: {
			termdb: {
				sampleTypes: {
					1: { name: 'Parent', parent_id: null },
					2: { name: 'Child', parent_id: 1 },
					4: { name: 'Unrelated', parent_id: null }
				},
				term2SampleType: new Map([
					['expression', { sampleType: 1, childSampleTypes: [2] }],
					['legacy', 1]
				])
			}
		}
	}

	t.equal(
		shouldMapParent2Children({ term: { id: 'expression' } }, ds, 'parentToChildren', [2]),
		true,
		'parent sample type from object metadata maps to a requested child type'
	)
	t.equal(
		shouldMapParent2Children({ term: { id: 'expression' } }, ds, 'parentToChildren', [4]),
		false,
		'unrelated requested sample types do not map'
	)
	t.equal(
		shouldMapParent2Children({ term: { id: 'expression' } }, ds, undefined, [2]),
		false,
		'absent mapping never maps'
	)
	t.equal(
		shouldMapParent2Children({ term: { id: 'expression' } }, ds, 'parentToChildren', []),
		false,
		'without requested sample types there is nothing to map'
	)
	t.equal(
		shouldMapParent2Children({ term: { id: 'legacy' } }, ds, 'parentToChildren', [2]),
		true,
		'legacy numeric sample type metadata remains supported'
	)
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

tape('divideTerms: rejects a reserved $id', t => {
	const term = { $id: '__proto__', term: { type: 'dict', id: 'd2' } }
	t.throws(() => divideTerms({ terms: [term] }, emptyDs), /invalid \$id/, 'throws instead of assigning a reserved $id')
	t.end()
})

tape('getData: rejects a term wrapper whose $id is a non-string that coerces to a reserved key', async t => {
	const tw = { $id: ['__proto__'], term: { id: 'agedx', name: 'Age', type: 'float' }, q: { mode: 'continuous' } }
	const result = await getData({ terms: [tw] }, { cohort: { db: null, termdb: {} } })
	t.ok(result.error, 'returns an error instead of writing through the coerced key')
	t.end()
})

// String coercion of an object $id is not guaranteed pure (a custom toString() can return a
// different value on every call), so validating it once and later re-keying byTermId{} (a plain,
// non-null-prototype object) with a SEPARATE coercion of the same object could validate one string
// while actually writing under another. validateArg() must resolve $id to a string exactly once
// and freeze that value onto tw.$id, so every later use is a no-op re-coercion of an already-string.
tape('getData: an object $id with a stateful toString() is resolved exactly once and frozen', async t => {
	await ensureOpenAuth()
	let calls = 0
	const statefulId = {
		toString() {
			calls++
			return calls === 1 ? 'safeName' : '__proto__'
		}
	}
	const tw = {
		$id: statefulId,
		term: { gene: 'CLN8', name: 'CLN8', type: 'geneExpression' },
		q: {
			mode: 'discrete',
			type: 'custom-bin',
			lst: [
				{ startunbounded: true, stopinclusive: false, stop: 6, label: '<6' },
				{ start: 6, startinclusive: true, stopunbounded: true, label: '≥6' }
			]
		}
	}
	const data = await getData({ terms: [tw], filter: emptyFilter() }, makeNoDbDs())
	t.notOk(data.error, 'no error')
	t.ok(
		Object.hasOwn(data.refs.byTermId, 'safeName'),
		'byTermId is keyed by the single resolved value validateArg() checked, not a later re-coercion'
	)
	t.notOk({}.bins, 'does not pollute Object.prototype even though a later coercion would have been dangerous')
	t.end()
})

// mds3.variant2samples.js calls this function directly, bypassing getData()/validateArg() entirely,
// so it must reject a dangerous $id on its own rather than relying on an upstream caller to have checked
tape(
	'getSampleData_dictionaryTerms_termdb: rejects a reserved or coercible $id independently of getData()',
	async t => {
		const q = { ds: emptyDs, filter: null }
		try {
			await getSampleData_dictionaryTerms_termdb(q, [{ $id: '__proto__', term: { id: 'x' } }])
			t.fail('should have thrown for a reserved $id')
		} catch (e) {
			t.ok(String(e).includes('invalid $id'), 'rejects a reserved $id called the way mds3.variant2samples.js calls it')
		}
		try {
			await getSampleData_dictionaryTerms_termdb(q, [{ $id: ['__proto__'], term: { id: 'x' } }])
			t.fail('should have thrown for a coercible $id')
		} catch (e) {
			t.ok(String(e).includes('invalid $id'), 'rejects a non-string $id that would coerce to a reserved key')
		}
		t.end()
	}
)

// The sample id here comes from a SQL row's `sample` column (dataset content, not the client
// request), but nothing guarantees it can never be '__proto__'. Both getSamples() and
// getSampleData_dictionaryTerms_cached() index a plain samples{} map by this value, which is
// the exact read-through-then-write shape that caused the original prototype pollution bug --
// just keyed by sample id instead of term $id.
tape('getSamples: a sample id of __proto__ does not pollute Object.prototype', async t => {
	const rows = [{ sample: '__proto__', key: 'k1', term_id: 'agedx', value: 42 }]
	const samples = await getSamples({}, rows, [])
	t.ok(Object.hasOwn(samples, '__proto__'), 'stores the sample as a real own __proto__ key')
	t.equal(samples['__proto__'].agedx.value, 42, 'the term value is stored under the correct sample entry')
	t.notOk({}.agedx, 'does not pollute Object.prototype')
	t.end()
})

tape('getSamples: a term id of __proto__ is stored as real per-sample data, not a prototype reassignment', async t => {
	const rows = [{ sample: 's1', key: 'k1', term_id: '__proto__', value: 99 }]
	const samples = await getSamples({}, rows, [])
	t.ok(Object.hasOwn(samples.s1, '__proto__'), 'stores the term value as a real own __proto__ key on the sample')
	t.equal(samples.s1['__proto__'].value, 99, 'the value is retrievable rather than lost to a prototype swap')
	t.notOk({}.key, 'does not pollute Object.prototype')
	t.end()
})

tape(
	'getSampleData_dictionaryTerms_cached: a sample id of __proto__ does not pollute Object.prototype, even given a plain samples map',
	async t => {
		const tw = { $id: 'agedx', term: { id: 'agedx' } }
		const ds = { termid2sample2value: new Map([['agedx', new Map([['__proto__', 42]])]]) }
		const q = { ds }
		// a plain {} (not the null-prototype map our own code creates) simulates what a
		// dataset-supplied dictionary.get()/getAdHocTermValues() getter could hand this function
		const samples = {}
		const byTermId = {}
		await getSampleData_dictionaryTerms_cached(q, [tw], samples, byTermId)
		t.ok(Object.hasOwn(samples, '__proto__'), 'stores the sample as a real own __proto__ key')
		t.equal(samples['__proto__'].agedx.value, 42, 'the term value is stored under the correct sample entry')
		t.notOk({}.agedx, 'does not pollute Object.prototype')
		t.end()
	}
)

tape('getData: refs.bySampleId does not pollute Object.prototype for a sample id of __proto__', async t => {
	await ensureOpenAuth()
	const tw = { $id: 'agedx', term: { id: 'agedx', name: 'Age', type: 'float' }, q: { mode: 'continuous' } }
	const ds = {
		cohort: { db: null, termdb: { q: { id2sampleName: id => 'Case-' + id } } },
		// the cached path Copilot's finding traces through: a sample id of '__proto__' now survives
		// into refs.bySampleId, which must not resolve it through Object.prototype either
		termid2sample2value: new Map([['agedx', new Map([['__proto__', 42]])]])
	}
	const data = await getData({ terms: [tw] }, ds)
	t.notOk(data.error, 'no error')
	t.ok(Object.hasOwn(data.refs.bySampleId, '__proto__'), 'stores the sample ref under a real own __proto__ key')
	t.equal(data.refs.bySampleId['__proto__'].label, 'Case-__proto__', 'the ref is retrievable rather than lost')
	t.notOk({}.label, 'does not pollute Object.prototype')
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
	// spread first: a newly-created row is intentionally null-prototype (see getOrCreateSampleEntry),
	// which deepEqual treats as unequal to a {} literal even with identical own properties
	t.deepEqual(
		{ ...samples.c2 },
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

tape('setSampleLstData: a prototype-named sample id becomes a safe, real row', t => {
	// sampleId and $id are unvalidated request data on this route. A sample named '__proto__' is a
	// legitimate, real sample now that samples{} preserves it elsewhere (see getOrCreateSampleEntry()),
	// so it must be annotated like any other id instead of being silently skipped.
	const tw = name => ({
		$id: 'polluted',
		term: { type: 'samplelst', name: 'P' },
		q: { groups: [{ name: 'G', values: [{ sampleId: name }] }] }
	})

	const samples = {}
	setSampleLstData([tw('__proto__')], samples)
	t.equal({}.polluted, undefined, '__proto__ as a sample id does not pollute Object.prototype')
	t.equal(Object.getPrototypeOf(samples), Object.prototype, "does not re-point samples{}'s own prototype")
	t.ok(Object.hasOwn(samples, '__proto__'), 'creates a real own __proto__ row instead of skipping it')
	// spread first: a newly-created row is intentionally null-prototype, which deepEqual treats as
	// unequal to a {} literal even with identical own properties
	t.deepEqual(
		{ ...samples['__proto__'] },
		{ sample: '__proto__', polluted: { key: 'G', value: 'G' } },
		'the row is a normal, annotated entry'
	)

	const samples2 = {}
	setSampleLstData([tw('constructor')], samples2)
	t.equal(Object.polluted, undefined, 'constructor as a sample id does not write onto the Object constructor')
	t.deepEqual(
		{ ...samples2.constructor },
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
function makeNoDbDs({
	scope = new Set(['c1', 'c2', 'c3']),
	expValues = { c1: 5, c2: 6, c3: 7 },
	dictCalls,
	scExpValues,
	sampleTypes,
	sampleTypesByTerms
} = {}) {
	const ds = {
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
				q: { id2sampleName: id => 'submitter-' + id },
				sampleTypes,
				sampleTypesByTerms
			}
		},
		queries: {
			geneExpression: {
				get: async args => ({ term2sample2value: new Map([[args.terms[0].$id, expValues]]) })
			}
		}
	}
	// single cell gene expression is keyed by cell, not sample, and is served by its own query
	if (scExpValues) ds.queries.singleCell = { geneExpression: { get: async () => scExpValues } }
	return ds
}

function makeSampleMappingDs(valuesByTerm) {
	const connection = guardDb(new Database(':memory:'), 'off')
	connection.exec(`
		CREATE TABLE sampleidmap (id INTEGER, sample_type INTEGER);
		CREATE TABLE sample_ancestry (sample_id INTEGER, ancestor_id INTEGER);
		INSERT INTO sampleidmap VALUES (10, 1), (20, 2), (30, 3), (40, 2);
		INSERT INTO sample_ancestry VALUES (20, 10), (30, 10), (40, 10);
	`)
	const ds = makeNoDbDs()
	ds.cohort.db = { connection }
	ds.cohort.termdb.hasSampleAncestry = true
	ds.cohort.termdb.sampleTypes = {
		1: { name: 'Parent', plural_name: 'Parents', parent_id: null },
		2: { name: 'Child A', plural_name: 'Children A', parent_id: 1 },
		3: { name: 'Child B', plural_name: 'Children B', parent_id: 1 }
	}
	ds.cohort.termdb.term2SampleType = new Map([['parentExpression', { sampleType: 1, childSampleTypes: [2] }]])
	const sampleTypesById = new Map([
		[10, 1],
		[20, 2],
		[30, 3],
		[40, 2]
	])
	const getterArgs = []
	ds.queries.geneExpression.get = async args => {
		getterArgs.push(args)
		const tw = args.terms[0]
		const values = Object.fromEntries(
			Object.entries(valuesByTerm[tw.term.id]).filter(
				([id]) => !tw.term.sampleTypes || tw.term.sampleTypes.includes(sampleTypesById.get(Number(id)))
			)
		)
		return { term2sample2value: new Map([[tw.$id, await mayMapNonDictionaryData(tw, { ...args, ds }, values)]]) }
	}
	return { ds, connection, getterArgs }
}

const emptyFilter = () => ({ type: 'tvslst', in: true, join: '', lst: [] })

tape('geneExpression getter: source sample types limit data before mapping', async t => {
	const { ds, connection } = makeSampleMappingDs({})
	ds.sampleId2Type = new Map([
		[20, 2],
		[30, 3]
	])
	ds.cohort.termdb.q.sampleName2id = name => (name === '2646' ? 20 : 30)
	ds.queries.geneExpression = {
		file: relative(
			serverconfig.tpmasterdir,
			join(import.meta.dirname, '../../test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5')
		)
	}
	const tw = {
		$id: 'expression',
		term: { type: 'geneExpression', gene: 'DDX11L1', sampleTypes: [2] }
	}
	try {
		await validate_query_geneExpression(ds, null)
		const aligned = await ds.queries.geneExpression.get({ terms: [tw], sampleTypes: [3] })
		t.deepEqual(
			Object.keys(aligned.term2sample2value.get(tw.$id)),
			['20'],
			'source types, not request types, select data'
		)
		const parent = await ds.queries.geneExpression.get({
			terms: [tw],
			sampleTypes: [1],
			sampleMapping: 'childrenToParent'
		})
		t.deepEqual(Object.keys(parent.term2sample2value.get(tw.$id)), ['10'], 'source expression maps to parent targets')
		const untyped = await ds.queries.geneExpression.get({
			terms: [{ ...tw, term: { ...tw.term, sampleTypes: undefined } }]
		})
		t.deepEqual(
			Object.keys(untyped.term2sample2value.get(tw.$id)),
			['20', '30'],
			'missing term types keep all source data'
		)
	} finally {
		connection.close()
	}
	t.end()
})

tape('geneExpression getter: maps native data before target sample filtering', async t => {
	await ensureOpenAuth()
	const { ds, connection } = makeSampleMappingDs({})
	connection.exec(`
		ALTER TABLE sampleidmap ADD COLUMN name TEXT;
		CREATE TABLE anno_categorical (sample INTEGER, term_id TEXT, value TEXT);
		INSERT INTO anno_categorical VALUES (10, 'status', 'include'), (20, 'status', 'include'),
			(30, 'status', 'include'), (40, 'status', 'exclude');
	`)
	ds.sampleId2Type = new Map([
		[10, 1],
		[20, 2],
		[30, 3],
		[40, 2]
	])
	ds.cohort.termdb.q.sampleName2id = name => (name === '2646' ? 20 : 40)
	ds.queries.geneExpression = {
		file: relative(
			serverconfig.tpmasterdir,
			join(import.meta.dirname, '../../test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5')
		)
	}
	const tw = {
		$id: 'expression',
		term: { gene: 'DDX11L1', name: 'Expression', type: 'geneExpression', sampleTypes: [2] },
		q: { mode: 'continuous' }
	}
	const filter = sampleTypes => ({
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'status', name: 'Status', type: 'categorical', sampleTypes },
					values: [{ key: 'include' }]
				}
			}
		]
	})
	try {
		await validate_query_geneExpression(ds, null)
		const parent = await getData({ terms: [tw], filter: filter([3]) }, ds)
		t.notOk(parent.error, 'parent filter is applied after child expression data maps')
		t.deepEqual(Object.keys(parent.samples), ['10'], 'matrix keeps the mapped parent without mapping a second time')
		t.ok(Number.isFinite(parent.samples[10].expression.value), 'mapped parent retains an expression value')

		await ds.queries.geneExpression
			.get({
				terms: [tw],
				sampleMapping: 'childrenToParent',
				sampleTypes: [1],
				filter: {
					...filter([3]),
					lst: [{ type: 'tvs', tvs: { ...filter([3]).lst[0].tvs, values: [{ key: 'absent' }] } }]
				}
			})
			.then(
				() => t.fail('gene expression retains its no-data error when all values are filtered out'),
				error => t.ok(String(error).includes('No data available'), 'gene expression retains its no-data error')
			)

		const child = await ds.queries.geneExpression.get({
			terms: [tw],
			sampleTypes: [2],
			filter: filter([2])
		})
		t.deepEqual(Object.keys(child.term2sample2value.get(tw.$id)), ['20'], 'aligned sample types are filtered normally')
		t.deepEqual(Object.keys(child.bySampleId), ['20'], 'references contain only retained samples')

		ds.cohort.termdb.q.sampleName2id = () => 10
		const parentTw = { ...tw, term: { ...tw.term, sampleTypes: [1] } }
		const children = await ds.queries.geneExpression.get({
			terms: [parentTw],
			sampleMapping: 'parentToChildren',
			sampleTypes: [2],
			filter: filter([2])
		})
		t.deepEqual(
			Object.keys(children.term2sample2value.get(tw.$id)),
			['20'],
			'parent expression maps to children before the child filter removes excluded children'
		)
		t.deepEqual(Object.keys(children.bySampleId), ['20'], 'downward mapping references use filtered child IDs')
	} finally {
		connection.close()
	}
	t.end()
})

tape('mayMapNonDictionaryData: accepts and returns sample2value objects', async t => {
	const { ds, connection } = makeSampleMappingDs({})
	const tw = { term: { type: 'geneExpression', sampleTypes: [2] } }
	try {
		const values = Object.freeze({ 20: 0, 40: 13 })
		const q = { ds, sampleMapping: 'childrenToParent', sampleTypes: [1] }
		const mapped = await mayMapNonDictionaryData(tw, q, values)
		t.notOk(Array.isArray(mapped), 'mapped output is an object, not an entries array')
		t.deepEqual({ ...mapped }, { 10: 0 }, 'the first value wins even when it is zero')
		t.equal(Object.getPrototypeOf(mapped), null, 'mapped object has no inherited sample keys')
		t.deepEqual(values, { 20: 0, 40: 13 }, 'source object is unchanged')
		t.equal(
			await mayMapNonDictionaryData(tw, { ds, sampleTypes: [2] }, values),
			values,
			'no-op returns the original object'
		)
		const empty = await mayMapNonDictionaryData(tw, q, {})
		t.deepEqual(Object.keys(empty), [], 'empty input returns an empty object')
		t.notOk(Array.isArray(empty), 'empty output is not an array')

		const inherited = Object.create({ 20: 5 })
		inherited[40] = 7
		const ownValues = await mayMapNonDictionaryData(tw, q, inherited)
		t.deepEqual({ ...ownValues }, { 10: 7 }, 'inherited source values are ignored')
	} finally {
		connection.close()
	}
	t.end()
})

tape('getData: geneExpression values map in both sample hierarchy directions', async t => {
	await ensureOpenAuth()
	const valuesByTerm = {
		parentExpression: { 10: 5 },
		childExpressionA: { 20: 6 },
		childExpressionB: { 30: 7 }
	}
	const { ds, connection, getterArgs } = makeSampleMappingDs(valuesByTerm)
	try {
		const parentTerm = {
			$id: 'parentExpression',
			term: { id: 'parentExpression', name: 'Parent expression', gene: 'P', type: 'geneExpression' },
			q: { mode: 'continuous' }
		}
		const filter = emptyFilter()
		const filter0 = {}
		const children = await getData({ terms: [parentTerm], sampleMapping: 'parentToChildren', filter, filter0 }, ds)
		t.equal(getterArgs[0].filter, filter, 'the request filter is passed unchanged to the getter')
		t.equal(getterArgs[0].filter0, filter0, 'the hidden filter is passed unchanged to the getter')
		t.equal(getterArgs[0].sampleMapping, 'parentToChildren', 'the resolved mapping direction is passed to the getter')
		t.deepEqual(getterArgs[0].sampleTypes, [2], 'gene expression getter receives target sample types')
		t.notOk(children.error, 'parent-to-children mapping succeeds')
		t.deepEqual(
			Object.keys(children.samples).sort(),
			['20', '40'],
			'parent values are copied to the requested child type'
		)
		t.equal(children.samples[20].parentExpression.value, 5, 'the first child receives the parent value')
		t.equal(children.samples[40].parentExpression.value, 5, 'the second child receives the parent value')

		const childTerms = [
			{
				$id: 'childExpressionA',
				term: {
					id: 'childExpressionA',
					name: 'Child A expression',
					gene: 'A',
					type: 'geneExpression',
					sampleTypes: [2]
				},
				q: { mode: 'continuous' }
			},
			{
				$id: 'childExpressionB',
				term: {
					id: 'childExpressionB',
					name: 'Child B expression',
					gene: 'B',
					type: 'geneExpression',
					sampleTypes: [3]
				},
				q: { mode: 'continuous' }
			}
		]
		const parentQuery = { terms: childTerms }
		const parent = await getData(parentQuery, ds)
		t.deepEqual(getterArgs[1].sampleTypes, [1], 'the first getter receives parent target types')
		t.deepEqual(getterArgs[2].sampleTypes, [1], 'the sister getter receives the same parent target types')
		t.deepEqual(parentQuery.sampleTypes, [1], 'mapping retains the parent target type')
		t.notOk(parent.error, 'children-to-parent mapping succeeds')
		t.deepEqual(Object.keys(parent.samples), ['10'], 'sibling term values map to their common parent')
		t.equal(parent.samples[10].childExpressionA.value, 6, 'the first term keeps its value')
		t.equal(parent.samples[10].childExpressionB.value, 7, 'the second term keeps its value')
		t.equal(parent.sampleType.name, 'Parent', 'the response reports the mapped sample type')
		const sameGeneTerms = childTerms.map(tw => ({ ...tw, term: { ...tw.term, gene: 'TP53' } }))
		const sameGene = await getData({ terms: sameGeneTerms }, ds)
		t.notOk(sameGene.error, 'the original getter returns data for the same gene with sister sample types')
		t.equal(sameGene.samples[10].childExpressionA.value, 6, 'the first term keeps its source value after mapping')
		t.equal(sameGene.samples[10].childExpressionB.value, 7, 'the second term keeps its source value after mapping')
		t.deepEqual(Object.keys(parent.refs.bySampleId), ['10'], 'sample references use the mapped parent IDs')

		valuesByTerm.childExpressionA = { 20: 6, 40: 8 }
		const collision = await getData(
			{
				terms: [childTerms[0]],
				sampleMapping: 'childrenToParent'
			},
			ds
		)
		t.notOk(collision.error, 'multiple source values can map to one sample')
		t.equal(collision.samples[10].childExpressionA.value, 6, 'the first mapped value is retained')
	} finally {
		connection.close()
	}
	t.end()
})

tape('getData: other numeric getters receive target sample types', async t => {
	await ensureOpenAuth()
	const ds = makeNoDbDs()
	let getterArgs
	ds.queries.isoformExpression = {
		get: async args => {
			getterArgs = args
			return { term2sample2value: new Map([['isoform', { c1: 5 }]]) }
		}
	}
	const tw = {
		$id: 'isoform',
		term: { type: 'isoformExpression', isoform: 'ENST1', sampleTypes: [2] },
		q: { mode: 'continuous' }
	}
	ds.cohort.termdb.sampleTypes = { 3: { name: 'Other', plural_name: 'Others' } }
	const data = await getData({ terms: [tw], sampleTypes: [3] }, ds)
	t.notOk(data.error, 'the non-expression numeric getter still succeeds')
	t.deepEqual(getterArgs.sampleTypes, [3], 'other getters receive query target types')
	t.end()
})

tape('getData: non-dictionary numeric types retain getter-mapped target values', async t => {
	await ensureOpenAuth()
	const { ds, connection } = makeSampleMappingDs({})
	try {
		for (const type of [
			'isoformExpression',
			'metaboliteIntensity',
			'proteomeAbundance',
			'ssGSEA',
			'dnaMethylation',
			'junction',
			'pseudobulk'
		]) {
			let args
			const getter = {
				get: async param => {
					args = param
					return { term2sample2value: new Map([['value', { 10: 6 }]]) }
				}
			}
			if (type === 'proteomeAbundance') ds.queries.proteome = getter
			else if (type === 'pseudobulk') ds.queries.singleCell = { pseudobulk: getter }
			else ds.queries[type] = getter
			const data = await getData(
				{
					sampleMapping: 'childrenToParent',
					terms: [{ $id: 'value', term: { type, sampleTypes: [2] }, q: { mode: 'continuous' } }]
				},
				ds
			)
			t.notOk(data.error, `${type}: mapping succeeds`)
			t.deepEqual(args.sampleTypes, [1], `${type}: getter receives target types`)
			t.deepEqual(Object.keys(data.samples), ['10'], `${type}: values use target sample IDs`)
			t.equal(data.samples[10].value.value, 6, `${type}: preserves the numeric value`)
		}
	} finally {
		connection.close()
	}
	t.end()
})

tape('getData: non-dictionary mapping preserves dictionary rows and numeric payload keys', async t => {
	await ensureOpenAuth()
	const { ds, connection } = makeSampleMappingDs({})
	connection.exec(`
		CREATE TABLE anno_categorical (sample INTEGER, term_id TEXT, value TEXT);
		INSERT INTO anno_categorical VALUES (30, 'status', 'D');
	`)
	ds.queries.geneExpression.get = async () => ({
		term2sample2value: new Map([
			['geneA', { 10: 6 }],
			['geneB', { 10: 9 }]
		])
	})
	const terms = [
		{ $id: 'status', term: { id: 'status', name: 'Status', type: 'categorical', sampleTypes: [3] }, q: {} },
		{ $id: 'expression', term: { type: 'geneExpression', gene: 'G', sampleTypes: [2] }, q: { mode: 'continuous' } }
	]
	try {
		const data = await getData({ terms }, ds)
		t.notOk(data.error, 'inferred mapping succeeds')
		t.deepEqual(Object.keys(data.samples), ['10'], 'dictionary and non-dictionary data share one target row')
		t.deepEqual(data.samples[10].status, { key: 'D', value: 'D' }, 'dictionary annotation is not mapped again')
		t.equal(data.samples[10].geneA.value, 6, 'first numeric payload key maps independently')
		t.equal(data.samples[10].geneB.value, 9, 'second numeric payload key maps independently')
		t.notOk(Object.hasOwn(data.samples[10], 'expression'), 'getter payload keys are not replaced with tw.$id')
	} finally {
		connection.close()
	}
	t.end()
})

tape('getData: SNP-list and locus reject sample ancestry and preserve non-hierarchical data', async t => {
	await ensureOpenAuth()
	const { ds, connection } = makeSampleMappingDs({})
	const cacheFile = snpgtCacheFile(makeCacheid(ds), ds)
	try {
		await mkdir(dirname(cacheFile), { recursive: true })
		for (const type of ['snplst', 'snplocus']) {
			await writeFile(
				cacheFile,
				[
					'snp\tchr\tpos\tref\talt\teff\t20\t40',
					'rs1\tchr1\t100\tA\tT\tT\tA/T\tT/T',
					'rs2\tchr1\t200\tC\tG\tG\tC/C\tC/G'
				].join('\n')
			)
			const tw = {
				$id: 'snps',
				term: { type, sampleTypes: [2] },
				q: { cacheid: cacheFile.split('/').pop(), AFcutoff: 0, geneticModel: 0 }
			}
			for (const sampleMapping of [undefined, 'childrenToParent', 'parentToChildren']) {
				const rejected = await getData({ terms: [tw], sampleMapping }, ds)
				t.equal(
					rejected.error,
					`sample hierarchy mapping not supported for '${type}' term`,
					`${type}: rejects ancestry even when mapping is ${sampleMapping}`
				)
			}
			ds.cohort.termdb.hasSampleAncestry = false
			try {
				const data = await getData({ terms: [tw] }, ds)
				t.notOk(data.error, `${type}: non-hierarchical query succeeds`)
				t.deepEqual(Object.keys(data.samples), ['20', '40'], `${type}: source sample IDs are preserved`)
				t.deepEqual({ ...data.samples[20].snps }, { rs1: 1, rs2: 0 }, `${type}: first genotype map is preserved`)
				t.deepEqual({ ...data.samples[40].snps }, { rs1: 2, rs2: 1 }, `${type}: second genotype map is preserved`)
			} finally {
				ds.cohort.termdb.hasSampleAncestry = true
			}
		}
	} finally {
		await unlink(cacheFile)
		connection.close()
	}
	t.end()
})

tape('default bins: numeric getters receive target types', async t => {
	const ds = makeNoDbDs()
	let args
	ds.queries.isoformExpression = {
		get: async param => {
			args = param
			return { term2sample2value: new Map([['isoform', { c1: 1, c2: 2, c3: 3 }]]) }
		}
	}
	let response
	await trigger_getDefaultBins(
		{
			sampleTypes: [1],
			tw: { $id: 'isoform', term: { type: 'isoformExpression', sampleTypes: [2] }, q: {} }
		},
		ds,
		{
			send: data => {
				response = data
			}
		}
	)
	t.notOk(response.error, 'bin calculation succeeds')
	t.deepEqual(args.sampleTypes, [1], 'bins query the resolved target sample types')
	t.end()
})

tape('getData: samplelst overlay resolves on a dataset without a sqlite db', async t => {
	await ensureOpenAuth()
	const dictCalls = []
	const q = { terms: [geneTw(), sampleLstTw()], filter: emptyFilter() }
	const data = await getData(q, makeNoDbDs({ dictCalls }))

	t.equal(data.error, undefined, 'no error')
	// the original bug: samplelst reached the ds dictionary getter, which cannot know the term,
	// so every sample came back without a group and the overlay matched nothing
	t.deepEqual(dictCalls, [], 'the samplelst term is never handed to the dictionary getter')
	// spread to a plain object first: data.samples.c1 is intentionally null-prototype
	// (see getOrCreateSampleEntry()), which deepEqual treats as unequal to a {} literal
	// even with identical own properties
	t.deepEqual(
		{ ...data.samples.c1 },
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

tape('getData: uses generic sample labels for non-root sample types', async t => {
	await ensureOpenAuth()
	const ds = makeNoDbDs({
		sampleTypes: {
			2: {
				name: 'Baseline Bone Marrow CD138pos sample',
				plural_name: 'Baseline Bone Marrow CD138pos samples',
				parent_id: 1
			},
			3: {
				name: 'Baseline Peripheral Blood CD138pos sample',
				plural_name: 'Baseline Peripheral Blood CD138pos samples',
				parent_id: 1
			}
		},
		sampleTypesByTerms: {
			'samples.collection_event': { Baseline: [2, 3] },
			'samples.specimen_type': { 'Bone Marrow': [2], 'Peripheral Blood': [3] },
			'samples.sample_type': { CD138pos: [2, 3] }
		}
	})
	const tw = geneTw()
	tw.term.sampleTypeLabel = ''
	const data = await getData({ terms: [tw], filter: emptyFilter(), sampleTypes: [2, 3] }, ds)

	t.equal(data.error, undefined, 'no error')
	t.deepEqual(
		data.sampleType,
		{ name: 'sample', plural_name: 'samples' },
		'a term sample type label makes generic labels sufficient for non-root types'
	)

	const unlabeledData = await getData({ terms: [geneTw()], filter: emptyFilter(), sampleTypes: [2, 3] }, ds)
	t.deepEqual(
		unlabeledData.sampleType,
		{
			name: 'Baseline Bone Marrow CD138pos sample / Baseline Peripheral Blood CD138pos sample',
			plural_name: 'Baseline Bone Marrow CD138pos samples / Baseline Peripheral Blood CD138pos samples'
		},
		'sample type metadata alone does not replace labels when the term has no sample type label'
	)
	t.end()
})

tape('getData: a non-dict term data id of __proto__ does not corrupt an existing sample row', async t => {
	await ensureOpenAuth()
	const dictTw = { $id: 'grp2', term: { type: 'categorical', id: 'grp2', name: 'Group' }, q: {} }
	const expTw = geneTw() // $id: 'exp', term.type: geneExpression (non-dict)
	const ds = makeNoDbDs()
	// an uncached ds-supplied dictionary getter can hand back an existing, ordinary (non-null-
	// prototype) row -- getOrCreateSampleEntry() must return it unchanged since it already exists
	ds.cohort.termdb.dictionary.get = async () => [{ c1: { sample: 'c1', grp2: { key: 'A', value: 'A' } } }, {}]
	// the query handler's term2sample2value key is not necessarily tw.$id (e.g. pseudobulk with
	// dataTypeDetails.genes uses a raw, unvalidated client-supplied gene name as the key)
	ds.queries.geneExpression.get = async () => ({ term2sample2value: new Map([['__proto__', { c1: 5 }]]) })

	const data = await getData({ terms: [dictTw, expTw], filter: emptyFilter() }, ds)
	t.notOk(data.error, 'no error')
	t.ok(
		Object.hasOwn(data.samples.c1, '__proto__'),
		'stores the value under a real own __proto__ key on the existing row'
	)
	t.equal(data.samples.c1['__proto__'].value, 5, 'the value is retrievable rather than corrupting the row prototype')
	t.equal(
		data.samples.c1.grp2.key,
		'A',
		'the row created by the ds-supplied dictionary getter is preserved, not replaced'
	)
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

	/* the response bins are a copy: callers go on to mutate them (termdb.barchart.js overlays
	q.binColored on them), which must not write back into the request */
	t.notEqual(bins[0], tw.q.lst[0], 'the response bins are not the request bins')
	t.equal(tw.q.lst.filter(b => 'color' in b).length, 0, 'no color leaks onto the request q.lst[]')
	t.end()
})

tape('getData: custom bins of a single-cell gene expression term come back colored and distinct', async t => {
	await ensureOpenAuth()
	// this term type does not route through findListOfBins(), so it needs its own coloring guard
	const tw = {
		$id: 'scexp',
		term: {
			type: 'singleCellGeneExpression',
			gene: 'CLN8',
			name: 'CLN8',
			sample: { sID: 'sample1' },
			bins: { min: 0, max: 10 }
		},
		q: {
			mode: 'discrete',
			type: 'custom-bin',
			lst: [
				{ startunbounded: true, stopinclusive: false, stop: 6, label: '<6' },
				{ start: 6, startinclusive: true, stopunbounded: true, label: '≥6' }
			]
		}
	}
	const ds = makeNoDbDs({ scExpValues: { cell1: 5, cell2: 7 } })
	const data = await getData({ terms: [tw], filter: emptyFilter() }, ds)
	const bins = data.refs.byTermId.scexp.bins

	t.equal(bins.filter(b => b.color).length, 2, 'every bin carries a color')
	t.equal(new Set(bins.map(b => b.color)).size, 2, 'the two bins are colored differently')
	// the other half of what the bin list feeds: cell values are keyed by their bin label
	t.equal(data.samples.cell1.scexp.key, '<6', 'a cell below the cutoff is keyed by the first bin')
	t.equal(data.samples.cell2.scexp.key, '≥6', 'a cell at or above the cutoff is keyed by the last bin')
	t.equal(tw.q.lst.filter(b => 'color' in b).length, 0, 'no color leaks onto the request q.lst[]')
	t.end()
})

tape('getData: single-cell terms take precedence over configured sample type labels', async t => {
	await ensureOpenAuth()
	const tw = {
		$id: 'scexp',
		term: {
			type: 'singleCellGeneExpression',
			gene: 'CLN8',
			name: 'CLN8',
			sample: { sID: 'sample1' },
			sampleTypeLabel: ''
		},
		q: { mode: 'continuous' }
	}
	const sampleTypes = {
		2: { name: 'tumor', plural_name: 'tumors', parent_id: 1 },
		3: { name: 'normal', plural_name: 'normals', parent_id: 1 }
	}
	const ds = makeNoDbDs({ scExpValues: { cell1: 5 }, sampleTypes })
	const data = await getData({ terms: [tw], filter: emptyFilter(), sampleTypes: [2, 3] }, ds)

	t.equal(data.error, undefined, 'no error')
	t.deepEqual(data.sampleType, { name: 'cell', plural_name: 'cells' }, 'single-cell results are labeled as cells')
	t.end()
})

// the filter groups of a groupset are built as extra CTEs by termdb.sql.categorical.js,
// which previously failed with a ReferenceError since getFilterCTEs() was not imported
tape('getData: a categorical groupset with filter groups is assigned by each group filter', async t => {
	await ensureOpenAuth()
	const tdb = await init('termdb.test.ts')
	server_init_db_queries(tdb.ds)
	const termjson = id => structuredClone(tdb.ds.cohort.termdb.q.termjsonByOneid(id))
	const sexFilter = key => ({
		type: 'tvslst',
		join: '',
		in: true,
		lst: [{ type: 'tvs', tvs: { term: termjson('sex'), values: [{ key }] } }]
	})
	const tw = {
		$id: 'diaggrp',
		term: { ...termjson('diaggrp'), groupsetting: { disabled: false } },
		q: {
			type: 'custom-groupset',
			groupsetting: { activeCohort: 0 },
			customset: {
				groups: [
					{ name: 'males', type: 'filter', filter4activeCohort: [sexFilter('1')] },
					{ name: 'females', type: 'filter', filter4activeCohort: [sexFilter('2')] }
				]
			}
		}
	}
	const data = await getData({ terms: [tw] }, tdb.ds)
	t.notOk(data.error, 'no error')
	const counts = {}
	for (const s of Object.values(data.samples)) counts[s.diaggrp.key] = (counts[s.diaggrp.key] || 0) + 1
	const sexCounts = {}
	for (const r of tdb.ds.cohort.db.connection
		.prepare('SELECT value, count(*) AS n FROM anno_categorical WHERE term_id = ? GROUP BY value')
		.all('sex'))
		sexCounts[r.value] = r.n
	t.deepEqual(counts, { males: sexCounts['1'], females: sexCounts['2'] }, 'assigns samples by each group filter')
	t.end()
})

tape('getData: sampleMapping childrenToParent returns one entry per parent sample', async t => {
	await ensureOpenAuth()
	const tdb = await init('termdb.test.ts')
	server_init_db_queries(tdb.ds)
	const termjson = id => structuredClone(tdb.ds.cohort.termdb.q.termjsonByOneid(id))
	// in the test db, sex annotates patients and diaggrp annotates their child samples
	const terms = () => [
		{ $id: 'sex', term: termjson('sex'), q: { type: 'values' } },
		{ $id: 'diaggrp', term: termjson('diaggrp'), q: { type: 'values' } }
	]
	const bySample = await getData({ terms: terms() }, tdb.ds)
	const byParent = await getData({ terms: terms(), sampleMapping: 'childrenToParent' }, tdb.ds)
	t.notOk(byParent.error, 'no error')
	const parentIds = Object.keys(byParent.samples)
	t.ok(parentIds.length < Object.keys(bySample.samples).length, 'child samples are combined into parent samples')
	t.deepEqual(Object.keys(byParent.refs.bySampleId).sort(), [...parentIds].sort(), 'the sample refs are of the parents')
	t.equal(byParent.sampleType.name, 'patient', 'the sample type is the parent type')
	t.deepEqual(byParent.samples[102].sex, { key: '2', value: '2' }, 'a term annotating the parent samples is not mapped')
	t.ok(byParent.samples[102].diaggrp, 'a term annotating the child samples is mapped onto the parent')
	t.end()
})

tape('getData: a fraction termCollection returns only the rows with a fraction value', async t => {
	await ensureOpenAuth()
	const tdb = await init('termdb.test.ts')
	server_init_db_queries(tdb.ds)
	const tw = lst => ({
		$id: 'frac',
		type: 'TermCollectionTWFraction',
		term: {
			type: 'termCollection',
			name: 'Fake Collection 1',
			memberType: 'numeric',
			termlst: ['agedx', 'a_death'].map(id => ({ id, type: 'float' }))
		},
		q: { mode: 'discrete', type: 'custom-bin', denominators: ['agedx', 'a_death'], numerators: ['agedx'], lst }
	})
	const counts = data => ({
		rows: Object.keys(data.samples).length,
		annotated: Object.values(data.samples).filter(s => s.frac).length,
		refs: Object.keys(data.refs.bySampleId).length
	})
	{
		const lst = [
			{ startunbounded: true, stop: 0.5, label: 'low' },
			{ start: 0.5, startinclusive: true, stopunbounded: true, label: 'high' }
		]
		const data = await getData({ terms: [tw(lst)] }, tdb.ds)
		t.notOk(data.error, 'should not return an error when the bins cover the values')
		const c = counts(data)
		t.ok(c.rows > 0, 'should return rows when the bins cover the values')
		t.deepEqual(
			c,
			{ rows: c.rows, annotated: c.rows, refs: c.rows },
			'every returned row has a fraction value and a ref'
		)
	}
	{
		const data = await getData({ terms: [tw([{ start: 1e9, startinclusive: true, stopunbounded: true }])] }, tdb.ds)
		t.notOk(data.error, 'should not return an error when no value is in a bin')
		t.deepEqual(
			counts(data),
			{ rows: 0, annotated: 0, refs: 0 },
			'should return no row or ref when no value is in a bin'
		)
	}
	t.end()
})

tape('dropRowsWithoutAnnotation()', t => {
	const data = {
		samples: {
			1: { sample: 1, sex: { key: 'M', value: 'M' } },
			2: { sample: 2 },
			3: { sample: 3, sex: undefined }
		},
		refs: { byTermId: {}, bySampleId: { 1: { label: 'a' }, 2: { label: 'b' }, 3: { label: 'c' } } }
	}
	dropRowsWithoutAnnotation(data)
	t.deepEqual(Object.keys(data.samples), ['1'], 'should keep only the row with an annotation')
	t.deepEqual(Object.keys(data.refs.bySampleId), ['1'], 'should remove the refs of the removed rows')
	t.end()
})

tape("getData: checkAccessToSampleData.need='count' checks the sample count of each term", async t => {
	await ensureOpenAuth()
	const tdb = await init('termdb.test.ts')
	server_init_db_queries(tdb.ds)
	const termdb = tdb.ds.cohort.termdb
	const termjson = id => structuredClone(termdb.q.termjsonByOneid(id))
	const terms = () => [
		{ $id: 'relapse_site', term: termjson('relapse_site'), q: { type: 'values' } },
		{ $id: 'diaggrp', term: termjson('diaggrp'), q: { type: 'values' } }
	]
	const saved = termdb.checkAccessToSampleData
	const calls = []
	try {
		termdb.checkAccessToSampleData = {
			need: 'count',
			assess: (q, data) => {
				calls.push(data)
				return { minSize: 1, canAccess: true }
			}
		}
		const data = await getData({ terms: terms() }, tdb.ds)
		t.notOk(data.error, 'should not return an error')
		const counts = ['relapse_site', 'diaggrp'].map(
			$id => Object.values(data.samples).filter(s => s[$id] && typeof s[$id] == 'object').length
		)
		t.notEqual(counts[0], counts[1], 'the test terms should have data on different numbers of samples')
		// the terms are not checked in a set order
		const byCount = (a, b) => a.count - b.count
		t.deepEqual(
			calls.sort(byCount),
			counts.map(count => ({ count })).sort(byCount),
			'should call assess() with only the sample count of each term'
		)

		// a minSize between the two counts rejects the term with fewer samples
		const minSize = Math.min(...counts) + 1
		termdb.checkAccessToSampleData = {
			need: 'count',
			assess: (q, data) => ({ minSize, canAccess: data.count >= minSize })
		}
		const data2 = await getData({ terms: terms() }, tdb.ds)
		t.equal(data2.code, 'ERR_MIN_SIZE', 'should reject the request when one term has fewer than minSize samples')
	} finally {
		termdb.checkAccessToSampleData = saved
	}
	t.end()
})
