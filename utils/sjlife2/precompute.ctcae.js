const serverconfig = require('../../serverconfig.json')
const path = require('path')
const fs = require('fs')
const Partjson = require('../../modules/partjson')

/*
  Precompute dataset values to help speed up 
  server response as needed
  
  node ./precompute.ctcae.js [termdbfile outcomesfile jsontarget] > chronicevents.precomputed
  
  where
    termdbfile:                     (optional renamed) input file with lines of term_id \t name \t parent_id \t {termjson}
    outcomesfile:                   (optional renamed) input file with lines of sample \t {term_id: {conditionevents: [grae, age, yearstoevent]}}
    jsontarget:                     (optional renamed) will save the json formatted results to this file
    chronicevents.precomputed:      the expected tsv output filename for autoloading via load.sql

  the tsv output file should be loaded to the
  database via load.sql, which is not part of this script
*/

precompute()

function precompute () {
  const termdbfile = process.argv[3] || 'termdb'
  if (!termdbfile) throw "missing termdbfile argument"
  const outcomesfile = process.argv[4] || 'outcomes_2017'
  if (!outcomesfile) throw "missing outcomesfile argument"
  const jsontarget = process.argv[5] || 'precomputed.json'
  if (!jsontarget) throw "missing jsontarget argument"

  const terms = load_terms(termdbfile)
  const annotations = load_patientcondition(outcomesfile)
  const data = Object.values(annotations)

  try {
    //console.log('Precomputing by sample and term_id')
    const pj = getPj(terms, data)
    pj.tree.pjtime = pj.times
    //console.log(pj.times)
    save_json(jsontarget, pj.tree)
    generate_tsv(pj.tree.bySample)
  } catch(e) {
    console.log(e.message || e)
    if(e.stack) console.log(e.stack)
  }
}

function load_terms (termdbfile) {
  const file = fs.readFileSync(termdbfile, {encoding:'utf8'})
  if (!file) throw `error loading termdb file '${termdbfile}'`
  const terms = {}
  const child2parent = Object.create(null)
  // {term_id: parent id}

  for(const line of file.trim().split('\n')) {
    if(line[0]=='#') continue
    const [id, name, parent_id, jsontext] = line.split('\t')
    terms[id] = Object.assign(JSON.parse(jsontext), {id, parent_id, name})
    child2parent[id] = parent_id
  }

  for(const id in terms) {
    const term = terms[id]
    if (term.iscondition && term.isleaf) {
      term.conditionlineage = get_term_lineage([id], id, child2parent)
    }
  }
  return terms
}

/* set term ancestry recursively */
function get_term_lineage (lineage, termid, child2parent) {
  const pa = child2parent[ termid ]
  if ( pa ) {
    lineage.push( pa )
    return get_term_lineage(lineage, pa , child2parent)
  } else {
    return lineage
  }
}

function load_patientcondition (outcomesfile) {
  const file = fs.readFileSync(outcomesfile, {encoding:'utf8'})
  if (!file) throw `error loading outcomes file '${outcomesfile}'`
  const annotations = {}

  let count=0
  for(const line of file.trim().split('\n')) {
    const l = line.split('\t')
    const sample = l[0]
    annotations[ sample ] = JSON.parse(l[1])
    annotations[ sample ].sample = sample
    count++
  }
  //console.log(ds.label+': '+count+' samples loaded with condition data from '+ outcomesfile)
  return annotations
}

function getPj (terms, data) {
  const uncomputable = {0: 'No symptom', 9: 'Unknown status'}

  return new Partjson({
    data,
    template: {
      "@split()": "=splitDataRow()",
      bySample: {
        '$sample': {
          byCondition: {
            '$lineage[]': {
              term_id: '@branch',
              maxGrade: '<$grade',
              mostRecentAge: '<$age',
              children: ['=child()'],
              computableGrades: ['$grade', "set"],
              '__:childrenAtMaxGrade': ['=childrenAtMaxGrade(]'],
              '__:childrenAtMostRecent': ['=childrenAtMostRecent(]'],
              '~gradesByAge': {
                '$age': ['$grade', 'set']
              },
              '__:mostRecentGrades': '=mostRecentGrades()'
            }
          }
        }
      }
    },
    "=": {
      splitDataRow(row) {
        if (!row.sample) return []
        const gradedEvents = []
        for(const key in row) {
          if (typeof row[key] != 'object') continue
          if (!row[key] || !('conditionevents' in row[key])) continue;
          if (key == 'CTCAE Graded Events') continue
          const term = terms[key]
          if (!term || !term.iscondition) continue
          for(const event of row[key].conditionevents) {
            if (uncomputable[event.grade]) continue
            gradedEvents.push({
              sample: row.sample,
              term_id: key,
              // topmost lineage terms are root and CTCAE
              lineage: term.conditionlineage.slice(0,-2),
              age: event.age,
              grade: event.grade
            })
          }
        }
        return gradedEvents
      },
      child(row, context) {
        if (context.branch == row.term_id) return
        const i = row.lineage.indexOf(context.branch)
        return row.lineage[i-1]
      },
      childrenAtMaxGrade(row, context) {
        if (!Array.isArray(context.self.children)) return []
        const byCondition = context.parent
        const ids = new Set()
        for(const id of context.self.children) {
          if (byCondition[id].maxGrade == context.self.maxGrade) {
            ids.add(id)
          }
        }
        return [...ids]
      },
      childrenAtMostRecent(row, context) {
        if (!Array.isArray(context.self.children)) return []
        const byCondition = context.parent
        const ids = new Set()
        for(const id of context.self.children) {
          if (byCondition[id].mostRecentAge == context.self.mostRecentAge) {
            ids.add(id)
          }
        }
        return [...ids]
      },
      mostRecentGrades(row, context) {
        return [...context.self.gradesByAge[context.self.mostRecentAge]]
      }
    }
  })
}

async function save_json(precomputed_file, results) {
  if (!precomputed_file) return
  await write_file(precomputed_file, JSON.stringify(results))
  //console.log('Saved precomputed values to '+ filename)
}


// will output to file via bash argument
function generate_tsv(bySample) { //console.log(Object.keys(bySample).length); return;
  let csv = '', numSamples=0, numRows=0
  for(const sample in bySample) { 
    numSamples++
    for(const termid in bySample[sample].byCondition) {
      const subresult = bySample[sample].byCondition[termid]
      console.log([sample, termid, 'grade', subresult.maxGrade, 'max_grade'].join('\t'))
      numRows++

      if (!subresult.mostRecentGrades) subresult.mostRecentGrades = []
      for(const grade of subresult.mostRecentGrades) {
        console.log([sample, termid, 'grade', grade, 'most_recent'].join('\t'))
        numRows++
      }

      if (!subresult.computableGrades) subresult.computableGrades = []
      for(const grade of subresult.computableGrades) {
        console.log([sample, termid, 'grade', grade, 'computable_grade'].join('\t'))
        numRows++
      }

      if (!subresult.children) subresult.children = []
      for(const child of subresult.children) {
        console.log([sample, termid, 'child', child, 'computable_grade'].join('\t'))
        numRows++
      }

      if (!subresult.childrenAtMostRecent) subresult.childrenAtMostRecent = []
      for(const child of subresult.childrenAtMostRecent) {
        console.log([sample, termid, 'child', child, 'most_recent'].join('\t'))
        numRows++
      }

      if (!subresult.childrenAtMaxGrade) subresult.childrenAtMaxGrade = []
      for(const child of subresult.childrenAtMaxGrade) {
        console.log([sample, termid, 'child', child, 'max_grade'].join('\t'))
        numRows++
      }
    }
  }
  //write_file(precomputed_file, csv)
  //console.log('Saved precomputed csv to '+ precomputed_file +":")
  //console.log("number of samples="+ numSamples, ", rows="+ numRows)
}

function write_file ( file, text ) {
  return new Promise((resolve, reject)=>{
    fs.writeFile( file, text, (err)=>{
      if(err) reject('cannot write')
      resolve()
    })
  })
}

