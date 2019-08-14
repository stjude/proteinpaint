const path = require('path')
const fs = require('fs')
const serverconfig = require('../../serverconfig.json')

/* 
  Load the dataset given a dataset label,
  which corresponds to a filename
  in proteinpaint/dataset/
*/

function load_dataset(dslabel) {
  const ds = get_dataset( dslabel )
  const termdb = ds.cohort.termdb

  load_term2term( termdb )
  load_termjson( termdb )
  ds.cohort.annotation = {}
  load_patientcondition( ds )
  load_cohort_files( ds )
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

  // migrate sjlife dataset sample id and file information here
  const samplenamekey = 'sjlid'
  ds.cohort.samplenamekey = samplenamekey
  ds.cohort.tohash = (item, ds)=>{
    const n = item[samplenamekey]
    if(ds.cohort.annotation[n]) {
      for(const k in item) {
        ds.cohort.annotation[n][k] = item[k]
      }
    } else {
      ds.cohort.annotation[ n ] = item
    }
  }
  ds.cohort.files = [
    {file:'files/hg38/sjlife/clinical/matrix'},
    {file:'files/hg38/sjlife/cohort/admix'},
  ]
  ds.cohort.termdb.term2term = {
    file: 'files/hg38/sjlife/clinical/term2term'
  }
  ds.cohort.termdb.termjson = {
    file: 'files/hg38/sjlife/clinical/termjson'
  }
  if (!ds.cohort.termdb.patient_condition) ds.cohort.termdb.patient_condition = {}
  ds.cohort.termdb.patient_condition.file = 'files/hg38/sjlife/clinical/annotation.outcome'
  // the precompute script will save the json object to this file
  // also, this will be loaded once during termdb.sql.spec.js testing
  ds.cohort.termdb.precomputed_file = 'files/hg38/sjlife/clinical/precomputed.json'
  // the precompute script will save the tsv to this file
  ds.cohort.db.precomputed_file = 'files/hg38/sjlife/clinical/chronicevents.precomputed'

  return ds
}


/*
  Code reused from porteinpaint/modules/termdb.js
  functions renamed from server_init_ to load_
  to reflect usage in this case
*/

function load_term2term ( termdb ) {
  if(!termdb.term2term) throw '.term2term{} missing'
  if(!termdb.term2term.file) throw 'term2term: unknown data source'
  const filename = path.join(serverconfig.tpmasterdir,termdb.term2term.file)
  const file = fs.readFileSync(filename, {encoding:'utf8'})
  if (!file) throw "error rading term2term file " + filename

  termdb.parent2children = new Map()
  // k: id, v: list of children id
  termdb.child2parent = new Map()
  // k: id, v: parent id

  for(const line of file.trim().split('\n')) {
    if(line[0]=='#') continue
    const [pa,child] = line.split('\t')
    termdb.child2parent.set( child, pa )
    if(!termdb.parent2children.has( pa )) termdb.parent2children.set( pa, [] )
    termdb.parent2children.get( pa ).push( child )
  }
}


function load_termjson ( termdb ) {
  if(!termdb.termjson) throw '.termjson{} missing'
  if(!termdb.termjson.file) throw 'termjson: unknown data source'
  const filename = path.join(serverconfig.tpmasterdir,termdb.termjson.file)
  const file = fs.readFileSync(filename,{encoding:'utf8'})
  if (!file) throw 'error loading termjson file ' + filename

  termdb.termjson.map = new Map()
  // k: term
  // v: {}
  let currTerm = -1
  let currLineage = []
  for(const line of file.trim().split('\n')) {
    if(line[0]=='#') continue
    const l = line.split('\t')
    const term = JSON.parse( l[1] )
    term.id = l[0]
    termdb.termjson.map.set( l[0], term )
    if (term.iscondition && term.isleaf) {
      term.conditionlineage = get_term_lineage([term.id], term.id, termdb.child2parent)
    }
  }
}

/* set term ancestry recursively */
function get_term_lineage (lineage, termid, child2parent) {
  const pa = child2parent.get( termid )
  if ( pa ) {
    lineage.push( pa )
    return get_term_lineage(lineage, pa , child2parent)
  } else {
    return lineage
  }
}


function load_patientcondition ( ds ) {
  const termdb = ds.cohort.termdb
  if(!termdb.patient_condition) return
  if(!termdb.patient_condition.file) throw 'file missing from termdb.patient_condition'
  const filename = path.join(serverconfig.tpmasterdir,termdb.patient_condition.file)
  // fileContents: lines of tab-separated sample,term,grade,age_graded,yearstoevent
  const fileContents = fs.readFileSync(filename,{encoding:'utf8'})
  if (!fileContents) throw 'error loading termjson file ' + filename

  const annotations = ds.cohort.annotation
  let count = 0
  for(const line of fileContents.trim().split('\n')) {
    const l = line.split('\t')
    const sample = l[0]
    if(!(annotations[sample])) {
      annotations[sample] = {}
      count++
    }
    const term_id = l[1]
    if (!annotations[sample][term_id]) {
      annotations[sample][term_id] = {conditionevents:[]}
    }
    annotations[sample][term_id].conditionevents.push({
      sample,
      term_id,
      grade: Number(l[2]),
      age:Number(l[3]),
      yearstoevent: Number(l[4])
    })
  }

  console.log(ds.label+': '+count+' samples loaded with condition data from '+ filename)
}



/*
  Code extracted from proteinpaint/app.js
*/

function load_cohort_files(ds) {
  if(!ds.cohort.files) throw '.files[] missing from .cohort'
  if(!Array.isArray(ds.cohort.files)) throw '.cohort.files is not array'
  if(!ds.cohort.tohash) throw '.tohash() missing from cohort'
  if(typeof ds.cohort.tohash !='function') throw '.cohort.tohash is not function'
  if(!ds.cohort.samplenamekey) throw '.samplenamekey missing'

  for(const file of ds.cohort.files) {
    if(!file.file) throw '.file missing from one of .cohort.files'
    const filename = path.join(serverconfig.tpmasterdir, file.file)
    const text = fs.readFileSync(filename,{encoding:'utf8'})
    if (!text) throw 'error reading cohort file ' + file.file
    const [err, items] = parse_textfilewithheader(text.trim())
    if(err) throw 'cohort annotation file "'+file.file+'": '+err
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
