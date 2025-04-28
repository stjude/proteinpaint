import serverconfig from '../../serverconfig.js'
import fs from 'fs'
import { promisify } from 'util'
import { exec } from 'child_process'
import { gitProjectRoot } from '@sjcrh/augen/dev'

const execProm = promisify(exec)

// The /coverage route will only be initialized if
// a coverageKey value is detected. This is an extra security
// measure to minimize issues and risks of having an external signal
// close a server.
const key =
	process.env.coverageKey !== undefined ? process.env.coverageKey : serverconfig.features?.coverageKey || 'test'
const maxTries = 5

export default function setRoutes(app, basepath) {
	if (!serverconfig.debugmode || !key) return
	console.log('setting /coverage routes')

	let numTries = 0

	app.get(basepath + '/specCoverage', async (req, res) => {
		try {
			const out = await execProm(`cd ${gitProjectRoot} && npm run spec:coverage --workspaces --if-present`, {
				encoding: 'utf8'
			})
			// since this server route is only set up in dev, okay to use relative paths in import
			const testHelper = await import('../../../../test/evalAllSpecCovResults.mjs')
			const { failures, workspaces } = await testHelper.evalAllSpecCovResults()
			res.send({ ok: true, out, failures, workspaces })
		} catch (error) {
			console.log('\n!!! /specCoverage route error !!!\n', error)
			res.send({ error })
		}
	})

	app.get(basepath + '/evalCoverage', async (req, res) => {
		try {
			const { failures, workspaces } = await evalAllSpecCovResults()
			res.send({ ok: true, failures, workspaces })
		} catch (error) {
			console.log('\n!!! /specCoverage route error !!!\n', error)
			res.send({ error })
		}
	})

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
