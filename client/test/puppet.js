// reuse expressjs, as installed in the server workspace
import express from 'express'
import puppeteer from 'puppeteer'
import fs from 'fs'
import MCR from 'monocart-coverage-reports'
import path from 'path'
import crypto from 'crypto'
import { decode as urlJsonDecode } from '#shared/urljson.js'
import bodyParser from 'body-parser'
import { ReqResCache } from '@sjcrh/augen'

// user __dirname later to detect relative path to public dir,
// since the unit test may be triggered from the pp dir with --workspace option
const __dirname = import.meta.dirname
const port = Number(process.argv[3] || 0) || 6789

const params = process.argv[2] || ''
if (!params) throw `missing puppet.js params argument`

runTest(params).catch(console.error)

async function runTest(paramsStr) {
	const startTime = Date.now()
	const server = port === 6789 ? initServer() : null
	const paramsArr = paramsStr.split(' ') //; console.log(21, paramsArr, port); return;

	const browser = await puppeteer.launch({
		// headless: false, // uncomment to see puppeteer chrome instance
		args: [`--no-sandbox`, `--disable-setuid-sandbox`]
	})
	const page = await browser.newPage()
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
		.on('pageerror', e => {
			console.log('-- pageerror --', e.message)
			console.trace(e)
		})
		.on('requestfailed', request =>
			console.log('-- requestfailed --', `${request.failure().errorText} ${request.url()}`)
		)

	for (const params of paramsArr) {
		// Enable both JavaScript and CSS coverage
		await Promise.all([
			page.coverage.startJSCoverage({
				resetOnNavigation: false,
				includeRawScriptCoverage: true
			})
			//page.coverage.startCSSCoverage()
		])

		// console.log(70, port, params, `http://localhost:${port}/puppet.html?port=${port}&${params}`)
		// Navigate to test page
		await page
			.goto(`http://localhost:${port}/puppet.html?port=${port}&${params}`, { timeout: 1000 })
			.then(r => {
				if (!r.ok()) throw `Error loading page: ${r.status()}`
			})
			.catch(e => {
				console.error('--- page.goto().catch ---', e)
				process.exit(1)
			})

		await new Promise((resolve, reject) => {
			const i = setInterval(async () => {
				// see page.on('console') above for the expected last lines texts that are being detected
				if (lastLines.length < 4 || !lastLines.find(t => t.includes('# ok') || t.includes('# fail'))) return
				clearInterval(i)
				console.log(`test run time=${(Date.now() - startTime) / 1000} ms`)

				if (!lastLines.find(l => l.startsWith('# ok'))) {
					console.error(`\n!!! test failed !!!\n`)
					await browser.close()
					process.exit(1)
				}
				// Disable both JavaScript and CSS coverage
				const [jsCoverage /*, cssCoverage*/] = await Promise.all([
					page.coverage.stopJSCoverage()
					//page.coverage.stopCSSCoverage(),
				])
				const matched = jsCoverage.filter(({ rawScriptCoverage: c }) => {
					//if (!c.url.includes('node_modules') && !c.url.includes('sjcrh/proteinpaint-')) console.log(c.url)
					return (
						c.url.includes('/bin/test') &&
						!c.url.includes('_.._') &&
						!c.url.includes('node_modules') &&
						!c.url.includes('appdrawer') &&
						!c.url.includes('sjcrh/proteinpaint-')
					) // appdrawer tests do not use TermdbTest
				})
				//fs.writeFileSync(`${process.cwd()}/results-${paramsArr.indexOf(params)}.json`, JSON.stringify(matched))

				const coverageList = matched.map((it, i) => {
					return {
						source: it.text,
						...it.rawScriptCoverage
					}
				})

				const mcr = MCR({
					name: `Test Coverage for ${params}`,
					sourceFilter: path => {
						//if (!path.includes('node_modules')) console.log(path)
						return (
							(path.includes('client') || path.includes('shared')) &&
							!path.includes('/bin/test') &&
							!path.includes('_.._') &&
							!path.includes('node_modules') &&
							!path.includes('appdrawer') &&
							!path.includes('sjcrh/proteinpaint-')
						)
					},
					outputDir: './.nyc_output',
					reports: ['v8', 'console-summary', 'html', 'json', 'markdown-summary', 'markdown-details'],
					cleanCache: true
				})

				const report = await mcr.add(coverageList)
				await mcr.generate()
				// delete all entries
				lastLines.splice(0, lastLines.length)
				resolve()
			}, 100)
		})
	}

	await browser.close()
	if (server) server.close()
}

function initServer() {
	// NOTES:
	// - integration and other non-unit tests must use an active PP server with test genome and dataset
	// as runproteinpaint({host}); client unit tests do NOT need this active PP server instance
	//
	// - the minimal expressjs instance below serves only static spec code files,
	// so that dynamically-loaded code chunks can be imported at runtime, and also minimize loading
	// irrelevant code chunks when more specific name= pattern is supplied in params
	//
	const app = express()

	const publicDir = path.join(__dirname, '../../public')
	const staticMiddleware = express.static(publicDir)
	app.use(staticMiddleware)
	app.use(bodyParser.json({ limit: '5mb' }))
	app.use(bodyParser.text({ limit: '5mb' }))
	app.use(bodyParser.urlencoded({ extended: true }))
	app.get('*', routeHandler)
	app.post('*', routeHandler)

	const cachedir = `${publicDir}/testrunData`

	async function routeHandler(req, res) {
		const query = Object.assign({}, req.query || {}, req.body || {})
		// console.log(173, req.method, req.path, req.body, req.query)
		delete query.embedder
		delete query.__protected__ //if (req.path.includes('config')) console.log(175, query)
		const cache = new ReqResCache({ path: req.path, query }, { cachedir })

		const data = await cache.read()
		res.status(data.header?.status || 200)
		res.header('content-type', 'application/json')
		res.send(data.res?.body)
	}
	return app.listen(port)
}
