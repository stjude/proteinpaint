import { testApi } from '../src/tester.ts'
import { readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as checkers from './checkers/transformed/index.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

runTests()

async function runTests() {
	const files = readdirSync(join(__dirname, './routes'))
	const endpoints = files.filter(f => f.endsWith('.ts') || f.endsWith('.js'))
	for (const f of endpoints) {
		const route = await import(`./routes/${f}`)
		await testApi(route, f, checkers)
	}
}
