import jsonwebtoken from 'jsonwebtoken'
import { getApplicableSecret } from './auth.demoToken.ts'
import { type AuthInterface } from '../auth.ts'
import { Auth } from './Auth.ts'
import { setAuthMiddleware } from './AuthMiddleWare.ts'
import { setAuthRoutes } from './AuthRoutes.ts'
import { sleep } from '../utils.js'
import mm from 'micromatch'

const { isMatch } = mm

// const authRouteByCredType = {
// 	basic: '/dslogin',
// 	jwt: '/jwt-status'
// }

// An AuthApi instance wraps the private Auth instance
export class AuthApi implements AuthInterface {
	#auth: Auth
	credEmbedders: string[] = []

	constructor(creds, app, genome, serverconfig) {
		this.#auth = new Auth(creds, app, genome, serverconfig)
	}

	async maySetAuthRoutes(app, genomes, basepath = '', serverconfig) {
		setAuthMiddleware(app, genomes, this, this.#auth)
		/*** call app.use() before any await lines ***/

		// app.use() from other route setters must be called before app.get|post|all
		// so delay setting these optional routes (this is done in server/src/test/routes/gdc.js also)
		await sleep(0)
		setAuthRoutes(app, this.#auth, basepath, serverconfig)
	}

	canDisplaySampleIds(req, ds) {
		if (!ds.cohort.termdb.displaySampleIds) return false
		return this.isUserLoggedIn(req, ds, this.#auth.protectedRoutes.samples)
	}

	/*
		will return a list of all dslabels that require credentials
	*/
	getDsAuth(req) {
		const activeDslabels: string[] = []
		for (const g of Object.values(this.#auth.genomes)) {
			for (const dslabel of Object.keys((g as any).datasets || {})) {
				activeDslabels.push(dslabel)
			}
		}
		const dsAuth: any[] = []
		const embedder = req.query.embedder || req.get('host')?.split(':')[0] // do not include port number
		for (const [dslabelPattern, ds] of Object.entries(this.#auth.creds)) {
			if (
				dslabelPattern.startsWith('__') ||
				dslabelPattern.startsWith('#') ||
				!activeDslabels.find(dslabel => dslabel === dslabelPattern || isMatch(dslabel, dslabelPattern))
			)
				continue
			for (const [routePattern, route] of Object.entries(ds as any)) {
				for (const [embedderHostPattern, _cred] of Object.entries(route as any)) {
					if (embedderHostPattern != '*' && !isMatch(embedder, embedderHostPattern)) continue
					const cred: any = _cred
					const query = Object.assign({}, req.query, { dslabel: dslabelPattern })
					const id = this.#auth.getSessionId({ query, headers: req.headers, cookies: req.cookies }, cred)
					const activeSession = this.#auth.sessions[dslabelPattern]?.[id]
					const sessionStart = activeSession?.time || 0
					// support a dataset-specific override to maxSessionAge
					const maxAge = cred.maxSessionAge || this.#auth.maxSessionAge
					const currTime = Date.now()
					const insession =
						// Previously, all requests to `/genomes` is assumed to originate from a "landing page"
						// that should trigger a sign-in. This assumption causes unnecessary duplicate logins
						// when the landing page opens links to protected pages that also request `/genomes` data.
						/* cred.type == 'basic' && req.path.startsWith('/genomes')
						? false
						: */ (cred.type != 'jwt' || id) && currTime - sessionStart < maxAge

					// if session is valid, extend the session expiration by resetting the start time
					if (insession) activeSession.time = currTime
					const referer = req.headers.referer || ''
					const demoTokenRoles = cred.demoToken?.referers.find(r => referer.includes(r))
						? cred.demoToken?.roles
						: undefined
					dsAuth.push({
						dslabel: dslabelPattern,
						route: routePattern,
						type: cred.type || 'basic',
						headerKey: cred.headerKey,
						insession,
						demoTokenRoles
					})
				}
			}
		}

		return dsAuth
	}

	/* return non sensitive user auth info to assist backend process e.g. getSupportChartTypes
	forbiddenRoutes: 
		This is used by the server to indicate forbidden routes, with no option for user login,
		to screen unauthorized server requests from embedders/portal that match a glob pattern.
		Note that a route that is not forbidden may still require 'jwt' or 'password' access.
	clientAuthResult:
		ds-specific jwt payload
	*/
	getNonsensitiveInfo(req) {
		if (!req.query.dslabel) throw 'req.query.dslabel missing'
		if (!req.query.embedder) {
			req.query.embedder = req.get('host')?.split(':')[0]
			if (!req.query.embedder) throw 'req.query.embedder missing'
		}

		const forbiddenRoutes: string[] = []
		const ds = this.#auth.creds[req.query.dslabel] || this.#auth.creds['*']
		let cred
		if (!ds) {
			// no checks for this ds, is open access
			return { forbiddenRoutes, clientAuthResult: {} }
		} else {
			// has checks
			for (const k in ds) {
				cred = ds[k][req.query.embedder] || ds[k]['*']
				if (cred?.type == 'forbidden') {
					forbiddenRoutes.push(k)
				}
			}
		}
		const id = this.#auth.getSessionId(req, cred)
		const activeSession = id && this.#auth.sessions[req.query.dslabel]?.[id]
		return { forbiddenRoutes, clientAuthResult: activeSession?.clientAuthResult || {} }
	}

	getRequiredCredForDsEmbedder(dslabel, embedder) {
		const requiredCred: any[] = []
		for (const dslabelPattern in this.#auth.creds) {
			if (!isMatch(dslabel, dslabelPattern)) continue
			for (const routePattern in this.#auth.creds[dslabelPattern]) {
				for (const embedderHostPattern in this.#auth.creds[dslabelPattern][routePattern]) {
					if (!isMatch(embedder, embedderHostPattern)) continue
					const cred = this.#auth.creds[dslabelPattern][routePattern][embedderHostPattern]
					requiredCred.push({
						route: routePattern,
						type: cred.type,
						headerKey: cred.headerKey
					})
				}
			}
		}
		return requiredCred.length ? requiredCred : undefined
	}

	isUserLoggedIn(req, ds, protectedRoutes) {
		const cred = this.#auth.getRequiredCred(req.query, req.path, protectedRoutes)
		if (!cred) return true
		// NOTE: Basic (password) credentials are converted to session token upon log-in,
		// so that a user does not have to login again for each runproteinpaint() call.
		const id = this.#auth.getSessionId(req, cred)
		const activeSession = this.#auth.sessions[ds.label]?.[id]
		const sessionStart = activeSession?.time || 0
		return Date.now() - sessionStart < this.#auth.maxSessionAge
	}

	getPayloadFromHeaderAuth(req, route) {
		if (!req.headers?.authorization) return {}
		const cred = this.#auth.getRequiredCred(req.query, route)
		if (!cred) return {}
		const [type, b64token] = req.headers.authorization.split(' ')
		if (type.toLowerCase() != 'bearer') throw `unsupported authorization type='${type}', allowed: 'Bearer'`
		const token = Buffer.from(b64token, 'base64').toString()
		const { secret } = getApplicableSecret(req.headers, cred, token)
		const payload = jsonwebtoken.verify(token, secret)
		return payload || {}
	}

	async getHealth() {
		const { app, port } = this.#auth
		// may track different health for actual or mock apps during tests
		if (this.#auth.authHealth.has(app)) return this.#auth.authHealth.get(app)

		const errors: any[] = []
		const dslabelPatterns = Object.keys(this.#auth.creds)
		if (!dslabelPatterns.length) return { errors }

		for (const dslabelPattern of dslabelPatterns) {
			if (dslabelPattern.startsWith('#')) continue
			for (const routePattern in this.#auth.creds[dslabelPattern]) {
				if (dslabelPattern.startsWith('#')) continue
				for (const embedderHostPattern in this.#auth.creds[dslabelPattern][routePattern]) {
					if (dslabelPattern.startsWith('#')) continue
					const cred = this.#auth.creds[dslabelPattern][routePattern][embedderHostPattern]
					const keys = [dslabelPattern, routePattern, embedderHostPattern].join(' > ')
					if (cred.processor) {
						if (cred.processor.test) {
							const res = await cred.processor.test(
								cred,
								`http://localhost:${port}${cred.authRoute}`,
								embedderHostPattern
							)
							if (res?.status != 'ok') errors.push(keys)
						}
					} else if (cred.type == 'basic') {
						try {
							const res = await fetch(`http://localhost:${port}${cred.authRoute}`, {
								method: 'POST',
								headers: {
									authorization: `Basic ${btoa(cred.password)}`
								},
								body: JSON.stringify({
									dslabel: dslabelPattern,
									embedder: embedderHostPattern,
									route: cred.route
								})
							}).then(r => r.json())
							if (res?.status != 'ok') errors.push(keys)
						} catch (e) {
							console.log(e)
							errors.push(keys)
						}
					}
				}
			}
		}
		const health = { errors }
		this.#auth.authHealth.set(app, health)
		return health
	}

	// q: req.query
	// ds: dataset object
	// routeTwLst[]: optional array of route-specific termwrappers
	//   - if undefined: the ds.getAdditionalFilter() should return it's strictest auth filter
	//   - if an empty array: no terms should be considered protected by ds.getAdditionalFilter(), so no auth filter
	//   - if an array with 1+ entries: these are the only terms to be matched against a dataset's hidden terms,
	//     and the ds should construct an actual or undefined auth filter based on matched terms
	mayAdjustFilter(q, ds, routeTwLst) {
		if (!ds.cohort?.termdb?.getAdditionalFilter) return
		if (!q.__protected__) throw `missing q.__protected__`
		if (routeTwLst && !Array.isArray(routeTwLst)) throw `invalid routeTwLst`

		// clientAuthResult{}: from authApi.getNonsensitiveInfo()
		// ignoredTermIds[]: a list of protected term.ids to ignore,
		//   such as when a server route is expected to aggregate the data
		//   so that no sample level data will be included in the server response
		if (!q.__protected__.clientAuthResult || !q.__protected__.ignoredTermIds)
			throw `missing q.__protected__ clientAuthResult or ignoredTermIds`
		// NOTE: as needed, the server route code must append to q.__protected__.ignoredTermIds[],
		//       since it knows the req.query key names that correspond to terms/termwrappers

		const routeTerms =
			routeTwLst === undefined
				? undefined
				: routeTwLst.filter(tw => !q.__protected__.ignoredTermIds.includes(tw.term.id)).map(tw => tw.term)
		const authFilter = ds.cohort.termdb.getAdditionalFilter(q.__protected__, routeTerms)

		if (!q.filter) q.filter = { type: 'tvslst', join: '', lst: [] }
		else if (q.filter.type != 'tvslst') throw `invalid q.filter.type != 'tvslst'`
		else if (!Array.isArray(q.filter.lst)) throw `q.filter.lst[] is not an array`
		// NOTE: other filter data validation will be done in termdb.filter.js

		const FILTER_TAG = 'termLevelAuthFilter'
		const i = q.filter.lst.findIndex(f => f.tag === FILTER_TAG)
		if (!authFilter) {
			// certain roles (from jwt payload) may have access to everything,
			// revert or do not adjust the q.filter in this case
			if (i !== -1) {
				// remove a previously added auth filter
				q.filter.lst.splice(i)
				if (q.filter.lst.length < 2) q.filter.join = ''
			} else if (q.filter.tag === FILTER_TAG) {
				// replace a previous authFilter that was set as the q.filter
				q.filter = { type: 'tvslst', join: '', lst: [] }
			}
			// nothing to adjust
			return
		} else {
			authFilter.tag = FILTER_TAG
			// the adjusted filter must have the correct filter shape, for example, avoid an empty nested tvslst
			if (i !== -1) {
				if (q.filter.join != 'and') throw `unexpected filter.join != 'and' for a previously added auth filter entry `
				q.filter.lst[i] = authFilter // replace the previously added auth filter entry
			} else if (!q.filter.lst.length) q.filter = authFilter // replace an empty root filter
			else if (q.filter.tag === FILTER_TAG)
				q.filter = authFilter // replace a previous authFilter that was set as root q.filter
			else if (q.filter.join != 'or') {
				// prevent unnecessary filter nesting,  root filter.lst[] with only one entry that is also a tvslst
				q.filter.lst.push(authFilter) // add to the existing root filter.lst[] array
				if (q.filter.join == '') q.filter.join = 'and'
			} else q.filter = { type: 'tvslst', join: 'and', lst: [authFilter, q.filter] } // prepend the auth filter using an 'and' operator
		}
	}
}
