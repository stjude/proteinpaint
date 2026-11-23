import tape from 'tape'
import Database from 'better-sqlite3'
import { getAuthApi, authApi } from '../auth.js'
import { guardDb } from '../sql.ts'
import { getSamplesByName } from '../routes/termdb.getSamplesByName.ts'

async function ensureOpenAuth() {
	if (authApi) return
	const app = { doNotFreezeAuthApi: true, get() {}, post() {}, all() {}, use() {} }
	await getAuthApi(app, {}, {}, true)
}

tape('getSamplesByName(): includes ancestry without a filter', async t => {
	await ensureOpenAuth()
	const parentId = 10
	const sampleId = 20
	const connection = guardDb(new Database(':memory:'), 'off')
	connection.exec(`
		CREATE TABLE sampleidmap (id INTEGER, name TEXT);
		INSERT INTO sampleidmap VALUES (10, 'sample-10'), (20, 'sample-20');
	`)
	const ds = {
		cohort: {
			db: { connection },
			termdb: {
				displaySampleIds: true,
				hasSampleAncestry: true,
				q: {
					id2sampleRefs: id => (id === sampleId ? { ancestors: [{ ancestor_id: parentId }] } : { ancestors: [] })
				}
			}
		},
		sampleId2Name: new Map([
			[parentId, 'sample-10'],
			[sampleId, 'sample-20']
		]),
		sampleId2Type: new Map([[sampleId, 2]])
	}
	let result

	try {
		await getSamplesByName({}, {}, { send: data => (result = data) }, ds)

		t.deepEqual(
			result,
			{
				'sample-10': {
					id: parentId,
					name: 'sample-10',
					ancestor_id: undefined,
					ancestor_name: undefined,
					sample_type: undefined
				},
				'sample-20': {
					id: sampleId,
					name: 'sample-20',
					ancestor_id: parentId,
					ancestor_name: 'sample-10',
					sample_type: 2
				}
			},
			'should include the nearest ancestor and sample type for all unfiltered samples'
		)
	} finally {
		connection.close()
	}
	t.end()
})

tape('getSamplesByName(): applies limits to db-less samples', async t => {
	await ensureOpenAuth()
	const ds = {
		cohort: {
			termdb: {
				displaySampleIds: true,
				filterSamples: async () => new Set([20]),
				q: {
					id2sampleRefs: id => ({
						ancestors: id === 20 ? [{ ancestor_id: 10 }] : []
					})
				}
			}
		},
		sampleName2Id: new Map([
			['parent', 10],
			['included', 20]
		]),
		sampleId2Name: new Map([
			[10, 'parent'],
			[20, 'included']
		]),
		sampleId2Type: new Map([
			[10, 1],
			[20, 2]
		])
	}
	let result

	await getSamplesByName({ filter: { lst: [{ type: 'tvs' }] } }, {}, { send: data => (result = data) }, ds)

	t.deepEqual(Object.keys(result), ['included'], 'should return only samples permitted by mayLimitSamples()')
	t.deepEqual(
		result.included,
		{ id: 20, name: 'included', ancestor_id: 10, ancestor_name: 'parent', sample_type: 2 },
		'should preserve sample identity and ancestry metadata'
	)
	t.end()
})
