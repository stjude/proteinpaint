const fs = require('fs')
const path = require('path')
const serverconfig = require('./serverconfig')

const sessions = {} // TODO: rehydrate sessions from a cached file
const creds = serverconfig.dsCredentials
const maxSessionAge = 1000 * 3600 * 24

module.exports = async function maySetAuthRoutes(app, basepath) {
	if (!creds || !Object.keys(creds).length) return
	for (const dslabel in creds) {
		sessions[dslabel] = {}
	}

	app.use((req, res, next) => {
		const q = req.query
		if (req.path == '/dslogin' || !q.dslabel || !(q.dslabel in creds)) {
			next()
			return
		}

		try {
			//console.log(req.query.dslabel)
			const id = req.cookies[`${q.dslabel}SessionId`]
			if (!id) throw 'missing session cookie'
			const session = sessions[q.dslabel][id]
			if (!session) throw `unestablished browser session`
			if (+new Date() - sessions.time > maxSessionAge) {
				delete sessions[q.dslabel][id]
				throw 'expired browser session'
			}
			next()
		} catch (e) {
			res.send({ error: e })
		}
	})

	app.post(basepath + '/dslogin', async (req, res) => {
		let code = 401
		try {
			const q = req.query
			if (!q.dslabel || !(q.dslabel in creds)) {
				code = 400
				throw `No login required for dataset='${q.dslabel}'`
			}

			if (!req.headers.authorization) throw 'missing authorization header'
			const [type, pwd] = req.headers.authorization.split(' ')
			if (type.toLowerCase() != 'basic') throw `unsupported authorization type='${type}', allowed: 'Basic'`
			if (Buffer.from(pwd, 'base64').toString() != creds[q.dslabel].password) throw 'invalid password'
			const id = Math.random().toString()
			sessions[q.dslabel][id] = { id, time: +new Date() }
			res.header('Set-cookie', `${q.dslabel}SessionId=${id}`)
			res.send({ status: 'ok' })
		} catch (e) {
			res.status(code)
			res.send({ error: e })
		}
	})
}
