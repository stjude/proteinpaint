import tape from 'tape'
import fetch from 'node-fetch'
import { isHealthCheckResponse, validHealthCheckResponse } from '../../test/testers/index.ts'
import { handle_healthcheck_closure } from '../health.ts'

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
	const msg = 'should have an empty array for type check errors'

	const handler = handle_healthcheck_closure({ hg38: {} })
	const req = {}
	const res = {
		send(r) {
			test.deepEqual(validHealthCheckResponse(r)?.errors, [], msg)
		}
	}
	await handler(req, res)

	/* TODO: move this to integration test or client-performed api-test/monitoring
	await fetch('http://localhost:3000/healthcheck')
		.then(r => r.json())
		.then(r => {
			test.deepEqual(
				validHealthCheckResponse(r)?.errors, 
				[], 
				msg
			)
		})
		.catch(e => {
			test.fail(msg)
		})
	*/
})
