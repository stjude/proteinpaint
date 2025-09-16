// reuse expressjs, as installed in the server workspace
import express from 'express'
import puppeteer from 'puppeteer'
import fs from 'fs'
import MCR from 'monocart-coverage-reports'
import path from 'path'
import crypto from 'crypto'
import { decode as urlJsonDecode } from '#shared/urljson.js'
import bodyParser from 'body-parser'
import { ReqResCache, emitRelevantSpecCovDetails, publicSpecsDir } from '@sjcrh/augen/dev'
import { getRelevantClientSpecs, getUrlParams } from './closestSpec.js'
import { minimatch } from 'minimatch'

// user __dirname later to detect relative path to public dir,
// since the unit test may be triggered from the pp dir with --workspace option
const __dirname = import.meta.dirname
// serves html, js, and css bundles
const STATICPORT = 6789
// serves live OR cached API responses,
// may be the same as STATICPORT if serving cached resposes
const DATAPORT = Number(process.argv[3] || 0) || 3000
const reportDir = path.join(__dirname, '../.coverage')
const publicSpecsClientDir = `${publicSpecsDir}/client`
const extractFiles = {
	html: `${publicSpecsDir}/client-relevant.html`,
	markdown: `${publicSpecsDir}/client-relevant.md`,
	json: `${publicSpecsDir}/client-relevant.json`
}

let relevantSpecs, patternToSpecs
let patternsStr = process.argv[2] || 'name=*' // default pattern to test all emitted spec imports
if (!patternsStr) throw `missing puppet.js patternsStr argument`
if (patternsStr === 'RELEVANT_SPECS_ONLY') {
	relevantSpecs = getRelevantClientSpecs()
	if (!relevantSpecs.matched?.length) {
		console.log('\n--- No applicable client specs to test in this branch. ---\n')
		patternsStr = ''
	} else {
		const urlParams = getUrlParams(relevantSpecs)
		patternToSpecs = urlParams.patternToSpecs
		patternsStr = urlParams.paramsStr
	}
	if (fs.existsSync(publicSpecsClientDir)) fs.rmSync(publicSpecsClientDir, { force: true, recursive: true })
	if (fs.existsSync(extractFiles.html)) fs.rmSync(extractFiles.html, { force: true, recursive: true })
	if (fs.existsSync(extractFiles.markdown)) fs.rmSync(extractFiles.markdown, { force: true, recursive: true })
	if (fs.existsSync(extractFiles.json)) fs.rmSync(extractFiles.json, { force: true, recursive: true })
}

if (patternsStr) {
	if (patternsStr === 'NO_BRANCH_COVERAGE_UPDATE') {
		// a coverage run is requested, but there are no relevant files that have been updated in the branch
		console.log('\n--- No applicable client specs to test in this branch. ---\n')
		patternsStr = ''
	} else {
		// IMPORTANT: runTest call process.exit(1) if there are any detected errors,
		// no need to throw here, just log to the console
		runTest(patternsStr).catch(console.error)
	}
}

async function runTest(patternsStr) {
	const startTime = Date.now()
	const server = initServer()
	const patternsArr = patternsStr.split(' ')

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

	const html = []
	const markdowns = []
	const json = {}
	//let title

	const relevantCoverage = {}
	const errors = {}

	for (const _pattern of patternsArr) {
		// Enable both JavaScript and CSS coverage
		await Promise.all([
			page.coverage.startJSCoverage({
				resetOnNavigation: true,
				includeRawScriptCoverage: true
			})
			//page.coverage.startCSSCoverage()
		])

		const [pattern, testedFiles] = _pattern.split('#')
		//console.log(101, DATAPORT, pattern)
		console.log(`\n--- testing http://localhost:${STATICPORT}/puppet.html?port=${DATAPORT}&${pattern} ---\n`)
		// Navigate to test page
		await page
			.goto(`http://localhost:${STATICPORT}/puppet.html?port=${DATAPORT}&${pattern}`, { timeout: 1000 })
			.then(r => {
				if (!r.ok()) throw `Error loading page: ${r.status()}`
			})
			.catch(e => {
				console.error('--- page.goto().catch ---', e)
				errors[pattern] = error
			})

		if (errors[pattern]) continue

		await new Promise((resolve, reject) => {
			const i = setInterval(async () => {
				// see page.on('console') above for the expected last lines texts that are being detected
				if (lastLines.length < 4 || !lastLines.find(t => t.includes('# ok') || t.includes('# fail'))) return
				clearInterval(i)
				console.log(`test run time=${(Date.now() - startTime) / 1000} ms`)

				// Disable both JavaScript and CSS coverage
				const [jsCoverage /*, cssCoverage*/] = await Promise.all([
					page.coverage.stopJSCoverage()
					//page.coverage.stopCSSCoverage(),
				])

				if (!lastLines.find(l => l.startsWith('# ok'))) {
					console.error(`\n!!! test failed !!!\n`)

					reject(lastLines.join('\n'))
				}

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
				//fs.writeFileSync(`${process.cwd()}/results-${patternsArr.indexOf(pattern)}.json`, JSON.stringify(matched))

				const coverageList = matched.map((it, i) => {
					return {
						source: it.text,
						...it.rawScriptCoverage
					}
				})

				const outputDir = path.join(__dirname, '../.coverage')
				const mcr = MCR({
					name: `Client test coverage for pattern '${pattern}'`,
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
					outputDir,
					reports: ['v8', 'console-summary', 'html', 'json-summary', 'markdown-summary', 'markdown-details'],
					cleanCache: true
				})

				const report = await mcr.add(coverageList)
				await mcr.generate()

				if (testedFiles) {
					if (relevantSpecs) {
						const extracts = await emitRelevantSpecCovDetails({
							workspace: 'client',
							relevantSpecs,
							reportDir,
							testedSpecs: patternToSpecs.get(pattern),
							specPattern: pattern
						})
						if (extracts) {
							//if (!title) title = extracts.title
							html.push(extracts.html)
							markdowns.push(extracts.markdown)
						}
					}

					const { default: summary } = await import(`${outputDir}/coverage-summary.json`, { with: { type: 'json' } })
					const files = testedFiles.split(',')
					// disinguish reports from different spec-pattern-coverage runs,
					// so that a user may interactively view the applicable coverage html
					// const publicDir = pattern.replaceAll('&', '`_').replaceAll('=', '~')
					// fs.renameSync(outputDir, path.join(__dirname, '../.nyc_output'))
					const summaryFiles = Object.keys(summary)
					for (const f of files) {
						for (const key of summaryFiles) {
							if (key.endsWith(`/${f}`)) {
								relevantCoverage[key.replace('client/', '')] = summary[key]
								//relevantCoverage[f].link = `/coverage/client/${dirname}/`

								if (Object.hasOwn(json, f)) console.log(51, `non-unique coverage result for client file='${f}'`)
								else json[f] = summary[key]
							}
						}
					}
				}

				// delete all entries
				lastLines.splice(0, lastLines.length)
				resolve()
			}, 100)
		}).catch(error => {
			errors[pattern] = error
		})
	}

	await browser.close()
	if (server) server.close()

	if (html.length) {
		const combinedHtml = html.join('\n')
		fs.writeFileSync(extractFiles.html, combinedHtml, { encoding: 'utf8' })
		const combinedMarkdown = markdowns.join('\n')
		fs.writeFileSync(extractFiles.markdown, combinedMarkdown, { encoding: 'utf8' })
	}
	if (fs.existsSync(path.dirname(extractFiles.json)))
		fs.writeFileSync(extractFiles.json, JSON.stringify(json, null, '  '), { encoding: 'utf8' })

	if (Object.keys(errors).length) {
		console.log(`\n!!! Errors detected !!!`)
		for (const [pattern, error] of Object.entries(errors)) {
			console.log(`\nErrors testing spec pattern=${pattern}`)
			console.log(error)
		}
		console.log(`\n`)
		process.exit(1)
	}
}

function getLowestPct(result) {
	if (Object.hasOwn(result, 'lowestPct')) return result.lowestPct.curr
	const values = Object.values(result)
	if (!values.length) return 0
	let min
	for (const v of values) {
		if (!Object.hasOwn(v, 'pct')) continue
		if (min === undefined || min > v.pct) min = v.pct
	}
	return min
}

function getAveragePct(result) {
	if (Object.hasOwn(result, 'averagePct')) return result.averagePct.curr
	const values = Object.values(result)
	if (!values.length) return 0
	let total = 0
	for (const v of values) total += Object.hasOwn(v, 'pct') ? v.pct : 0
	return total / values.length
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
	return app.listen(STATICPORT)
}
