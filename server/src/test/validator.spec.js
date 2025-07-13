import tape from 'tape'
import fetch from 'node-fetch'
import serverconfig from '../serverconfig.js'

const host = `http://localhost:${serverconfig.port}`

// helper functions
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

// tests
tape('\n', test => {
	test.comment('-***- server/src/validator -***-')
	test.end()
})

tape('genome validation', async test => {
	test.timeoutAfter(1000)
	test.plan(2)
	const message0 = 'should use bodyParser.json() to detect invalid req.body'
	try {
		const opts = {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: `[[}`
		}
		const res = await fetch(`${host}/genelookup`, opts).then(r => r.json())
		test.equal(res.error, 'invalid request body, must be a valid JSON-encoded object', message0)
	} catch (e) {
		console.log(32, e)
		test.fail(message0 + ': ' + e)
	}

	const message1 = 'should return an error message on invalid character'
	try {
		const opts = {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				genome: 'hg 19',
				input: 'tp'
			})
		}
		const res = await fetch(`${host}/genelookup`, opts).then(r => r.json())
		test.equal(res.error, 'invalid genome character', message1)
	} catch (e) {
		test.fail(message1 + ': ' + e)
	}

	test.end()
})

tape('gene lookup validation', async test => {
	test.timeoutAfter(1000)
	test.plan(1)
	const message = 'should return an error message on invalid character'
	try {
		const opts = {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				genome: 'hg19',
				input: 'tp 53 nslookup bad action'
			})
		}
		const res = await fetch(`${host}/genelookup`, opts).then(r => r.json())
		test.equal(res.error, 'invalid character in gene name', message)
	} catch (e) {
		test.fail(message + ': ' + e)
	}

	test.end()
})

tape('repeated failed requests', async test => {
	test.timeoutAfter(2000)
	test.plan(1)
	const message = 'should not be served based on IP address and span of time between failed requests'
	try {
		const opts = {
			method: 'POST',
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				genome: 'hg 19',
				input: 'tp'
			})
		}

		let error
		for (let i = 0; i < 20; i++) {
			const res = await fetch(`${host}/genelookup`, opts).then(r => r.json())
			error = res.error
		}
		test.equal(error, 'busy', message)
	} catch (e) {
		test.fail(message + ': ' + e)
	}

	test.end()
})
