const fs = require('fs').promises
const path = require('path')
const serverconfig = require('./serverconfig')

const cacheFile = path.join(serverconfig.cachedir, 'dsSessions')
const creds = serverconfig.dsCredentials
const maxSessionAge = 1000 * 3600 * 24

let sessions

async function maySetAuthRoutes(app, basepath) {
	if (!creds || !Object.keys(creds).length) return
	try {
		sessions = await getSessions()
	} catch (e) {
		throw e
	}

	app.use((req, res, next) => {
		const q = req.query
		if (req.path == '/genomes' || req.path == '/dslogin' || !q.dslabel || !(q.dslabel in creds)) {
			next()
			return
		}

		try {
			const id = req.cookies[`${q.dslabel}SessionId`]
			if (!id) throw 'missing session cookie'
			const session = sessions[q.dslabel][id]
			if (!session) throw `unestablished or expired browser session`
			const time = +new Date()
			if (time - session.time > maxSessionAge) {
				delete sessions[q.dslabel][id]
				throw 'expired browser session'
			}
			session.time = time
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
			const time = +new Date()
			sessions[q.dslabel][id] = { id, time }
			await fs.appendFile(cacheFile, `${q.dslabel}\t${id}\t${time}\n`)
			res.header('Set-cookie', `${q.dslabel}SessionId=${id}`)
			res.send({ status: 'ok' })
		} catch (e) {
			console.log(e, code)
			res.status(code)
			res.send({ error: e })
		}
	})
}

async function getSessions() {
	const sessions = {}
	for (const dslabel in creds) {
		if (!sessions[dslabel]) sessions[dslabel] = {}
	}

	try {
		const file = await fs.readFile(cacheFile, 'utf8')
		//rehydrate sessions from a cached file
		const now = +new Date()
		for (const line of file.split('\n')) {
			if (!line) continue
			const [dslabel, id, _time] = line.split('\t')
			const time = Number(_time)
			if (!sessions[dslabel]) sessions[dslabel] = {}
			if (now - time < maxSessionAge) sessions[dslabel][id] = { id, time }
		}
		return sessions
	} catch (e) {
		console.log(e)
		return sessions
	}
}

function getDsAuth(req) {
	return Object.keys(serverconfig.dsCredentials || {}).map(dslabel => {
		const id = req.cookies[`${dslabel}SessionId`]
		const sessionStart = sessions[dslabel]?.[id]?.time || 0
		return { dslabel, insession: +new Date() - sessionStart < maxSessionAge }
	})
}

module.exports = { maySetAuthRoutes, getDsAuth }
