import tape from 'tape'
import Database from 'better-sqlite3'
import { getAuthApi, authApi } from '../auth.js'
import { barchart_data } from '../termdb.barchart.js'
import { guardDb } from '../sql.ts'

async function ensureOpenAuth() {
	if (authApi) return
	const app = { doNotFreezeAuthApi: true, get() {}, post() {}, all() {}, use() {} }
	await getAuthApi(app, {}, {}, true)
}

tape('barchart_data: passes sample types and mapping to getData', async t => {
	await ensureOpenAuth()
	const connection = guardDb(new Database(':memory:'), 'off')
	connection.exec(`
		CREATE TABLE sampleidmap (id INTEGER, sample_type INTEGER);
		CREATE TABLE sample_ancestry (sample_id INTEGER, ancestor_id INTEGER);
		CREATE TABLE anno_categorical (sample INTEGER, term_id TEXT, value TEXT);
		INSERT INTO sampleidmap VALUES (10, 1), (20, 2), (30, 2);
		INSERT INTO sample_ancestry VALUES (20, 10), (30, 10);
		INSERT INTO anno_categorical VALUES (10, 'status', 'positive');
	`)
	const ds = {
		cohort: {
			db: { connection },
			termdb: {
				hasSampleAncestry: true,
				sampleTypes: {
					1: { name: 'Parent', plural_name: 'Parents', parent_id: null },
					2: { name: 'Child', plural_name: 'Children', parent_id: 1 }
				},
				term2SampleType: new Map()
			}
		}
	}
	try {
		const result = await barchart_data(
			{
				term1: {
					$id: 'status',
					term: { id: 'status', name: 'Status', type: 'categorical', sampleTypes: [1] },
					q: { type: 'values' }
				},
				sampleTypes: [2],
				sampleMapping: 'parentToChildren'
			},
			ds,
			ds.cohort.termdb
		)
		t.deepEqual(
			result.data.charts[0].serieses.map(({ seriesId, total }) => [seriesId, total]),
			[['positive', 2]],
			'parent annotation is counted once for each requested child sample'
		)
	} finally {
		connection.close()
	}
	t.end()
})
