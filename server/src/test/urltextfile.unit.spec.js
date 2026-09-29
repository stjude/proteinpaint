import tape from 'tape'
import http from 'http'
import serverconfig from '../serverconfig.js'
import * as utils from '../utils.js'
import { setRoutes } from '../app.unorg.js'

/*
Regression specs for server-side request forgery in the /urltextfile route.

The route fetches req.query.url on the server and returns the response text, so a url of a loopback,
private, or cloud metadata address would have returned the internal response to the requester.

A local http server on 127.0.0.1 stands in for an internal host, and for this server when
serverconfig.URL is rewritten to the loopback address.

test sections:
- checkRemoteUrl()
- /urltextfile rejects loopback, private ip, and non-http urls
- /urltextfile fetches an allowed url
- /urltextfile rewrites only an exact serverconfig.URL prefix to the loopback address
- /urltextfile checks the host of each redirect
*/

let server, H, port
// the paths that the specs expect the stand-in server to receive
const knownPaths = new Map(['/a/b.txt', '//a/b.txt', '/moved/redirect-ok/a.txt'].map(p => [p, p]))
function startServer() {
	return new Promise(resolve => {
		server = http
			.createServer((req, res) => {
				if (req.url.startsWith('/redirect-internal/')) {
					res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data' }).end()
				} else if (req.url.startsWith('/redirect-ok/')) {
					res.writeHead(301, { location: '/moved' + req.url }).end()
				} else if (req.url.startsWith('/redirect-loop/')) {
					res.writeHead(302, { location: req.url }).end()
				} else {
					// respond with a fixed body per known path instead of reflecting req.url
					res.writeHead(200, { 'content-type': 'text/plain' })
					res.end(knownPaths.has(req.url) ? 'INTERNAL ' + knownPaths.get(req.url) : 'INTERNAL unknown')
				}
			})
			.listen(0, '127.0.0.1', () => {
				port = server.address().port
				H = '127.0.0.1:' + port
				resolve()
			})
	})
}

async function send(handler, query) {
	const sent = []
	const req = { query, get: () => undefined }
	const res = { send: x => sent.push(x), status: () => res, header: () => {}, set: () => {} }
	await handler(req, res)
	return sent[0]
}

const routes = {}
const saved = {}

tape('\n', async function (test) {
	test.comment('-***- /urltextfile specs -***-')
	await startServer()
	for (const k of ['URL', 'port', 'urlHosts']) saved[k] = serverconfig[k]
	delete serverconfig.urlHosts
	const record = (p, h) => (routes[p] = h)
	setRoutes({ get: record, post: record, all: record, put: record, delete: record, use: () => {} }, {}, {})
	test.ok(routes['/urltextfile'], 'should register the /urltextfile route')
	test.end()
})

tape('checkRemoteUrl()', test => {
	test.equal(utils.checkRemoteUrl('https://example.org/a/b.txt'), undefined, 'should allow a public https url')
	test.equal(utils.checkRemoteUrl('http://example.org/a/b.txt'), undefined, 'should allow a public http url')
	for (const u of [
		'http://127.0.0.1/a/b.txt',
		'http://localhost/a/b.txt',
		'http://[::1]/a/b.txt',
		'http://2130706433/a/b.txt',
		'http://10.1.2.3/a/b.txt',
		'http://192.168.1.1/a/b.txt',
		'http://169.254.169.254/latest/meta-data'
	]) {
		test.equal(utils.checkRemoteUrl(u), 'url host is not allowed', `should reject ${u}`)
	}
	test.equal(utils.checkRemoteUrl('ftp://example.org/a/b.txt'), 'protocol must be http or https', 'should reject ftp')
	test.equal(
		utils.checkRemoteUrl('file:///etc/passwd'),
		'protocol must be http, https or ftp',
		'should reject a file url'
	)
	test.equal(utils.checkRemoteUrl('/etc/passwd'), 'improper url', 'should reject a bare path')
	test.equal(utils.checkRemoteUrl(['https://example.org/a']), 'url must be a string', 'should reject an array')
	test.equal(
		utils.checkRemoteUrl('http://localhost/a/b.txt', true),
		undefined,
		'should skip only the host check when skipHostCheck is true'
	)
	test.equal(
		utils.checkRemoteUrl('file:///etc/passwd', true),
		'protocol must be http, https or ftp',
		'should still check the protocol when skipHostCheck is true'
	)
	test.end()
})

tape('/urltextfile rejects loopback, private ip, and non-http urls', async test => {
	delete serverconfig.URL
	const cases = [
		[`http://${H}/secret`, 'loopback ip'],
		[`http://localhost:${port}/secret`, 'localhost'],
		['http://10.0.0.1/secret', 'private ip'],
		['http://172.16.0.1/secret', 'private ip'],
		['http://169.254.169.254/latest/meta-data', 'cloud metadata ip'],
		['http://[::ffff:7f00:1]/secret', 'ipv4-mapped ipv6 loopback'],
		['file:///etc/passwd', 'file url'],
		['ftp://example.org/a/b.txt', 'ftp url'],
		['/etc/passwd', 'bare path'],
		[[`http://${H}/secret`], 'array']
	]
	for (const [url, label] of cases) {
		const r = await send(routes['/urltextfile'], { url })
		test.match(r?.error || '', /^invalid url: /, `should reject a ${label} url`)
		test.notOk(r?.text, `should not return text for a ${label} url`)
	}
	test.end()
})

tape('/urltextfile fetches an allowed url', async test => {
	delete serverconfig.URL
	serverconfig.urlHosts = ['127.0.0.1']
	const r = await send(routes['/urltextfile'], { url: `http://${H}/a/b.txt` })
	test.equal(r?.text, 'INTERNAL /a/b.txt', 'should return the text of a url whose host is listed in urlHosts')
	delete serverconfig.urlHosts
	test.end()
})

tape('/urltextfile rewrites only an exact serverconfig.URL prefix to the loopback address', async test => {
	serverconfig.URL = 'https://pp.example.org'
	serverconfig.port = port

	let r = await send(routes['/urltextfile'], { url: 'https://pp.example.org/a/b.txt' })
	test.equal(r?.text, 'INTERNAL /a/b.txt', 'should fetch a url of this server from the loopback address')

	r = await send(routes['/urltextfile'], { url: 'https://pp.example.org//a/b.txt' })
	test.equal(r?.text, 'INTERNAL //a/b.txt', 'should keep the loopback host for a path that starts with //')

	// with urlHosts set, a url that is not rewritten fails the host check instead of being fetched
	serverconfig.urlHosts = ['example.org']
	for (const url of [
		'https://pp.example.org.evil.com/a/b.txt',
		'https://pp.example.org@169.254.169.254/latest/meta-data',
		'https://pp.example.org:1@127.0.0.1/a/b.txt'
	]) {
		r = await send(routes['/urltextfile'], { url })
		test.equal(r?.error, 'invalid url: url host is not allowed', `should not rewrite a lookalike url ${url}`)
	}

	r = await send(routes['/urltextfile'], { url: 'https://pp.example.org/a/b.txt' })
	test.equal(r?.text, 'INTERNAL /a/b.txt', 'should rewrite a url of this server even if urlHosts does not list it')

	r = await send(routes['/urltextfile'], { url: 'http://pp.example.org:1@127.0.0.1/a/b.txt' })
	test.equal(r?.error, 'invalid url: url host is not allowed', 'should not rewrite a url with a different protocol')
	delete serverconfig.urlHosts

	delete serverconfig.URL
	test.end()
})

tape('/urltextfile checks the host of each redirect', async test => {
	delete serverconfig.URL
	serverconfig.urlHosts = ['127.0.0.1']
	let r = await send(routes['/urltextfile'], { url: `http://${H}/redirect-internal/a.txt` })
	test.equal(
		r?.error,
		'invalid url redirect: url host is not allowed',
		'should reject a redirect to a host that is not allowed'
	)

	r = await send(routes['/urltextfile'], { url: `http://${H}/redirect-ok/a.txt` })
	test.equal(r?.text, 'INTERNAL /moved/redirect-ok/a.txt', 'should follow a redirect to an allowed host')

	r = await send(routes['/urltextfile'], { url: `http://${H}/redirect-loop/a.txt` })
	test.equal(r?.error, 'url has too many redirects', 'should stop following a redirect loop')
	delete serverconfig.urlHosts
	test.end()
})

tape('cleanup', test => {
	for (const [k, v] of Object.entries(saved)) {
		if (v === undefined) delete serverconfig[k]
		else serverconfig[k] = v
	}
	server.close()
	test.end()
})
