import tape from 'tape'
import Database from 'better-sqlite3'
import { getAuthApi, authApi } from '#src/auth.ts'
import { guardDb } from '#src/sql.ts'
import { get_samplecount } from '#src/termdb.sql.js'

async function ensureOpenAuth() {
	if (authApi) return
	const app = { doNotFreezeAuthApi: true, get() {}, post() {}, all() {}, use() {} }
	await getAuthApi(app, {}, {}, true)
}

tape('get_samplecount returns singular, plural, empty, and non-database counts', async t => {
	await ensureOpenAuth()
	const connection = guardDb(new Database(':memory:'), 'off')
	connection.exec(`
		CREATE TABLE sampleidmap (id INTEGER, name TEXT);
		CREATE TABLE anno_categorical (sample INTEGER, term_id TEXT, value TEXT);
		INSERT INTO sampleidmap VALUES (20, 'C1'), (30, 'C2'), (40, 'C3');
		INSERT INTO anno_categorical VALUES
			(20, 'status', 'selected'),
			(30, 'status', 'selected'),
			(40, 'status', 'single');
	`)
	const ds = {
		cohort: {
			db: { connection },
			termdb: {
				sampleTypes: {
					1: { name: 'patient', plural_name: 'patients', parent_id: null },
					2: { name: 'child', plural_name: 'children', parent_id: 1 }
				},
				term2SampleType: new Map()
			}
		},
		sampleId2Type: new Map([
			[20, 2],
			[30, 2],
			[40, 2]
		])
	}
	function makeQuery(value) {
		return {
			filter: {
				type: 'tvslst',
				in: true,
				lst: [
					{
						type: 'tvs',
						tvs: {
							term: { id: 'status', name: 'Status', type: 'categorical', sampleTypes: [2] },
							values: [{ key: value }]
						}
					}
				]
			}
		}
	}

	try {
		t.equal((await get_samplecount(makeQuery('selected'), ds)).count, '2 children', 'pluralizes the count')
		t.equal((await get_samplecount(makeQuery('single'), ds)).count, '1 child', 'uses a singular label')
		t.equal((await get_samplecount(makeQuery('missing'), ds)).count, '0 samples', 'reports an empty result')
		t.equal(
			(await get_samplecount(makeQuery('selected'), { cohort: { termdb: {} } })).count,
			'n/a',
			'uses the placeholder for non-database datasets'
		)
	} finally {
		connection.close()
	}
	t.end()
})
