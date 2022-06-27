const utils = require('./utils')

/*
take list of terms and sample annotations that both are stored in-memory
load to sqlite db with random file name at cache
works for "ad-hoc" official datasets using flat files for metadata
benefit of converting to sqlite db: can use standard API at ds.cohort.termdb.q{}

TODO
- support hierarchy
- may later link with data browser card on app drawer? auto-create db with user-uploaded files

inputs:
dbfile=str
	full file path where the new db will be created; overrides existing file without warning
terms=[]
	array of term objects
annotations=Map
	k: sample name string
	v: map()
		k: term id
		v: value

no output
*/

export function makeTempSqliteDb({ terms, annotations, dbfile }) {
	if (!Array.isArray(terms) || !terms.length) throw 'terms[] not non-empty array'
	if (!(annotations instanceof Map)) throw 'annotations not map'
	if (typeof dbfile != 'string') throw 'dbfile not string'
	if (dbfile[0] != '/') throw 'dbfile not absolute path'

	const db = utils.connect_db(dbfile, { readonly: false, fileMustExist: false })

	// build tables
	db.exec(sqlTables)

	// populate tables
	loadTerms(db, terms)
	loadAnnotations(db, terms, annotations)

	// indexing
	db.exec(sqlIndexing)
}

function loadTerms(db, terms) {
	const insert = db.prepare('INSERT INTO terms VALUES (?,?,?,?,?,?,?)')
	const insertMany = db.transaction(rows => {
		for (const row of rows) insert.run(...row)
	})
	const rows = terms.map(t => {
		return [t.id, t.name, null, JSON.stringify(t), 1, t.type, 1]
	})
	insertMany(rows)
}
function loadAnnotations(db, terms, annotations) {
	const sample2id = new Map() // k: sample name, v: id

	{
		const insert = db.prepare('INSERT INTO sampleidmap VALUES (?,?)')
		const insertMany = db.transaction(rows => {
			for (const row of rows) insert.run(...row)
		})
		const rows = []
		let i = 1
		for (const sample of annotations.keys()) {
			sample2id.set(sample, i)
			rows.push([i, sample])
			i++
		}
		insertMany(rows)
	}

	const rowsAll = [],
		rowsCat = [],
		rowsFloat = [],
		rowsInt = [],
		termid2samplecount = new Map() // k: term id, v: set of samples

	for (const [sample, o] of annotations) {
		const si = sample2id.get(sample)
		for (const [tid, v] of o) {
			const row = [si, tid, v]
			rowsAll.push(row)
			const term = terms.find(i => i.id == tid)
			if (!term) continue
			switch (term.type) {
				case 'categorical':
					rowsCat.push(row)
					break
				case 'integer':
					rowsInt.push(row)
					break
				case 'float':
					rowsFloat.push(row)
					break
			}
			if (!termid2samplecount.has(tid)) termid2samplecount.set(tid, new Set())
			termid2samplecount.get(tid).add(si)
		}
	}

	{
		const insert = db.prepare('INSERT INTO annotations VALUES (?,?,?)')
		const insertMany = db.transaction(rows => {
			for (const row of rows) insert.run(...row)
		})
		insertMany(rowsAll)
	}
	{
		const insert = db.prepare('INSERT INTO anno_categorical VALUES (?,?,?)')
		const insertMany = db.transaction(rows => {
			for (const row of rows) insert.run(...row)
		})
		insertMany(rowsCat)
	}
	{
		const insert = db.prepare('INSERT INTO anno_integer VALUES (?,?,?)')
		const insertMany = db.transaction(rows => {
			for (const row of rows) insert.run(...row)
		})
		insertMany(rowsInt)
	}
	{
		const insert = db.prepare('INSERT INTO anno_float VALUES (?,?,?)')
		const insertMany = db.transaction(rows => {
			for (const row of rows) insert.run(...row)
		})
		insertMany(rowsFloat)
	}
	{
		const insert = db.prepare('INSERT INTO subcohort_terms VALUES (?,?,?,?,?)')
		const insertMany = db.transaction(rows => {
			for (const row of rows) insert.run(...row)
		})
		const rows = []
		for (const [tid, s] of termid2samplecount) {
			rows.push([null, tid, s.size, terms.find(i => i.id == tid).type, null])
		}
		insertMany(rows)
	}
}

const sqlTables = `
drop index if exists sidmap_id;
drop table if exists sampleidmap;
create table sampleidmap (
  id integer not null,
  name character varying(100) not null
);

drop index if exists terms_id;
drop index if exists terms_p;
drop index if exists terms_n;
drop table if exists terms;
create table terms (
  id character varying(100) not null,
  name character varying(100) not null,
  parent_id character varying(100),
  jsondata json not null,
  child_order integer not null,
  type text,
  isleaf integer
);

drop index if exists ancestry_tid;
drop index if exists ancestry_pid;
drop table if exists ancestry;
create table ancestry (
  term_id character varying(100) not null,
  ancestor_id character varying(100) not null
);


drop table if exists annotations;
drop index if exists a_sample;
drop index if exists a_termid;
drop index if exists a_value;
create table annotations (
  sample integer not null,
  term_id character varying(100) not null,
  value character varying(255) not null
);



drop table if exists anno_integer;
drop index if exists a_int_sample;
drop index if exists a_int_termid;
drop index if exists a_int_value;
create table anno_integer (
  sample integer not null,
  term_id character varying(100) not null,
  value integer not null
);

drop table if exists anno_float;
drop index if exists a_float_sample;
drop index if exists a_float_termid;
drop index if exists a_float_value;
create table anno_float (
  sample integer not null,
  term_id character varying(100) not null,
  value REAL not null
);


drop table if exists anno_categorical;
drop index if exists a_cat_sample;
drop index if exists a_cat_termid;
drop index if exists a_cat_value;
create table anno_categorical (
  sample integer not null,
  term_id character varying(100) not null,
  value character varying(255) not null
);

DROP TABLE IF EXISTS subcohort_terms;
DROP INDEX IF EXISTS subcohort_terms_cohort;
DROP INDEX IF EXISTS subcohort_terms_termid;
CREATE TABLE subcohort_terms (
 cohort TEXT,
 term_id TEXT,
 count INT,
 included_types TEXT,
 child_types TEXT
);


`

const sqlIndexing = `
create index sidmap_id on sampleidmap(id);

create index terms_id on terms(id);
create index terms_p on terms(parent_id);
create index terms_n on terms(name);

create index ancestry_tid on ancestry(term_id);
create index ancestry_pid on ancestry(ancestor_id);

create index a_sample on annotations(sample);
create index a_termid on annotations(term_id);
create index a_value on annotations(value);


create index a_int_sample on anno_integer(sample);
create index a_int_termid on anno_integer(term_id);
create index a_int_value on anno_integer(value);

create index a_float_sample on anno_float(sample);
create index a_float_termid on anno_float(term_id);
create index a_float_value on anno_float(value);

create index a_cat_sample on anno_categorical(sample);
create index a_cat_termid on anno_categorical(term_id);
create index a_cat_value on anno_categorical(value);

CREATE INDEX subcohort_terms_cohort ON subcohort_terms(cohort);
CREATE INDEX subcohort_terms_termid ON subcohort_terms(term_id);
`
