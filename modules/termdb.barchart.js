const app = require('../app')
const path = require('path')
const utils = require('./utils')
const Partjson = require('./partjson')
const serverconfig = __non_webpack_require__('./serverconfig.json')
const sample_match_termvaluesetting = require('./mds2.load.vcf').sample_match_termvaluesetting
const d3format = require('d3-format')
const binLabelFormatter = d3format.format('.3r')
const request=require('request')

/*
********************** EXPORTED
handle_request_closure
**********************
get_AF
*/

exports.handle_request_closure = ( genomes ) => {
  may_trigger_precompute(genomes)

  return async (req, res) => {
    const q = req.query
    if (q.custom_bins) {
      try {
        q.custom_bins = JSON.parse(decodeURIComponent(q.custom_bins))
      } catch(e) {
        app.log(req)
        res.send({error: (e.message || e)})
        if(e.stack) console.log(e.stack)
      }
    } 
    if (q.filter) {
      try {
        q.filter = JSON.parse(decodeURIComponent(q.filter))
      } catch(e) {
        app.log(req)
        res.send({error: (e.message || e)})
        if(e.stack) console.log(e.stack)
      }
    }
    app.log(req)
    if (!q.term0) q.term0 = ''
    if (!q.term2) q.term2 = ''
    try {
      const genome = genomes[ q.genome ]
      if(!genome) throw 'invalid genome'
      const ds = genome.datasets[ q.dslabel ]
      if(!ds) throw 'invalid dslabel'
      if(!ds.cohort) throw 'ds.cohort missing'
      const tdb = ds.cohort.termdb
      if(!tdb) throw 'no termdb for this dataset'
      if(tdb.precomputed_file && !tdb.precomputed) throw 'Precompute is pending'
      // process triggers
      await barchart_data( q, ds, res, tdb )
    } catch(e) {
      res.send({error: (e.message || e)})
      if(e.stack) console.log(e.stack)
    }
  }
}

async function barchart_data ( q, ds, res, tdb ) {
/*
  q: objectified URL query string
  ds: dataset
  res: express route callback's response argument
  tdb: cohort termdb tree 
*/
  if(!ds.cohort) throw 'cohort missing from ds'
  if(!ds.cohort.annorows) throw `cohort.annorows is missing`
  // request-specific variables
  const startTime = +(new Date())
  const inReqs = [getTrackers(), getTrackers(), getTrackers()]
  inReqs.filterFxn = ()=>1 // default allow all rows, may be replaced via q.termfilter
  await setValFxns(q, inReqs, ds, tdb);
  const pj = getPj(q, inReqs, ds.cohort.annorows, tdb, ds)
  if (pj.tree.results) pj.tree.results.pjtime = pj.times
  res.send(pj.tree.results)
}

function getTrackers() {
  return {
    joinFxns: {"": () => ""}, // keys are term0, term1, term2 names; ...
    numValFxns: {"": () => {}}, // ... if key == empty string then the term is not specified
    unannotated: "",
    orderedLabels: [],
    unannotatedLabels: [],
    bins: [],
    uncomputable_grades: {}
  }
}

// template for partjson, already stringified so that it does not 
// have to be re-stringified within partjson refresh for every request
const template = JSON.stringify({
  "@errmode": ["","","",""],
  "@before()": "=prep()",
  "@join()": {
    "idVal": "=idVal()"
  },
  results: {
    "_2:maxAcrossCharts": "=maxAcrossCharts()",
    charts: [{
      chartId: "@key",
      total: "+1",
      "_1:maxSeriesTotal": "=maxSeriesTotal()",
      serieses: [{
        total: "+1",
        seriesId: "@key",
        data: [{
          dataId: "@key",
          total: "+1" 
        }, "&idVal.dataId[]"],
        max: "<&idVal.dataVal", // needed by client-side boxplot renderer 
        "~values": ["&idVal.dataVal",0],
        "~sum": "+&idVal.dataVal",
        "__:boxplot": "=boxplot()",
        "~samples": ["$sjlid", "set"],
        "__:AF": "=getAF()"
      }, "&idVal.seriesId[]"],
      "@done()": "=filterEmptySeries()"
    }, "&idVal.chartId[]"],
    "~sum": "+&idVal.seriesVal",
    "~values": ["&idVal.seriesVal",0],
    "__:boxplot": "=boxplot()",
    /*"_:_unannotated": {
      label: "",
      label_unannotated: "",
      value: "+=unannotated()",
      value_annotated: "+=annotated()"
    },*/
    refs: {
      cols: ["&idVal.seriesId[]"],
      colgrps: ["-"], 
      rows: ["&idVal.dataId[]"],
      rowgrps: ["-"],
      col2name: {
        "&idVal.seriesId[]": {
          name: "@branch",
          grp: "-"
        }
      },
      row2name: {
        "&idVal.dataId[]": {
          name: "@branch",
          grp: "-"
        }
      },
      "__:useColOrder": "=useColOrder()",
      "__:useRowOrder": "=useRowOrder()",
      "__:unannotatedLabels": "=unannotatedLabels()",
      "__:bins": "=bins()",
      "__:grade_labels": "=grade_labels()",
      "@done()": "=sortColsRows()"
    },
    "@done()": "=sortCharts()"
  }
})

function getPj(q, inReqs, data, tdb, ds) {
/*
  q: objectified URL query string
  inReq: request-specific closured functions and variables
  data: rows of annotation data
*/ 
  const kvs = [
    {i: 0, term: 'term0', key: 'chartId', val: 'chartVal'},
    {i: 1, term: 'term1', key: 'seriesId', val: 'seriesVal'},
    {i: 2, term: 'term2', key: 'dataId', val: 'dataVal'}
  ]; let j=0
  return new Partjson({
    data,
    seed: `{"values": []}`, // result seed 
    template,
    "=": {
      prep(row) {
        // a falsy filter return value for a data row will cause the
        // exclusion of that row from farther processing
        return inReqs.filterFxn(row)
      },
      idVal(row, context, joinAlias) {
        // chart, series, data
        const csd = Object.create(null)
        for(const kv of kvs) {
          const termid = q[kv.term]
          const id = inReqs[kv.i].joinFxns[termid](row, context, joinAlias)
          if (id===undefined || (Array.isArray(id) && !id.length)) return
          csd[kv.key] = Array.isArray(id) ? id : [id]
          const value = typeof inReqs[kv.i].numValFxns[termid] == 'function'
            ? inReqs[kv.i].numValFxns[termid](row)
            : undefined
          csd[kv.val] = 0 && inReqs[kv.i].unannotatedLabels.includes(value)
            ? undefined
            : value 
        }; //if (j<3) {j++; console.log(csd); console.log(inReqs[2])}
        return csd
      },
      maxSeriesTotal(row, context) {
        let maxSeriesTotal = 0
        for(const grp of context.self.serieses) {
          if (grp && grp.total > maxSeriesTotal) {
            maxSeriesTotal = grp.total
          }
        }
        return maxSeriesTotal
      },
      maxAcrossCharts(row, context) {
        let maxAcrossCharts = 0
        for(const chart of context.self.charts) {
          if (chart.maxSeriesTotal > maxAcrossCharts) {
            maxAcrossCharts = chart.maxSeriesTotal
          }
        }
        return maxAcrossCharts
      },
      boxplot(row, context) {
        if (!context.self.values || !context.self.values.length) return
        const values = context.self.values.filter(d => d !== null)
        if (!values.length) return
        values.sort((i,j)=> i - j ); //console.log(values.slice(0,5), values.slice(-5), context.self.values.sort((i,j)=> i - j ).slice(0,5))
        const stat = app.boxplot_getvalue( values.map(v => {return {value: v}}) )
        stat.mean = context.self.sum / values.length
        let s = 0
        for(const v of values) {
          s += Math.pow( v - stat.mean, 2 )
        }
        stat.sd = Math.sqrt( s / (values.length-1) )
        return stat
      },
      numSamples(row, context) {
        return context.self.samples.size
      },
      getAF(row, context) {
		    // only get AF when termdb_bygenotype.getAF is true
  	    if ( !ds.track
  		    || !ds.track.vcf
  		    || !ds.track.vcf.termdb_bygenotype
  		    || !ds.track.vcf.termdb_bygenotype.getAF
        ) return
        if (!q.term2_is_genotype) return
		    if (!q.chr) throw 'chr missing for getting AF'
		    if (!q.pos) throw 'pos missing for getting AF'
        
        return get_AF(
          context.self.samples ? [...context.self.samples] : [],
          q.chr,
          Number(q.pos),
          inReqs.genotype2sample,
          ds
        )
      },
      filterEmptySeries(result) {
        const nonempty = result.serieses.filter(series=>series.total)
        result.serieses.splice(0, result.serieses.length, ...nonempty)
      },
      unannotated(row, context) {
        const series = context.joins.get('series')
        if (!series) return
        let total = 0
        for(const s of idVal.seriesId) {
          if (inReqs[1].unannotatedLabels.includes(s)) {
            total += 1
          }
        }
        return total
      },
      annotated(row, context) {
        const series = context.joins.get('series')
        if (!series) return
        let total = 0
        for(const s of idVal.seriesId) {
          if (!inReqs[1].unannotatedLabels.includes(s)) {
            total += 1
          }
        }
        return total
      },
      sortColsRows(result) {
        if (inReqs[1].orderedLabels.length) {
          const labels = inReqs[1].orderedLabels
          result.cols.sort((a,b) => labels.indexOf(a) - labels.indexOf(b))
        }
        if (inReqs[2].orderedLabels.length) {
          const labels = inReqs[2].orderedLabels
          result.rows.sort((a,b) => labels.indexOf(a) - labels.indexOf(b))
        }
      },
      sortCharts(result) {
        if (inReqs[0].orderedLabels.length) {
          const labels = inReqs[0].orderedLabels
          result.charts.sort((a,b) => labels.indexOf(a.chartId) - labels.indexOf(b.chartId))
        }
      },
      useColOrder() {
        return inReqs[1].orderedLabels.length > 0
      },
      useRowOrder() {
        return inReqs[2].orderedLabels.length > 0
      },
      unannotatedLabels() {
        return {
          term0: inReqs[0].unannotatedLabels,
          term1: inReqs[1].unannotatedLabels, 
          term2: inReqs[2].unannotatedLabels
        }
      },
      bins() {
        return {
          "0": inReqs[0].bins,
          "1": inReqs[1].bins,
          "2": inReqs[2].bins,
        }
      },
      grade_labels() {
        return q.conditionParents && tdb.patient_condition
          ? tdb.patient_condition.grade_labels
          : q.conditionUnits && (q.conditionUnits[0] || q.conditionUnits[1] || q.conditionUnits[2])
          ? tdb.patient_condition.grade_labels
          : undefined
      }
    }
  })
}

async function setValFxns(q, inReqs, ds, tdb) {
/*
  sets request-specific value and filter functions
  non-condition unannotated values will be processed but tracked separately
*/
  if(q.filter) {
    // for categorical terms, must convert values to valueset
    for(const t of q.filter) {
      if(t.term.iscategorical) {
        t.valueset = new Set( t.values.map(i=>i.key) )
      }
    }
    inReqs.filterFxn = (row) => {
      return sample_match_termvaluesetting( row, q.filter, ds )
    }
  }

  const conditionUnits = q.conditionUnits ? q.conditionUnits.split("-,-") : []
  const conditionParents = q.conditionParents ? q.conditionParents.split("-,-") : []
  for(const i of [0, 1, 2]) {
    const inReq = inReqs[i]
    const term = 'term' + i
    const key = q[term]
    if (!inReq.orderedLabels) {
      inReq.orderedLabels = []
      inReq.unannotatedLabels = []
    }
    if (q['term'+ i + '_is_genotype']) {
      if (!q.ssid) throw `missing ssid for genotype`
      const [bySample, genotype2sample] = await load_genotype_by_sample(q.ssid)
      inReqs.genotype2sample = genotype2sample
      const skey = ds.cohort.samplenamekey
      inReq.joinFxns[key] = row => bySample[row[skey]]
      continue
    }
    const t = tdb.termjson.map.get(key)
    if ((!key || t.iscategorical) && key in inReq.joinFxns) continue
    if (!t) throw `Unknown ${term}="${q[term]}"`
    if (!t.graph) throw `${term}.graph missing`
    if (!t.graph.barchart) throw `${term}.graph.barchart missing`
    if (t.iscategorical) {
      inReq.joinFxns[key] = row => row[key] 
    } else if (t.isinteger || t.isfloat) {
      get_numeric_bin_name(key, t, ds, term, q.custom_bins, inReq)
    } else if (t.iscondition) {
      // tdb.patient_condition
      if (!tdb.patient_condition) throw "missing termdb patient_condition"
      if (!tdb.patient_condition.events_key) throw "missing termdb patient_condition.events_key"
      inReq.orderedLabels = t.grades ? t.grades : [0,1,2,3,4,5,9] // hardcoded default order
      const unit = conditionUnits[i]
      const parent = conditionParents[i]
      set_condition_fxn(key, t.graph.barchart, tdb, unit, inReq, parent, conditionUnits, i)
    } else {
      throw "unsupported term binning"
    }
  }
}

function set_condition_fxn(key, b, tdb, unit, inReq, conditionParent, conditionUnits, index) {
  if (tdb.precomputed) {
    const precomputedKey = unit == 'by_children' ? 'children'
      : 'by_children_at_max_grade' ? 'childrenAtMaxGrade'
      : 'by_children_at_most_recent' ? 'childrenAtMostRecent'
      : 'max_grade_perperson' ? 'maxGrade'
      : 'most_recent_grade' ? 'mostRecentGrades'
      : ''
    if (!precomputedKey) throw `unknown condition term unit='${unit}'`

    inReq.joinFxns[key] = row => {
      const conditions = []
      if (tdb.precomputed.bySample[row.sjlid]) {
        const s = tdb.precomputed.bySample[row.sjlid]
        if (key in s.byCondition) {
          return Array.isArray(s.byCondition[key][precomputedKey])
            ? s.byCondition[key][precomputedKey]
            : [s.byCondition[key][precomputedKey]]
        }
      }
    }
  }

  // the rest of this function can be deleted if we use tdb.precomputed all the time

  const events_key = tdb.patient_condition.events_key
  const grade_key = tdb.patient_condition.grade_key
  const age_key = tdb.patient_condition.age_key
  const uncomputable = tdb.patient_condition.uncomputable_grades || {}
  
  // deduplicate array entry
  function dedup(v, i, a) {
    return a.indexOf(v) === i
  }

  if (unit == 'max_grade_perperson') {
    if (index==1 && conditionUnits[2] == "max_grade_by_subcondition") {
      inReq.joinFxns[key] = (row, context, joinAlias) => {
        const maxGradeByCond = {}
        for(const k in row) {
          if (!row[k][events_key]) continue
          const term = tdb.termjson.map.get(k)
          if (!term || !term.conditionlineage) continue
          const i = term.conditionlineage.indexOf(conditionParent)
          if (i < 1) continue
          const child = term.conditionlineage[i - 1];
          for(const event of row[k][events_key]) {
            const grade = event[grade_key]
            if (uncomputable[grade]) continue
            if (!(child in maxGradeByCond) || maxGradeByCond[child] < grade) {
              maxGradeByCond[child] = grade
            }
          }
        }
        return Object.values(maxGradeByCond).filter(dedup); 
      }
    }
    else {
      inReq.joinFxns[key] = (row, context, joinAlias) => {
        let maxGrade
        for(const k in row) {
          if (!row[k][events_key]) continue
          const term = tdb.termjson.map.get(k)
          if (term && term.conditionlineage && term.conditionlineage.includes(key)) {
            for(const event of row[k][events_key]) {
              const grade = event[grade_key]
              if (uncomputable[grade]) continue
              if (maxGrade === undefined || maxGrade < grade) {
                maxGrade = grade
              }
            }
          }
        }
        return maxGrade ? [maxGrade] : []
      }
    }
  } else if (unit == 'most_recent_grade') {
    if (index==1 && conditionUnits[2] == "max_grade_by_subcondition") {
      inReq.joinFxns[key] = row => {
        const byCond = {}
        for(const k in row) {
          if (!row[k][events_key]) continue
          const term = tdb.termjson.map.get(k)
          if (!term || !term.conditionlineage) continue
          const i = term.conditionlineage.indexOf(conditionParent)
          if (i < 1) continue
          const child = term.conditionlineage[i - 1];
          for(const event of row[k][events_key]) {
            const age = event[age_key]
            const grade = event[grade_key]
            if (grade in uncomputable) continue;
            if (!(child in byCond) || byCond[child].age < age) {
              if (!byCond[child]) byCond[child] = {}
              byCond[child].age = age
              byCond[child].grade = grade
            }
          }
        }
        return Object.values(byCond).map(d=>d.grade).filter(dedup)
      }
    } else {
      inReq.joinFxns[key] = row => {
        const mostRecentGrades = []
        let mostRecentAge
        for(const k in row) {
          if (!row[k][events_key]) continue
          const term = tdb.termjson.map.get(k)
          if (term && term.conditionlineage && term.conditionlineage.includes(key)) {
            for(const event of row[k][events_key]) {
              const age = event[age_key]
              if (event[grade_key] in uncomputable) continue
              if (mostRecentAge === undefined || mostRecentAge < age) {
                mostRecentAge = age
              }
            }
          }
        }
        for(const k in row) {
          if (!row[k][events_key]) continue
          const term = tdb.termjson.map.get(k)
          if (term && term.conditionlineage && term.conditionlineage.includes(key)) {
            for(const event of row[k][events_key]) {
              if (event[age_key] === mostRecentAge) {
                const grade = event[grade_key]
                if (!(grade in uncomputable) && !mostRecentGrades.includes(grade)) {
                  mostRecentGrades.push(grade)
                }
              }
            }
          }
        }
        return mostRecentGrades
      }
    }
  } else if (unit.startsWith('by_children')) {
    if (!conditionParent) throw "conditionParents must be specified when categories is by children"
    inReq.joinFxns[key] = row => {
      const conditions = []
      for(const k in row) {
        if (!row[k][events_key]) continue
        const term = tdb.termjson.map.get(k)
        if (!term || !term.conditionlineage) continue
        const i = term.conditionlineage.indexOf(conditionParent)
        if (i < 1) continue
        let allowed_grades 
        if (unit == 'by_children') {
          for(const event of row[k][events_key]) {
            if (uncomputable[event[grade_key]]) continue
            const child = term.conditionlineage[i - 1];
            if (!conditions.includes(child)) {
              // get the immediate child of the parent condition in the lineage
              conditions.push(child)
            }
          }
        } else if (unit == 'by_children_at_max_grade') {
          let maxGrade
          for(const k in row) {
            if (!row[k][events_key]) continue
            const term = tdb.termjson.map.get(k)
            if (term && term.conditionlineage && term.conditionlineage.includes(key)) {
              for(const event of row[k][events_key]) {
                const grade = event[grade_key]
                if (uncomputable[grade]) continue
                if (maxGrade === undefined || maxGrade < grade) {
                  maxGrade = grade
                }
              }
            }
          }
          for(const k in row) {
            if (!row[k][events_key]) continue
            const term = tdb.termjson.map.get(k)
            if (term && term.conditionlineage && term.conditionlineage.includes(key)) {
              for(const event of row[k][events_key]) {
                const grade = event[grade_key]
                if (grade == maxGrade) {
                  // get the immediate child of the parent condition in the lineage
                  const child = term.conditionlineage[i - 1];
                  if (!conditions.includes(child)) {
                    conditions.push(child)
                  }
                }
              }
            }
          }
        } else if (unit == 'by_children_at_most_recent') {
          let mostRecentAge
          for(const k in row) {
            if (!row[k][events_key]) continue
            const term = tdb.termjson.map.get(k)
            if (term && term.conditionlineage && term.conditionlineage.includes(key)) {
              for(const event of row[k][events_key]) {
                const age = event[age_key]
                if (event[grade_key] in uncomputable) continue
                if (mostRecentAge === undefined || mostRecentAge < age) {
                  mostRecentAge = age
                }
              }
            }
          }
          for(const k in row) {
            if (!row[k][events_key]) continue
            const term = tdb.termjson.map.get(k)
            if (term && term.conditionlineage && term.conditionlineage.includes(key)) {
              for(const event of row[k][events_key]) {
                if (event[age_key] === mostRecentAge) {
                  const child = term.conditionlineage[i - 1];
                  if (!conditions.includes(child)) {
                    conditions.push(child)
                  }
                }
              }
            }
          }
        } else {
          throw 'unrecognized condition term unit for subcondition overlay in termdb.barchart'
        }
      }
      return conditions
    }
  } /* might re-enable this option later
  else if (unit == 'max_graded_children') {
    if (!conditionParent) throw "conditionParents must be specified when category is max_graded_children"
    inReq.joinFxns[key] = (row, context) => {
      const maxGrade = context.key
      const conditions = []
      for(const k in row) {
        if (!row[k][events_key]) continue
        const term = tdb.termjson.map.get(k)
        if (!term || !term.conditionlineage) continue
        const i = term.conditionlineage.indexOf(conditionParent)
        if (i < 1) continue
        let maxGraded = false; 
        for(const event of row[k][events_key]) {
          if (maxGrade === true || event[grade_key] == maxGrade) {
            maxGraded = true
            break
          }
        }
        if (maxGraded) { 
          // get the immediate child of the parent condition in the lineage
          const child = term.conditionlineage[i - 1];
          if (!conditions.includes(child)) {
            conditions.push(child);
          }
        }
      }
      return conditions
    }
  }*/ else if (unit == 'max_grade_by_subcondition') {
    if (!conditionParent) throw "conditionParents must be specified when category is max_grade_by_subcondition"
    const parentUnit = conditionUnits[index-1]
    if (parentUnit == "by_children") {
      inReq.joinFxns[key] = (row, context) => {
        const child = context.key;
        let maxGrade; 
        for(const k in row) {
          if (!row[k][events_key]) continue
          const term = tdb.termjson.map.get(k);
          if (!term || !term.conditionlineage || !term.conditionlineage.includes(child)) continue
          for(const event of row[k][events_key]) { 
            const grade = event[grade_key]
            if (uncomputable[grade]) continue
            if (maxGrade === undefined || maxGrade < grade) {
              maxGrade = grade
            }
          }
        }
        if (maxGrade !== undefined) {
          return [maxGrade]
        }
      }
    } else if (parentUnit == "max_grade_perperson") {
      inReq.joinFxns[key] = (row, context) => {
        const maxGrade = context.key
        const maxGradeByCond = {}; 
        for(const k in row) {
          if (!row[k][events_key]) continue
          const term = tdb.termjson.map.get(k)
          if (!term || !term.conditionlineage) continue
          const i = term.conditionlineage.indexOf(conditionParent)
          if (i < 1) continue
          const child = term.conditionlineage[i - 1];
          
          for(const event of row[k][events_key]) {
            const grade = event[grade_key]
            if (uncomputable[grade]) continue
            if (!(child in maxGradeByCond) || maxGradeByCond[child] < grade) {
              maxGradeByCond[child] = grade
            }
          }
        }
        const conditions = []
        for(const child in maxGradeByCond) {
          if (maxGradeByCond[child] == maxGrade && !conditions.includes(child)) {
            conditions.push(child)
          }
        }
        return conditions
      }
    } else if (parentUnit == "most_recent_grade") {
      inReq.joinFxns[key] = (row, context) => {
        const mostRecentGrade = context.key
        const byCond = {}; 
        for(const k in row) {
          if (!row[k][events_key]) continue
          const term = tdb.termjson.map.get(k)
          if (!term || !term.conditionlineage) continue
          const i = term.conditionlineage.indexOf(conditionParent)
          if (i < 1) continue
          const child = term.conditionlineage[i - 1];
          
          for(const event of row[k][events_key]) {
            const grade = event[grade_key]
            if (uncomputable[grade]) continue
            const age = event[age_key]
            if (!(child in byCond) || byCond[child].age < age) {
              if (!byCond[child]) byCond[child] = {}
              byCond[child].age = age
              byCond[child].grade = grade
            }
          }
        }
        const conditions = []
        for(const child in byCond) {
          if (byCond[child].grade == mostRecentGrade && !conditions.includes(child)) {
            conditions.push(child)
          }
        }
        return conditions
      }
    } else {
      throw `invalid parent condition unit: '${parentUnit}'`
    }
  } else {
    throw `invalid condition unit: '${unit}'`
  }
}

function get_numeric_bin_name ( key, t, ds, termNum, custom_bins, inReq ) {
  const [ binconfig, values, _orderedLabels ] = termdb_get_numericbins( key, t, ds, termNum, custom_bins[termNum.slice(-1)] )
  inReq.bins = binconfig.bins

  inReq.orderedLabels = _orderedLabels
  if (binconfig.unannotated) {
    inReq.unannotatedLabels = Object.values(binconfig.unannotated._labels)
  }
  Object.assign(inReq.unannotated, binconfig.unannotated)

  inReq.joinFxns[key] = row => {
    const v = row[key]
    if( binconfig.unannotated && binconfig.unannotated._values.includes(v) ) {
      return binconfig.unannotated._labels[v]
    }

    for(const b of binconfig.bins) {
      if( b.startunbound ) {
        if( b.stopinclusive && v <= b.stop  ) {
          return b.label
        }
        if( !b.stopinclusive && v < b.stop ) {
          return b.label
        }
      }
      if( b.stopunbound ) {
        if( b.startinclusive && v >= b.start  ) {
          return b.label
        }
        if( !b.stopinclusive && v > b.start ) {
          return b.label
        }
      }
      if( b.startinclusive  && v <  b.start ) continue
      if( !b.startinclusive && v <= b.start ) continue
      if( b.stopinclusive   && v >  b.stop  ) continue
      if( !b.stopinclusive  && v >= b.stop  ) continue
      return b.label
    }
  }

  inReq.numValFxns[key] = row => {
    const v = row[key]
    if(!binconfig.unannotated || !binconfig.unannotated._values.includes(v) ) {
      return v
    }
  }
}

function termdb_get_numericbins ( id, term, ds, termNum, custom_bins ) {
/*
must return values from all samples, not to exclude unannotated values

do not count sample for any bin here, including annotated/unannotated
only initiate the bins without count
barchart or crosstab will do the counting in different ways

return an object for binning setting {}
rather than a list of bins
this is to accommondate settings where a valid value e.g. 0 is used for unannotated samples, and need to collect this count

.bins[{}]
  each element is one bin
  .start
  .stop
  etc
.unannotated{}
  .value
  .samplecount
  for counting unannotated samples if unannotated{} is set on server
*/

  // step 1, get values from all samples
  const values = []
  let observedMin, observedMax
  for(const s in ds.cohort.annotation) {
    const v = ds.cohort.annotation[ s ][ id ]

    if (!values.length) {
      observedMin = v
      observedMax = v
    } else if (v < observedMin) {
      observedMin = v
    } else if (v > observedMax) {
      observedMax = v
    }

    if(Number.isFinite(v)) {
      values.push(+v)
    }
  }
  if(values.length==0) {
    throw 'No numeric values found for any sample'
  }
  const nb = term.graph.barchart.numeric_bin
  const bins = []
  const orderedLabels = []

  if(custom_bins) {
    if (custom_bins.min_unit == "percentile" || custom_bins.max_unit == "percentile") {
      values.sort((a,b) => a - b)
    }
    const min = custom_bins.min_val == 'auto' 
      ? observedMin 
      : custom_bins.min_unit == 'percentile' 
      ? values[ Math.floor((custom_bins.min_val / 100) * values.length) ]
      : custom_bins.min_val
    const max = custom_bins.max_val == 'auto' 
      ? observedMax 
      : custom_bins.max_unit == 'percentile'
      ? values[ Math.floor((custom_bins.max_val / 100) * values.length) ]
      : custom_bins.max_val
    
    let start = custom_bins.min_val == 'auto' ? null : min
    
    while( start <= observedMax ) {
      const upper = start == null ? min + custom_bins.size : start + custom_bins.size //custom_bins.size == "auto" ? custom_bins.max_val : 
      const stop = upper < max 
        ? upper
        : custom_bins.max_val == 'auto'
        ? null
        : max

      const bin = {
        start, // >= max ? max : start,
        stop, //startunbound ? min : stop,
        startunbound: start === null,
        stopunbound: stop === null,
        startinclusive: custom_bins.startinclusive,
        stopinclusive: custom_bins.stopinclusive,
      }
      
      if (bin.startunbound) { 
        const oper = bin.stopinclusive ? "\u2264" : "<"
        const v1 = Number.isInteger(stop) ? stop : binLabelFormatter(stop)
        bin.label = oper + binLabelFormatter(stop);
      } else if (bin.stopunbound) {
        const oper = bin.startinclusive ? "\u2265" : ">"
        const v0 = Number.isInteger(start) ? start : binLabelFormatter(start)
        bin.label = oper + v0
      } else if( Number.isInteger( custom_bins.size )) {
        // bin size is integer, make nicer label
        if( custom_bins.size == 1 ) {
          // bin size is 1; use just start value as label, not a range
          bin.label = start //binLabelFormatter(start)
        } else {
          const oper0 = custom_bins.startinclusive ? "" : ">"
          const oper1 = custom_bins.stopinclusive ? "" : "<"
          const v0 = Number.isInteger(start) ? start : binLabelFormatter(start)
          const v1 = Number.isInteger(stop) ? stop : binLabelFormatter(stop)
          bin.label = oper0 + v0 +' to '+ oper1 + v1
        }
      } else {
        const oper0 = custom_bins.startinclusive ? "" : ">"
        const oper1 = custom_bins.stopinclusive ? "" : "<"
        bin.label = oper0 + binLabelFormatter(start) +' to '+ oper1 + binLabelFormatter(stop)
      }

      bins.push( bin )
      orderedLabels.push(bin.label)
      start = upper
    }

    const binconfig = {
      bins: bins
    }

    if( nb.unannotated ) {
      // in case of using this numeric term as term2 in crosstab, 
      // this object can also work as a bin, to be put into the bins array
      binconfig.unannotated = {
        _values: [nb.unannotated.value],
        _labels: {[nb.unannotated.value]: nb.unannotated.label},
        label: nb.unannotated.label,
        label_annotated: nb.unannotated.label_annotated
      }

      if (nb.unannotated.value_positive) {
        binconfig.unannotated.value_positive = 0
        binconfig.unannotated._values.push(nb.unannotated.value_positive)
        binconfig.unannotated._labels[nb.unannotated.value_positive] = nb.unannotated.label_positive
      }
      if (nb.unannotated.value_negative) {
        binconfig.unannotated.value_negative = 0
        binconfig.unannotated._values.push(nb.unannotated.value_negative)
        binconfig.unannotated._labels[nb.unannotated.value_negative] = nb.unannotated.label_negative
      }
    }

    return [ binconfig, values, orderedLabels ]
  }
  else {
    const fixed_bins = (termNum=='term2' || termNum=='term0') && nb.crosstab_fixed_bins ? nb.crosstab_fixed_bins 
      : nb.fixed_bins ? nb.fixed_bins
      : undefined

    if( fixed_bins ) {
      // server predefined
      // return copy of the bin, not direct obj, as bins will be modified later

      for(const i of fixed_bins) {
        const copy = {}
        for(const k in i) {
          copy[ k ] = i[ k ]
        }
        bins.push( copy )
        orderedLabels.push(i.label)
      }

    } else if( nb.auto_bins ) {

      /* auto bins
      given start and bin size, use max from value to decide how many bins there are
      */

      const max = Math.max( ...values )
      let start = nb.auto_bins.start_value
      while( start < max ) {
        const stop = Math.min(start + nb.auto_bins.bin_size, max)
        const bin = {
          start,
          stop,
          startinclusive:1,
        } 
        if (!bin.label) {
          if( Number.isInteger( nb.auto_bins.bin_size ) ) {
            // bin size is integer, make nicer label
            if( nb.auto_bins.bin_size == 1 ) {
              // bin size is 1; use just start value as label, not a range
              bin.label = start
            } else {
              // bin size bigger than 1, reduce right bound by 1, in label only!
              bin.label = start + ' to ' + (stop-1)
            }
          } else {
            // 
            if( bin.startunbounded ) {
              bin.label = (bin.stopinclusive ? '<=' : '<')+' '+bin.stop
            } else if( bin.stopunbounded ) {
              bin.label = (bin.startinclusive ? '>=' : '>')+' '+bin.start
            } else {
              bin.label = `${bin.start} <${bin.startinclusive?'=':''} x <${bin.stopinclusive?'=':''} ${bin.stop}`
            }
          }
        }

        bins.push( bin )
        orderedLabels.push(bin.label)

        start += nb.auto_bins.bin_size
      }

      bins[bins.length - 1].stopinclusive = 1
    } else {
      throw 'unknown ways to decide bins'
    }

    const binconfig = {
      bins: bins
    }

    if( nb.unannotated ) {
      // in case of using this numeric term as term2 in crosstab, 
      // this object can also work as a bin, to be put into the bins array
      binconfig.unannotated = {
        _values: [nb.unannotated.value],
        _labels: {[nb.unannotated.value]: nb.unannotated.label},
        label: nb.unannotated.label,
        label_annotated: nb.unannotated.label_annotated,
        // for annotated samples
        value_annotated: 0, // v2s
      }

      if (nb.unannotated.value_positive) {
        binconfig.unannotated.value_positive = 0
        binconfig.unannotated._values.push(nb.unannotated.value_positive)
        binconfig.unannotated._labels[nb.unannotated.value_positive] = nb.unannotated.label_positive
      }
      if (nb.unannotated.value_negative) {
        binconfig.unannotated.value_negative = 0
        binconfig.unannotated._values.push(nb.unannotated.value_negative)
        binconfig.unannotated._labels[nb.unannotated.value_negative] = nb.unannotated.label_negative
      }
    }

    return [ binconfig, values, orderedLabels ]
  }
}

async function load_genotype_by_sample ( id ) {
/* id is the file name under cache/samples-by-genotype/
*/
  const text = await utils.read_file( path.join( serverconfig.cachedir, 'ssid', id ) )
  const bySample = Object.create(null)
  const genotype2sample = new Map()
  for(const line of text.split('\n')) {
    const [type, samplesStr] = line.split('\t')
    const samples = samplesStr.split(",")
    for(const sample of samples) {
      bySample[sample] = type
    }

    if(!genotype_type_set.has(type)) throw 'unknown hardcoded genotype label: '+type
    genotype2sample.set(type, new Set(samples))
  }
  return [bySample, genotype2sample]
}




const genotype_type_set = new Set(["Homozygous reference","Homozygous alternative","Heterozygous"])
const genotype_types = {
  href: "Homozygous reference",
  halt: "Homozygous alternative",
  het: "Heterozygous"
}




function get_AF ( samples, chr, pos, genotype2sample, ds ) {
/*
as configured by ds.track.vcf.termdb_bygenotype,
at genotype overlay of a barchart,
to show AF=? for each bar, based on the current variant

arguments:
- samples[]
	list of sample names from a bar
- chr
	chromosome of the variant
- genotype2sample Map
    returned by load_genotype_by_sample()
- ds{}
*/
  const afconfig = ds.track.vcf.termdb_bygenotype // location of configurations
  const href = genotype2sample.has(genotype_types.href) ? genotype2sample.get(genotype_types.href) : new Set()
  const halt = genotype2sample.has(genotype_types.halt) ? genotype2sample.get(genotype_types.halt) : new Set()
  const het = genotype2sample.has(genotype_types.het) ? genotype2sample.get(genotype_types.het) : new Set()
  let AC=0, AN=0
  for(const sample of samples) {
    let isdiploid = false
    if( afconfig.sex_chrs.has( chr ) ) {
      if( afconfig.male_samples.has( sample ) ) {
        if( afconfig.chr2par && afconfig.chr2par[chr] ) {
          for(const par of afconfig.chr2par[chr]) {
            if(pos>=par.start && pos<=par.stop) {
              isdiploid=true
              break
            }
          }
        }
      } else {
        isdiploid=true
      }
    } else {
      isdiploid=true
    }
    if( isdiploid ) {
      AN+=2
      if(halt.has( sample ) ) {
        AC+=2
      } else if(het.has( sample )) {
        AC++
    	}
    } else {
      AN++
      if(!href.has(sample)) AC++
    }
  }
  return (AN==0 || AC==0) ? 0 : (AC/AN).toFixed(3)
}


function may_trigger_precompute(genomes) {
  // asynchronously trigger the precomputation of condition
  // values for termdb dataset
  // will not re-trigger if ds.cohort.termdb.precomputed
  // has been triggered or already been set
  const maxTries = 1
  let numTries = 0
  const i = setInterval(()=>{
    numTries++
    if (numTries >= maxTries) {
      clearInterval(i);
    }
    for(const gnlabel in genomes) {
      for(const dslabel in genomes[gnlabel].datasets) {
        const ds = genomes[gnlabel].datasets[dslabel]
        if (
          ds.cohort 
          && ds.cohort.termdb 
          && ds.cohort.annorows
          && ds.cohort.termdb.precomputed_file // trigger only if set in dataset/*.json
          && !ds.cohort.termdb.precompute_pending // do not re-trigger
          && !ds.cohort.termdb.precomputed // do not precompute again
        ) {  
          console.log('triggered precompute for', dslabel)
          request(
            `http://localhost:${serverconfig.port}/termdb-precompute?`
            + `genome=${gnlabel}&dslabel=${dslabel}`,
            (error,response,body)=>{
              if (error) console.log(error)
            }
          )
        }
      }
    }
  }, 500)
}
