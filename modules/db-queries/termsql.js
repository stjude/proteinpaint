const app = require('../../app')
const utils = require('../utils')

// work in progress, mostly for practice 
// using better-sqlite3 and the db schema

export function handle_request_closure(genomes) {
  return async (req, res) => {
    app.log( req )

    const q = req.query
    let db
    try {
      if (!q || !Object.keys(q).length) return listExampleUrls(res) 

      const genome = genomes[ q.genome ]
      if(!genome) throw 'invalid genome'
      const ds = genome.datasets[ q.dslabel ]
      if(!ds) throw 'invalid dslabel'
      if(!ds.cohort) throw 'ds.cohort missing'
      const dbfile = ds.cohort.db && ds.cohort.db.file
      if(!dbfile) throw 'no db for this dataset'
      const tdb = ds.cohort.termdb
      if(!tdb) throw 'no termdb for this dataset'
      if (!q.term1) throw 'term1 is missing'
      const term1 = tdb.termjson.map.get(q.term1)
      if (!term1) throw 'missing termjson entry for term1='+ q.term1
      const term2 = q.term2 ? tdb.termjson.map.get(q.term2) : null
      if (q.term2 && !term2) throw 'missing termjson entry for term2='+ q.term2
      
      const startTime = +(new Date())
      db = utils.connect_db(dbfile)
      let result = []
      if (term1.iscondition || (term2 && term2.iscondition)) {
        result = handleConditionTerms(db, term1, term2, q)   
      }
      db.close()
      res.send({
        dbtime: +(new Date()) - startTime,
        result
      })   
    } catch(e) {
      if (db) db.close()
      res.send({error: (e.message || e)})
      if(e.stack) console.log(e.stack)
    }
  }
}

function listExampleUrls(res) {
  // do not show this if in production
  const path = "/termsql?genome=hg38&dslabel=SJLife&"
  const urls = []
  const examples = require('./examples')

  function getList(items){
    return items.map(d=>{
      const url = examples.getURL(d)
      urls.push(url)
      return `<li onclick='fetch("${url}").then(response=>response.json()).then(console.log)' style="cursor: pointer; margin:5px;">
        ${d.title}: ${d.description}
      </li>`
    }).join("\n")
  }

  const conditionItems = getList(examples.data.conditions)
  res.send(`
    <h2>Example Requests</h2>
    <p>To use, <b>click on a list entry</b> then check your browser's dev tools.</p>
    <button onclick='runAll()'>Run All Examples</button>
    <h3>Condition terms</h3>
    <ul>${conditionItems}</ul>
    <script>
      function runAll() {
        ${JSON.stringify(urls)}.forEach(url=>{
          fetch(url).then(response=>response.json()).then(data=>console.log(url,data))
        })
      }
    </script>
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

templates["max_grade_perperson | max_grade_by_subcondition"] = sameConditionTemplate('grade','child')
templates["by_children | max_grade_by_subcondition"] = sameConditionTemplate('child','grade')

function sameConditionTemplate(bar, overlay) {
  return `WITH 
children AS (
  SELECT child
  FROM term2term
  WHERE parent = ?
),
descendants AS (
  SELECT c.child as child, term_id
  FROM ancestry a, children c
  WHERE c.child = a.ancestor_id OR c.child = a.term_id
  UNION ALL
  SELECT d.child as child, a.term_id
  FROM ancestry a, descendants d
  WHERE a.ancestor_id = d.term_id
),
maxgrade AS (
  SELECT d.child as child, sample, MAX(grade) AS grade
  FROM chronicevents a
  INNER JOIN descendants d ON d.term_id = a.term_id
  WHERE a.grade IN (1,2,3,4,5)
  GROUP BY d.child, sample
)
SELECT
  ${bar} AS bar,
  ${overlay} AS overlay,
  COUNT(*) AS total
FROM maxgrade
GROUP BY grade, child`
}
