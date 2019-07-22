const app = require('../app')
const Partjson = require('./partjson')
const serverconfig = __non_webpack_require__('./serverconfig.json')
const path = require('path')
const utils = require('./utils')
const fs = require('fs')
const { exec } = require('child_process')

/*
********************** EXPORTED
handle_request_closure
**********************
*/

exports.handle_request_closure = ( genomes ) => {
  return async (req, res) => {
    const q = req.query
    app.log(req)
    // can force file caching and table reset
    if (!q.force) q.force=''
    try {
      const genome = genomes[ q.genome ]
      if(!genome) throw 'invalid genome'
      const ds = genome.datasets[ q.dslabel ]
      if(!ds) throw 'invalid dslabel'
      if(!ds.cohort) throw 'ds.cohort missing'
      const tdb = ds.cohort.termdb
      if(!tdb) throw 'no termdb for this dataset'
      if (!tdb.precomputed_file) throw 'termdb.precomputed_file is not in dataset config'
      if (tdb.precompute_pending) throw 'precompute is already pending'
      tdb.precompute_pending = 1
      const annorows = ds.cohort.annorows //.slice(0,300)
      if (!annorows) throw 'ds.cohort.annorows is missing' 
      if (!Array.isArray(annorows)) throw 'ds.cohort.annorows must be an array'
      // process triggers
      await precompute(q, ds.cohort.db, res, tdb, annorows) //.slice(0,35))
    } catch(e) {
      res.send({error: (e.message || e)})
      if(e.stack) console.log(e.stack)
    }
  }
}

async function precompute (q, db, res, tdb, rows) {
/*
  q: objectified URL query string
  ds: dataset
  res: express route callback's response argument
  tdb: cohort termdb tree 
  rows: data rows
*/
  const filename = path.join(serverconfig.tpmasterdir,tdb.precomputed_file)
  try {
    const file = fs.existsSync(filename) ? await utils.read_file(filename, {encoding:'utf8'}) : ''
    const mssg0 = 'verify import with sqlite3> select count(*) from precomputed;'  
    const mssg1 = 'or manually trigger the import from the pp project folder with terminal$ '
    
    if (q.force.includes('json') || !file) {
      console.log('Precomputing by sample and term_id')
      const pj = getPj(tdb, rows)
      pj.tree.pjtime = pj.times
      tdb.precomputed = pj.tree
      utils.write_file(filename, JSON.stringify(pj.tree))
      console.log('Saved precomputed values to '+ filename)
      tdb.precompute_pending = 0 
      const mssg = dbcache(q, db, tdb.precomputed.bySample, [mssg0, mssg1])
      if (res) res.send({times: pj.times, ok: mssg})
    } else {
      console.log("Reusing precomputed values from file "+ filename)
      tdb.precomputed = JSON.parse(file.trim())
      tdb.precompute_pending = 0
      const mssg = dbcache(q, db, tdb.precomputed.bySample, [mssg0, mssg1])
      if (res) res.send({ok: mssg})
    }
  } catch(e) {
    res.send({error: (e.message || e)})
    if(e.stack) console.log(e.stack)
  }
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

exports.precompute = precompute

/*
  work in progress
*/
function dbcache(q, db, bySample, messages) {
  if (!db || !db.file || !db.precomputed_file) return
  const precomputed_file = path.join(serverconfig.tpmasterdir,db.precomputed_file)
  if (q.force.includes('tsv') || !fs.existsSync(precomputed_file)) {
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
    utils.write_file(precomputed_file, csv)
    console.log('Saved precomputed csv to '+ precomputed_file +": samples="+ numSamples, ", rows="+ numRows)
  }
  if (!q.force.includes('tsv') && exec(`sqlite3 db "select count(1) from sqlite_master where name='precomputed'"`)) {
    const mssg = 'The precomputed table has already been imported.' 
    console.log(mssg)
    return mssg
  } else {
    console.log('Starting import into the precompute table from '+ precomputed_file)
    const dbfile = path.join(serverconfig.tpmasterdir,db.file)
    const cmd = `./utils/precomputed.sh ${dbfile} ${precomputed_file}`
    console.log(cmd)
    exec(cmd, function errHandler(err) {
      if (err) throw err
      else {
        console.log(messages[0])
        console.log(messages[1] + cmd)
      }
    })
    return [messages[0], messages[1] + cmd]
  }
}
