import tape from 'tape'
import Database from 'better-sqlite3'
import { getAuthApi, authApi } from '../auth.js'
import { guardDb } from '../sql.ts'
import { get_AllSamplesByName } from '../termdb.js'

async function ensureOpenAuth() {
	if (authApi) return
	const app = { doNotFreezeAuthApi: true, get() {}, post() {}, all() {}, use() {} }
	await getAuthApi(app, {}, {}, true)
}

tape('get_AllSamplesByName(): includes ancestry without a filter', async t => {
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
		await get_AllSamplesByName({}, {}, { send: data => (result = data) }, ds)

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
