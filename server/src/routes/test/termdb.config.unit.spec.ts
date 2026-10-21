import tape from 'tape'
import { getDsAllowedTermTypes, getLoneTermByType, getUserTab, getClientMassNav } from '../termdb.config.ts'
import {
	CATEGORICAL,
	FLOAT,
	SURVIVAL,
	TERM_COLLECTION,
	GENE_EXPRESSION,
	ISOFORM_EXPRESSION,
	METABOLITE_INTENSITY,
	PROTEOME_ABUNDANCE,
	SSGSEA,
	DNA_METHYLATION,
	SINGLECELL_CELLTYPE,
	SINGLECELL_GENE_EXPRESSION,
	JUNCTION,
	SINGLECELL_NUMERIC_VALUE
} from '#types'

/**
 * Tests for getDsAllowedTermTypes()
 *
 * This function extracts the unique list of term types from a dataset configuration
 * by examining multiple sources:
 * - termtypeByCohort object of per-cohort term type counts
 * - allowedTermTypes array (optional)
 * - queries object (various data types)
 * - termCollections (optional)
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- #routes/termdb.config getDsAllowedTermTypes -***-')
	test.end()
})

tape('getDsAllowedTermTypes() - basic termtypeByCohort', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: { '': { categorical: 2, float: 1, integer: 1, numeric: 2 } }
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.deepEqual(
		result.sort(),
		['categorical', 'float', 'integer'].sort(),
		'Should extract term types from termtypeByCohort'
	)
	test.end()
})

tape('getDsAllowedTermTypes() - with allowedTermTypes', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: { '': { categorical: 1, numeric: 0 } },
				allowedTermTypes: ['survival', 'condition']
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.deepEqual(
		result.sort(),
		['categorical', 'survival', 'condition'].sort(),
		'Should merge termtypeByCohort and allowedTermTypes'
	)
	test.end()
})

tape('getDsAllowedTermTypes() - with junction query', function (test) {
	const ds: any = {
		cohort: { termdb: { termtypeByCohort: {} } },
		queries: { junction: {} }
	}
	test.deepEqual(getDsAllowedTermTypes(ds), [JUNCTION], 'adds the junction numeric term type')
	test.end()
})

tape('getDsAllowedTermTypes() - with geneExpression query', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: { '': { categorical: 1, numeric: 0 } }
			}
		},
		queries: {
			geneExpression: { unit: 'TPM' }
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(GENE_EXPRESSION), 'Should include GENE_EXPRESSION term type')
	test.ok(result.includes('categorical'), 'Should also include categorical from termtypeByCohort')
	test.end()
})

tape('getDsAllowedTermTypes() - with isoformExpression query', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: {}
			}
		},
		queries: {
			isoformExpression: { unit: 'TPM' }
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(ISOFORM_EXPRESSION), 'Should include ISOFORM_EXPRESSION term type')
	test.end()
})

tape('getDsAllowedTermTypes() - with metaboliteIntensity query', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: {}
			}
		},
		queries: {
			metaboliteIntensity: {}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(METABOLITE_INTENSITY), 'Should include METABOLITE_INTENSITY term type')
	test.end()
})

tape('getDsAllowedTermTypes() - with proteome query', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: {}
			}
		},
		queries: {
			proteome: {
				assays: {
					someAssay: {}
				}
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(PROTEOME_ABUNDANCE), 'Should include PROTEOME_ABUNDANCE term type')
	test.end()
})

tape('getDsAllowedTermTypes() - with ssGSEA query', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: {}
			}
		},
		queries: {
			ssGSEA: {}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(SSGSEA), 'Should include SSGSEA term type')
	test.end()
})

tape('getDsAllowedTermTypes() - with dnaMethylation query', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: {}
			}
		},
		queries: {
			dnaMethylation: { unit: 'beta', get: async () => ({}) }
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(DNA_METHYLATION), 'Should include DNA_METHYLATION term type')
	test.end()
})

tape('getDsAllowedTermTypes() - with singleCell query', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: {}
			}
		},
		queries: {
			singleCell: {
				samples: {},
				data: {}
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(SINGLECELL_CELLTYPE), 'Should include SINGLECELL_CELLTYPE term type')
	test.end()
})

tape('getDsAllowedTermTypes() - with singleCell and geneExpression', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: {}
			}
		},
		queries: {
			singleCell: {
				samples: {},
				data: {},
				geneExpression: { unit: 'CPM' }
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(SINGLECELL_CELLTYPE), 'Should include SINGLECELL_CELLTYPE term type')
	test.ok(result.includes(SINGLECELL_GENE_EXPRESSION), 'Should include SINGLECELL_GENE_EXPRESSION term type')
	test.end()
})

tape('getDsAllowedTermTypes() - singleCell without geneExpression', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: {}
			}
		},
		queries: {
			singleCell: {
				samples: {},
				data: {}
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(SINGLECELL_CELLTYPE), 'Should include SINGLECELL_CELLTYPE')
	test.notOk(
		result.includes(SINGLECELL_GENE_EXPRESSION),
		'Should not include SINGLECELL_GENE_EXPRESSION without geneExpression'
	)
	test.end()
})

tape('getDsAllowedTermTypes() - singleCell with numeric but without geneExpression', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: {}
			}
		},
		queries: {
			singleCell: {
				terms: [{ name: 'fake', type: SINGLECELL_NUMERIC_VALUE }],
				samples: {},
				data: {}
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes(SINGLECELL_CELLTYPE), 'Should include SINGLECELL_CELLTYPE')
	test.ok(result.includes(SINGLECELL_NUMERIC_VALUE), 'Should include SINGLECELL_NUMERIC_VALUE')
	test.notOk(
		result.includes(SINGLECELL_GENE_EXPRESSION),
		'Should not include SINGLECELL_GENE_EXPRESSION without geneExpression'
	)
	test.end()
})

tape('getDsAllowedTermTypes() - with termCollections', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: {},
				termCollections: [{ name: 'Collection1' }, { name: 'Collection2' }]
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.ok(result.includes('termCollection'), 'Should include termCollection term type')
	test.end()
})

tape('getDsAllowedTermTypes() - termtypeByCohort with only zero counts', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: { '': { categorical: 0, numeric: 0 } }
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.equal(result.length, 0, 'Should skip zero counts and the precomputed .numeric total')
	test.end()
})

tape('getDsAllowedTermTypes() - mixed termTypes with duplicates', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: { A: { categorical: 1, float: 1, numeric: 1 }, B: { categorical: 3, numeric: 0 } },
				allowedTermTypes: ['categorical', 'survival']
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.deepEqual(
		result.sort(),
		['categorical', 'float', 'survival'].sort(),
		'Should return unique term types without duplicates'
	)
	test.end()
})

tape('getDsAllowedTermTypes() - comprehensive dataset', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: { '': { categorical: 1, float: 1, numeric: 1 } },
				allowedTermTypes: ['survival'],
				termCollections: [{ name: 'Collection1' }]
			}
		},
		queries: {
			geneExpression: { unit: 'TPM' },
			isoformExpression: { unit: 'TPM' },
			proteome: { assays: { someAssay: {} } },
			dnaMethylation: { unit: 'beta', get: async () => ({}) },
			ssGSEA: {},
			singleCell: {
				terms: [{ name: 'fake', type: SINGLECELL_NUMERIC_VALUE }],
				samples: {},
				data: {},
				geneExpression: { unit: 'CPM' }
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	const expectedTypes = [
		CATEGORICAL,
		FLOAT,
		SURVIVAL,
		TERM_COLLECTION,
		GENE_EXPRESSION,
		ISOFORM_EXPRESSION,
		PROTEOME_ABUNDANCE,
		DNA_METHYLATION,
		SSGSEA,
		SINGLECELL_CELLTYPE,
		SINGLECELL_GENE_EXPRESSION,
		SINGLECELL_NUMERIC_VALUE
	]
	test.equal(result.length, expectedTypes.length, 'Should have correct number of term types')
	for (const type of expectedTypes) {
		test.ok(result.includes(type), `Should include ${type}`)
	}
	test.end()
})

tape('getDsAllowedTermTypes() - no queries object', function (test) {
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: { '': { categorical: 1, numeric: 0 } }
			}
		}
	}
	const result = getDsAllowedTermTypes(ds)
	test.deepEqual(result, ['categorical'], 'Should handle missing queries object')
	test.end()
})

/**************
 getLoneTermByType()
***************/
tape('\n', function (test) {
	test.comment('-***- #routes/termdb.config getLoneTermByType -***-')
	test.end()
})

const loneTermByType = {
	ABC: { survival: { id: 'os', type: 'survival' }, condition: { id: 'grade', type: 'condition' } },
	XYZ: { survival: { id: 'os', type: 'survival' } }
}

tape('getLoneTermByType() - returns the launch-time object when the ds hides no term', function (test) {
	const ds: any = { cohort: { termdb: {} } }
	test.equal(getLoneTermByType({}, ds, loneTermByType), loneTermByType, 'Should return the same object without copying')
	test.equal(getLoneTermByType({}, ds, undefined), undefined, 'Should return undefined when nothing was computed')
	test.end()
})

tape('getLoneTermByType() - drops a lone term hidden from the requesting user', function (test) {
	const ds: any = {
		cohort: { termdb: { isTermVisible: (_protected: any, term: any) => term.id != 'os' } }
	}
	const result = getLoneTermByType({ query: {} }, ds, loneTermByType)
	test.deepEqual(
		result,
		{ ABC: { condition: { id: 'grade', type: 'condition' } } },
		'Should keep only the visible term, and drop a cohort left with none'
	)
	test.end()
})

tape('getLoneTermByType() - returns undefined when every lone term is hidden', function (test) {
	const ds: any = { cohort: { termdb: { isTermVisible: () => false } } }
	test.equal(getLoneTermByType({ query: {} }, ds, loneTermByType), undefined, 'Should not send an empty loneTermByType')
	test.end()
})

/**************
 getUserTab()
***************/
tape('\n', function (test) {
	test.comment('-***- #routes/termdb.config getUserTab -***-')
	test.end()
})

const getDs = (getContent: any): any => ({ cohort: { massNav: { tabs: { user: { getContent } } } } })

tape('getUserTab() - computes the content from clientAuthResult', function (test) {
	const ds = getDs(q =>
		q.clientAuthResult.datasets?.length
			? { msgs: [{ txt: 'authorized' }] }
			: { msgs: [{ txt: 'public only' }], isPublic: true }
	)
	test.deepEqual(
		getUserTab(ds, { datasets: ['a'] }, {}),
		{ msgs: [{ txt: 'authorized' }] },
		'Should return the message for an authorized user'
	)
	test.deepEqual(
		getUserTab(ds, {}, {}),
		{ msgs: [{ txt: 'public only' }], isPublic: true },
		'Should return the message and isPublic for a user without authorization'
	)
	test.end()
})

tape(
	'getUserTab() - passes the login status and datasets from __protected__, and the ds, to the hook',
	function (test) {
		const received: any[] = []
		const ds = getDs((q, ds) => {
			received.push({ q, ds })
			return { msgs: [{ txt: 'msg' }], isPublic: false }
		})
		const datasets = Object.freeze(['sjlife', 'ccss'])
		const __protected__ = Object.freeze({
			clientAuthResult: { x: 1 },
			datasets,
			isUserLoggedIn: true,
			sessionid: 'abc',
			ignoredTermIds: []
		})
		test.deepEqual(
			getUserTab(ds, { y: 2 }, __protected__),
			{ msgs: [{ txt: 'msg' }] },
			'Should leave out isPublic when it is false'
		)
		test.equal(received.length, 1, 'Should call the hook once')
		test.deepEqual(
			received[0].q,
			{ clientAuthResult: { y: 2 }, datasets: ['sjlife', 'ccss'], isUserLoggedIn: true, cohortKeys: [] },
			'Should pass only clientAuthResult, datasets, isUserLoggedIn, and no cohortKeys without selectCohort'
		)
		test.true(Object.isFrozen(received[0].q), 'Should pass a frozen argument')
		test.equal(received[0].q.datasets, datasets, 'Should pass the frozen datasets of __protected__ as they are')
		test.equal(received[0].ds, ds, 'Should pass the ds')

		// missing or partial __protected__, such as when the server has no auth
		for (const p of [undefined, {}, { sessionid: 'abc' }, { datasets: 'sjlife', isUserLoggedIn: 'true' }]) {
			received.length = 0
			getUserTab(ds, {}, p)
			test.deepEqual(
				received[0].q,
				{ clientAuthResult: {}, datasets: [], isUserLoggedIn: false, cohortKeys: [] },
				`Should default to no datasets and not logged in for __protected__=${JSON.stringify(p)}`
			)
		}
		test.end()
	}
)

tape('getUserTab() - returns the status, message, and list without the empty or invalid items', function (test) {
	const ds = getDs(() => ({
		status: 'Administrator',
		msgs: [{ txt: 'msg' }, { email: "o'connor@example.org" }, { label: 'Docs', link: 'https://example.org' }],
		list: { label: 'Sites', items: ['a', '', 7, 'b'] },
		other: 1
	}))
	test.deepEqual(
		getUserTab(ds, {}, {}),
		{
			status: 'Administrator',
			msgs: [{ txt: 'msg' }, { email: "o'connor@example.org" }, { label: 'Docs', link: 'https://example.org' }],
			list: { label: 'Sites', items: ['a', 'b'] }
		},
		'Should return only the known fields, and the list without the empty or invalid items'
	)
	test.end()
})

tape('getUserTab() - returns undefined or leaves out a field without a usable value', function (test) {
	for (const massNav of [
		undefined,
		{},
		{ tabs: {} },
		{ tabs: { user: {} } },
		{ tabs: { user: { top: 'USER' } } },
		{ tabs: { user: { getContent: { msgs: [{ txt: 'x' }] } } } }
	]) {
		const ds: any = { cohort: { massNav } }
		test.equal(getUserTab(ds, {}, {}), undefined, `Should return undefined for massNav=${JSON.stringify(massNav)}`)
	}
	for (const content of [undefined, null, 'x', 7, {}]) {
		test.equal(
			getUserTab(
				getDs(() => content),
				{},
				{}
			),
			undefined,
			`Should ignore content=${JSON.stringify(content)}`
		)
	}
	const fields = {
		status: ['', 7, { text: 'x' }],
		msgs: [
			'x',
			[],
			[{}, null, 7, { txt: '' }, { email: '' }, { link: '' }, { label: 'x', txt: '' }],
			[{ email: 'a b@c.org' }, { email: 'a@b@c.org' }, { email: '"a@c.org' }, { email: 'a@' }, { email: '@c.org' }],
			[{ link: 'javascript:alert(1)' }, { link: 'data:text/html,x' }, { link: '//example.org' }, { link: 'not a url' }],
			[
				{ email: 'a@b.org', link: 'https://a.org' },
				{ txt: 'x', email: 'a@b.org' },
				{ txt: 'x', link: 'https://a.org' },
				{ label: 'x' },
				{ label: '', txt: 'x' },
				{ label: 7, txt: 'x' }
			]
		],
		isPublic: ['true', 1, false],
		list: [
			'a',
			{ items: ['a'] },
			{ label: '', items: ['a'] },
			{ label: 'x' },
			{ label: 'x', items: 'a' },
			{ label: 'x', items: [] },
			{ label: 'x', items: ['', null, 7] }
		]
	}
	for (const [field, values] of Object.entries(fields)) {
		for (const value of values) {
			test.deepEqual(
				getUserTab(
					getDs(() => ({ [field]: value, msgs: field == 'msgs' ? value : [{ txt: 'm' }] })),
					{},
					{}
				),
				field == 'msgs' ? undefined : { msgs: [{ txt: 'm' }] },
				`Should leave out ${field}=${JSON.stringify(value)}`
			)
		}
	}
	test.deepEqual(
		getUserTab(
			getDs(() => ({ isPublic: true })),
			{},
			{}
		),
		{ isPublic: true },
		'Should return isPublic alone'
	)

	const log = console.log
	console.log = () => {}
	try {
		test.equal(
			getUserTab(
				getDs(() => {
					throw 'hook error'
				}),
				{},
				{}
			),
			undefined,
			'Should not throw when the hook throws'
		)
	} finally {
		console.log = log
	}
	test.end()
})

tape('getUserTab() - keeps the valid parts of msgs, with the value of an email or link as it is', function (test) {
	const ds = getDs(() => ({
		msgs: [
			{ txt: 'a' },
			{ label: 'Team', email: "o'connor@example.org" },
			{ link: 'http://example.org/x?y=1' },
			{ link: 'javascript:alert(1)' },
			{ email: 'a b@c.org' },
			7
		]
	}))
	test.deepEqual(
		getUserTab(ds, {}, {}),
		{
			msgs: [{ txt: 'a' }, { label: 'Team', email: "o'connor@example.org" }, { link: 'http://example.org/x?y=1' }]
		},
		'Should leave out the invalid parts, and keep the apostrophe in the address'
	)
	test.end()
})

tape('getUserTab() - computes the content for each value of selectCohort, by index', function (test) {
	const received: any[] = []
	const ds: any = getDs((q, _) => {
		received.push(q.cohortKeys)
		return {
			status: q.cohortKeys.join('+') || 'none',
			msgs: [{ txt: q.clientAuthResult[q.cohortKeys[0]]?.role || 'public' }]
		}
	})
	ds.cohort.termdb = { selectCohort: { values: [{ keys: ['abbrev'] }, { keys: ['full'] }, { keys: ['x', 'y'] }, {}] } }
	test.deepEqual(
		getUserTab(ds, { abbrev: { role: 'admin' }, full: { role: 'user' } }, {}),
		{
			byCohort: {
				0: { status: 'abbrev', msgs: [{ txt: 'admin' }] },
				1: { status: 'full', msgs: [{ txt: 'user' }] },
				2: { status: 'x+y', msgs: [{ txt: 'public' }] },
				3: { status: 'none', msgs: [{ txt: 'public' }] }
			}
		},
		'Should return the content of each cohort, with its own role'
	)
	test.deepEqual(received, [['abbrev'], ['full'], ['x', 'y'], []], 'Should pass the keys of each value to the hook')

	const log = console.log
	console.log = () => {}
	try {
		ds.cohort.massNav.tabs.user.getContent = q => {
			if (q.cohortKeys[0] == 'abbrev') throw 'hook error'
			return q.cohortKeys[0] == 'full' ? { isPublic: true } : undefined
		}
		test.deepEqual(
			getUserTab(ds, {}, {}),
			{ byCohort: { 1: { isPublic: true } } },
			'Should leave out a cohort where the hook throws or has no content'
		)
	} finally {
		console.log = log
	}
	test.end()
})

tape(
	'getClientMassNav() - sends the content in massNav.tabs.user, without the hook, and does not change the ds',
	function (test) {
		const getContent = () => ({})
		const massNav = { title: 't', tabs: { about: { top: 'A' }, user: { top: 'USER', getContent } } }
		const out = getClientMassNav(massNav, { status: 's', byCohort: { 0: { isPublic: true } } })
		test.deepEqual(
			out,
			{
				title: 't',
				tabs: { about: { top: 'A' }, user: { top: 'USER', status: 's', byCohort: { 0: { isPublic: true } } } }
			},
			'Should merge the content into the user tab entry'
		)
		test.equal(massNav.tabs.user.getContent, getContent, 'Should not remove the hook from the ds')
		test.deepEqual(getClientMassNav(massNav, undefined).tabs.user, { top: 'USER' }, 'Should still leave out the hook')
		test.equal(getClientMassNav(undefined, { status: 's' }), undefined, 'Should not add a massNav to a ds without one')
		const noUser = { tabs: { about: {} } }
		test.equal(getClientMassNav(noUser, { status: 's' }), noUser, 'Should not add a user tab to a ds without one')
		test.end()
	}
)
