// reuse expressjs, as installed in the server workspace
import express from 'express'
import puppeteer from 'puppeteer'
import fs from 'fs'
import MCR from 'monocart-coverage-reports'
import path from 'path'


(async () => {
  const app = express()
  const staticDir = express.static(path.join(process.cwd(), '../public'))
  app.use(staticDir)
  const server = app.listen(3000)

  const browser = await puppeteer.launch()
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
    // .on('pageerror', ({ message }) => console.log(message))
    // .on('response', response =>
    //   console.log(`${response.status()} ${response.url()}`))
    // .on('requestfailed', request =>
    //   console.log(`${request.failure().errorText} ${request.url()}`))

  // Navigate to test page
  await page.goto('http://localhost:3000/puppet.html?name=*.unit');

  const i = setInterval(async ()=>{
    // see page.on('console') above for the expected last lines texts that are being detected
    if (lastLines.length < 4 || !lastLines.find(t => t.includes('# ok') || t.includes('# fail'))) return
    clearInterval(i)
    if (!lastLines.find(l => l.startsWith('# ok'))) {
      console.error(`\n!!! test failed !!!\n`)
      //await browser.close()
      //process.exit(1)
    }
    // Disable both JavaScript and CSS coverage
    const [jsCoverage /*, cssCoverage*/] = await Promise.all([
      page.coverage.stopJSCoverage(),
      //page.coverage.stopCSSCoverage(),
    ])//; console.log(58, Object.keys(jsCoverage).length)
    const matched = jsCoverage.filter(({rawScriptCoverage: c}) => 
      c.url.includes('/bin/test') && !c.url.includes('_.._') && !c.url.includes('node_modules')
    )
    fs.writeFileSync(`${process.cwd()}/results.json`, JSON.stringify(matched))
    
    const coverageList = matched.map((it,i) => {
        return {
            source: it.text,
            ... it.rawScriptCoverage
        };
    });

    const mcr = MCR({
        name: 'My Coverage Report',
        sourceFilter: (path) => !path.includes('/bin/test') && !path.includes('_.._') && !path.includes('node_modules'),
        outputDir: './.nyc_output',
        reports: ["v8", "console-details", "html"],
        cleanCache: true
    })

    const report = await mcr.add(coverageList);
    console.log('puppeteer coverage added', report.type);
    await mcr.generate()
    await browser.close()
    server.close()
  }, 100)
})()
