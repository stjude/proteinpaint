import tape from 'tape'
import fs from 'fs'
import os from 'os'
import path from 'path'
import http from 'http'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import serverconfig from '../serverconfig.js'
import * as utils from '../utils.js'
import { api as ntseqApi } from '../routes/ntseq.ts'
import { setRoutes } from '../app.unorg.js'
import { init as onesampletkInit } from '../j2/onesampletk.ts'

/*
Specs for the request values that are passed as arguments to samtools, tabix and other tools.

The server starts these tools with spawn() and an argument array, so each request value reaches a tool
as one literal argument. The test values below have special characters, such as $(...), backticks, ";",
"|", "&&", ">" or ${IFS}, and each one names a marker file; the specs assert that no marker file is
created, whether the value is rejected or passed on to the tool. The tool-dependent paths run whatever
tools are installed, and the assertions on the markers hold either way.

A local http server stands in for the remote host.

test sections:
- child_process usage
- /ntseq coord
- url and indexURL of the routes that run samtools, tabix, bcftools or bigBedInfo
- get_lines_bigfile() args
*/

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-spawnargs-'))
const hasSamtools = spawnSync(serverconfig.samtools, ['--version']).status === 0

let markerCount = 0
const markers = []
// returns the path of a new marker file, which must never be created
function marker() {
	const m = path.join(tmpdir, `marker${++markerCount}`)
	markers.push(m)
	return m
}
const createdMarkers = () => markers.filter(m => fs.existsSync(m))
// shortens the tmpdir in a test message
const show = s => (typeof s == 'string' ? s.replaceAll(tmpdir, '<tmp>') : JSON.stringify(s))

/*
	returns values with special characters that each name a new marker file; ${IFS} stands in for a space,
	since a space is rejected by some checks before a value reaches a tool
*/
function specialValues() {
	const touch = m => 'touch${IFS}' + m
	// a base64-encoded variant, with its own marker for the decoded file
	const encoded = m => {
		const b64 = Buffer.from(`touch ${m}\n`).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
		const s = path.join(tmpdir, `s${markerCount}.sh`)
		markers.push(s) // the decoded file must not be written either
		return `$(printf${'${IFS}'}%s${'${IFS}'}${b64}|tr${'${IFS}'}--${'${IFS}'}-_${'${IFS}'}+/|base64${'${IFS}'}-d>${s};sh${'${IFS}'}${s})`
	}
	return [
		`$(${touch(marker())})`,
		'`' + touch(marker()) + '`',
		`;${touch(marker())};`,
		`|${touch(marker())}`,
		`&&${touch(marker())}`,
		`>${marker()}`,
		`$(printf${'${IFS}'}x>${marker()})`,
		encoded(marker())
	]
}

const hits = new Set()
let server, H, allowRemoteFile, routes

function startServer() {
	return new Promise(resolve => {
		server = http
			.createServer((req, res) => {
				hits.add(req.url)
				try {
					hits.add(decodeURIComponent(req.url))
				} catch (_) {
					// a value such as %s is not a valid percent-encoding
				}
				res.end('NOT_A_REAL_FILE')
			})
			.listen(0, '127.0.0.1', () => {
				H = '127.0.0.1:' + server.address().port
				resolve()
			})
	})
}

// resolves with the first res.send() payload, since some handlers do not return their promise
function send(handler, query) {
	return new Promise(resolve => {
		const timer = setTimeout(() => resolve({ timeout: true }), 10000)
		const done = x => {
			clearTimeout(timer)
			resolve(x)
		}
		const req = { query, get: () => undefined }
		const res = { send: done, status: () => res, header: () => {}, set: () => {}, end: done }
		Promise.resolve(handler(req, res)).catch(e => done({ error: String(e) }))
	})
}

function getGenome(genomefile = 'NA') {
	return {
		name: 'hg38',
		genomefile,
		chrlookup: { CHR1: { name: 'chr1', len: 248956422 } },
		datasets: {
			// legacy mds routes are only mounted when there is at least one mds dataset
			FakeMds: { isMds: true }
		}
	}
}

const rglst = () => [{ chr: 'chr1', start: 1, stop: 100, width: 100 }]

// routes that pass url and indexURL to samtools, tabix, bcftools or bigBedInfo
const urlRoutes = [
	{ route: '/tkbam', query: (url, indexURL) => ({ genome: 'hg38', url, indexURL, regions: rglst() }) },
	{ route: '/tabixheader', query: (url, indexURL) => ({ genome: 'hg38', url, indexURL }) },
	{ route: '/vcfheader', query: (url, indexURL) => ({ genome: 'hg38', url, indexURL }) },
	{ route: '/bcfheader', query: (url, indexURL) => ({ genome: 'hg38', url, indexURL }) },
	{ route: '/tkld', query: (url, indexURL) => ({ genome: 'hg38', url, indexURL, rglst: rglst() }) },
	{
		route: '/tkbedj',
		query: (url, indexURL) => ({
			genome: 'hg38',
			url,
			indexURL,
			rglst: rglst(),
			stackheight: 10,
			stackspace: 1,
			regionspace: 1,
			width: 100,
			devicePixelRatio: 1
		})
	},
	{ route: '/tkbedgraphdot', query: (url, indexURL) => ({ genome: 'hg38', url, indexURL, rglst: rglst() }) },
	{ route: '/mdsjunction', query: (url, indexURL) => ({ genome: 'hg38', iscustom: 1, url, indexURL, rglst: rglst() }) },
	{ route: '/mdssvcnv', query: (url, indexURL) => ({ genome: 'hg38', iscustom: 1, url, indexURL, rglst: rglst() }) },
	{ route: 'onesampletk', query: (url, indexURL) => ({ genome: 'hg38', url, indexURL, rglst: rglst() }) }
]

tape('\n', async function (test) {
	test.comment('-***- spawn args specs -***-')
	await startServer()
	// the local stand-in host is a loopback address, which fileurl() and cache_index() reject unless listed
	serverconfig.urlHosts = ['127.0.0.1']
	allowRemoteFile = serverconfig.features.ALLOW_remotefilefromurl
	serverconfig.features.ALLOW_remotefilefromurl = true

	routes = {}
	const record = (p, h) => (routes[p] = h)
	const genomes = { hg38: getGenome() }
	setRoutes({ get: record, post: record, all: record, put: record, delete: record, use: () => {} }, genomes, {})
	routes.onesampletk = onesampletkInit({ genomes })
	test.end()
})

tape('child_process usage', test => {
	// these files only pass exec() and execSync() fixed commands, or ones built from serverconfig at
	// startup, not from a request
	const execAllowed = new Set(['checkDependenciesAndVersions.js', 'grin2/memory.ts'])
	const withShellOption = [],
		withExec = []
	const walk = dir => {
		for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
			const f = path.join(dir, d.name)
			if (d.isDirectory()) {
				if (d.name != 'test' && d.name != 'node_modules') walk(f)
				continue
			}
			if (!/\.(js|ts)$/.test(d.name) || d.name == 'app.js') continue // app.js is the bundled server
			const rel = path.relative(srcDir, f)
			const code = fs.readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '') // skip commented-out code
			if (/\bshell\s*:\s*(?!false\b)/.test(code)) withShellOption.push(rel)
			const usesExec =
				/child_process\s*\.\s*exec(Sync)?\s*\(/.test(code) ||
				/import\s*\{[^}]*\bexec(Sync)?\b[^}]*\}\s*from\s*['"](node:)?child_process['"]/.test(code)
			if (usesExec && !execAllowed.has(rel)) withExec.push(rel)
		}
	}
	walk(srcDir)
	test.deepEqual(withShellOption, [], 'no file should set the shell option')
	test.deepEqual(withExec, [], 'only the listed files should use exec() or execSync()')
	test.end()
})

tape('/ntseq coord', async test => {
	const genomes = [getGenome()]
	if (hasSamtools) {
		const fa = path.join(tmpdir, 'ntseq.fa')
		fs.writeFileSync(fa, '>chr1\nACGTACGTAC\n')
		genomes.push(getGenome(fa))
	} else {
		test.comment('samtools not found, only the genome without a fasta file is tested')
	}
	for (const g of genomes) {
		const handler = ntseqApi.methods.get.init({ genomes: { hg38: g } })
		const label = g.genomefile == 'NA' ? 'no fasta' : 'real fasta'
		for (const p of specialValues()) {
			for (const coord of [p, `chr1:1-2${p}`, `chr1:${p}`, `-r${p}`]) {
				const r = await send(handler, { genome: 'hg38', coord })
				// a coord with a special-value suffix may still parse to a valid region; then only that sequence is returned
				test.ok(
					r?.error == 'cannot get sequence' || /^[ACGTN]*$/i.test(r?.seq),
					`${label}: should reject, or return only a sequence for, coord=${show(coord)}`
				)
			}
		}
	}
	test.deepEqual(createdMarkers(), [], 'should not create any marker file')
	test.end()
})

tape('url and indexURL of the routes that run samtools, tabix, bcftools or bigBedInfo', async test => {
	for (const c of urlRoutes) {
		const handler = routes[c.route]
		const name = c.route == 'onesampletk' ? '/termdb/junction/onesampletk' : c.route
		test.equal(typeof handler, 'function', `${name} should be a mounted route`)
		for (const p of specialValues()) {
			const url = `http://${H}/x${p}/t.gz`
			const r1 = await send(handler, c.query(url))
			test.notOk(r1?.timeout, `${name} should respond to url=${show(url)}`)
			const r2 = await send(handler, c.query(`http://${H}/ok/t.gz`, `http://${H}/x${p}/t.gz.tbi`))
			test.notOk(r2?.timeout, `${name} should respond to indexURL with ${show(p)}`)
		}
	}
	test.deepEqual(createdMarkers(), [], 'should not create any marker file')

	// an index url is downloaded by the server itself, so its request shows that the value was sent as literal text
	const p = specialValues()[0]
	await send(routes['/tabixheader'], {
		genome: 'hg38',
		url: `http://${H}/ok2/t.gz`,
		indexURL: `http://${H}/y${p}/t.gz.tbi`
	})
	test.ok(hits.has(`/y${p}/t.gz.tbi`), 'should request the index url with the special characters as literal text')
	test.deepEqual(createdMarkers(), [], 'should not create any marker file')
	test.end()
})

tape('get_lines_bigfile() args', async test => {
	const file = path.join(serverconfig.tpmasterdir, 'files/hg38/TermdbTest/TermdbTest_ITD.gz')
	for (const p of specialValues()) {
		for (const args of [
			[file, `chr1:1-2${p}`],
			[file + p, 'chr1:1-2'],
			['-H', file, p]
		]) {
			// the tool may fail or return no lines, but must not create a marker file
			await utils.get_lines_bigfile({ args, callback: () => {} }).catch(() => {})
		}
	}
	test.deepEqual(createdMarkers(), [], 'should not create any marker file')
	test.end()
})

tape('cleanup', test => {
	delete serverconfig.urlHosts
	if (allowRemoteFile === undefined) delete serverconfig.features.ALLOW_remotefilefromurl
	else serverconfig.features.ALLOW_remotefilefromurl = allowRemoteFile
	server.close()
	for (const p of ['http', 'https', 'ftp'])
		fs.rmSync(path.join(serverconfig.cachedir, p, H), { recursive: true, force: true })
	fs.rmSync(tmpdir, { recursive: true, force: true })
	test.end()
})
