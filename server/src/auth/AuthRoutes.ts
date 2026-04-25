import jsonwebtoken from 'jsonwebtoken'
import { promises as fs } from 'fs'
import path from 'path'

export function setAuthRoutes(app, AuthInner, basepath = '', serverconfig) {
	const actionsFile = path.join(serverconfig.cachedir, 'authorizedActions')

	// creates a session ID that is returned
	app.post(basepath + '/dslogin', async (req, res) => {
		let code = 401
		try {
			const q = req.query
			const cred = AuthInner.getRequiredCred(q, req.path)
			if (!cred) {
				code = 400
				throw `No login required for dataset='${q.dslabel}'`
			}
			if (cred.authRoute != '/dslogin') {
				code = 400
				throw `Incorrect authorization route, use '${cred.authRoute}'`
			}
			if (!req.headers.authorization) throw 'missing authorization header'
			const [type, pwd] = req.headers.authorization.split(' ')
			if (type.toLowerCase() != 'basic') throw `unsupported authorization type='${type}', allowed: 'Basic'`
			if (Buffer.from(pwd, 'base64').toString() != cred.password) throw 'invalid password'
			code = 401 // in case of jwt processing error
			const jwt = await AuthInner.getSignedJwt(req, res, q, cred, {}, AuthInner.maxSessionAge, '', AuthInner.sessions)
			res.send({ status: 'ok', jwt, route: cred.route })
		} catch (e) {
			res.status(code)
			res.send({ error: e })
		}
	})

	app.post(basepath + '/dslogout', async (req, res) => {
		try {
			const q = req.query
			const cred = AuthInner.getRequiredCred(q, req.path)
			const id = AuthInner.getSessionId(req, cred)
			if (!id) throw 'missing session cookie'
			const session = AuthInner.sessions[q.dslabel]?.[id]
			if (!session) {
				res.send({ status: 'ok' })
				return
			}
			delete AuthInner.sessions[q.dslabel][id]
			//const ip = req.ip
			res.send({ status: 'ok' })
		} catch (e) {
			res.status(401)
			res.send({ error: e })
		}
	})

	app.post(basepath + '/jwt-status', async (req, res) => {
		let code = 401 // assume unauthorized by default

		// To simulate a failed JWT signature verification uncomment the following lines
		// res.status(code)
		// res.send({"error":{"name":"JsonWebTokenError","message":"invalid signature"}})
		// return
		const q = req.query
		const cred = AuthInner.getRequiredCred(q, req.path)
		try {
			if (!cred) {
				res.send({ status: 'ok' })
				return
			}
			// NOTE: session jwt is generated for non-jwt auth.type, so must not limit to cred.authRoute === '/jwt-status'
			// if (cred.authRoute != '/jwt-status') {
			// 	code = 400
			// 	throw `Incorrect authorization route, use ${cred.authRoute}'`
			// }

			const { email, ip, clientAuthResult, dslabel, rawToken } = AuthInner.getJwtPayload(q, req.headers, cred)
			AuthInner.checkIPaddress(req, ip, cred)
			let jwt = rawToken
			if (!dslabel) {
				// NOTE: A login jwt payload is expected to not have dslabel, while session jwt is expected to have it
				// No need to get another session jwt if the current jwt is already a session jwt (not from initial login)
				code = 401 // in case of jwt processing error
				jwt = await AuthInner.getSignedJwt(
					req,
					res,
					q,
					cred,
					clientAuthResult,
					AuthInner.maxSessionAge,
					email,
					AuthInner.sessions
				)
			}
			// difficult to setup CORS cookie, will deprecate support
			res.send({ status: 'ok', jwt, route: cred.route, clientAuthResult })
		} catch (e) {
			res.status(code)
			res.header('Set-Cookie', `${cred.cookieId}=; HttpOnly; SameSite=None; Secure; Max-Age=0`)
			res.send(e instanceof Error || typeof e != 'object' ? { error: e } : e)
		}
	})

	app.post(basepath + '/authorizedActions', async (req, res) => {
		const q = req.query
		try {
			// TODO: later, other routes besides /termdb may require tracking
			const cred = AuthInner.getRequiredCred(q, 'termdb')
			if (!cred) {
				res.send({ status: 'ok' })
				return
			}
			const id = AuthInner.getSessionId(req)
			const session = AuthInner.sessions[q.dslabel]?.[id]
			const email = session.email
			const time = new Date()
			await fs.appendFile(actionsFile, `${q.dslabel}\t${email}\t${time}\t${q.action}\t${JSON.stringify(q.details)}\n`)
			res.send({ status: 'ok' })
		} catch (e) {
			res.status(401)
			res.send(typeof e == 'object' ? e : { error: e })
		}
	})

	app.post(basepath + '/demoToken', async (req, res) => {
		let cookieId
		try {
			const q = req.query
			const genome = AuthInner.genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.demoJwtInput) throw `missing ds.demoJwtInput`

			const cred = AuthInner.getRequiredCred(q, '/demoToken')
			if (!cred) {
				res.send({ status: 'ok' })
				return
			}
			cookieId = cred.cookieId
			if (!cred.demoToken) throw `${q.dslabel} demoToken requests are not accepted by this portal`
			else {
				if (!cred.demoToken.roles.includes(q.role) || !ds.demoJwtInput[q.role]) {
					throw `${q.dslabel} demoToken is not supported for role=${q.role}`
				}
				const referer = req.headers.referer || ''
				if (!cred.demoToken.referers.find(r => referer.includes(r))) {
					throw `${q.dslabel} demoToken requests are not accepted from referer='${referer}'`
				}
			}

			const computed = cred.demoToken.computedByRole[q.role]
			if (computed && computed.exp > Date.now() + 60000) {
				// reuse a previously computed jwt that is not close to expiring;
				// both computed.exp and time buffer (60000) are in milliseconds
				res.send({ status: 'ok', fakeTokensByRole: { [q.role]: computed.jwt } })
				return
			}

			const iat = Math.floor(Date.now() / 1000)
			const defaultToken = {
				iat,
				exp: iat + 86400, // 60*60*24 = 1 day expiration, /jwt-status will generate a session token with a longer lifetime
				email: 'username@test.tld',
				ip: req.ip || null
			}
			const fullPayload = Object.assign({}, defaultToken, ds.demoJwtInput[q.role])
			const credCopy = { ...cred, secret: cred.demoToken.secret }
			const jwt = cred.processor // also test any applicable cred.processor in demo mode
				? cred.processor.generatePayload(fullPayload, credCopy)
				: jsonwebtoken.sign(fullPayload, cred.demoToken.secret)
			console.log(`~~ Faketoken computed for ds=${q.dslabel}, role=${q.role}`)
			cred.demoToken.computedByRole[q.role] = { jwt, exp: fullPayload.exp * 1000 } // track expiration in milliseconds
			res.send({ status: 'ok', fakeTokensByRole: { [q.role]: jwt } })
		} catch (e) {
			if (cookieId) res.header('Set-Cookie', `${cookieId}=; HttpOnly; SameSite=None; Secure; Max-Age=0`)
			res.status(401)
			res.send(typeof e == 'object' ? e : { error: e })
		}
	})
}
