import tape from 'tape'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { server_init_db_queries, setSupportedChartTypes } from '../termdb.server.init.ts'

/*
Tests:
	termtypeByCohort{} - computed from the db, per cohort, with .numeric
	termtypeByCohort{} - ds preset is validated, gets .numeric and is frozen
	termtypeByCohort{} - legacy array preset is converted
	termtypeByCohort{} - invalid preset throws
	termtypeByCohort{} - computed even when the ds supplies its own getSupportedChartTypes()
	termtypeByCohort{} - left unset without a preset or a db
*/

tape('\n', t => {
	t.comment('-***- termdb.server.init termtypeByCohort -***-')
	t.end()
})

const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'termtypeByCohort-'))
let dbCount = 0

// the schema of the TermdbTest fixture, so a temp db has every table server_init_db_queries() touches
const schemaSql: string = new Database(path.join(import.meta.dirname, '../../test/tp/files/hg38/TermdbTest/db'), {
	readonly: true,
	fileMustExist: true
})
	.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'`)
	.all()
	.map((r: any) => r.sql)
	.join(';\n')

/* build a ds on an empty copy of the termdb schema holding only the given terms.
connect_db() only accepts a relative path under tpmasterdir or an absolute one, hence the tmp dir */
function mkDbDs(terms: any[], subcohortTerms: string[][]) {
	const dbfile = path.join(tmpdir, `db${dbCount++}`)
	const cn = new Database(dbfile)
	cn.pragma('foreign_keys = OFF') // only the terms/subcohort_terms rows below are seeded
	cn.exec(schemaSql)
	const ins = cn.prepare('INSERT INTO terms (id, name, jsondata, type, child_order) VALUES (?,?,?,?,?)')
	for (const [i, t] of terms.entries()) ins.run(t.id, t.name, JSON.stringify(t), t.type, i)
	const s = cn.prepare('INSERT INTO subcohort_terms (cohort, term_id) VALUES (?,?)')
	for (const r of subcohortTerms) s.run(r)
	cn.close()

	// sampleTypes{} is set by mds3.init.js before server_init_db_queries() runs
	const ds: any = { label: 'termtypeTest', cohort: { db: { file_fullpath: dbfile }, termdb: { sampleTypes: {} } } }
	server_init_db_queries(ds)
	return ds
}

tape('termtypeByCohort{} is computed from the db, per cohort, with .numeric', t => {
	const ds = mkDbDs(
		[
			{ id: 'branch', name: 'Branch', type: '' },
			{ id: 'sex', name: 'Sex', type: 'categorical' },
			{ id: 'age', name: 'Age', type: 'integer' },
			{ id: 'bmi', name: 'BMI', type: 'float' },
			{ id: 'os', name: 'Overall survival', type: 'survival' }
		],
		[
			['ABC', 'branch'],
			['ABC', 'sex'],
			['ABC', 'age'],
			['ABC', 'bmi'],
			['XYZ', 'sex'],
			['XYZ', 'os']
		]
	)
	setSupportedChartTypes(ds)
	const counts = ds.cohort.termdb.termtypeByCohort
	t.notOk(Array.isArray(counts), 'is a plain object, not an array')
	t.deepEqual(
		counts,
		{
			ABC: { numeric: 2, categorical: 1, float: 1, integer: 1 },
			XYZ: { numeric: 0, categorical: 1, survival: 1 }
		},
		'counts each term type per cohort, skips branch terms, and sums numeric types'
	)
	t.ok(Object.isFrozen(counts) && Object.isFrozen(counts.ABC), 'object and per-cohort counts are frozen')
	t.equal(typeof ds.cohort.termdb.q.getSupportedChartTypes, 'function', 'getSupportedChartTypes() is set')
	t.end()
})

tape('termtypeByCohort{} preset by ds is validated, gets .numeric and is frozen', t => {
	const preset = { '': { categorical: 3, float: 2, integer: 1 } }
	const ds: any = { cohort: { termdb: { termtypeByCohort: preset, q: {} } } }
	setSupportedChartTypes(ds)
	const counts = ds.cohort.termdb.termtypeByCohort
	t.deepEqual(counts, { '': { numeric: 3, categorical: 3, float: 2, integer: 1 } }, '.numeric is added')
	t.ok(Object.isFrozen(counts) && Object.isFrozen(counts['']), 'result is frozen')
	t.notOk(Object.isFrozen(preset), 'the ds-supplied object is copied, not modified')

	const ds2: any = { cohort: { termdb: { termtypeByCohort: { '': { float: 2, numeric: 99 } }, q: {} } } }
	setSupportedChartTypes(ds2)
	t.equal(ds2.cohort.termdb.termtypeByCohort[''].numeric, 2, 'a preset .numeric is recomputed')
	t.end()
})

tape('termtypeByCohort{} legacy array preset is converted', t => {
	// rows only, e.g. a ds module not yet migrated from the array shape
	const rows: any = [
		{ cohort: '', termType: 'categorical', termCount: 1 },
		{ cohort: '', termType: '', termCount: 5 }
	]
	const ds: any = { cohort: { termdb: { termtypeByCohort: rows, q: {} } } }
	setSupportedChartTypes(ds)
	t.deepEqual(ds.cohort.termdb.termtypeByCohort, { '': { numeric: 0, categorical: 1 } }, 'rows are grouped by cohort')

	// rows with .nested{}, as gdc/mmrf previously built it
	const withNested: any = [{ cohort: '', termType: 'float', termCount: 2 }]
	withNested.nested = { '': { float: 2 } }
	const ds2: any = { cohort: { termdb: { termtypeByCohort: withNested, q: {} } } }
	setSupportedChartTypes(ds2)
	t.deepEqual(ds2.cohort.termdb.termtypeByCohort, { '': { numeric: 2, float: 2 } }, '.nested{} is used')
	t.end()
})

tape('termtypeByCohort{} invalid preset throws', t => {
	const mk = (termtypeByCohort: any) => ({ cohort: { termdb: { termtypeByCohort, q: {} } } })
	t.throws(() => setSupportedChartTypes(mk('x')), /is not an object/, 'non-object preset')
	t.throws(() => setSupportedChartTypes(mk({ '': [1] })), /\[""\] is not an object/, 'non-object cohort counts')
	t.throws(
		() => setSupportedChartTypes(mk({ '': { float: '2' } })),
		/float is not a non-negative integer/,
		'non-numeric count'
	)
	t.end()
})

tape('termtypeByCohort{} is computed even when the ds supplies its own getSupportedChartTypes()', t => {
	const ds = mkDbDs([{ id: 'sex', name: 'Sex', type: 'categorical' }], [['', 'sex']])
	const ownGetter = () => ({ '': ['summary'] })
	ds.cohort.termdb.q.getSupportedChartTypes = ownGetter
	setSupportedChartTypes(ds)
	t.deepEqual(ds.cohort.termdb.termtypeByCohort, { '': { numeric: 0, categorical: 1 } }, 'counts are computed')
	t.equal(ds.cohort.termdb.q.getSupportedChartTypes, ownGetter, 'ds-supplied getter is kept')
	t.end()
})

tape('termtypeByCohort{} is left unset without a preset or a db', t => {
	const ds: any = { cohort: { termdb: { q: {} } } }
	setSupportedChartTypes(ds)
	t.equal(ds.cohort.termdb.termtypeByCohort, undefined, 'not set')
	t.equal(ds.cohort.termdb.q.getSupportedChartTypes, undefined, 'getSupportedChartTypes() not set')
	t.end()
})

tape('teardown', t => {
	fs.rmSync(tmpdir, { recursive: true, force: true })
	t.end()
})
