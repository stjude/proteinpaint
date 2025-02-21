import pti from 'puppeteer-to-istanbul'
import puppeteer from 'puppeteer'


(async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
 
  // Enable both JavaScript and CSS coverage
  await Promise.all([
    page.coverage.startJSCoverage(),
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
      if (reachedSummary) lastLines.push(msg)
      else if (msg.startsWith('1..')) reachedSummary = true
    })
    // .on('pageerror', ({ message }) => console.log(message))
    // .on('response', response =>
    //   console.log(`${response.status()} ${response.url()}`))
    // .on('requestfailed', request =>
    //   console.log(`${request.failure().errorText} ${request.url()}`))

  // Navigate to test page
  await page.goto('http://localhost:3000/testrun.html?name=*.unit');

  const i = setInterval(async ()=>{
    // see page.on('console') above for the expected last lines texts that are being detected
    if (!reachedSummary || lastLines.length < 4 || !lastLines.find(t => t.includes(' ok') || t.includes(' fail'))) return
    clearInterval(i)
    if (!lastLines.find(l => l.startsWith('# ok'))) {
      console.error(`\n!!! test failed !!!\n`)
      await browser.close()
      process.exit(1)
    }
    // Disable both JavaScript and CSS coverage
    const [jsCoverage, cssCoverage] = await Promise.all([
      page.coverage.stopJSCoverage(),
      //page.coverage.stopCSSCoverage(),
    ]);
    pti.write([...jsCoverage], { includeHostname: true , storagePath: './.nyc_output' })
    await browser.close()
  }, 100)
})()
