import jsonwebtoken from 'jsonwebtoken'
import { promises as fs } from 'fs'
import path from 'path'
import { getSessionEntry, getOriginFromHeaders } from './Auth.ts'

// true only when the resolved session id came from one of the cookie checks in Auth.ts's
// getSessionId(), not from the Authorization header (handled earlier in getSessionId(), before
// any of these cookie checks run) or the x-sjppds-sessionid header/query fallback, which a caller
// must set deliberately and a browser does not attach on its own
function wasResolvedFromCookie(req, cred, id) {
	return (
		!!id &&
		(id === req.cookies?.[`${cred?.cookieId}`] ||
			id === req.cookies?.[`${req.query?.dslabel}SessionId`] ||
			id === req.cookies?.['x-ds-access-token'])
	)
}

// Returns the credential to use after this check: when the session id was not cookie-derived,
// `cred` is returned unchanged, since there is nothing to re-check. Otherwise, re-resolves the
// credential for the same dslabel/routeKeys using the request's real Origin (or, lacking one, its
// own Host) as the embedder value instead of the client-supplied q.embedder that resolved `cred`,
// to confirm this exact dataset/route (not some other, unrelated one) authorizes that origin, and
// returns that freshly-resolved credential: q.embedder may not have matched the same entry, or any
// entry, even when the real origin does, so the caller must use this return value, not the
// original `cred`, for anything that dereferences it afterward.
function assertAllowedSessionOrigin(auth, req, dslabel, routeKeys, cred, id) {
	if (!wasResolvedFromCookie(req, cred, id)) return cred
	const origin = getOriginFromHeaders(req)
	// try both forms, same as isCredEmbedder(), so a dataset configured with a port-qualified
	// embedder key (e.g. 'localhost:3000') is not rejected
	const resolved =
		origin &&
		[origin.hostname, origin.host].map(embedder => auth.getRouteCred(dslabel, routeKeys, embedder)).find(Boolean)
	if (!resolved) throw 'disallowed origin for a cookie-authenticated request'
	return resolved
}

export function setAuthRoutes(app, auth, basepath = '', serverconfig) {
	const actionsFile = path.join(serverconfig.cachedir, 'authorizedActions')

	// TODO: should check if the app already has an auth route handlers,
	// to avoid mutating what's already been set at server launch

	// creates a session ID that is returned
	app.post(basepath + '/dslogin', async (req, res) => {
		let code = 401
		try {
			const q = req.query
			const cred = auth.getRequiredCred(q, req.path)
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
			const jwt = await auth.getSignedJwt(req, res, q, cred, {}, auth.maxSessionAge, '', auth.sessions)
			res.send({ status: 'ok', jwt, route: cred.route })
		} catch (e) {
			res.status(code)
			res.send({ error: e })
		}
	})

	app.post(basepath + '/dslogout', async (req, res) => {
		try {
			const q = req.query
			// same route-key precedence used elsewhere to resolve the credential that governs an
			// established session, so this matches that same credential regardless of how the
			// session came to exist
			const routeKeys = [q.route, 'termdb', '/**']
			let cred = auth.getRouteCred(q.dslabel, routeKeys, q.embedder)
			const id = auth.getSessionId(req, cred)
			if (!id) throw 'missing session cookie'
			cred = assertAllowedSessionOrigin(auth, req, q.dslabel, routeKeys, cred, id)
			const session = getSessionEntry(auth.sessions, q.dslabel, id)
			if (!session) {
				res.send({ status: 'ok' })
				return
			}
			auth.sessions.get(q.dslabel)?.delete(id)
			//const ip = req.ip
			res.header('Set-Cookie', `${cred.cookieId}=; HttpOnly; SameSite=None; Secure; Max-Age=0`)
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
		const cred = auth.getRequiredCred(q, req.path)
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

			const { email, ip, clientAuthResult, dslabel, rawToken } = auth.getJwtPayload(q, req.headers, cred)
			auth.checkIPaddress(req, ip, cred)
			let jwt = rawToken
			if (!dslabel) {
				// NOTE: A login jwt payload is expected to not have dslabel, while session jwt is expected to have it
				// No need to get another session jwt if the current jwt is already a session jwt (not from initial login)
				code = 401 // in case of jwt processing error
				jwt = await auth.getSignedJwt(req, res, q, cred, clientAuthResult, auth.maxSessionAge, email, auth.sessions)
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
			const cred = auth.getRequiredCred(q, 'termdb')
			if (!cred) {
				res.send({ status: 'ok' })
				return
			}
			const id = auth.getSessionId(req, cred)
			assertAllowedSessionOrigin(auth, req, q.dslabel, ['termdb'], cred, id)
			const session = getSessionEntry(auth.sessions, q.dslabel, id)
			const email = session?.email || ''
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
			const genome = auth.genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			if (!ds.demoJwtInput) throw `missing ds.demoJwtInput`

			const cred = auth.getRequiredCred(q, '/demoToken')
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
