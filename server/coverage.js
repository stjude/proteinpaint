import { execSync } from 'child_process'
import path from 'path'

const __dirname = import.meta.dirname
const host = `http://localhost:3000`

try {
	const health = await fetch(`${host}/healthcheck`)
		.then(r => r.json())
		.catch(e => {
			const code = e.code || e.error?.code || e.cause?.code || ''
			if (code !== 'ECONNREFUSED') throw e
		})

	if (health) throw 'there is a conflicting localhost:3000 server that is already running'
} catch (e) {
	// expect to not have conflicting server instance
	if (typeof e != 'string' || !e.includes('coflicting localhost')) {
		throw e
	}
}

try {
	await import('./serverTests.js')
	await import('./server.js')
} catch (e) {
	console.log(e)
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}
