const serverconfig = require('../../serverconfig.json')
const path = require("path")
const bettersqlite = require('better-sqlite3')

/* 
  Load the dataset given a dataset label,
  which corresponds to a filename
  in proteinpaint/dataset/
*/

// may call as script from command line
// if (process.argv[2]) load_dataset(process.argv[2])

function load_dataset(dslabel) {
  const ds = get_dataset( dslabel )
  const db = bettersqlite( path.join(serverconfig.tpmasterdir, ds.cohort.db.file), {readonly:true, fileMustExist:true} )
  load_termjson( ds, db )
  load_annotations( ds, db)
  load_precomputed( ds, db );
  ds.cohort.annorows = Object.values(ds.cohort.annotation);  //console.log(ds.cohort.annorows.slice(0,5).map(d=>d.sample))
  return ds
}

exports.load_dataset = load_dataset


function get_dataset(dslabel) {
  const dsfilename = path.join('../../dataset', dslabel)
  const ds = require(dsfilename)
  if(!ds) throw 'invalid dslabel'
  if(!ds.cohort) throw 'ds.cohort missing'

  const tdb = ds.cohort.termdb
  if(!tdb) throw 'no termdb for this dataset'
  
  ds.label = dslabel
  return ds
}

function load_termjson ( ds, db ) {
  console.log(ds.label + ': loading termjson from db.terms ...')
  const termdb = ds.cohort.termdb
  const rows = db.prepare('SELECT * FROM terms').all()
  const child2parent = {}
  for(const row in rows) {
    child2parent[row.id] = row.parent_id
  }

  if (!termdb.termjson) termdb.termjson = {map: new Map()}
  for(const row of rows) { //console.log(row.jsondata); console.log(Object.keys(row)); break
    const term = row.jsondata ? JSON.parse(row.jsondata) : {}
    delete row.jsondata
    termdb.termjson.map.set(row.id, Object.assign(term,row))
    if (term.iscondition && term.isleaf) {
      term.conditionlineage = get_term_lineage([term.id], term.id, child2parent)
    }
  }
}

/* set term ancestry recursively */
function get_term_lineage (lineage, termid, child2parent) {
  const pa = child2parent[termid]
  if ( pa ) {
    lineage.push( pa )
    return get_term_lineage(lineage, pa , child2parent)
  } else {
    return lineage
  }
}


function load_annotations ( ds, db ) {
  console.log(ds.label + ': loading annotations from db ...')
  const annotation = {}
  const termjson = ds.cohort.termdb.termjson
  const rows = db.prepare('SELECT * FROM annotations').all()
  for(const row of rows) {
    if (!(annotation[row.sample])) annotation[row.sample] = {sample: row.sample}
    const term = termjson.map.get(row.term_id)
    annotation[row.sample][row.term_id] = term && (term.isinteger || term.isfloat) ? Number(row.value) : row.value
  }
  ds.cohort.annotation = annotation
}

function load_precomputed(ds, db) {
  console.log(ds.label + ': loading precomputed from db ...')
  const rows = db.prepare('SELECT * FROM precomputed').all()
  const bySample = {}
  const termjson = ds.cohort.termdb.termjson
  const alias = {
    "child | computable_grade": "children",
    "child | max_grade": "childrenAtMaxGrade",
    "child | most_recent": "childrenAtMostRecent",
    "grade | computable_grade": "computableGrades",
    "grade | max_grade": "maxGrade",
    "grade | most_recent": "mostRecentGrades",
  }; let i=0;
  for(const row of rows) {
    if (!bySample[row.sample]) bySample[row.sample] = {}
    if (!bySample[row.sample][row.term_id]) {
      bySample[row.sample][row.term_id] = {}
    }
    const key = alias[row.value_for + " | " + row.restriction]
    const value = row.value_for == "grade" ? +row.value : row.value
    if (key == "maxGrade") bySample[row.sample][row.term_id][key] = value
    else {
      if (!bySample[row.sample][row.term_id][key]) {
        bySample[row.sample][row.term_id][key] = []
      }
      if (!bySample[row.sample][row.term_id][key].includes(value)) {
        bySample[row.sample][row.term_id][key].push(value)
      }
    }
  }
  ds.cohort.termdb.precomputed = bySample
}
