import tape from 'tape'
import fs from 'fs'
import os from 'os'
import path from 'path'
import http from 'http'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import serverconfig from '../serverconfig.js'
import * as common from '#shared/common.js'
import { setRoutes } from '../app.unorg.js'
import { init as onesampletkInit } from '../j2/onesampletk.ts'

/*
Specs for each caller of utils.cache_index() that is reached from a request.

Every caller passes the request url and indexURL to the shared utils.cache_index(), which keeps the
cache dir and the downloaded index under serverconfig.cachedir. Each route below is driven twice:
- with a valid url, the index must be downloaded, so the route is known to reach cache_index()
- with a url that has ".." segments, no dir may be created outside cachedir and no index downloaded

A local http server stands in for the remote host. The outside dirs are under os.tmpdir().

test sections:
- every cache_index() call uses utils.cache_index()
- one section per route, see routeCases[]
*/

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-cacheidx-callers-'))
// /tkbedj runs bigBedInfo, which some environments do not have
const hasBigBedInfo = !spawnSync(serverconfig.bigBedInfo, []).error
const up = '/..'.repeat(40) // more than enough to reach "/" from any cachedir
// a new array for each request, since some handlers add properties to rglst[]
const rglst = () => [{ chr: 'chr1', start: 1, stop: 100, width: 100 }]

// request paths that the local server has received
const hits = new Set()
let server, H, allowRemoteFile, routes

function startServer() {
	return new Promise(resolve => {
		server = http
			.createServer((req, res) => {
				hits.add(decodeURIComponent(req.url))
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

function getGenome() {
	return {
		name: 'hg38',
		genomefile: 'NA',
		chrlookup: { CHR1: { name: 'chr1', len: 248956422 } },
		datasets: {
			// legacy mds routes are only mounted when there is at least one mds dataset
			FakeMds: { isMds: true }
		}
	}
}

/*
	name: also the name of the outside dir
	route: path in the route table, or a handler
	file: the caller file, for the test message
	query(url, indexURL): request query
*/
const routeCases = [
	{
		name: 'tkbam',
		route: '/tkbam',
		file: 'bam.js',
		query: (url, indexURL) => ({ genome: 'hg38', url, indexURL, regions: rglst() })
	},
	{
		name: 'tkbam-getread',
		route: '/tkbam',
		file: 'bam.js',
		query: (url, indexURL) => ({
			genome: 'hg38',
			url,
			indexURL,
			getread: 1,
			chr: 'chr1',
			qname: 'x',
			start: 1,
			stop: 2
		})
	},
	{
		name: 'tkld',
		route: '/tkld',
		file: 'ld.js',
		query: (url, indexURL) => ({ genome: 'hg38', url, indexURL, rglst: rglst() })
	},
	{
		name: 'tkbedj',
		route: '/tkbedj',
		file: 'bedj.js',
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
	{
		name: 'tkaicheck',
		route: '/tkaicheck',
		file: 'aicheck.js',
		query: (url, indexURL) => ({
			genome: 'hg38',
			url,
			indexURL,
			rglst: rglst(),
			coveragemax: 100,
			vafheight: 10,
			coverageheight: 10,
			rowspace: 1,
			width: 100,
			devicePixelRatio: 1
		})
	},
	{
		name: 'tkbampile',
		route: '/tkbampile',
		file: 'bampile.js',
		query: (url, indexURL) => ({
			genome: 'hg38',
			url,
			indexURL,
			rglst: rglst(),
			allheight: 10,
			fineheight: 10,
			fineymax: 10,
			midpad: 1,
			regionspace: 1,
			width: 100
		})
	},
	{
		name: 'tkbigwig',
		route: '/tkbigwig',
		file: 'bw.js',
		query: (url, indexURL) => ({ genome: 'hg38', url, indexURL, rglst: rglst() })
	},
	{
		name: 'tkbedgraphdot',
		route: '/tkbedgraphdot',
		file: 'bedgraphdot.js',
		query: (url, indexURL) => ({ genome: 'hg38', url, indexURL, rglst: rglst() })
	},
	{
		name: 'tabixheader',
		route: '/tabixheader',
		file: 'app.unorg.js',
		query: (url, indexURL) => ({ genome: 'hg38', url, indexURL })
	},
	{
		name: 'vcfheader',
		route: '/vcfheader',
		file: 'app.unorg.js',
		query: (url, indexURL) => ({ genome: 'hg38', url, indexURL })
	},
	{
		name: 'bcfheader',
		route: '/bcfheader',
		file: 'app.unorg.js',
		query: (url, indexURL) => ({ genome: 'hg38', url, indexURL })
	},
	{
		name: 'mdssvcnv',
		route: '/mdssvcnv',
		file: 'app.unorg.js',
		query: (url, indexURL) => ({ genome: 'hg38', iscustom: 1, url, indexURL, rglst: rglst() })
	},
	{
		name: 'mdssvcnv-checkvcf',
		route: '/mdssvcnv',
		file: 'app.unorg.js',
		query: (url, indexURL) => ({
			genome: 'hg38',
			iscustom: 1,
			file: 'files/hg38/TermdbTest/TermdbTest_ITD.gz',
			checkvcf: JSON.stringify({ url, indexURL }),
			rglst: rglst()
		})
	},
	{
		name: 'mdssvcnv-checkexpressionrank',
		route: '/mdssvcnv',
		file: 'handle_mdssvcnv_expression.js',
		query: (url, indexURL) => ({
			genome: 'hg38',
			iscustom: 1,
			file: 'files/hg38/TermdbTest/TermdbTest_ITD.gz',
			checkexpressionrank: { url, indexURL },
			rglst: rglst()
		})
	},
	{
		name: 'mdsexpressionrank',
		route: '/mdsexpressionrank',
		file: 'app.unorg.js',
		query: (url, indexURL) => ({ genome: 'hg38', iscustom: 1, sample: 's1', url, indexURL, rglst: rglst() })
	},
	{
		name: 'mdsgenevalueonesample',
		route: '/mdsgenevalueonesample',
		file: 'app.unorg.js',
		query: (url, indexURL) => ({
			genome: 'hg38',
			iscustom: 1,
			sample: 's1',
			genes: [{ gene: 'TP53', chr: 'chr1', start: 1, stop: 2 }],
			url,
			indexURL
		})
	},
	...['isgenevalue', 'iscnv', 'isloh', 'isitd', 'issvfusion', 'issvcnv', 'isvcf', 'ismutation'].map(flag => ({
		name: 'samplematrix-' + flag,
		route: '/samplematrix',
		file: 'app.unorg.js',
		query: (url, indexURL) => samplematrixQuery(flag, url, indexURL)
	})),
	{
		name: 'mdsjunction',
		route: '/mdsjunction',
		file: 'mds.junction.js',
		query: (url, indexURL) => ({ genome: 'hg38', iscustom: 1, url, indexURL, rglst: rglst() })
	},
	{
		name: 'mdsgeneboxplot',
		route: '/mdsgeneboxplot',
		file: 'mds.geneboxplot.js',
		query: (url, indexURL) => ({
			genome: 'hg38',
			iscustom: 1,
			url,
			indexURL,
			gene: 'TP53',
			chr: 'chr1',
			start: 1,
			stop: 2
		})
	},
	{
		name: 'onesampletk',
		route: 'onesampletk',
		file: 'j2/onesampletk.ts',
		query: (url, indexURL) => ({ genome: 'hg38', url, indexURL, rglst: rglst() })
	}
]

/*
	flag: a samplematrix feature flag
	returns a /samplematrix request with one custom track, of the type that the flag reads
*/
function samplematrixQuery(flag, url, indexURL) {
	const feature = { chr: 'chr1', start: 1, stop: 100, [flag]: true }
	let tk
	if (flag == 'isgenevalue') {
		feature.genename = 'TP53'
		tk = { type: common.tkt.mdsexpressionrank, url, indexURL }
	} else if (flag == 'isvcf' || flag == 'ismutation') {
		tk = { type: common.tkt.mdsvcf, url, indexURL }
	} else {
		tk = { type: common.tkt.mdssvcnv, url, indexURL }
	}
	if (flag == 'ismutation') feature.querykeylst = ['k']
	else feature.querykey = 'k'
	return { genome: 'hg38', iscustom: 1, querykey2tracks: { k: tk }, features: [feature] }
}

// callers whose url and indexURL come from a dataset config, not a request; they still go through utils.cache_index()
const configCallers = ['km.js', 'mds3.init.js']

tape('\n', async function (test) {
	test.comment('-***- cache_index() caller specs -***-')
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

tape('every cache_index() call uses utils.cache_index()', test => {
	// a caller that copied cache_index() would not have its checks, so only utils.js may define it
	const callers = new Set(),
		ownDefinition = [],
		notImported = []
	const walk = dir => {
		for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
			const f = path.join(dir, d.name)
			if (d.isDirectory()) {
				if (d.name != 'test' && d.name != 'node_modules') walk(f)
				continue
			}
			if (!/\.(js|ts)$/.test(d.name) || d.name == 'app.js') continue // app.js is the bundled server
			const rel = path.relative(srcDir, f)
			if (rel == 'utils.js') continue
			const code = fs.readFileSync(f, 'utf8')
			if (/function\s+cache_index\b/.test(code)) ownDefinition.push(rel)
			if (!/\bcache_index\s*\(/.test(code)) continue
			callers.add(rel)
			// a bare cache_index() call must be the named import from utils.js
			if (
				/(^|[^.\w])cache_index\s*\(/m.test(code) &&
				!/import\s*\{[^}]*\bcache_index\b[^}]*\}\s*from\s*['"](\.\/|#src\/)utils\.js['"]/.test(code)
			)
				notImported.push(rel)
		}
	}
	walk(srcDir)
	test.deepEqual(ownDefinition, [], 'only utils.js should define cache_index()')
	test.deepEqual(notImported, [], 'a bare cache_index() call should be the import from utils.js')
	// a new caller needs a case in routeCases[], or in configCallers[] if its url only comes from dataset config
	test.deepEqual(
		[...callers].sort(),
		[...new Set([...routeCases.map(c => c.file), ...configCallers])].sort(),
		'every caller should have a case'
	)
	test.end()
})

for (const c of routeCases) {
	tape(`${c.route == 'onesampletk' ? '/termdb/junction/onesampletk' : c.route} (${c.file}), ${c.name}`, async test => {
		const handler = routes[c.route]
		test.equal(typeof handler, 'function', 'should be a mounted route')
		if (c.route == '/tkbedj' && !hasBigBedInfo) {
			test.comment('bigBedInfo not found, skipped')
			return test.end()
		}

		// valid url: the index must be downloaded, otherwise this route did not reach cache_index()
		const ctl = `/ctl-${c.name}/t.gz`
		await send(handler, c.query(`http://${H}${ctl}`, `http://${H}${ctl}.tbi`))
		test.ok(hits.has(ctl + '.tbi'), 'should download the index of a valid url')

		// url with ".." segments, and an index url to download into the outside dir
		const outside = path.join(tmpdir, c.name)
		const idx = `/idx-${c.name}/t.gz.tbi`
		const r = await send(handler, c.query(`http://${H}${up}${outside}/a`, `http://${H}${idx}`))
		test.ok(r?.error, 'should return an error for a url with ".." segments')
		test.notOk(fs.existsSync(outside), 'should not create a dir outside cachedir')
		test.notOk(hits.has(idx), 'should not download the index')
		test.end()
	})
}

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
