import { testApi } from '#src/tester.ts'
import { existsSync, rmSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = import.meta.dirname.trim()

await runTests()

async function runTests() {
	try {
		// genereate typia checkers at runtime, so that the generated code
		// that import augen.setRoutes() will be instrumented to detect code coverage
		const checkersDir = join(__dirname, './toyApp/checkers')
		if (!existsSync(checkersDir)) {
			rmSync(checkersDir, { recursive: true, force: true })
			rmSync(`${checkersDir}-raw`, { recursive: true, force: true })
		}
		const log = execSync(`npm run pretest`, { encoding: 'utf8' })
		console.log(log)
	} catch (e) {
		throw e
	}

	const { default: checkers } = await import('./toyApp/checkers/index.ts')
	const files = readdirSync(join(__dirname, './toyApp/routes'))
	const endpoints = files.filter(f => f.endsWith('.ts'))
	for (const f of endpoints) {
		const route = await import(`./toyApp/routes/${f}`)
		testApi(route, f, checkers)
	}
}
