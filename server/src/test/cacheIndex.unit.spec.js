import tape from 'tape'
import fs from 'fs'
import os from 'os'
import path from 'path'
import http from 'http'
import serverconfig from '../serverconfig.js'
import * as utils from '../utils.js'
import { setRoutes } from '../app.unorg.js'

/*
Regression specs for path traversal in cache_index() (ANT-2026-UGQ1CB65).

cache_index() turns a request url into a cache dir, cachedir/<protocol>/<url body>, and saves the
index file downloaded from indexURL into it under the basename of indexURL. A ".." in the url body
walked the dir out of cachedir, so an unauthenticated request could write attacker-chosen bytes to
any path the server can write; a protocol like "massSession" landed in another feature's cache dir.

A local http server stands in for the attacker's host. Escape targets are under os.tmpdir(), never
system paths.

test sections:
- cache_index() rejects traversal
- cache_index() rejects non-remote protocols
- cache_index() still caches valid urls
- fileurl() url branch
- /tkbedj, /tabixheader, /bamnochr via the real route table
*/

const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-cacheidx-'))
const up = '/..'.repeat(40) // more than enough to reach "/" from any cachedir

let server, H
function startServer() {
	return new Promise(resolve => {
		server = http
			.createServer((req, res) => res.end('ATTACKER_BYTES ' + req.url))
			.listen(0, '127.0.0.1', () => {
				H = '127.0.0.1:' + server.address().port
				resolve()
			})
	})
}

async function rejects(test, fn, pattern, msg) {
	try {
		await fn()
		test.fail(msg)
	} catch (e) {
		test.match(String(e), pattern, msg)
	}
}

async function send(handler, query) {
	const sent = []
	const req = { query, get: () => undefined }
	const res = { send: x => sent.push(x), status: () => res, header: () => {}, set: () => {} }
	await handler(req, res)
	return sent[0]
}

tape('\n', async function (test) {
	test.comment('-***- cache_index specs -***-')
	await startServer()
	test.end()
})

tape('cache_index() rejects traversal', async test => {
	const escape = path.join(tmpdir, 'escaped')

	// the disclosed payload: ".." in url picks the dir, indexURL picks the file name and bytes
	await rejects(
		test,
		() => utils.cache_index(`http://${H}${up}${escape}/a`, `http://${H}/payload.so`),
		/must not contain "\.\." path segment/,
		'should reject ".." in url'
	)
	test.notOk(fs.existsSync(escape), 'should not create the escaped dir')

	await rejects(
		test,
		() => utils.cache_index(`http://${H}/a\\..\\..\\x/t.gz`),
		/must not contain "\.\." path segment/,
		'should reject a backslash ".." segment'
	)
	await rejects(
		test,
		() => utils.cache_index(`http://${H}/ok/t.gz`, `http://${H}/x/..`),
		/must not contain "\.\." path segment/,
		'should reject ".." as the index file name'
	)
	await rejects(
		test,
		() => utils.cache_index(`http://${H}/ok/t.gz`, `http://${H}/x/.`),
		/index URL file name escapes cache dir/,
		'should reject "." as the index file name'
	)
	test.end()
})

tape('cache_index() rejects non-remote protocols', async test => {
	// protocol becomes a dir name under cachedir, so a feature dir name must not be accepted
	for (const p of ['massSession', 'bam', 'ssid', 'sessionsByCred', 'file', 'javascript']) {
		await rejects(
			test,
			() => utils.cache_index(`${p}://${H}/x/t.gz`),
			/protocol must be http, https or ftp/,
			`should reject ${p}://`
		)
		test.notOk(fs.existsSync(path.join(serverconfig.cachedir, p, H)), `should not create cachedir/${p}/${H}`)
	}
	test.end()
})

tape('cache_index() still caches valid urls', async test => {
	const dir = await utils.cache_index(`http://${H}/tracks/t.gz`, `http://${H}/tracks/t.gz.tbi`)
	test.equal(dir, path.join(serverconfig.cachedir, 'http', H, 'tracks/t.gz'), 'should build dir under cachedir/http')
	test.equal(
		fs.readFileSync(path.join(dir, 't.gz.tbi'), 'utf8'),
		'ATTACKER_BYTES /tracks/t.gz.tbi',
		'should download the index into the cache dir'
	)
	test.equal(
		await utils.cache_index(`HTTPS://${H}/tracks/t.gz`),
		path.join(serverconfig.cachedir, 'https', H, 'tracks/t.gz'),
		'should accept an uppercase protocol'
	)
	test.equal(
		await utils.cache_index(`ftp://${H}/tracks/t.gz`),
		path.join(serverconfig.cachedir, 'ftp', H, 'tracks/t.gz'),
		'should accept ftp'
	)
	test.equal(
		await utils.cache_index(`http://${H}/a..b/t..gz`),
		path.join(serverconfig.cachedir, 'http', H, 'a..b/t..gz'),
		'should allow ".." inside a name'
	)
	for (const p of ['http', 'https', 'ftp'])
		fs.rmSync(path.join(serverconfig.cachedir, p, H), { recursive: true, force: true })
	test.end()
})

tape('fileurl() url branch', test => {
	test.deepEqual(
		utils.fileurl({ query: { url: `http://${H}${up}/etc/x.gz` } }),
		['url must not contain ".." path segment'],
		'should reject ".." in url'
	)
	test.deepEqual(
		utils.fileurl({ query: { url: [`http://${H}/x.gz`, 'y'] } }),
		['url must be a string'],
		'should reject url from a repeated query parameter'
	)
	test.equal(utils.fileurl({ query: { url: `http://${H}/x.gz` } })[1], `http://${H}/x.gz`, 'should accept a normal url')
	test.end()
})

tape('/tkbedj, /tabixheader, /bamnochr via the real route table', async test => {
	const routes = {}
	const record = (p, h) => (routes[p] = h)
	const genome = { name: 'hg38', chrlookup: { CHR1: { name: 'chr1', len: 248956422 } }, datasets: {} }
	setRoutes(
		{ get: record, post: record, all: record, put: record, delete: record, use: () => {} },
		{ hg38: genome },
		{}
	)
	const escape = path.join(tmpdir, 'route-escape')
	const url = `http://${H}${up}${escape}/a`
	const indexURL = `http://${H}/payload.so`

	for (const route of ['/tkbedj', '/tabixheader', '/bamnochr']) {
		const r = await send(routes[route], { genome: 'hg38', url, indexURL, rglst: [{ chr: 'chr1', start: 1, stop: 2 }] })
		test.ok(r?.error, `${route} should return an error for a traversal url`)
		test.notOk(fs.existsSync(escape), `${route} should not write outside cachedir`)
	}

	const r = await send(routes['/bamnochr'], { genome: 'hg38', file: '../../../etc/x.bam' })
	test.equal(r?.error, 'illegal file path', '/bamnochr should reject ".." in file')
	test.end()
})

tape('cleanup', test => {
	server.close()
	fs.rmSync(tmpdir, { recursive: true, force: true })
	test.end()
})
