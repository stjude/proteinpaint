import serverconfig from '../../serverconfig.js'
import fs from 'fs'
// import { promisify } from 'util'
// import { exec } from 'child_process'

// const execProm = promisify(exec)

// The /coverage route will only be initialized if
// a coverageKey value is detected. This is an extra security
// measure to minimize issues and risks of having an external signal
// close a server.
const key = process.env.coverageKey
const maxTries = 5

export default function setRoutes(app, basepath) {
	if (!serverconfig.debugmode || !key) return

	let numTries = 0 //; console.log('---- setting /coverage routes ---')

	// app.get(basepath + '/coverage/spec', async (req, res) => {
	// 	try {

	// 	} catch(e) {
	// 		console.log('\n!!! /coverage/spec route error !!!\n', error)
	// 		res.send({ error })
	// 	}
	// })

	app.get(basepath + '/coverage/close', async (req, res) => {
		try {
			if (numTries >= maxTries) throw `maximum tries=${maxTries} already reached`
			if (req.query.key === key) {
				if (!closeServer) throw `closeServer() callback has not been set`
				// console.log('--- Closing server app --- ')
				res.send({ ok: true, status: 'ok' })
				closeServer()
			} else {
				numTries++
				throw `invalid /coverage key`
			}
		} catch (error) {
			console.log('\n!!! /coverage/close route error !!!\n', error)
			res.send({ error })
		}
	})

	let closeServer

	return {
		setCloseServer(callback) {
			// console.log('---- setting closeServer() callback')
			closeServer = callback
		}
	}
}
