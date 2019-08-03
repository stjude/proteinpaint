/*
  WORK IN PROGRESS
  - use `npm run test-barsql` to run all termdb.sql.spec tests
  - use this to help troubleshoot a failing test 

  to try this for troubleshooting: 
  `node test/termdb.barchart.server.js`
  then visit
  http://localhost:8999/termdb-barchart?genome=hg38&dslabel=SJLife
*/
const serverconfig = require("../serverconfig")
const express=require('express')
const bodyParser = require('body-parser')
const compareResponseData = require("./termdb.sql.helpers").compareResponseData

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
  compareResponseData(test(res), q, "WEB-TEST")
}

function test(res) {
  return {
    fail(error) {
      res.send({error})
    },
    deepEqual(actual, expected, result) {
      res.send({diff: actual, result})
    }
  }
}
