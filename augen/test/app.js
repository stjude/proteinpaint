import express from 'express'
import { setRoutes } from '../src/augen.js'
import { readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const files = readdirSync(join(__dirname, './routes'))
const endpoints = files.filter(f => f.endsWith('.ts') || f.endsWith('.js'))
init()

async function init(opts = {}) {
	const routes = await Promise.all(
		endpoints.map(file => {
			const route = import(join(__dirname, `./routes/${file}`))
			route.file = file
			return route
		})
	)
	//console.log(endpoints, endpoints, routes)

	const app = express()
	const staticService = express.static(join(__dirname, '../public'))
	app.use(staticService)
	setRoutes(app, routes)

	const port = opts.port || 8999
	console.log(`STANDBY PORT ${port}`)
	app.listen(port)
}
