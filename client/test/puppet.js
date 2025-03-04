// reuse expressjs, as installed in the server workspace
import express from 'express'
import puppeteer from 'puppeteer'
import fs from 'fs'
import MCR from 'monocart-coverage-reports'
import path from 'path'

// user __dirname later to detect relative path to public dir,
// since the unit test may be triggered from the pp dir with --workspace option
const __dirname = import.meta.dirname

runTest().catch(console.error)

async function runTest() {
  const app = express()
  const publicDir = path.join(__dirname, '../../public')
  const staticMiddleware = express.static(publicDir)
  app.use(staticMiddleware)
  const port = 3000
  const server = app.listen(port)

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      `--no-sandbox`,
      `--disable-setuid-sandbox`,
    ],
  })
  const page = await browser.newPage()
 
  // Enable both JavaScript and CSS coverage
  await Promise.all([
    page.coverage.startJSCoverage({
      resetOnNavigation: false,
      includeRawScriptCoverage: true
    }),
    //page.coverage.startCSSCoverage()
  ]);

  const lastLines = []
  let reachedSummary = false
  page
    .on('console', m => {
      const msg = m.text()
      console.log(msg)
      /*
        detected last lines are expected to look like below, 
        with empty lines before and after "# ok" line,
        which may be "# fail" instead (not ok)

        1..977
        # tests 977
        # pass  977
        
        # ok

      */
      if (msg.startsWith('1..') || lastLines.length) lastLines.push(msg)
    })
    // .on('response', response =>
    //   console.log(`63 ${response.status()} ${response.url()}`)
    // )
    .on('pageerror', (e) => {
      console.log('-- pageerror --', e.message)
      console.trace(e)
    })
    .on('requestfailed', request =>
      console.log('-- requestfailed --', `${request.failure().errorText} ${request.url()}`)
    )

  // Navigate to test page
  await page.goto(`http://localhost:${port}/puppet.html?name=*.unit`, {timeout: 1000})
    .then(r => {
      if (r.status() != 200) throw `Error loading page: ${r.status()}`
    })
    .catch(e => {
      console.error('--- page.goto().catch ---', e)
      process.exit(1)
    })

  const i = setInterval(async ()=>{
    // see page.on('console') above for the expected last lines texts that are being detected
    if (lastLines.length < 4 || !lastLines.find(t => t.includes('# ok') || t.includes('# fail'))) return
    clearInterval(i)
    if (!lastLines.find(l => l.startsWith('# ok'))) {
      console.error(`\n!!! test failed !!!\n`)
      await browser.close()
      process.exit(1)
    }
    // Disable both JavaScript and CSS coverage
    const [jsCoverage /*, cssCoverage*/] = await Promise.all([
      page.coverage.stopJSCoverage(),
      //page.coverage.stopCSSCoverage(),
    ])
    const matched = jsCoverage.filter(({rawScriptCoverage: c}) => 
      c.url.includes('/bin/test') && !c.url.includes('_.._') && !c.url.includes('node_modules')
    )
    //fs.writeFileSync(`${process.cwd()}/results.json`, JSON.stringify(matched))
    
    const coverageList = matched.map((it,i) => {
      return {
          source: it.text,
          ... it.rawScriptCoverage
      };
    });

    const mcr = MCR({
      name: 'Unit Test Coverage',
      sourceFilter: (path) => !path.includes('/bin/test') && !path.includes('_.._') && !path.includes('node_modules'),
      outputDir: './.nyc_output',
      reports: ["v8", "console-summary", "html"],
      cleanCache: true
    })

    const report = await mcr.add(coverageList);
    console.log('puppeteer coverage added', report.type);
    await mcr.generate()
    await browser.close()
    server.close()
  }, 100)
}
