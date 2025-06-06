import './dataset/termdb.test.ts'
import { execSync } from 'child_process'
import path from 'path'
import './src/serverconfig.js'

/*
  This script is used in server/package.json combined:coverage script.
  It loads server unit tests and starts a server instance
  to handle requests and serve response data during client integration tests.
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
	await import('./serverTests.js')
	await sleep(5000)
	const { launch } = await import('./src/app.ts')
	await launch()
} catch (e) {
	fetch(`${host}/coverage/close`) /*.then(r => r.json()).then(console.log)*/
		.catch(console.log)
	throw e
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}
