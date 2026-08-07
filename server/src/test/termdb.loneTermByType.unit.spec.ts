import tape from 'tape'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { findLoneTermByType, server_init_db_queries } from '../termdb.server.init.ts'

/*
Tests:
	getTermsByTermType() - returns the terms of one type in a cohort, as term objects
	findLoneTermByType() - records the lone term of each type, per cohort
	findLoneTermByType() - no lone term when a type has more than one term
	findLoneTermByType() - skips a type whose count and term list disagree
	findLoneTermByType() - hook-based ds supplying its own q.getTermsByTermType()
	findLoneTermByType() - does not clobber a ds-supplied value
	findLoneTermByType() - no-op without termtypeByCohort or without the q helper
*/

tape('\n', t => {
	t.comment('-***- termdb.server.init findLoneTermByType -***-')
	t.end()
})

const os_ = { id: 'os', name: 'Overall survival', type: 'survival', unit: 'year' }
const efs = { id: 'efs', name: 'Event-free survival', type: 'survival' }
const grade = { id: 'grade', name: 'Grade', type: 'condition' }
const sex = { id: 'sex', name: 'Sex', type: 'categorical' }

const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'loneTerm-'))
const dbfiles: string[] = []

// the schema of the TermdbTest fixture, so a temp db has every table server_init_db_queries() touches
const schemaSql: string = new Database(path.join(import.meta.dirname, '../../test/tp/files/hg38/TermdbTest/db'), {
	readonly: true,
	fileMustExist: true
})
	.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'`)
	.all()
	.map((r: any) => r.sql)
	.join(';\n')

/* build a ds on an empty copy of the termdb schema holding only the given terms, so that the real
q.getTermsByTermType() built by server_init_db_queries() is exercised rather than a copy of it.
connect_db() only accepts a relative path under tpmasterdir or an absolute one, hence the tmp dir */
function mkDs(terms: any[], subcohortTerms: string[][], nested?: any) {
	const dbfile = path.join(tmpdir, `db${dbfiles.length}`)
	dbfiles.push(dbfile)
	const cn = new Database(dbfile)
	cn.pragma('foreign_keys = OFF') // only the terms/subcohort_terms rows below are seeded
	cn.exec(schemaSql)
	const ins = cn.prepare('INSERT INTO terms (id, name, jsondata, type, child_order) VALUES (?,?,?,?,?)')
	for (const [i, t] of terms.entries()) ins.run(t.id, t.name, JSON.stringify(t), t.type, i)
	const s = cn.prepare('INSERT INTO subcohort_terms (cohort, term_id) VALUES (?,?)')
	for (const r of subcohortTerms) s.run(r)
	cn.close()

	// sampleTypes{} is set by mds3.init.js before server_init_db_queries() runs
	const ds: any = { label: 'loneTermTest', cohort: { db: { file_fullpath: dbfile }, termdb: { sampleTypes: {} } } }
	server_init_db_queries(ds)
	if (nested) {
		// termtypeByCohort[] is an array with an extra .nested{} of per-cohort term type counts
		const t: any = []
		t.nested = nested
		ds.cohort.termdb.termtypeByCohort = t
	}
	return ds
}

tape('getTermsByTermType() returns the terms of one type in a cohort', t => {
	const ds = mkDs(
		[os_, efs, sex],
		[
			['ABC', 'os'],
			['ABC', 'sex'],
			['XYZ', 'os'],
			['XYZ', 'efs']
		]
	)
	const q = ds.cohort.termdb.q
	t.deepEqual(q.getTermsByTermType('survival', 'ABC'), [os_], 'one survival term in ABC')
	t.deepEqual(q.getTermsByTermType('survival', 'XYZ'), [os_, efs], 'two survival terms in XYZ, in child_order')
	t.deepEqual(q.getTermsByTermType('condition', 'ABC'), [], 'no condition term returns an empty array')
	t.deepEqual(q.getTermsByTermType('survival', 'ABC'), [os_], 'repeat call returns the cached result')
	t.end()
})

tape('findLoneTermByType() records the lone term of each type, per cohort', t => {
	const ds = mkDs(
		[os_, efs, grade, sex],
		[
			// ABC: one survival, one condition
			['ABC', 'os'],
			['ABC', 'grade'],
			['ABC', 'sex'],
			// XYZ: two survival, no condition
			['XYZ', 'os'],
			['XYZ', 'efs'],
			['XYZ', 'sex']
		],
		{ ABC: { survival: 1, condition: 1, categorical: 1 }, XYZ: { survival: 2, categorical: 1 } }
	)
	findLoneTermByType(ds)
	t.deepEqual(
		Object.keys(ds.cohort.termdb.loneTermByType),
		['ABC'],
		'only the cohort with a single term of a type is included'
	)
	t.deepEqual(ds.cohort.termdb.loneTermByType.ABC.survival, os_, 'the whole survival term object is stored')
	t.deepEqual(ds.cohort.termdb.loneTermByType.ABC.condition, grade, 'the whole condition term object is stored')
	t.end()
})

tape('findLoneTermByType() leaves loneTermByType unset when no type has a lone term', t => {
	const ds = mkDs(
		[os_, efs],
		[
			['', 'os'],
			['', 'efs']
		],
		{ '': { survival: 2 } }
	)
	findLoneTermByType(ds)
	t.equal(ds.cohort.termdb.loneTermByType, undefined, 'attribute is not created')
	t.end()
})

tape('findLoneTermByType() skips a type whose count and term list disagree', t => {
	// the count claims a lone survival term but the cohort actually has two
	const ds = mkDs(
		[os_, efs],
		[
			['', 'os'],
			['', 'efs']
		],
		{ '': { survival: 1 } }
	)
	findLoneTermByType(ds)
	t.equal(ds.cohort.termdb.loneTermByType, undefined, 'no term is guessed')
	t.end()
})

tape('findLoneTermByType() uses the q.getTermsByTermType() of a hook-based ds', t => {
	// gdc/mmrf build their dictionary in memory and supply their own version of the helper
	const id2term = new Map<string, any>([
		['case.disease_type', { id: 'case.disease_type', type: 'categorical' }],
		['Overall Survival', { id: 'Overall Survival', name: 'Overall Survival', type: 'survival' }]
	])
	const nested: any = []
	nested.nested = { '': { categorical: 1, survival: 1 } }
	const ds: any = {
		cohort: {
			termdb: {
				termtypeByCohort: nested,
				q: {
					getTermsByTermType: (termType: string) =>
						[...id2term.values()].filter(t => t.type == termType).map(t => structuredClone(t))
				}
			}
		}
	}
	findLoneTermByType(ds)
	t.deepEqual(
		ds.cohort.termdb.loneTermByType,
		{ '': { survival: { id: 'Overall Survival', name: 'Overall Survival', type: 'survival' } } },
		'the single survival term is found without a db'
	)
	t.end()
})

tape('findLoneTermByType() does not clobber a ds-supplied value', t => {
	const ds = mkDs([os_], [['', 'os']], { '': { survival: 1 } })
	ds.cohort.termdb.loneTermByType = { '': { survival: { id: 'preset' } } }
	findLoneTermByType(ds)
	t.deepEqual(ds.cohort.termdb.loneTermByType, { '': { survival: { id: 'preset' } } }, 'preset value is kept')
	t.end()
})

tape('findLoneTermByType() is a no-op without termtypeByCohort or the q helper', t => {
	// termtypeByCohort was never computed, so the term type counts are unknown
	const ds1 = mkDs([os_], [['', 'os']])
	findLoneTermByType(ds1)
	t.equal(ds1.cohort.termdb.loneTermByType, undefined, 'ds without termtypeByCohort is skipped')

	// ds does not supply the helper, so the term cannot be retrieved
	const nested: any = []
	nested.nested = { '': { survival: 1 } }
	const ds2: any = { cohort: { termdb: { termtypeByCohort: nested, q: {} } } }
	findLoneTermByType(ds2)
	t.equal(ds2.cohort.termdb.loneTermByType, undefined, 'ds without q.getTermsByTermType() is skipped')
	t.end()
})

tape('teardown', t => {
	fs.rmSync(tmpdir, { recursive: true, force: true })
	t.end()
})
