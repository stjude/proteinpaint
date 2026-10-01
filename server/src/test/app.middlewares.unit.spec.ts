import tape from 'tape'
import { getRequestOrigin, isAllowedEmbedder, isCredEmbedder, getCacheControl } from '../app.middlewares.js'

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
