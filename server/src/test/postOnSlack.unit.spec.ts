import tape from 'tape'
import https from 'https'
import { EventEmitter } from 'events'
import { labelValidationRun, sendMessageToSlack } from '../postOnSlack.ts'

/**
 * Tests
 * 		labelValidationRun()
 * 		sendMessageToSlack() without a hash file
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- postOnSlack specs -***-')
	test.end()
})

tape('labelValidationRun()', function (test) {
	const message = 'Startup error on: https://pp.example.org \nError: failed'
	test.equal(
		labelValidationRun(message, ['node', 'start.js', 'validate']),
		`[validation run only] ${message}`,
		'should label a message from a validation run'
	)
	test.equal(labelValidationRun(message, ['node', 'start.js']), message, 'should not label a live server message')
	test.equal(
		labelValidationRun(message, ['node', 'start.js', '--validate-something']),
		message,
		'should only match the exact validate argument'
	)
	test.end()
})

tape('sendMessageToSlack() without a hash file', async function (test) {
	// a fake webhook that answers each request with status 200, so that no request is sent
	const posted: string[] = []
	const request = https.request
	;(https as any).request = (_url, _opts, callback) => {
		const req: any = new EventEmitter()
		let body = ''
		req.write = data => (body += data)
		req.end = () => {
			posted.push(JSON.parse(body).text)
			const res: any = new EventEmitter()
			res.statusCode = 200
			res.resume = () => setImmediate(() => res.emit('end'))
			callback(res)
		}
		req.destroy = () => {}
		return req
	}
	try {
		await sendMessageToSlack('https://hooks.example.org/test', 'message 1', '')
		await sendMessageToSlack('https://hooks.example.org/test', 'message 1', '')
		test.deepEqual(posted, ['message 1'], 'should not post the same message again, with its hash in memory')
		await sendMessageToSlack('https://hooks.example.org/test', 'message 2', '')
		test.deepEqual(posted, ['message 1', 'message 2'], 'should post a different message')
	} catch (e) {
		test.fail(`should not throw: ${e}`)
	} finally {
		;(https as any).request = request
	}
	test.end()
})
