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
		console.log(18, e)
		test.fail(message)
	}
	test.end()
})

tape('testApi()', async test => {
	const routesDir = join(__dirname, './toyApp/routes')
	let endpoints
	try {
		const files = readdirSync(routesDir)
		endpoints = files.filter(f => f.endsWith('.ts'))
		const checkersDir = join(__dirname, './toyApp/checkers')
		const checkersExists = existsSync(checkersDir)
		let mtimeDiff = -1
		if (checkersExists) {
			const checkersMtime = statSync(`${checkersDir}-raw/index.ts`).mtimeMs
			const routesMtime = Math.max(endpoints.map(f => statSync(`${routesDir}/${f}`).mtimeMs))
			mtimeDiff = checkersMtime - routesMtime
		}
		if (wasCalledDirectly || mtimeDiff < 0 || !checkersExists) {
			if (checkersExists) {
				rmSync(checkersDir, { recursive: true, force: true })
				rmSync(`${checkersDir}-raw`, { recursive: true, force: true })
			}
			// generate typia checkers at runtime, so that the generated code
			// that import augen.setRoutes() will be instrumented to detect code coverage
			const log = execSync(`npm run pretest`, { encoding: 'utf8' })
			console.log(log)
		}
	} catch (e) {
		throw e
	}

	try {
		const { default: checkers } = await import('./toyApp/checkers/index.ts')
		for (const f of endpoints) {
			const route = await import(`./toyApp/routes/${f}`)
			await testApi(route, f, checkers)
		}
	} catch (e) {
		throw e
	}
	test.end()
})
