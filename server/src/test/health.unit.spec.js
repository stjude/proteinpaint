import tape from 'tape'
import fetch from 'node-fetch'
import { isHealthCheckResponse, validHealthCheckResponse } from '../../test/testers/index.ts'

/**************
 test sections
***************/

tape('\n', function (test) {
	test.pass('-***- server/health specs -***-')
	test.end()
})

tape('health check response', async test => {
	test.timeoutAfter(1000)
	test.plan(1)
	const msg = 'should return the expected health check response data shape'
	await fetch('http://localhost:3000/healthcheck')
		.then(r => r.json())
		.then(r => {
			if (isHealthCheckResponse(r)) test.pass(msg)
			else {
				console.log(validHealthCheckResponse(r))
				test.fail(msg)
			}
		})
		.catch(e => {
			console.log(e)
			test.fail(msg)
			//test.end()
		})
})
