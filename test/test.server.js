/*
  This testing-only server offers the following advantages:
  
  - It is much easier to inspect and compare deeply nested 
    objects in a browser's interactive dev tools, rather in 
    the command line output of test scripts.
  
  - The loaded test data is persisted in the server for 
    faster isolated, iterative tests. In contrast, data is 
    reloaded as part of each termdb.sql.spec test run.


  Use `npm run test-barsql` to run all termdb.sql.spec tests
  Use this to help isolate and troubleshoot a failing test.
  
  --------------------------------
  To try this for troubleshooting:
  -------------------------------- 
  
  `node test/server.js`
  
  then load this in your browser:
  
  http://localhost:8999/termdb-testui?term1=diaggrp&term2=sex
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
app.use( bodyParser.urlencoded({ extended: true } )) 
app.use((req, res, next)=>{
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
})
app.get('/termdb-testui', handle_testui_request )
app.get('/termdb-barchart', handle_barchart_request )

const port = serverconfig.testserverport || 8999
app.listen(port)
console.log('STANDBY AT PORT '+port)


/***********************
  handle server request
************************/

async function handle_barchart_request(req, res) {
  const q = req.query
  if (!q || !Object.keys(q).length) res.send(getHtml()) 
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
  compareResponseData(test(res, q), q, "WEB-TEST")
}

function test(res, q) {
  return {
    fail(error) {
      res.send({error})
    },
    deepEqual(actual, expected, result) {
      const diffStr = result.diffStr
      delete result.diffStr
      res.send({diff: actual, diffStr, result, q})
    }
  }
}

function handle_testui_request(req, res) {
  res.send(`<html>
<body style='font-family: Arial, Helvetica, san-serif;'>
<h3>Test UI</h3>
<p>This user interface helps troubleshoot failing tests.</p>
<ul>
  <li>
      It is much easier to inspect and compare deeply nested objects in a 
      browser's interactive dev tools, rather in the command 
      line output of test scripts.
  </li>
  <li>
      The loaded test data is persisted in the server for 
      faster isolated, iterative tests. In contrast, data is reloaded
      as part of each termdb.sql.spec test run.
  </li>
</ul>
<p>Open the browser's dev tools to inspect Network response preview for test results and details.</p>
<p>Enter the URL query parameters to test below, encoded as JSON, then click submit.</p>
<textarea id='qparams' style='width:400px; height: 400px; font-size:16px'></textarea>
<button onclick='submit()'>Submit</button>

<script>
const qparams = document.querySelector('#qparams')

if (window.location.search) {
  const params = {}
  for(const param of window.location.search.slice(1).split("&")) {
    const [key,val] = param.split("=")
    params[key] = key.endsWith("_q") || key == "tvslst"
      ? JSON.parse(decodeURIComponent(val))
      : val
  }
  qparams.value = JSON.stringify(params, null, '    ')
}

function submit() {
  const params = JSON.parse(qparams.value)
  const arr = []
  for(const key in params) {
    arr.push(key + "=" + 
      (
        key.endsWith('_q') || key == "tvslst"
        ? encodeURIComponent(JSON.stringify(params[key]))
        : params[key]
      )
    )
  }
  const url = "/termdb-barchart?" + arr.join("&")
  fetch(url)
  .then(response=>response.json())
  .then(response=>console.log(response.diffStr))
}
</script>
</body>
</html>`)
}
