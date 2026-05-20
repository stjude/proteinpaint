import tape from 'tape'
import { testApi } from '#src/tester.ts'
import { existsSync, rmSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = import.meta.dirname.trim()
const wasCalledDirectly = process.argv[1]?.includes('augen.unit.spec')
// console.log(8, { wasCalledDirectly })

tape('setRoutes()', async test => {
	const message = `should load a toy app that uses setRoutes()`
	try {
		const { server } = await import('./toyApp/app.js')
		test.pass(message)
		server.close()
	} catch (e) {
		/* c8 ignore start */
		console.log(18, e)
		test.fail(message)
		/* c8 ignore stop */
	}
	test.end()
})
