import serverconfig from '../../serverconfig.js'
import fs from 'fs'

const key = process.env.closeCoverageKey
const maxTries = 1

export default function setRoutes(app, basepath) {
	if (!serverconfig.debugmode || !key) return

	let numTries = 0 //; console.log('---- setting /closeCoverage route ---')

	app.post(basepath + '/closeCoverage', async (req, res) => {
		try {
			if (numTries >= maxTries) throw `maximum tries=${maxTries} already reached`
			if (req.query.key === key) {
				if (!closeServer) throw `closeServer() callback has not been set`
				console.log('--- Closing server app --- ')
				res.send({ ok: true, status: 'ok' })
				closeServer()
			} else {
				numTries++
				throw `invalid closeCoverage key`
			}
		} catch (error) {
			console.log('\n!!! closeCoverage route error !!!\n', error)
			res.send({ error })
		}
	})
	let closeServer
	return {
		setCloseServer(callback) {
			console.log('---- setting closeServer() callback')
			closeServer = callback
		}
	}
}
