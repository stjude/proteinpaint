import tape from 'tape'
import jsonwebtoken from 'jsonwebtoken'
import { addDemoTokenCred, getApplicableSecret } from '#src/auth/auth.demoToken.ts'

/*************************
 reusable constants and helper functions
**************************/

const secret = 'test-secret-abc123' // pragma: allowlist secret
const demoSecret = 'demo-secret-xyz789' // pragma: allowlist secret

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- src/auth/auth.demoToken -***-')
	test.end()
})

tape('addDemoTokenCred: non-object demoToken is deleted', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const cred: any = { secret, demoToken: 'not-an-object' }
	addDemoTokenCred(cred, 'testDs')
	test.equal(cred.demoToken, undefined, 'should delete cred.demoToken when it is not an object')
	test.end()
})

tape('addDemoTokenCred: missing demoToken.secret falls back to cred.secret', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const cred: any = {
		secret,
		demoToken: {
			roles: ['user'],
			referers: ['test.example.com']
		}
	}
	addDemoTokenCred(cred, 'testDs')
	test.equal(cred.demoToken.secret, secret, 'should set demoToken.secret to cred.secret when missing')
	test.ok(cred.demoToken.computedByRole, 'should initialize computedByRole object')
	test.end()
})

tape('addDemoTokenCred: valid demoToken with custom secret', function (test) {
	test.timeoutAfter(500)
	test.plan(4)

	const cred: any = {
		secret,
		demoToken: {
			roles: ['user', 'admin'],
			referers: ['https://example.com'],
			secret: demoSecret
		}
	}
	addDemoTokenCred(cred, 'testDs')
	test.equal(cred.demoToken.secret, demoSecret, 'should keep the provided demoToken.secret')
	test.deepEqual(cred.demoToken.roles, ['user', 'admin'], 'should keep the provided roles')
	test.deepEqual(cred.demoToken.referers, ['https://example.com'], 'should keep the provided referers')
	test.deepEqual(cred.demoToken.computedByRole, {}, 'should initialize empty computedByRole object')
	test.end()
})

tape('addDemoTokenCred: invalid roles is replaced with empty array', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const cred: any = {
		secret,
		demoToken: {
			roles: 'not-an-array',
			referers: [],
			secret: demoSecret
		}
	}
	addDemoTokenCred(cred, 'testDs')
	test.deepEqual(cred.demoToken.roles, [], 'should replace non-array roles with empty array')
	test.end()
})

tape('addDemoTokenCred: invalid referers is replaced with empty array', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const cred: any = {
		secret,
		demoToken: {
			roles: [],
			referers: 'not-an-array',
			secret: demoSecret
		}
	}
	addDemoTokenCred(cred, 'testDs')
	test.deepEqual(cred.demoToken.referers, [], 'should replace non-array referers with empty array')
	test.end()
})

tape('getApplicableSecret: session jwt (with dslabel+embedder+route) always uses cred.secret', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const cred: any = {
		secret,
		demoToken: {
			secret: demoSecret,
			referers: ['example.com']
		}
	}
	const sessionPayload = { dslabel: 'ds0', embedder: 'localhost', route: 'termdb' }
	const sessionToken = jsonwebtoken.sign(sessionPayload, secret)
	const headers = { referer: 'https://example.com/some/path' }

	const result = getApplicableSecret(headers, cred, sessionToken)
	test.equal(result.secret, secret, 'should use cred.secret for a session jwt (has dslabel, embedder, route)')
	test.deepEqual(result.processor, {}, 'should return empty processor when none is set')
	test.end()
})

tape('getApplicableSecret: embedder jwt without session fields uses demo secret when referer matches', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const cred: any = {
		secret,
		demoToken: {
			secret: demoSecret,
			referers: ['example.com']
		}
	}
	// Embedder jwt does NOT have dslabel+embedder+route
	const embedderPayload = { datasets: ['ds0'], email: 'test@test.com', exp: Math.floor(Date.now() / 1000) + 300 }
	const embedderToken = jsonwebtoken.sign(embedderPayload, demoSecret)
	const headers = { referer: 'https://example.com/demo-page' }

	const result = getApplicableSecret(headers, cred, embedderToken)
	test.equal(result.secret, demoSecret, 'should use demoToken.secret when referer matches a demoToken referer')
	test.end()
})

tape('getApplicableSecret: embedder jwt without matching referer uses cred.secret', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const cred: any = {
		secret,
		demoToken: {
			secret: demoSecret,
			referers: ['example.com']
		}
	}
	const embedderPayload = { datasets: ['ds0'] }
	const embedderToken = jsonwebtoken.sign(embedderPayload, secret)
	const headers = { referer: 'https://other-site.com/page' }

	const result = getApplicableSecret(headers, cred, embedderToken)
	test.equal(result.secret, secret, 'should use cred.secret when referer does not match any demoToken referer')
	test.end()
})

tape('getApplicableSecret: no demoToken always uses cred.secret', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const cred: any = { secret }
	const payload = { email: 'test@test.com' }
	const token = jsonwebtoken.sign(payload, secret)
	const headers = { referer: 'https://example.com' }

	const result = getApplicableSecret(headers, cred, token)
	test.equal(result.secret, secret, 'should use cred.secret when no demoToken is set')
	test.end()
})

tape('getApplicableSecret: null token with non-matching referer returns cred.secret', function (test) {
	test.timeoutAfter(500)
	test.plan(2)

	const cred: any = {
		secret,
		demoToken: {
			secret: demoSecret,
			referers: ['example.com']
		}
	}
	// Non-matching referer - should use cred.secret
	const headers = { referer: 'https://other-site.com' }

	const result = getApplicableSecret(headers, cred, null)
	test.equal(result.secret, secret, 'should return cred.secret for null token with non-matching referer')
	test.deepEqual(result.processor, {}, 'should return empty processor for null token')
	test.end()
})

tape('getApplicableSecret: cred.processor is returned when available', function (test) {
	test.timeoutAfter(500)
	test.plan(1)

	const mockProcessor = { handleToken: (t: string) => t, handlePayload: () => {} }
	const cred: any = {
		secret,
		processor: mockProcessor
	}
	const payload = { email: 'test@test.com' }
	const token = jsonwebtoken.sign(payload, secret)
	const headers = {}

	const result = getApplicableSecret(headers, cred, token)
	test.equal(result.processor, mockProcessor, 'should return cred.processor when it is set')
	test.end()
})
