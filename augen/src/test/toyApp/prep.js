import { emitFiles } from '#src/augen.js'
import { readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
prep()

async function prep() {
	const files = readdirSync(join(__dirname, './routes'))
	const endpoints = files.filter(f => f.endsWith('.ts')) // || f.endsWith('.js'))

	const routes = await Promise.all(
		endpoints.map(async file => {
			const route = await import(join(__dirname, `./routes/${file}`))
			return Object.assign({ file }, route)
		})
	)

	emitFiles(routes, {
		apiJson: join(__dirname, '../../../public/server-api.json'),
		types: {
			importDir: '../types',
			outputFile: join(__dirname, './checkers-raw/index.ts')
		}
	})
}
