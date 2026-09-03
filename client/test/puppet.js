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
	let groups = patternsStr.split(' ')

	// Optional concurrency: run each spec-pattern group in its own isolated browser
	// context (own window/document/tape harness), N at a time. Defaults to 1, which
	// preserves the original sequential single-context behavior.
	const CONCURRENCY = Math.max(1, Number(process.env.PUPPET_CONCURRENCY) || 1)

	// A lone `name=*` (the default when test.sh is called without a PATTERNSLIST, e.g.
	// `./test.sh "*.integration.spec.*"`) is a single group => nothing to parallelize.
	// When the caller opts into concurrency, split it into one `dir=<specDir>&name=*`
	// group per spec directory, derived from the just-emitted internals-test.js (the exact
	// set of specs that will run). Mirrors the dir+name pattern convention in closestSpec.js.
	if (CONCURRENCY > 1 && groups.length === 1 && /^name=\*?$/.test(groups[0].trim())) {
		const byDir = deriveDirGroups()
		if (byDir.length > 1) groups = byDir
	}

	const browser = await puppeteer.launch({
		// headless: false, // uncomment to see puppeteer chrome instance
		headless: fs.existsSync(path.join(__dirname, '../../../../sjpp')) ? true : 'shell',
		args: [`--no-sandbox`, `--disable-setuid-sandbox`]
	})

	const errors = {}
	// results[i] = { pattern, testedFiles, passed, coverageList, lastLines }
	const results = await runPool(groups, Math.min(CONCURRENCY, groups.length), g =>
		runOnePattern(browser, g, startTime, errors)
	)

	await browser.close()

	// --- Merge V8 coverage from every page into ONE report. The original built a fresh
	// MCR per pattern inside the run loop with cleanCache:true, which under parallelism
	// would race and clobber the shared output dir; collecting first and generating once is
	// both safe and more correct (a file covered by multiple groups gets unioned). ---
	const outputDir = path.join(__dirname, '../.coverage')
	const mcr = MCR({
		name: `Client test coverage`,
		sourceFilter: srcPath => {
			//if (!srcPath.includes('node_modules')) console.log(srcPath)
			return (
				(srcPath.includes('client') || srcPath.includes('shared')) &&
				!srcPath.includes('/bin/test') &&
				!srcPath.includes('_.._') &&
				!srcPath.includes('node_modules') &&
				!srcPath.includes('appdrawer') &&
				!srcPath.includes('sjcrh/proteinpaint-')
			)
		},
		outputDir,
		reports: ['v8', 'console-summary', 'html', 'json-summary', 'markdown-summary', 'markdown-details'],
		cleanCache: true
	})
	for (const r of results) {
		if (r?.coverageList?.length) await mcr.add(r.coverageList)
	}
	await mcr.generate()

	// --- Per-pattern relevant-coverage extraction + summary mapping. Same logic as before,
	// just moved out of the run loop and driven off the single aggregated summary. Only the
	// RELEVANT_SPECS_ONLY path supplies `#testedFiles`, so a plain `name=*`/`dir=*` run skips
	// this block, exactly as the original did. ---
	const html = []
	const markdowns = []
	const json = {}
	const relevantCoverage = {}
	if (results.some(r => r?.testedFiles)) {
		const { default: summary } = await import(`${outputDir}/coverage-summary.json`, { with: { type: 'json' } })
		const summaryFiles = Object.keys(summary)
		for (const r of results) {
			if (!r?.testedFiles) continue
			if (relevantSpecs) {
				const extracts = await emitRelevantSpecCovDetails({
					workspace: 'client',
					relevantSpecs,
					reportDir,
					testedSpecs: patternToSpecs.get(r.pattern),
					specPattern: r.pattern
				})
				if (extracts) {
					//if (!title) title = extracts.title
					html.push(extracts.html)
					markdowns.push(extracts.markdown)
				}
			}

			const files = r.testedFiles.split(',')
			// disinguish reports from different spec-pattern-coverage runs,
			// so that a user may interactively view the applicable coverage html
			for (const f of files) {
				for (const key of summaryFiles) {
					if (key.endsWith(`/${f}`)) {
						relevantCoverage[key.replace('client/', '')] = summary[key]
						//relevantCoverage[f].link = `/coverage/client/${dirname}/`

						if (Object.hasOwn(json, f)) console.log(`non-unique coverage result for client file='${f}'`)
						else json[f] = summary[key]
					}
				}
			}
		}
	}

	if (server) server.close()

	if (html.length) {
		const combinedHtml = html.join('\n')
		fs.writeFileSync(extractFiles.html, combinedHtml, { encoding: 'utf8' })
		const combinedMarkdown = markdowns.join('\n')
		fs.writeFileSync(extractFiles.markdown, combinedMarkdown, { encoding: 'utf8' })
	}
	if (fs.existsSync(path.dirname(extractFiles.json)))
		fs.writeFileSync(extractFiles.json, JSON.stringify(json, null, '  '), { encoding: 'utf8' })

	// aggregate pass/fail counts across every group and print one summary, with the
	// description + failure message of each failing test listed at the bottom
	const summaryText = formatSummary(results)
	console.log(summaryText)

	const totalFail = results.reduce((n, r) => n + (r?.parsed?.fail || 0), 0)
	// groups that never produced a TAP summary (timeout, page load error, thrown exception)
	const erroredGroups = results.filter(r => !r?.parsed && !r?.passed)
	const runPassed = totalFail === 0 && erroredGroups.length === 0

	if (runPassed) {
		// IMPORTANT: CI gates the whole integration run on the mere existence of this file
		// (see .github/actions/run-integration-tests/action.yml, which sets
		// INTEGRATION_TEST_PASSED=true iff client/passedTests.txt exists). It MUST therefore
		// be written ONLY when everything passed — writing it on failure reports a green run.
		fs.writeFileSync('passedTests.txt', summaryText, { encoding: 'utf8' })
		// drop any stale failure record from a previous run
		fs.rmSync('failedTests.txt', { force: true })
	} else {
		// keep the failure summary as an artifact, but under a name the CI gate does NOT check
		fs.writeFileSync('failedTests.txt', summaryText, { encoding: 'utf8' })
		if (erroredGroups.length) {
			console.log(`\n!!! Groups that did not complete (no TAP summary) !!!`)
			for (const r of erroredGroups) {
				console.log(`\nError testing spec pattern=${r?.pattern}`)
				console.log(r?.error || errors[r?.pattern] || '(unknown error)')
			}
			console.log(`\n`)
		}
		process.exit(1)
	}
}

// Parse a page's full TAP log into counts + failing-assertion details. Each failure keeps
// the enclosing `# <group>` comment, the `not ok <n> <description>` text, and the indented
// YAML diagnostic block that follows it (operator / expected / actual / at / ...).
function parseTap(output) {
	const lines = output.join('\n').split('\n')
	let tests = 0,
		pass = 0,
		fail = 0
	let group = ''
	const failures = []
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		let m
		if ((m = line.match(/^# tests\s+(\d+)/))) tests = +m[1]
		else if ((m = line.match(/^# pass\s+(\d+)/))) pass = +m[1]
		else if ((m = line.match(/^# fail\s+(\d+)/))) fail = +m[1]
		else if (line.startsWith('# ') && line.trim() !== '# ok') group = line.slice(2).trim()
		else if ((m = line.match(/^not ok\s+(\d+)\s*(.*)/))) {
			const diag = []
			let j = i + 1
			while (j < lines.length && /^\s/.test(lines[j])) diag.push(lines[j++])
			failures.push({ id: m[1], description: m[2], group, diag })
			i = j - 1
		}
	}
	return { tests, pass, fail, failures }
}

// pick the human-useful lines out of a TAP YAML diagnostic block (falls back to the first
// few raw lines if none of the known keys are present)
function formatDiag(diag) {
	const keys = ['operator', 'expected', 'actual', 'at', 'message', 'error', 'name']
	const trimmed = diag.map(l => l.trim()).filter(Boolean)
	const picked = trimmed.filter(t => keys.some(k => t.startsWith(k + ':')))
	return (picked.length ? picked : trimmed.slice(0, 6)).map(t => `        ${t}`)
}

// build the end-of-run summary: totals, a per-group breakdown, then a FAILED TESTS section
function formatSummary(results) {
	const bar = '='.repeat(64)
	const lines = ['', bar, 'TEST SUMMARY', bar]

	let totalTests = 0,
		totalPass = 0,
		totalFail = 0
	const failures = []
	const groupRows = []
	for (const r of results) {
		if (r?.parsed) {
			const { tests, pass, fail } = r.parsed
			totalTests += tests
			totalPass += pass
			totalFail += fail
			groupRows.push(`  ${fail ? 'FAIL' : ' ok '}  ${r.pattern}  —  ${pass}/${tests}${fail ? ` (${fail} failed)` : ''}`)
			for (const f of r.parsed.failures) failures.push({ ...f, pattern: r.pattern })
		} else {
			groupRows.push(`  ERR   ${r?.pattern ?? '(unknown)'}  —  ${r?.error || 'did not complete'}`)
		}
	}

	lines.push(
		'',
		`groups: ${results.length}`,
		`tests:  ${totalTests}`,
		`pass:   ${totalPass}`,
		`fail:   ${totalFail}`,
		'',
		'per group:',
		...groupRows
	)

	if (failures.length) {
		const dash = '-'.repeat(64)
		lines.push('', dash, `FAILED TESTS (${failures.length})`, dash)
		for (const f of failures) {
			lines.push('', `  [${f.pattern}] ${f.group ? f.group + ' › ' : ''}${f.description || `not ok ${f.id}`}`)
			lines.push(...formatDiag(f.diag))
		}
	}
	lines.push(bar, '')
	return lines.join('\n')
}

// Parse the just-emitted test/internals-test.js for the exact spec files that will run,
// then bucket them into one `dir=<specDir>&name=*` group per spec directory. specDir is
// the folder immediately containing each spec's `test/` dir (matching closestSpec.js), and
// `dir=<specDir>` maps in matchSpecs.js to the glob `**/<specDir>/test/*.spec.*s`.
// NOTE: distinct physical dirs that share a leaf name (e.g. two different `test`-parent
// folders both named `foo`) would collapse into one group — coarser, but still correct.
function deriveDirGroups() {
	const internalsFile = path.join(__dirname, 'internals-test.js')
	if (!fs.existsSync(internalsFile)) return []
	const src = fs.readFileSync(internalsFile, 'utf8')
	const dirs = new Set()
	for (const m of src.matchAll(/matchSpecs\('([^']+)'\)/g)) {
		const file = m[1]
		if (!file.includes('/test/')) continue
		const specDir = file.split('/test/')[0].split('/').pop()
		if (specDir) dirs.add(specDir)
	}
	return [...dirs].map(d => `dir=${d}&name=*`)
}

// Run one spec-pattern group in its own isolated browser context: own cookies/cache, own
// window/document, own tape harness, and — crucially — its own lastLines buffer, so parallel
// TAP streams never interleave into a single `# ok`/`# fail` detection buffer. Never throws;
// records into `errors` and returns a result the caller aggregates.
async function runOnePattern(browser, _pattern, startTime, errors) {
	const [pattern, testedFiles] = _pattern.split('#')
	const context = await browser.createBrowserContext()
	const page = await context.newPage()
	const lastLines = []
	// full TAP log for this page, used after the run to tally pass/fail counts and to
	// extract failing-assertion details (which stream as `not ok` lines *before* the
	// `1..` summary, i.e. before lastLines starts collecting)
	const output = []
	page
		.on('console', m => {
			const msg = m.text()
			console.log(`[${pattern}] ${msg}`)
			output.push(msg)
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
		.on('pageerror', e => {
			console.log(`[${pattern}] -- pageerror --`, e.message)
		})
		.on('requestfailed', request => {
			const text = request.failure().errorText
			if (!text.startsWith('net::ERR_ABORTED'))
				console.log(`[${pattern}] -- requestfailed --`, `${text} ${request.url()}`)
		})

	// Enable JavaScript coverage (CSS coverage is left off, as in the original)
	await page.coverage.startJSCoverage({ resetOnNavigation: true, includeRawScriptCoverage: true })
	try {
		console.log(`\n--- testing http://localhost:${STATICPORT}/puppet.html?port=${DATAPORT}&${pattern} ---\n`)
		// Navigate to test page
		const r = await page.goto(`http://localhost:${STATICPORT}/puppet.html?port=${DATAPORT}&${pattern}`, {
			timeout: Number(process.env.PUPPET_GOTO_TIMEOUT) || 1000
		})
		if (!r.ok()) throw `Error loading page: ${r.status()}`

		const status = await waitForTap(lastLines)
		console.log(`[${pattern}] test run time=${(Date.now() - startTime) / 1000} s`)

		const jsCoverage = await page.coverage.stopJSCoverage()
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
		const coverageList = matched.map(it => ({ source: it.text, ...it.rawScriptCoverage }))
		// parse counts + failing-assertion details from the full TAP log; done even when the
		// harness reported failures (status === 'fail'), so the final summary can tally them
		const parsed = parseTap(output)
		const passed = status === 'ok' && parsed.fail === 0
		if (!passed) errors[pattern] = `${parsed.fail || 'unknown number of'} failing test(s)`
		return { pattern, testedFiles, passed, coverageList, lastLines, parsed }
	} catch (error) {
		console.error(`\n!!! error running pattern=${pattern} !!!\n`)
		errors[pattern] = error
		return { pattern, testedFiles, passed: false, coverageList: [], lastLines, error: String(error) }
	} finally {
		// closing the context also tears down its page(s) and in-flight coverage
		await context.close()
	}
}

// Promisified version of the original setInterval TAP-summary detector: resolve when the
// harness prints a `# ok` summary, reject on `# fail` or if no summary arrives in time.
function waitForTap(lastLines) {
	const expMs = Number(process.env.PUPPET_TAP_TIMEOUT) || 300000
	const start = Date.now()
	return new Promise((resolve, reject) => {
		const i = setInterval(() => {
			if (Date.now() - start > expMs) {
				clearInterval(i)
				return reject(`timeout after ${expMs} ms waiting for TAP summary`)
			}
			// see page.on('console') for the expected last lines being detected
			if (lastLines.length < 4 || !lastLines.find(t => t.includes('# ok') || t.includes('# fail'))) return
			clearInterval(i)
			// resolve with the harness outcome ('ok' | 'fail') instead of rejecting on failure,
			// so the caller can still tally per-test pass/fail counts and extract failure details
			resolve(lastLines.findIndex(l => l.startsWith('# ok')) !== -1 ? 'ok' : 'fail')
		}, 100)
	})
}

// Bounded-concurrency pool; preserves input order in the returned results array.
async function runPool(items, limit, worker) {
	const results = new Array(items.length)
	let next = 0
	async function drain() {
		while (next < items.length) {
			const idx = next++
			results[idx] = await worker(items[idx])
		}
	}
	await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, drain))
	return results
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
