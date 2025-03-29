import express from 'express'
import { setRoutes } from '#src/augen.js'
import { readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const files = readdirSync(join(__dirname, './routes'))
const endpoints = files.filter(f => f.endsWith('.ts')) //|| f.endsWith('.js'))
const port = 'PORT' in process.env ? Number(process.env.PORT) : 8999
init({ port })

async function init(opts = {}) {
	const basepath = '/api'
	const routes = await Promise.all(
		endpoints.map(async file => {
			const route = await import(join(__dirname, `./routes/${file}`))
			return Object.assign({ file, basepath }, route)
		})
	)

	const app = express()
	const staticService = express.static(join(__dirname, '../../public'))
	app.use(staticService)
	setRoutes(app, routes, {
		basepath,
		apiJson: join(__dirname, '../../public/docs/server-api.json'),
		types: {
			importDir: '../types',
			outputFile: join(__dirname, 'checkers-raw/index.ts')
		}
	})

	if (opts.port) {
		const port = opts.port
		console.log(`STANDBY PORT ${port}`)
		app.listen(port)
	}
}
