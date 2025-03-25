import './dataset/termdb.test.ts'
import { execSync } from 'child_process'
import path from 'path'
import './src/serverconfig.js'

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
	if (typeof e != 'string' || !e.includes('coflicting localhost')) {
		throw e
	}
}

try {
	await import('./serverTests.js')
	await sleep(5000)
	const { launch } = await import('./src/app.ts')
	await launch()
} catch (e) {
	fetch(`${host}/closeCoverage`) /*.then(r => r.json()).then(console.log)*/
		.catch(console.log)
	console.log(e)
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}
