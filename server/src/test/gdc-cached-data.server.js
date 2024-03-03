import express from 'express'
import bodyParser from 'body-parser'
import serverconfig from '../serverconfig'
import setRoutes from './routes/cacheMiddleware'

const app = express()
app.use(bodyParser.json({}))
app.use(bodyParser.text({ limit: '1mb' }))
app.use(bodyParser.urlencoded({ extended: true }))
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*')
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
	res.header()
	next()
})
app.use((req, res, next) => {
	const j = {}
	for (const k in req.query) {
		if (k != 'jwt') j[k] = req.query[k]
	}
	console.log(
		'%s\t%s\t%s\t%s',
		req.originalUrl,
		new Date(),
		req.header('x-forwarded-for') || req.connection.remoteAddress,
		JSON.stringify(j)
	)
	next()
})

setRoutes(app)
const server = app.listen(serverconfig.port)
console.log('STANDBY AT PORT ' + serverconfig.port)
