const app = require('../app')
const Partjson = require('./partjson')
const serverconfig = __non_webpack_require__('./serverconfig.json')

/*
********************** EXPORTED
handle_request_closure
**********************
*/

exports.handle_request_closure = ( genomes ) => {
  return async (req, res) => {
    const q = req.query
    app.log(req)
    try {
      const genome = genomes[ q.genome ]
      if(!genome) throw 'invalid genome'
      const ds = genome.datasets[ q.dslabel ]
      if(!ds) throw 'invalid dslabel'
      if(!ds.cohort) throw 'ds.cohort missing'
      const tdb = ds.cohort.termdb
      if(!tdb) throw 'no termdb for this dataset'
      if (tdb.precomputed) return
      tdb.precomputed = 'pending'
      const annorows = ds.cohort.annorows //.slice(0,3)
      if (!annorows) throw 'ds.cohort.annorows is missing' 
      if (!Array.isArray(annorows)) throw 'ds.cohort.annorows must be an array'

      // process triggers
      precompute(ds.cohort.db.connection, res, tdb, annorows)
    } catch(e) {
      res.send({error: (e.message || e)})
      if(e.stack) console.log(e.stack)
    }
  }
}

function precompute (dbconn, res, tdb, rows) {
/*
  q: objectified URL query string
  ds: dataset
  res: express route callback's response argument
  tdb: cohort termdb tree 
  rows: data rows
*/
  const pj = getPj(tdb, rows)
  pj.tree.pjtime = pj.times
  delete tdb.precomputed
  tdb.precomputed = pj.tree
  dbcache(dbconn, pj.tree.bySample)
  if (res) res.send(pj.times)
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
        const ids = []
        for(const id of context.self.children) {
          if (byCondition[id].maxGrade == context.self.maxGrade) {
            ids.push(id)
          }
        }
        return ids
      },
      childrenAtMostRecent(row, context) {
        if (!Array.isArray(context.self.children)) return []
        const byCondition = context.parent
        const ids = []
        for(const id of context.self.children) {
          if (byCondition[id].mostRecentAge == context.self.mostRecentAge) {
            ids.push(id)
          }
        }
        return ids
      }
    }
  })
}

exports.precompute = precompute

/*
  work in progress
*/
function dbcache(dbconn, bySample) { return;
  dbconn.exec(
    `DROP TABLE IF EXISTS precomputed;
    CREATE TABLE precomputed(
      sample TEXT,
      maxgrade INT,
      maxage REAL,
      children TEXT
    );`
  );
  for(const sample in bySample) {
    for(const row of Object.values(bySample[sample].byCondition)) {

    }
  }
}
