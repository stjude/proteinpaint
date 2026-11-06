import './dataset/termdb.test.ts'
import { spawn } from 'child_process'
import path from 'path'
import './src/serverconfig.js'

/*
  This script is used in server/package.json combined:coverage script.
  It runs the server unit tests in a child process, and then starts a server instance in this process
  to handle requests and serve response data during client integration tests.

  The unit tests run in their own process, so that what they change in the shared module state,
  such as serverconfig or the shared authApi of auth.ts, is not carried over into the server.
  c8 also collects the coverage of the child process, from the NODE_V8_COVERAGE env that it sets.
*/

const __dirname = import.meta.dirname
const host = `http://localhost:3000`

try {
	const health = await fetch(`${host}/healthcheck`)
		.then(r => r.json())
		.catch(e => {
			const code = e.code || e.error?.code || e.cause?.code || ''
			if (code !== 'ECONNREFUSED' && code !== 'UND_ERR_SOCKET') throw e
		})

	if (health) throw 'there is a conflicting localhost:3000 server that is already running'
} catch (e) {
	// expect to not have conflicting server instance
	if (typeof e != 'string' && !e.includes('conflicting localhost')) {
		throw e
	}
}

// TODO: handler spec:coverage package script to only test relevant specs
try {
	// the same node options as this process, such as the tsx loader; a failed test does not stop the server launch,
	// so that the client tests still run; container/coverage/test.sh checks the logged status after the report is copied
	const { code, signal } = await new Promise((resolve, reject) => {
		const ps = spawn(process.execPath, [...process.execArgv, 'serverTests.js'], { cwd: __dirname, stdio: 'inherit' })
		ps.on('error', reject)
		ps.on('close', (code, signal) => resolve({ code, signal }))
	})
	console.log(`server unit tests exited with code ${code}` + (signal ? `, signal ${signal}` : ''))
	const { launch } = await import('./src/app.ts')
	await launch()
} catch (e) {
	fetch(`${host}/coverage/close`) /*.then(r => r.json()).then(console.log)*/
		.catch(console.log)
	throw e
}
