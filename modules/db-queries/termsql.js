const app = require('../../app')
const utils = require('../utils')

// work in progress, mostly for practice 
// using better-sqlite3 and the db schema

export function handle_request_closure(genomes) {
  return async (req, res) => {
    app.log( req )

    const q = req.query
    try {
      if (!q || !Object.keys(q).length) return listExampleUrls(res) 

      const genome = genomes[ q.genome ]
      if(!genome) throw 'invalid genome'
      const ds = genome.datasets[ q.dslabel ]
      if(!ds) throw 'invalid dslabel'
      if(!ds.cohort) throw 'ds.cohort missing'
      const tdb = ds.cohort.termdb
      if(!tdb) throw 'no termdb for this dataset'
      
      if (!q.term1) throw 'term1 is missing'
      const term1 = tdb.termjson.map.get(q.term1)
      if (!term1) throw 'missing termjson entry for term1='+ q.term1
      const term2 = q.term2 ? tdb.termjson.map.get(q.term2) : null
      if (q.term2 && !term2) throw 'missing termjson entry for term2='+ q.term2

      const dbfile = ds.cohort.db && ds.cohort.db.file
      if(!dbfile) throw 'no db for this dataset'
      const db = utils.connect_db(dbfile)
      const startTime = +(new Date())
      if (term1.iscondition || (term2 && term2.iscondition)) {
        res.send({
          totalTime: +(new Date()) - startTime,
          result: handleConditionTerms(db, term1, term2, q)
        })      
      }
    } catch(e) {
      res.send({error: (e.message || e)})
      if(e.stack) console.log(e.stack)
    }
  }
}

function listExampleUrls(res) {
  // do not show this if in production
  const items = [{
    title: "Same condition, overlay=children",
    description: "term1, term2, unit1=max_grade_perperson, unit2=max_grade_by_subcondition",
    url: 'term1=Cardiovascular%20System&term2=Cardiovascular%20System&unit1=max_grade_perperson&unit2=max_grade_by_subcondition'
  },{
    title: "Same condition, overlay=grade",
    description: "term1, term2, unit1=by_children, unit2=max_grade_by_subcondition",
    url: 'term1=Cardiovascular%20System&term2=Cardiovascular%20System&unit1=by_children&unit2=max_grade_by_subcondition'
  }].map(d=>`<li>
    <a href="/termsql?genome=hg38&dslabel=SJLife&${d.url}">${d.title}</a>: ${d.description}
  </li>`).join("\n")

  res.send(`
    <h2>Example URLs</h2>
    <h3>Condition terms</h3>
    <ul>${items}</ul>
  `)
}

function handleConditionTerms(db, term1, term2, q) {
  const template = templates[q.unit1+' | '+ q.unit2]
  if (!template) throw 'missing SQL template'
  const sql = db.prepare(template)

  return q.unit2 == "max_grade_by_subcondition"
    ? sql.all(term1.id)
    : term1 && term2
    ? sql.all({id1: term1.id, id2: term2.id})
    : sql.all(term1.id)
}

const templates = {}

templates["max_grade_perperson | max_grade_by_subcondition"] = sameConditionTemplate('grade','ancestor_id')
templates["by_children | max_grade_by_subcondition"] = sameConditionTemplate('ancestor_id','grade')

function sameConditionTemplate(bar, overlay) {
  return `WITH 
children AS (
  SELECT child
  FROM term2term
  WHERE parent = ?
),
descendants AS (
  SELECT term_id, ancestor_id
  FROM ancestry
  INNER JOIN children c ON c.child = ancestry.ancestor_id
),
maxgrade AS (
  SELECT ancestor_id, sample, MAX(grade) AS grade
  FROM chronicevents a
  INNER JOIN descendants ON descendants.term_id = a.term_id
  WHERE a.grade IN (1,2,3,4,5)
  GROUP BY ancestor_id, sample
)
SELECT
  ${bar} AS bar,
  ${overlay} AS overlay,
  COUNT(*) AS total
FROM maxgrade
GROUP BY grade, ancestor_id`
}
