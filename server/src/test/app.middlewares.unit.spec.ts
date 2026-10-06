import tape from 'tape'
import {
	getRequestOrigin,
	isAllowedEmbedder,
	isCredEmbedder,
	getCacheControl,
	jsonErrorHandler,
	getFrontPublicFallback
} from '../app.middlewares.js'
import express from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'

function getReq(headers: { [key: string]: string }, protocol = 'http') {
	return { protocol, get: (key: string) => headers[key] }
}

tape('\n', test => {
	test.comment('-***- app.middlewares specs -***-')
	test.end()
})

tape('getRequestOrigin()', test => {
	test.equal(
		getRequestOrigin(getReq({ origin: 'https://trusted.org' }))?.origin,
		'https://trusted.org',
		'should accept a serialized origin'
	)
	test.equal(
		getRequestOrigin(getReq({ origin: 'http://localhost:3000' }))?.origin,
		'http://localhost:3000',
		'should accept a serialized origin with a port'
	)
	for (const origin of [
		'https://trusted.org/path?x=1',
		'https://trusted.org/',
		'https://user:pass@trusted.org', // pragma: allowlist secret
		'null',
		'not a url',
		'file:///etc/passwd',
		'javascript:alert(1)'
	]) {
		test.equal(getRequestOrigin(getReq({ origin })), undefined, `should reject an Origin header='${origin}'`)
	}
	test.equal(
		getRequestOrigin(getReq({ origin: 'https://trusted.org/x', referrer: 'https://trusted.org/x' })),
		undefined,
		'should not fall back to the referrer when an invalid Origin header is present'
	)
	test.equal(
		getRequestOrigin(getReq({ referrer: 'https://a.org:8080/x?y=1' }))?.origin,
		'https://a.org:8080',
		'should allow a path in the referrer fallback'
	)
	test.equal(
		getRequestOrigin(getReq({ referrer: 'https://user:pass@a.org/x' })), // pragma: allowlist secret
		undefined,
		'should reject a referrer with userinfo'
	)
	test.equal(
		getRequestOrigin(getReq({ host: 'localhost:3000' }))?.origin,
		'http://localhost:3000',
		'should fall back to the request protocol and host'
	)
	test.equal(
		getRequestOrigin(getReq({ host: 'example.com:443' }, 'https'))?.origin,
		'https://example.com',
		'should accept a host fallback with an explicit default port'
	)
	test.equal(
		getRequestOrigin(getReq({ host: 'Example.COM' }, 'https'))?.origin,
		'https://example.com',
		'should accept a host fallback with non-lowercase casing'
	)
	test.equal(getRequestOrigin(getReq({})), undefined, 'should return undefined when there is no origin')
	test.end()
})

tape('isAllowedEmbedder()', test => {
	const origin = new URL('https://trusted.org')
	test.equal(isAllowedEmbedder(origin, 'trusted.org'), true, 'should match an exact hostname')
	test.equal(isAllowedEmbedder(origin, '*'), true, `should match '*'`)
	test.equal(
		isAllowedEmbedder(new URL('https://trusted.org.evil.com'), 'trusted.org'),
		false,
		'should not match a host that only has the embedder as a prefix'
	)
	test.equal(
		isAllowedEmbedder(new URL('https://eviltrusted.org'), 'trusted.org'),
		false,
		'should not match a host that only has the embedder as a suffix'
	)
	test.equal(
		isAllowedEmbedder(new URL('https://sub.trusted.org'), 'trusted.org'),
		false,
		'should not match a subdomain of an exact embedder host'
	)
	const withPort = new URL('http://localhost:3000')
	test.equal(isAllowedEmbedder(withPort, 'localhost'), true, 'should match a hostname for an origin with a port')
	test.equal(isAllowedEmbedder(withPort, 'localhost:3000'), true, 'should match a hostname:port')
	test.equal(isAllowedEmbedder(withPort, 'localhost:4000'), false, 'should not match a different port')
	test.equal(isAllowedEmbedder(undefined, 'trusted.org'), false, 'should not match an explicit host without an origin')
	test.end()
})

tape('isCredEmbedder()', test => {
	const origin = new URL('https://portal.example.org')
	test.equal(isCredEmbedder(origin, 'portal.example.org'), true, 'should match an exact hostname')
	test.equal(isCredEmbedder(origin, '*.example.org'), true, 'should match a glob pattern')
	test.equal(isCredEmbedder(origin, '*.EXAMPLE.org'), true, 'should match a glob pattern case-insensitively')
	test.equal(isCredEmbedder(origin, '*'), true, `should match '*'`)
	test.equal(
		isCredEmbedder(new URL('https://example.org.evil.com'), '*.example.org'),
		false,
		'should not match a host that only has the glob domain as a prefix'
	)
	test.equal(
		isCredEmbedder(new URL('https://portal.example.org.evil.com'), 'portal.example.org'),
		false,
		'should not match a host that only has the embedder as a prefix'
	)
	test.equal(isCredEmbedder(origin, 'other.org'), false, 'should not match a different host')
	test.equal(
		isCredEmbedder(new URL('http://localhost:3000'), 'localhost'),
		true,
		'should match a hostname for an origin with a port'
	)
	test.equal(isCredEmbedder(undefined, '*.example.org'), false, 'should not match a glob pattern without an origin')
	test.end()
})

tape('getCacheControl()', test => {
	const immutable = 'public, max-age=31536000, immutable'
	test.equal(
		getCacheControl('/bin/123.abcd1234.proteinpaint.js'),
		immutable,
		'should cache a hashed chunk as immutable'
	)
	test.equal(
		getCacheControl('/bin/123.abcd1234.proteinpaint.js.map'),
		immutable,
		'should cache a hashed chunk source map as immutable'
	)
	test.equal(
		getCacheControl('/bin/123.abcd1234.proteinpaint.js', undefined, true),
		'private, max-age=31536000, immutable',
		'should not allow a shared cache to store a hashed chunk when isPrivate'
	)
	test.equal(getCacheControl('/bin/proteinpaint.js'), 'no-cache', 'should require revalidation of the bundle entry')
	test.equal(
		getCacheControl('/base/bin/proteinpaint.js'),
		'no-cache',
		'should require revalidation of the bundle entry under a basepath'
	)
	test.equal(getCacheControl('/bin/123.proteinpaint.js'), undefined, 'should not set a header for an unhashed chunk')
	test.equal(getCacheControl('/bin/dist/app.js'), undefined, 'should not set a header for other static files')
	test.equal(getCacheControl('/genomes'), 'immutable,max-age=1', 'should default to a 1 second max-age for a route')
	test.equal(getCacheControl('/genomes', 5), 'immutable,max-age=5', 'should use the responseMaxAge for a route')
	test.end()
})

tape('jsonErrorHandler()', test => {
	function respond(err, headersSent = false) {
		const out: any = { nextErr: undefined }
		const res: any = {
			headersSent,
			status(code) {
				out.status = code
				return res
			},
			send(body) {
				out.body = body
			}
		}
		jsonErrorHandler(err, {}, res, e => (out.nextErr = e))
		return out
	}

	const clientErr = Object.assign(new Error('unsupported content encoding "bogus"'), { status: 415, expose: true })
	test.deepEqual(
		respond(clientErr),
		{ nextErr: undefined, status: 415, body: { error: 'unsupported content encoding "bogus"' } },
		'should expose the message of a client error'
	)

	const serverErr = Object.assign(new Error('ENOENT: /home/root/pp/tp/secret'), { status: 500, expose: false })
	test.deepEqual(respond(serverErr).body, { error: 'request failed' }, 'should hide the message of a server error')

	const exposed5xx = Object.assign(new Error('internal detail'), { statusCode: 503, expose: true })
	const r = respond(exposed5xx)
	test.equal(r.status, 503, 'should use statusCode when status is missing')
	test.deepEqual(r.body, { error: 'request failed' }, 'should hide the message of a 5xx even when expose is set')

	for (const status of [undefined, 'x', 200, 302, 700]) {
		const res = respond(Object.assign(new Error('m'), { status, expose: true }))
		test.equal(res.status, 500, `should answer a missing or invalid status (${status}) as 500`)
	}

	const sent = respond(clientErr, true)
	test.equal(sent.nextErr, clientErr, 'should pass the error on when the response has already started')
	test.equal(sent.status, undefined, 'should not set a status when the response has already started')
	test.end()
})

tape('getFrontPublicFallback()', async test => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-front-public-'))
	const publicDir = path.join(dir, 'public')
	const frontDir = path.join(dir, 'front')
	fs.mkdirSync(publicDir)
	fs.mkdirSync(path.join(frontDir, 'cards'), { recursive: true })
	fs.writeFileSync(path.join(frontDir, 'index.html'), 'front index')
	fs.writeFileSync(path.join(frontDir, 'cards/a.json'), 'front card')
	fs.writeFileSync(path.join(frontDir, 'other.txt'), 'other')
	fs.writeFileSync(path.join(publicDir, 'b.json'), 'public file')
	const app = express()
	app.use(express.static(publicDir))
	app.use(getFrontPublicFallback(frontDir))
	const server = app.listen(0)
	await new Promise(resolve => server.once('listening', resolve))
	const port = (server.address() as any).port
	const get = async (p: string) => {
		const r = await fetch(`http://127.0.0.1:${port}${p}`)
		return [r.status, r.status == 200 ? await r.text() : '']
	}
	try {
		test.deepEqual(await get('/'), [200, 'front index'], 'should serve the front index.html when public/ has none')
		test.deepEqual(await get('/index.html'), [200, 'front index'], 'should serve /index.html from the front copy')
		test.deepEqual(await get('/cards/a.json'), [200, 'front card'], 'should serve a front card when public/ has none')
		test.deepEqual(await get('/other.txt'), [404, ''], 'should not serve other files in the front dir')
		test.deepEqual(await get('/b.json'), [200, 'public file'], 'should still serve the public/ files')
		for (const p of ['/cards/%2e%2e/other.txt', '/cards/..%2fother.txt', '/cards%2f..%2fother.txt']) {
			test.notEqual((await get(p))[0], 200, `should not serve other files in the front dir for ${p}`)
		}
		fs.writeFileSync(path.join(publicDir, 'index.html'), 'public index')
		fs.mkdirSync(path.join(publicDir, 'cards'))
		fs.writeFileSync(path.join(publicDir, 'cards/a.json'), 'public card')
		test.deepEqual(await get('/'), [200, 'public index'], 'should prefer the public/ index.html')
		test.deepEqual(await get('/cards/a.json'), [200, 'public card'], 'should prefer a public/ card')
	} finally {
		server.close()
		fs.rmSync(dir, { recursive: true, force: true })
	}
	test.end()
})
