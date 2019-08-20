const serverconfig = require('../../serverconfig.json')
const path = require('path')
const fs = require('fs')
const Partjson = require('../../modules/partjson')

/*
  Precompute dataset values to help speed up 
  server response as needed
*/

if(process.argv.length!=5) {
	console.log('<termdb> <annotation.outcome> <dataset.js>, output to "precomputed.json" and stdout for loading to db')
	process.exit()
}

const termdbfile = process.argv[2]
// input file with lines of term_id \t name \t parent_id \t {termjson}
const outcomesfile = process.argv[3]
// input file with lines of sample,term,grade,age_graded,yearstoevent
const datasetjsfile = process.argv[4]
// input dataset js file, for accessing termdb configs



const uncomputableGrades = new Set()
{
	const ds = require(datasetjsfile)
	if( ds.cohort.termdb.patient_condition.uncomputable_grades ) {
		for(const k in ds.cohort.termdb.patient_condition.uncomputable_grades) uncomputableGrades.add( Number(k) )
	}
}




try {
	const terms = load_terms(termdbfile)
	const annotations = load_patientcondition(outcomesfile, terms)
	const pj = getPj(terms, annotations)
	pj.tree.pjtime = pj.times
	generate_tsv(pj.tree.bySample)
} catch(e) {
	console.log(e.message || e)
	if(e.stack) console.log(e.stack)
}









function load_terms (termdbfile) {
  const file = fs.readFileSync(termdbfile, {encoding:'utf8'}) // throws upon invalid file name
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

function load_patientcondition (outcomesfile, terms) {
// outcomesfiles: lines of tab-separated sample,term,grade,age_graded,yearstoevent
	const annotations = []
	for(const line of fs.readFileSync(outcomesfile, {encoding:'utf8'}).trim().split('\n')) {
		const l = line.split('\t')
		const grade = Number(l[2])
		if( uncomputableGrades.has( grade )) continue
		const sample = l[0]
		const term_id = l[1]
		const term = terms[ term_id ]
		annotations.push({
			sample,
			term_id,
			grade,
			age:Number(l[3]),
      // remove the top-most terms, [..., CTCAE, root]
			lineage: term.conditionlineage.slice(0,-2),
		})
	}
	return annotations
}

function getPj (terms, data) {

  return new Partjson({
    data,
    template: {
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

