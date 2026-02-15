import tape from 'tape'
import ky from 'ky'
import { ezFetch } from '#shared/index.js'

tape('ky retry', async test => {
	const message = 'ky retry works'
	try {
		const payload = await ky('http://localhost:3000/ky-retry-test', { retry: { limit: 2, backoffLimit: 10000 } }).then(
			r => r.json()
		)
		test.deepEqual(payload, { ok: true, status: 'ok', message: 'built-in retry works!!' }, message)
	} catch (e) {
		test.fail(message)
	}
	test.end()
})

tape('xfetch', async test => {
	const message = 'xfetch() works with unexpected client disconnection'
	const url = 'http://localhost:3000/termdb/external-API-test?dslabel=GDC'
	const abortCtrl = new AbortController()
	const init = { signal: abortCtrl.signal }
	const get = () => {
		return fetch(url, init).then(r => {
			r, r.json()
		})
	}

	let result
	try {
		setTimeout(() => abortCtrl.abort(), 100) // simulate client disconnection while fetch is still pending
		result = await Promise.all([ezFetch(url, init), ezFetch(url, init), ezFetch(url, init)])
		test.deepEqual(
			result,
			[
				{ status: 'error', error: 'AbortError' },
				{ status: 'error', error: 'AbortError' },
				{ status: 'error', error: 'AbortError' }
			],
			`should get error responses`
		)
	} catch (e) {
		test.equal(e.name, 'AbortError', message)
	}
	test.end()
})
