const serverconfig = require('../../serverconfig.json')
const path = require('path')
const fs = require('fs')
const Partjson = require('../../modules/partjson')
const load_dataset = require('./load.sjlife').load_dataset

/*
  Precompute dataset values to help speed up 
  server response as needed
  
  call with dataset label
  node ./precompute.ctcae.js
  
  - ds.cohort
      .db
        .precomputed_file # tsv format
      .termdb
        .precomputed_file # json format

  the tsv output file will be loaded to the
  database via load.sql, which is not part of this script
*/

precompute()

function precompute() {
  const ds = verify_ds()
  const tdb = ds.cohort.termdb
  const db = ds.cohort.db
  const data = Object.values(ds.cohort.annotation)

  try {
    console.log('Precomputing by sample and term_id')
    const pj = getPj(tdb, data)
    pj.tree.pjtime = pj.times
    console.log(pj.times)
    may_save_json(tdb, pj.tree)
    generate_tsv(pj.tree.bySample, db)
  } catch(e) {
    console.log(e.message || e)
    if(e.stack) console.log(e.stack)
  }
}

function verify_ds() {
  const dslabel = 'sjlife2.hg38.js'
  const ds = load_dataset(dslabel)
  const tdb = ds.cohort.termdb
  if(!tdb) throw 'no termdb for this dataset'
  if (!tdb.precomputed_file) {
    console.log('Warning: Precomputed values will not be loaded in memory since the ds.cohort.termdb.precomputed_file is not defined.')
  }
  if (!ds.cohort.db || !ds.cohort.db.precomputed_file) {
    console.log('Warning: No db tables will be generated since the ds.cohort.db.precomputed_file is not defined')
  }

  return ds
}

function getPj(tdb, data) {
  const events_key = tdb.patient_condition.events_key
  const grade_key = tdb.patient_condition.grade_key
  const age_key = tdb.patient_condition.age_key
  const uncomputable = tdb.patient_condition.uncomputable_grades || {}

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
        if (!row.sjlid) return []
        const gradedEvents = []
        for(const key in row) {
          if (typeof row[key] != 'object') continue
          if (!row[key] || !(events_key in row[key])) continue;
          if (key == 'CTCAE Graded Events') continue
          const term = tdb.termjson.map.get(key)
          if (!term || !term.iscondition) continue
          for(const event of row[key][events_key]) {
            if (uncomputable[event[grade_key]]) continue
            gradedEvents.push({
              sample: row.sjlid,
              term_id: key,
              // topmost lineage terms are root and CTCAE
              lineage: term.conditionlineage.slice(0,-2),
              age: event[age_key],
              grade: event[grade_key]
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

async function may_save_json(tdb, results) {
  if (!tdb.precomputed_file) return 
  const filename = path.join(serverconfig.tpmasterdir,tdb.precomputed_file)
  await write_file(filename, JSON.stringify(results))
  console.log('Saved precomputed values to '+ filename)
}

function generate_tsv(bySample, db) {
  if (!db || !db.file || !db.precomputed_file) {
    console.log('Warning: precomputed tsv filename not defined')
    return
  }
  const precomputed_file = path.join(serverconfig.tpmasterdir,db.precomputed_file)
  
  console.log("Creating data for precompute tsv file")
  let csv = '', numSamples=0, numRows=0
  for(const sample in bySample) { 
    numSamples++
    for(const termid in bySample[sample].byCondition) {
      const subresult = bySample[sample].byCondition[termid]
      csv += [sample, termid, 'grade', subresult.maxGrade, 'max_grade'].join('\t') + '\n'
      numRows++

      if (!subresult.mostRecentGrades) subresult.mostRecentGrades = []
      for(const grade of subresult.mostRecentGrades) {
        csv += [sample, termid, 'grade', grade, 'most_recent'].join('\t') + '\n'
        numRows++
      }

      if (!subresult.computableGrades) subresult.computableGrades = []
      for(const grade of subresult.computableGrades) {
        csv += [sample, termid, 'grade', grade, 'computable_grade'].join('\t') + '\n'
        numRows++
      }

      if (!subresult.children) subresult.children = []
      for(const child of subresult.children) {
        csv += [sample, termid, 'child', child, 'computable_grade'].join('\t') + '\n'
        numRows++
      }

      if (!subresult.childrenAtMostRecent) subresult.childrenAtMostRecent = []
      for(const child of subresult.childrenAtMostRecent) {
        csv += [sample, termid, 'child', child, 'most_recent'].join('\t') + '\n'
        numRows++
      }

      if (!subresult.childrenAtMaxGrade) subresult.childrenAtMaxGrade = []
      for(const child of subresult.childrenAtMaxGrade) {
        csv += [sample, termid, 'child', child, 'max_grade'].join('\t') + '\n'
        numRows++
      }
    }
  }
  write_file(precomputed_file, csv)
  console.log('Saved precomputed csv to '+ precomputed_file +":")
  console.log("number of samples="+ numSamples, ", rows="+ numRows)
}


/* 
  extracted from modules/utils/js
*/

function write_file ( file, text ) {
  return new Promise((resolve, reject)=>{
    fs.writeFile( file, text, (err)=>{
      if(err) reject('cannot write')
      resolve()
    })
  })
}

function read_file ( file ) {
  return new Promise((resolve,reject)=>{
    fs.readFile( file, {encoding:'utf8'}, (err,txt)=>{
      // must use reject in callback, not throw
      if(err) reject('cannot read file')
      resolve(txt)
    })
  })
}
