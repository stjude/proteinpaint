import tape from 'tape'
import { mayCheckSampleAccess, validateCheckAccessToSampleData } from '../termdb.sampleAccess.ts'

/*
patients 1-6, with one site each in the fake SITEC term, and a sample name each in the fake sampleidmap
*/
const patient2site = { 1: 'A', 2: 'A', 3: 'B', 4: 'B', 5: 'B', 6: 'C' }

function getDs(check, opts: { tables?: string[]; termValues?: boolean } = {}) {
	const prepared: string[] = []
	const connection = {
		prepare(f) {
			prepared.push(f.text)
			return {
				all() {
					if (f.text.includes('sampleidmap'))
						return Object.keys(patient2site).map(id => ({ sample: Number(id), value: `sample${id}` }))
					if (f.values[0] != 'SITEC') return []
					return Object.entries(patient2site).map(([id, site]) => ({ sample: Number(id), value: site }))
				},
				get() {
					return opts.termValues === false ? undefined : { 1: 1 }
				}
			}
		}
	}
	const ds = {
		cohort: {
			termdb: { checkAccessToSampleData: check },
			db: { connection, tables: new Set(opts.tables || ['sampleidmap', 'anno_categorical']) }
		}
	}
	return { ds, prepared }
}

// same rules as the carereg and profile datasets
function siteAssess(q, data) {
	const minSize = 2
	const role = q.__protected__.role
	let canAccess
	if (role == 'admin') canAccess = true
	else if (role == 'user') {
		const forbidden = data.names.filter(n => !q.__protected__.sites.includes(n))
		canAccess = data.names.length >= minSize || forbidden.length === 0
	} else canAccess = data.names.length >= minSize
	return { minSize, canAccess, message: canAccess ? '' : 'Only one hospital was found' }
}

const publicQ = { __protected__: { role: 'public' } }
const userQ = { __protected__: { role: 'user', sites: ['A'] } }

function getErr(fn): any {
	try {
		fn()
	} catch (e) {
		return e
	}
}

tape('\n', t => {
	t.comment('-***- termdb.sampleAccess specs -***-')
	t.end()
})

tape('mayCheckSampleAccess(): no checkAccessToSampleData', t => {
	const ds = { cohort: { termdb: {} } }
	t.doesNotThrow(() => mayCheckSampleAccess(publicQ, ds, [{ sampleIds: [1] }]), 'should not check')
	t.end()
})

tape("mayCheckSampleAccess(): need='count'", t => {
	const calls: any[] = []
	const { ds, prepared } = getDs({
		need: 'count',
		assess: (q, data) => {
			calls.push(data)
			return { minSize: 3, canAccess: data.count >= 3 }
		}
	})
	mayCheckSampleAccess(publicQ, ds, [{ sampleIds: [1, 2, 3] }, { sampleIds: [] }, { sampleIds: [4, 5, 6, '6'] }])
	t.deepEqual(calls, [{ count: 3 }, { count: 3 }], 'should call assess() with only the count, once per non-empty term')
	t.equal(prepared.length, 0, 'should not query the db')

	const e = getErr(() => mayCheckSampleAccess(publicQ, ds, [{ sampleIds: [1, 2, 3, 4, 5] }, { sampleIds: [6] }]))
	t.deepEqual(
		e,
		{ message: 'One or more terms has less than 3 samples with data.', code: 'ERR_MIN_SIZE' },
		'should reject a term under minSize, even when all terms combined have enough samples'
	)
	t.end()
})

tape("mayCheckSampleAccess(): need='names' with termId", t => {
	const calls: any[] = []
	const { ds, prepared } = getDs({
		need: 'names',
		termId: 'SITEC',
		assess: (q, data) => {
			calls.push(data)
			return siteAssess(q, data)
		}
	})

	mayCheckSampleAccess(publicQ, ds, [{ sampleIds: [1, 3] }, { sampleIds: [2, 5, 6] }])
	t.deepEqual(
		calls,
		[{ names: ['A', 'B'] }, { names: ['A', 'B', 'C'] }],
		'should call assess() with the distinct termId values of each term'
	)

	{
		// the term with the fewest patients has 2 sites, another term has more patients from 1 site
		const e = getErr(() => mayCheckSampleAccess(publicQ, ds, [{ sampleIds: [1, 3] }, { sampleIds: [3, 4, 5] }]))
		t.equal(e?.message, 'Only one hospital was found', 'should reject a 1-site term that has more patients')
	}
	{
		// each term has 1 site, the user owns the site of the first term but not the second
		const e = getErr(() => mayCheckSampleAccess(userQ, ds, [{ sampleIds: [1, 2] }, { sampleIds: [3] }]))
		t.equal(e?.message, 'Only one hospital was found', 'should reject a 1-site term of a site the user does not own')
	}
	t.doesNotThrow(
		() => mayCheckSampleAccess(userQ, ds, [{ sampleIds: [1] }, { sampleIds: [2] }]),
		'should allow 1-site terms of the site the user owns'
	)

	calls.length = 0
	mayCheckSampleAccess(publicQ, ds, [{ sampleIds: [1], lookupIds: [1, 6] }])
	t.deepEqual(calls, [{ names: ['A', 'C'] }], 'should look up the lookupIds when given')

	t.equal(prepared.length, 1, 'should query the termId values once, and reuse them for later requests')
	t.end()
})

tape("mayCheckSampleAccess(): need='names' without termId", t => {
	const calls: any[] = []
	const { ds } = getDs({
		need: 'names',
		assess: (q, data) => {
			calls.push(data)
			return { minSize: 1, canAccess: true }
		}
	})
	mayCheckSampleAccess(publicQ, ds, [{ sampleIds: [1, 2], lookupIds: [1, 2, 3] }])
	t.deepEqual(calls, [{ names: ['sample1', 'sample2'] }], 'should use the sample names of the sampleIds')
	t.end()
})

tape('mayCheckSampleAccess(): assess() result', t => {
	for (const [result, message] of [
		[{ minSize: 5, canAccess: false, message: 'ds message' }, 'ds message'],
		[{ minSize: 5, canAccess: false }, 'One or more terms has less than 5 samples with data.'],
		[{ canAccess: 1 }, 'The sample data is not accessible.'],
		[undefined, 'The sample data is not accessible.']
	] as [any, string][]) {
		const { ds } = getDs({ need: 'count', assess: () => result })
		const e = getErr(() => mayCheckSampleAccess(publicQ, ds, [{ sampleIds: [1] }]))
		t.equal(e?.message, message, `should reject ${JSON.stringify(result)} with the expected message`)
	}
	t.end()
})

tape('validateCheckAccessToSampleData()', t => {
	const assess = () => ({ minSize: 1, canAccess: true })
	for (const [check, opts] of [
		[{ need: 'count', assess }, {}],
		[{ need: 'names', assess }, {}],
		[{ need: 'names', termId: 'SITEC', assess }, {}]
	] as [any, any][]) {
		t.doesNotThrow(
			() => validateCheckAccessToSampleData(getDs(check, opts).ds),
			`should accept ${JSON.stringify(check)}`
		)
	}
	t.doesNotThrow(() => validateCheckAccessToSampleData({ cohort: { termdb: {} } }), 'should accept no setup')

	for (const [check, opts, msg] of [
		[assess, {}, 'a function'],
		[{ need: 'count' }, {}, 'no assess()'],
		[{ need: 'all', assess }, {}, 'an unknown need'],
		[{ need: 'count', termId: 'SITEC', assess }, {}, "termId with need='count'"],
		[{ need: 'names', assess }, { tables: [] }, "need='names' without a sampleidmap table"],
		[{ need: 'names', termId: '', assess }, {}, 'an empty termId'],
		[{ need: 'names', termId: 'SITEC', assess }, { termValues: false }, 'a termId without values']
	] as [any, any, string][]) {
		t.throws(() => validateCheckAccessToSampleData(getDs(check, opts).ds), `should reject ${msg}`)
	}
	{
		const { ds } = getDs({ need: 'names', assess })
		delete (ds.cohort as any).db
		t.throws(() => validateCheckAccessToSampleData(ds), "should reject need='names' without a db")
	}
	t.end()
})
