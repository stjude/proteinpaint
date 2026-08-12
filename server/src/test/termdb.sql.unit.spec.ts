import tape from 'tape'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { mayMapFilterToTermSamples } from '../termdb.sql.js'
import { getSampleData_dictionaryTerms_termdb } from '../termdb.matrix.js'
import { server_init_db_queries } from '../termdb.server.init.ts'

/* a two-level dataset: patients (type 1) are the parents of samples (type 2).
survival and subtype annotate patients, purity annotates samples, and a geneVariant
term is non-dictionary and thus annotates the default (leaf) sample type */
function getDs() {
	return {
		cohort: {
			termdb: {
				sampleTypes: {
					1: { name: 'patient', plural_name: 'patients', parent_id: null },
					2: { name: 'sample', plural_name: 'samples', parent_id: 1 }
				},
				term2SampleType: new Map([
					['Event-free_survival', 1],
					['AGE_YRS', 1],
					['purity', 2]
				])
			}
		}
	}
}

const filter = { filters: 'f_0 AS (...), f AS (SELECT * FROM f_0)', CTEname: 'f', values: ['Subtype'] }
const survivalTerm = { id: 'Event-free_survival', type: 'survival' }
const sampleLevelTerm = { id: 'purity', type: 'float' }

tape('\n', test => {
	test.pass('-***- termdb.sql mayMapFilterToTermSamples -***-')
	test.end()
})

tape('mayMapFilterToTermSamples() maps a parent-level term back to parent ids', test => {
	const q = { ds: getDs(), mapParent2Children: true, sampleType: 2 }
	const mapped = mayMapFilterToTermSamples(filter, q, survivalTerm)
	test.notEqual(mapped.CTEname, filter.CTEname, 'should not reuse the child-level CTE name')
	test.ok(
		mapped.CTEname.includes('sample_ancestry') && mapped.CTEname.includes('sa.sample_id IN f'),
		'should resolve the filtered child ids to their ancestors'
	)
	test.ok(mapped.CTEname.includes('sm.sample_type = 1'), 'should restrict the ancestors to the parent sample type')
	test.equal(mapped.filters, filter.filters, 'should carry over the filter CTE definitions unchanged')
	test.deepEqual(mapped.values, filter.values, 'should carry over the filter values unchanged')
	test.equal(filter.CTEname, 'f', 'should not mutate the supplied filter')
	test.end()
})

tape('mayMapFilterToTermSamples() returns the filter unchanged when there is nothing to map', test => {
	const ds = getDs()
	test.equal(
		mayMapFilterToTermSamples(filter, { ds, mapParent2Children: false, sampleType: 2 }, survivalTerm),
		filter,
		'no parent-to-children mapping in effect'
	)
	test.equal(
		mayMapFilterToTermSamples(null, { ds, mapParent2Children: true, sampleType: 2 }, survivalTerm),
		null,
		'no filter'
	)
	test.equal(
		mayMapFilterToTermSamples(filter, { ds, mapParent2Children: true, sampleType: 2 }, sampleLevelTerm),
		filter,
		'term already annotates the query sample type'
	)
	test.equal(
		mayMapFilterToTermSamples(filter, { ds, mapParent2Children: true, sampleType: 1 }, survivalTerm),
		filter,
		'query sample type is the root, thus has no parent to map to'
	)
	test.equal(
		mayMapFilterToTermSamples(filter, { ds, mapParent2Children: true, sampleType: 3 }, survivalTerm),
		filter,
		'unknown query sample type'
	)
	test.end()
})

tape('mayMapFilterToTermSamples() leaves a non-dictionary term unmapped', test => {
	// a geneVariant term annotates the leaf sample type, which is what the filter already resolved to
	const q = { ds: getDs(), mapParent2Children: true, sampleType: 2 }
	const geneVariantTerm = { type: 'geneVariant', name: 'KRAS' }
	test.equal(mayMapFilterToTermSamples(filter, q, geneVariantTerm), filter, 'should return the filter unchanged')
	test.end()
})

/**************************************************************************************
db-backed regression coverage for a parent-level term going blank under a filter.

The tests above only pin down the helper's string output; they stay green if
get_term_cte() stops handing the mapped filter to a term CTE, which is the defect
itself. These run the real getFilterCTEs() -> get_term_cte() -> getAnnotationRows()
cascade against SQLite, covering both CTEs that restrict their own rows by the filter:
the survival term (which went empty, the reported bug) and the numeric term (whose bins
were computed over an empty value set). Reverting either call site fails them.
***************************************************************************************/

const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'termdbSql-'))

// the schema of the TermdbTest fixture, so the temp db has every table the query cascade touches
const schemaSql: string = new Database(path.join(import.meta.dirname, '../../test/tp/files/hg38/TermdbTest/db'), {
	readonly: true,
	fileMustExist: true
})
	.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'`)
	.all()
	.map((r: any) => r.sql)
	.join(';\n')

const efsTerm = { id: 'efs', name: 'Event-free survival', type: 'survival' }
const subtypeTerm = { id: 'subtype', name: 'Subtype', type: 'categorical' }
const ageTerm = { id: 'age', name: 'Age', type: 'float' }

/* a minimal two-level dataset in the shape that triggers the bug: both the survival term
and the filter term annotate patients, while the queried sample type is their children.
	patient 1 (subtype=A, efs, age 45) -> samples 11, 12
	patient 2 (subtype=B, efs, age 200) -> sample 21
the TermdbTest fixture cannot stand in for this: its survival terms are sample_type=2,
so no parent-to-children mapping is ever triggered for them */
function mkDs() {
	const dbfile = path.join(tmpdir, 'db')
	const cn = new Database(dbfile)
	cn.pragma('foreign_keys = OFF') // only the rows seeded below are needed
	cn.exec(schemaSql)

	const sampleTypes = cn.prepare('INSERT INTO sample_types (id, name, plural_name, parent_id) VALUES (?,?,?,?)')
	sampleTypes.run(1, 'patient', 'patients', null)
	sampleTypes.run(2, 'sample', 'samples', 1)

	const sample = cn.prepare('INSERT INTO sampleidmap (id, name, sample_type) VALUES (?,?,?)')
	sample.run(1, 'P1', 1)
	sample.run(2, 'P2', 1)
	sample.run(11, 'P1_s1', 2)
	sample.run(12, 'P1_s2', 2)
	sample.run(21, 'P2_s1', 2)

	const ancestry = cn.prepare('INSERT INTO sample_ancestry (sample_id, ancestor_id, distance) VALUES (?,?,?)')
	ancestry.run(11, 1, 1)
	ancestry.run(12, 1, 1)
	ancestry.run(21, 2, 1)

	const term = cn.prepare(
		'INSERT INTO terms (id, name, jsondata, child_order, type, isleaf, sample_type) VALUES (?,?,?,?,?,?,?)'
	)
	for (const [i, t] of [efsTerm, subtypeTerm, ageTerm].entries()) {
		term.run(t.id, t.name, JSON.stringify(t), i, t.type, 1, 1)
	}

	const anno = cn.prepare('INSERT INTO anno_categorical (sample, term_id, value) VALUES (?,?,?)')
	anno.run(1, 'subtype', 'A')
	anno.run(2, 'subtype', 'B')

	const float = cn.prepare('INSERT INTO anno_float (sample, term_id, value) VALUES (?,?,?)')
	float.run(1, 'age', 45)
	float.run(2, 'age', 200)

	const surv = cn.prepare('INSERT INTO survival (sample, term_id, tte, exit_code) VALUES (?,?,?,?)')
	surv.run(1, 'efs', 5, 1)
	surv.run(2, 'efs', 7, 0)

	cn.close()

	// sampleTypes{} is set by mds3.init.js before server_init_db_queries() runs
	const ds: any = { label: 'termdbSqlTest', cohort: { db: { file_fullpath: dbfile }, termdb: { sampleTypes: {} } } }
	server_init_db_queries(ds)
	return ds
}

let cachedDs: any
function getSeededDs() {
	// every test below only reads, so one seeded db serves them all
	if (!cachedDs) cachedDs = mkDs()
	return cachedDs
}

const subtypeIsA = {
	type: 'tvslst',
	in: true,
	join: '',
	lst: [{ type: 'tvs', tvs: { term: subtypeTerm, values: [{ key: 'A', label: 'A' }] } }]
}

tape('patient-level survival is served under a patient-level filter mapped to child samples', async test => {
	const ds = getSeededDs()
	const efsTw = { $id: 'efs$id', term: efsTerm, q: {} }
	// a sample-level term in the same request is what puts the query in the child sample type,
	// e.g. a geneVariant overlay; here that state is supplied directly
	const q = { ds, filter: subtypeIsA, mapParent2Children: true, sampleType: 2 }

	const [samples] = await getSampleData_dictionaryTerms_termdb(q, [efsTw])

	test.deepEqual(
		Object.keys(samples).sort(),
		['11', '12'],
		'should annotate both child samples of the filtered patient, and no other sample'
	)
	test.deepEqual(
		samples[11],
		{ sample: 11, efs$id: { key: 1, value: 5 } },
		`should carry the parent's survival value onto the child sample`
	)
	test.equal(samples[21], undefined, 'should exclude the child of the patient that the filter excludes')
	test.end()
})

tape('a patient-level filter still applies when there is no parent-to-children mapping', async test => {
	const ds = getSeededDs()
	const efsTw = { $id: 'efs$id', term: efsTerm, q: {} }
	// all terms in this request annotate patients, so the query stays in the patient sample type
	const q = { ds, filter: subtypeIsA, mapParent2Children: false }

	const [samples] = await getSampleData_dictionaryTerms_termdb(q, [efsTw])

	test.deepEqual(Object.keys(samples), ['1'], 'should return the filtered patient only')
	test.deepEqual(samples[1], { sample: 1, efs$id: { key: 1, value: 5 } }, 'should return that patient survival value')
	test.end()
})

tape('a patient-level numeric term bins over the filtered patients, not an empty set', async test => {
	const ds = getSeededDs()
	// the bin boundaries are computed from the min/max of the values the filter admits,
	// which get_numericMinMaxPct() reads with the same filter the term CTE uses
	const ageTw = {
		$id: 'age$id',
		term: ageTerm,
		q: { mode: 'discrete', type: 'regular-bin', bin_size: 20, first_bin: { startunbounded: true, stop: 20 } }
	}
	const q = { ds, filter: subtypeIsA, mapParent2Children: true, sampleType: 2 }

	const [samples, byTermId] = await getSampleData_dictionaryTerms_termdb(q, [ageTw])

	test.deepEqual(
		byTermId['age$id'].bins.map((b: any) => b.name || b.label),
		['<20', '20 to <40', '≥40'],
		'should bin up to the filtered patient age of 45, not the unfiltered max of 200'
	)
	test.deepEqual(
		Object.keys(samples).sort(),
		['11', '12'],
		'should bin both child samples of the filtered patient, and no other sample'
	)
	test.deepEqual(samples[11], { sample: 11, age$id: { key: '≥40', value: 45 } }, 'should assign the parent age bin')
	test.end()
})

tape('teardown', test => {
	fs.rmSync(tmpdir, { recursive: true, force: true })
	test.end()
})
