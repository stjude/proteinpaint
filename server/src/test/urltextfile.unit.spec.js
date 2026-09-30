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
- /urltextfile follows only redirect statuses and destroys an unused body
- /urltextfile resolves a relative redirect of a serverconfig.URL url against the public url
- makePublicAddressLookup() checks every resolved address
- requestRemoteUrl() rejects a hostname that resolves to a non-public address
*/

let server, H, port, trickleClosed
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
				} else if (req.url.startsWith('/redirect-loopback/')) {
					res.writeHead(302, { location: `http://${H}/a/b.txt` }).end()
				} else if (req.url.startsWith('/status-300/')) {
					res.writeHead(300, { location: '/a/b.txt' }).end()
				} else if (req.url.startsWith('/redirect-trickle/')) {
					// a redirect whose body never ends, which the handler must not keep reading
					res.writeHead(302, { location: '/a/b.txt' })
					const timer = setInterval(() => res.write('x'), 20)
					trickleClosed = new Promise(resolve =>
						res.on('close', () => {
							clearInterval(timer)
							resolve(true)
						})
					)
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
	for (const u of ['http://a b/path', 'http://a.org\\@127.0.0.1/x', 'http://a.org/x\ty']) {
		test.equal(
			utils.checkRemoteUrl(u, true),
			'url must not contain a backslash, whitespace, or control character',
			`should still check the url syntax of ${JSON.stringify(u)} when skipHostCheck is true`
		)
	}
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

tape('/urltextfile follows only redirect statuses and destroys an unused body', async test => {
	delete serverconfig.URL
	serverconfig.urlHosts = ['127.0.0.1']
	let r = await send(routes['/urltextfile'], { url: `http://${H}/status-300/a.txt` })
	test.equal(r?.error, 'unknown status code: 300', 'should not follow the location of a 300 response')

	r = await send(routes['/urltextfile'], { url: `http://${H}/redirect-trickle/a.txt` })
	test.equal(r?.text, 'INTERNAL /a/b.txt', 'should follow a redirect whose body never ends')
	const closed = await Promise.race([trickleClosed, new Promise(resolve => setTimeout(() => resolve(false), 1000))])
	test.equal(closed, true, 'should close the connection of the redirect instead of reading its endless body')
	delete serverconfig.urlHosts
	test.end()
})

tape('/urltextfile resolves a relative redirect of a serverconfig.URL url against the public url', async test => {
	delete serverconfig.urlHosts
	serverconfig.URL = 'https://pp.example.org'
	serverconfig.port = port
	let r = await send(routes['/urltextfile'], { url: 'https://pp.example.org/redirect-ok/a.txt' })
	test.equal(r?.text, 'INTERNAL /moved/redirect-ok/a.txt', 'should follow a relative redirect on this server')

	r = await send(routes['/urltextfile'], { url: 'https://pp.example.org/redirect-loopback/a.txt' })
	test.equal(
		r?.error,
		'invalid url redirect: url host is not allowed',
		'should reject an absolute redirect to the loopback address'
	)
	delete serverconfig.URL
	test.end()
})

// a dns.lookup() stand-in that resolves each hostname to the listed addresses
function fakeResolver(hosts) {
	return (hostname, options, callback) => {
		const ips = hosts[hostname]
		if (!ips) return callback(Object.assign(new Error('not found'), { code: 'ENOTFOUND' }))
		callback(
			null,
			ips.map(address => ({ address, family: address.includes(':') ? 6 : 4 }))
		)
	}
}

function lookupResult(lookup, hostname, options) {
	return new Promise(resolve => lookup(hostname, options, (err, ...rest) => resolve([err, ...rest])))
}

tape('makePublicAddressLookup() checks every resolved address', async test => {
	delete serverconfig.urlHosts
	const lookup = utils.makePublicAddressLookup(
		fakeResolver({
			'public.test': ['93.184.215.14', '2606:2800:21f:cb07:6820:80da:af6b:8b2c'],
			'loopback.test': ['127.0.0.1'],
			'metadata.test': ['169.254.169.254'],
			'mixed.test': ['93.184.215.14', '10.0.0.1'],
			'mapped.test': ['::ffff:7f00:1']
		})
	)

	let [err, address, family] = await lookupResult(lookup, 'public.test', {})
	test.equal(err, null, 'should allow a hostname that resolves to public addresses')
	test.deepEqual([address, family], ['93.184.215.14', 4], 'should return the first address when options.all is not set')

	let addresses
	;[err, addresses] = await lookupResult(lookup, 'public.test', { all: true })
	test.equal(addresses?.length, 2, 'should return all addresses when options.all is set')

	for (const h of ['loopback.test', 'metadata.test', 'mixed.test', 'mapped.test']) {
		;[err] = await lookupResult(lookup, h, { all: true })
		test.equal(err?.code, 'ENOTPUBLIC', `should reject ${h}`)
	}

	;[err] = await lookupResult(lookup, 'missing.test', {})
	test.equal(err?.code, 'ENOTFOUND', 'should pass on a lookup error')

	serverconfig.urlHosts = ['loopback.test']
	;[err, address] = await lookupResult(lookup, 'loopback.test', {})
	test.equal(address, '127.0.0.1', 'should not check the addresses of a host when urlHosts is set')
	delete serverconfig.urlHosts
	test.end()
})

tape('requestRemoteUrl() rejects a hostname that resolves to a non-public address', async test => {
	delete serverconfig.urlHosts
	// rebind.test passes checkRemoteUrl() as a hostname, but resolves to the loopback address
	const lookup = utils.makePublicAddressLookup(fakeResolver({ 'rebind.test': ['127.0.0.1'] }))
	const url = `http://rebind.test:${port}/a/b.txt`
	test.equal(utils.checkRemoteUrl(url), undefined, 'the hostname alone should pass checkRemoteUrl()')
	try {
		const res = await utils.requestRemoteUrl(url, lookup)
		res.resume()
		test.fail('should not connect to a hostname that resolves to the loopback address')
	} catch (e) {
		test.equal(e.code, 'ENOTPUBLIC', 'should not connect to a hostname that resolves to the loopback address')
	}

	serverconfig.urlHosts = ['rebind.test']
	const res = await utils.requestRemoteUrl(url, lookup)
	test.equal(await utils.readResponseText(res), 'INTERNAL /a/b.txt', 'should connect to a host listed in urlHosts')
	delete serverconfig.urlHosts
	test.end()
})

tape('cleanup', test => {
	for (const [k, v] of Object.entries(saved)) {
		if (v === undefined) delete serverconfig[k]
		else serverconfig[k] = v
	}
	// close any connection left open, such as an endless redirect body, so that a regression fails instead of hanging
	server.closeAllConnections()
	server.close()
	test.end()
})
