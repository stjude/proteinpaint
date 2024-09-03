import serverconfig from '../serverconfig.js'
import path from 'path'
import bettersqlite from 'better-sqlite3'

/* 
  Load the dataset given a dataset label,
  which corresponds to a filename
  in proteinpaint/dataset/
*/

// may call as script from command line
// if (process.argv[2]) load_dataset(process.argv[2])

export async function init(dslabel) {
	serverconfig.tpmasterdir = path.join(import.meta.dirname, '../../test/tp')
	const ds = await get_dataset(dslabel)
	const db = bettersqlite(path.join(serverconfig.tpmasterdir, ds.cohort.db.file), {
		readonly: true,
		fileMustExist: true
	})
	load_termjson(ds, db)
	ds.cohort.cn = db
	ds.cohort.annotation = {}
	ds.cohort.annorows = []
	const loadedAnnoTerms = []
	return {
		ds,
		cn: db,
		setAnnoByTermId(term_id) {
			if (!term_id || loadedAnnoTerms.includes(term_id)) return
			loadedAnnoTerms.push(term_id)
			load_annotations(ds, db, term_id)
			load_precomputed(ds, db, term_id)
		}
	}
}

async function get_dataset(dslabel) {
	const _ds = await import('../../dataset/' + dslabel)
	const ds =
		typeof _ds == 'function' ? _ds({}) : typeof _ds.default == 'function' ? _ds.default({}) : _ds.default || _ds
	if (!ds) throw 'invalid dslabel'
	if (!ds.cohort) throw 'ds.cohort missing'

	const tdb = ds.cohort.termdb
	if (!tdb) throw 'no termdb for this dataset'

	ds.label = dslabel
	return ds
}

function load_termjson(ds, db) {
	console.log(ds.label + ': loading termjson from db.terms ...')
	const termdb = ds.cohort.termdb
	const rows = db.prepare('SELECT * FROM terms').all()
	const child2parent = {}
	for (const row in rows) {
		child2parent[row.id] = row.parent_id
	}

	if (!termdb.termjson) termdb.termjson = { map: new Map() }

	/************************************************************
	 ** new properties created on tdb{} must be duplicated here **
	 *************************************************************/
	if (!termdb.sampleTypes) termdb.sampleTypes = new Map()

	for (const row of rows) {
		//console.log(row.jsondata); console.log(Object.keys(row)); break
		const term = row.jsondata ? JSON.parse(row.jsondata) : {}
		delete row.jsondata
		termdb.termjson.map.set(row.id, Object.assign(term, row))
		if (term.iscondition && term.isleaf) {
			term.conditionlineage = get_term_lineage([term.id], term.id, child2parent)
		}
	}
}

/* set term ancestry recursively */
function get_term_lineage(lineage, termid, child2parent) {
	const pa = child2parent[termid]
	if (pa) {
		lineage.push(pa)
		return get_term_lineage(lineage, pa, child2parent)
	} else {
		return lineage
	}
}

function load_annotations(ds, db, term_id) {
	const anno = ds.cohort.annotation
	const termjson = ds.cohort.termdb.termjson
	const anno_tables = `SELECT * FROM anno_categorical UNION ALL SELECT * FROM anno_float UNION_ALL SELECT * FROM anno_integer`
	const rows = db.prepare(`SELECT * FROM (${anno_tables}) WHERE term_id = ?`).all(term_id)
	for (const row of rows) {
		if (!anno[row.sample]) {
			anno[row.sample] = { sample: row.sample }
			ds.cohort.annorows.push(anno[row.sample])
		}
		const term = termjson.map.get(row.term_id)
		anno[row.sample][row.term_id] =
			term && (term.type == 'integer' || term.type == 'float') ? Number(row.value) : row.value
	}
}

// will load precomputed data into ds.cohort.annotation
function load_precomputed(ds, db, term_id) {
	const rows = db.prepare('SELECT * FROM precomputed WHERE term_id = ?').all(term_id)
	const bySample = {}
	const termjson = ds.cohort.termdb.termjson
	const anno = ds.cohort.annotation
	const alias = {
		'child | computable_grade': 'children',
		'child | max_grade': 'childrenAtMaxGrade',
		'child | most_recent': 'childrenAtMostRecent',
		'grade | computable_grade': 'computableGrades',
		'grade | max_grade': 'maxGrade',
		'grade | most_recent': 'mostRecentGrades'
	}
	const restrictions = ['computable_grade', 'max_grade', 'most_recent']
	for (const row of rows) {
		if (!anno[row.sample]) {
			anno[row.sample] = { sample: row.sample }
			ds.cohort.annorows.push(anno[row.sample])
		}
		if (!anno[row.sample][row.term_id]) {
			anno[row.sample][row.term_id] = {}
		}
		for (const restriction of restrictions) {
			if (row[restriction]) {
				const key = alias[row.value_for + ' | ' + restriction]
				const value = row.value_for == 'grade' ? +row.value : row.value
				if (key == 'maxGrade') anno[row.sample][row.term_id][key] = value
				else {
					if (!anno[row.sample][row.term_id][key]) {
						anno[row.sample][row.term_id][key] = []
					}
					if (!anno[row.sample][row.term_id][key].includes(value)) {
						anno[row.sample][row.term_id][key].push(value)
					}
				}
			}
		}
	}
}
