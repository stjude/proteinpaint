/*
  WORK IN PROGRESS
  - not working yet, might not need this for testing
  - use `npm run test-barsql` instead
*/

const express=require('express')
const bodyParser = require('body-parser')
const Partjson = require('../modules/partjson')
const fs = require('fs')
const path = require('path')
const utils = require('../modules/utils')
const serverconfig = require('../serverconfig.json')
const load_dataset = require('../utils/sjlife2/load.sjlife').load_dataset
const get_bins = require('../modules/termdb.sql').get_bins
const barchart_data = require("./termdb.barchart").barchart_data

/**************** 
  Set up server
*****************/

const app=express()
app.use( bodyParser.json({}) )
app.use( bodyParser.text({limit:'1mb'}) )
app.use(bodyParser.urlencoded({ extended: true })) 
app.use((req, res, next)=>{
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
})
app.use(express.static('./public'))
app.get('/termdb-barchart', handle_barchart_request )

const port = serverconfig.testserverport || 8999
app.listen(port)
console.log('STANDBY AT PORT '+port)


/**********************
  Load sjlife dataset
**********************/

const ds = load_dataset('sjlife2.hg38.js')
const tdb = ds.cohort.termdb
if (!tdb || tdb.precomputed || !tdb.precomputed_file) return

const filename = path.join(serverconfig.tpmasterdir, tdb.precomputed_file)
try {
  const file = fs.existsSync(filename) ? fs.readFileSync(filename, {encoding:'utf8'}) : ''
  tdb.precomputed = JSON.parse(file.trim())
  console.log("Loaded the precomputed values from "+ filename)
} catch(e) {
  throw 'Unable to load the precomputed file ' + filename
}

/***********************
  handle server request
************************/

async function handle_barchart_request(req, res) {
  const q = req.query
  for(const i of [0,1,2]) {
    const termnum_q = 'term' + i +'_q'
    if (q[termnum_q]) {
      try {
        q[termnum_q] = JSON.parse(decodeURIComponent(q[termnum_q]))
      } catch(e) {
        app.log(q)
        res.send({error: (e.message || e)})
        if(e.stack) console.log(e.stack)
      }
    }
  }
  if (q.tvslst) {
    try {
      q.tvslst = JSON.parse(decodeURIComponent(q.tvslst))
    } catch(e) {
      app.log(q)
      res.send({error: (e.message || e)})
      if(e.stack) console.log(e.stack)
    }
  }
  console.log(q)
  // support legacy query parameter names
  if (q.term1_id) q.term1 = q.term1_id
  if (!q.term1_q) q.term1_q = {}
  if (!q.term0) q.term0 = ''
  if (q.term0_id) q.term0 = q.term0_id 
  if (!q.term0_q) q.term0_q = {}
  if (!q.term2) q.term2 = ''
  if (q.term2_id) q.term2 = q.term2_id
  if (!q.term2_q) q.term2_q = {}
  try {
    if(!ds) throw 'invalid dslabel'
    if(!ds.cohort) throw 'ds.cohort missing'
    const tdb = ds.cohort.termdb
    if(!tdb) throw 'no termdb for this dataset'
    if(!tdb.precomputed) throw 'tdb.precomputed not loaded'
    // process triggers
    const result = await barchart_data( q )
    res.send(result)
  } catch(e) {
    res.send({error: (e.message || e)})
    if(e.stack) console.log(e.stack)
  }
}
