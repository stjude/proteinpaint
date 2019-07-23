const Partjson = require('../../modules/partjson')
const serverconfig = require('../../serverconfig.json')
const path = require('path')
const fs = require('fs')

/*
********************** EXPORTED
handle_request_closure
**********************
*/


async function precompute (tdb, rows, db) {
/*
  q: objectified URL query string
  ds: dataset
  res: express route callback's response argument
  tdb: cohort termdb tree 
  rows: data rows
*/
  
  try {
    console.log('Precomputing by sample and term_id')
    const pj = getPj(tdb, rows)
    pj.tree.pjtime = pj.times
    console.log(pj.times)
    may_save_json(tdb, pj.tree)
    generate_tsv(pj.tree.bySample, db)
  } catch(e) {
    console.log(e.message || e)
    if(e.stack) console.log(e.stack)
  }
}

exports.precompute = precompute


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
        '$sjlid': {
          byCondition: {
            '=term_id(]': {
              term_id: '@branch',
              maxGrade: '<$grade',
              mostRecentAge: '<$age',
              children: ['=subterm()'],
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
              sjlid: row.sjlid,
              term_id: key,
              // topmost lineage terms are root and CTCAE
              lineage: term.conditionlineage.slice(0,-2),
              age: event[age_key],
              grade: event[grade_key]
            })
          }
        } //console.log(gradedEvents)
        return gradedEvents
      },
      term_id(row, context) {
        return row.lineage
      },
      subterm(row, context) {
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
      const row = bySample[sample].byCondition[termid]
      csv += [sample, termid, 'grade', row.maxGrade, 'max_grade'].join('\t') + '\n'
      numRows++

      if (!row.mostRecentGrades) row.mostRecentGrades = []
      for(const grade of row.mostRecentGrades) {
        csv += [sample, termid, 'grade', grade, 'most_recent'].join('\t') + '\n'
        numRows++
      }

      if (!row.children) row.children = []
      for(const child of row.children) {
        csv += [sample, termid, 'child', child, 'computable_grade'].join('\t') + '\n'
        numRows++
      }

      if (!row.childrenAtMostRecent) row.childrenAtMostRecent = []
      for(const child of row.childrenAtMostRecent) {
        csv += [sample, termid, 'child', child, 'most_recent'].join('\t') + '\n'
        numRows++
      }

      if (!row.childrenAtMaxGrade) row.childrenAtMaxGrade = []
      for(const child of row.childrenAtMaxGrade) {
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
