const fs = require('fs')
const path = require('path')
const serverconfig = require('../../serverconfig')

const sessions = []
const auth = serverconfig.genomes.find(g => g.name == 'hg19').datasets.find(d => d.name == 'PNET').auth
const maxSessionAge = 1000 * 3600 * 24

module.exports = function setRoutes(app, basepath) {
	app.use((req, res, next) => {
		const q = req.query
		if (!q.dslabel || q.dslabel != 'PNET' || req.path == '/dslogin') {
			next()
			return
		}

		try {
			//console.log(req.query.dslabel)
			const id = req.cookies.pnetSessionId
			if (!id) throw 'missing session cookie'
			const session = sessions.find(s => s.id === id)
			if (!session) throw `unestablished browser session`
			if (+new Date() - sessions.time > maxSessionAge) {
				sessions.splice(sessions.indexOf(session), 1)
				throw 'expired browser session'
			}
			next()
		} catch (e) {
			res.send({ error: e })
		}
	})

	app.all(basepath + '/pnet-login', async (req, res) => {
		try {
			console.log(req.headers)
			if (!req.headers.authorization) throw 'missing authorization header'
			const [type, pwd] = req.headers.authorization.split(' ')
			if (type.toLowerCase() != 'basic') throw `unsupported authorization type='${type}', allowed: 'Basic'`
			if (Buffer.from(pwd, 'base64').toString() != auth.value) throw 'invalid password'
			const id = Math.random().toString()
			sessions.push({ id, time: +new Date() })
			res.header('Set-cookie', `pnetSessionId=${id}`)
			res.send({ status: 'ok' })
		} catch (e) {
			res.status(401)
			res.send({ error: e })
		}
	})
}
