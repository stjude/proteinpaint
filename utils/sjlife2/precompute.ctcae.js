/*
  Precompute dataset values to help speed up 
  server response as needed
  
  call with dataset label
  ./precompute.ctcae.sh dslabel # from your-tp-dir/cohort-dir/...

  The output and precompute script filenames 
  are declared in dataset/dslabel.js as
  
  - ds.cohort
      .db
        .precomputed_file # tsv format
      .termdb
        .precomputed_file # json format
        .precompute_script # js file

  the tsv output file will be loaded to the
  database via load.sql, which is not part of this script
*/

const path = require('path')
const fs = require('fs')
const serverconfig = require('../../serverconfig.json')

/***********************
  Sanity checks
************************/

const dslabel = process.argv[2]
if(!dslabel) throw 'usage: ./precompute.ctcae.sh dslabel # from your-tp-dir/cohort-dir/...'

const dsfilename = path.join('../../dataset', dslabel)
const ds = require(dsfilename)
if(!ds) throw 'invalid dslabel'
if(!ds.cohort) throw 'ds.cohort missing'
if(!ds.cohort.files) return '.files[] missing from .cohort'
if(!Array.isArray(ds.cohort.files)) return '.cohort.files is not array'
if(!ds.cohort.tohash) return '.tohash() missing from cohort'
if(typeof ds.cohort.tohash !='function') return '.cohort.tohash is not function'
if(!ds.cohort.samplenamekey) return '.samplenamekey missing'

const tdb = ds.cohort.termdb
if(!tdb) throw 'no termdb for this dataset'
if (!tdb.precompute_script) throw 'ds.cohort.termdb.precompute_script missing'
if (!tdb.precomputed_file) 
  console.log('Warning: Precomputed values will not be loaded in memory since the ds.cohort.termdb.precomputed_file is not defined.')
if (!ds.cohort.db || !ds.cohort.db.precomputed_file) 
  console.log('Warning: No db tables will be generated since the ds.cohort.db.precomputed_file is not defined')


/***********************
  Process dataset files
************************/

ds.label = dslabel
ds.cohort.annotation = {}
server_init(ds)
load_cohort_files(ds)

const precompute = require('./'+tdb.precompute_script).precompute
precompute(tdb, Object.values(ds.cohort.annotation), ds.cohort.db)


/***********************
   Borrowed code
************************/

/*
  Code extracted from porteinpaint/modules/termdb.js
*/

///////////// server init
function server_init ( ds ) {
/* to initiate termdb for a mds dataset
*/
  const termdb = ds.cohort.termdb

  if(!termdb.term2term) throw '.term2term{} missing'
  server_init_parse_term2term( termdb )

  if(!termdb.termjson) throw '.termjson{} missing'
  server_init_parse_termjson( termdb )

  server_init_mayparse_patientcondition( ds )
}





function server_init_parse_term2term ( termdb ) {

  if(termdb.term2term.file) {
    // one single text file

    termdb.parent2children = new Map()
    // k: id, v: list of children id
    termdb.child2parent = new Map()
    // k: id, v: parent id

    for(const line of fs.readFileSync(path.join(serverconfig.tpmasterdir,termdb.term2term.file),{encoding:'utf8'}).trim().split('\n') ) {
      if(line[0]=='#') continue
      const [pa,child] = line.split('\t')
      termdb.child2parent.set( child, pa )
      if(!termdb.parent2children.has( pa )) termdb.parent2children.set( pa, [] )
      termdb.parent2children.get( pa ).push( child )
    }
    return
  }
  // maybe sqlitedb
  throw 'term2term: unknown data source'
}



function server_init_parse_termjson ( termdb ) {
  if(termdb.termjson.file) {
    termdb.termjson.map = new Map()
    // k: term
    // v: {}
    let currTerm = -1
    let currLineage = []
    for(const line of fs.readFileSync(path.join(serverconfig.tpmasterdir,termdb.termjson.file),{encoding:'utf8'}).trim().split('\n') ) {
      if(line[0]=='#') continue
      const l = line.split('\t')
      const term = JSON.parse( l[1] )
      term.id = l[0]
      termdb.termjson.map.set( l[0], term )
      if (term.iscondition && term.isleaf) {
        term.conditionlineage = get_term_lineage([term.id], term.id, termdb.child2parent)
      }
    }
    return
  }
  throw 'termjson: unknown data source'
}

function get_term_lineage (lineage, termid, child2parent) {
  const pa = child2parent.get( termid )
  if ( pa ) {
    lineage.push( pa )
    return get_term_lineage(lineage, pa , child2parent)
  } else {
    return lineage
  }
}


function server_init_mayparse_patientcondition ( ds ) {
  if(!ds.cohort.termdb.patient_condition) return
  if(!ds.cohort.termdb.patient_condition.file) throw 'file missing from termdb.patient_condition'
  let count=0
  for(const line of fs.readFileSync(path.join(serverconfig.tpmasterdir,ds.cohort.termdb.patient_condition.file),{encoding:'utf8'}).trim().split('\n')) {
    const l = line.split('\t')
    ds.cohort.annotation[ l[0] ] = JSON.parse(l[1])
    count++
  }
  console.log(ds.label+': '+count+' samples loaded with condition data from '+ds.cohort.termdb.patient_condition.file)
}



/*
  Code extracted from proteinpaint/app.js
*/

function load_cohort_files(ds) {
  for(const file of ds.cohort.files) {
    if(!file.file) return '.file missing from one of .cohort.files'
    const [err, items] = parse_textfilewithheader( fs.readFileSync(path.join(serverconfig.tpmasterdir, file.file),{encoding:'utf8'}).trim() )
    if(err) return 'cohort annotation file "'+file.file+'": '+err
    //if(items.length==0) return 'no content from sample annotation file '+file.file
    console.log(ds.label+': '+items.length+' samples loaded from annotation file '+file.file)
    items.forEach( i=> {

      // may need to parse certain values into particular format

      for(const k in i) {
        let attr
        if( ds.cohort.sampleAttribute ) {
          attr = ds.cohort.sampleAttribute.attributes[ k ]
        }
        if( !attr ) {
          if( ds.cohort.termdb && ds.cohort.termdb.termjson && ds.cohort.termdb.termjson.map ) {
            attr = ds.cohort.termdb.termjson.map.get( k )
          }
        }
        if(attr) {
          if(attr.isfloat) {
            i[k] = Number.parseFloat(i[k])
          } else if(attr.isinteger) {
            i[k] = Number.parseInt(i[k])
          }
        }
      }

      ds.cohort.tohash(i, ds)
    })
  }
  ds.cohort.annorows = Object.values(ds.cohort.annotation)
  console.log(ds.label+': total samples from sample table: '+ds.cohort.annorows.length)
}

function parse_textfilewithheader( text ) {
  /*
  for sample annotation file, first line is header, skip lines start with #
  parse each line as an item
  */
  const lines = text.split(/\r?\n/)
  /*
  if(lines.length<=1) return ['no content']
  if(lines[0] == '') return ['empty header line']
  */

  // allow empty file
  if(lines.length<=1 || !lines[0]) return [null,[]]

  const header = lines[0].split('\t')
  const items = []
  for(let i=1; i<lines.length; i++) {
    if(lines[i][0]=='#') continue
    const l = lines[i].split('\t')
    const item = {}
    for(let j=0; j<header.length; j++) {
      const value = l[j]
      if(value) {
        item[ header[j] ] = value
      }
    }
    items.push(item)
  }
  return [null, items]
}
