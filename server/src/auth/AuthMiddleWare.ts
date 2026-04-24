// these server routes should not be protected by default,
// since a user that is not logged should be able to have a way to login,
// also logout should be supported regardless
const forcedOpenRoutes = new Set(['/dslogin', '/jwt-status', '/dslogout', '/healthcheck', '/demoToken'])

export function setAuthMiddleware(app, genomes, authApi, AuthInner) {
	//const sessionTracking = serverconfig.features?.sessionTracking || ''

	app.use((req, res, next) => {
		req.query.__protected__ = {
			ignoredTermIds: [], // when provided the filter on these terms will be ignored
			// NOTE: sessionid is from a domain-based cookie for GDC,
			//       for SJ sites, the cookie key is determined by dsCredentials entry
			sessionid: req.cookies.sessionid // may be undefined
		}

		if (forcedOpenRoutes.has(req.path)) {
			Object.freeze(req.query.__protected__)
			next()
			return
		}

		try {
			mayUpdate__protected__(req, res)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			res.status(e.status || 401)
			res.send({ error: e.message || e.error || e })
			return
		}

		const q = req.query
		const cred = AuthInner.getRequiredCred(q, req.path)
		if (!cred) {
			next()
			return
		}

		let code

		// may configure to avoid in-memory session tracking, to simulate a multi-server process setup
		if (AuthInner.sessionTracking == 'jwt-only') {
			console.log('!!! --- CLEARING ALL SESSION DATA TO simulate stateless service --- !!!')
			for (const key of Object.keys(AuthInner.sessions)) delete AuthInner.sessions[key]
		}

		try {
			const id = AuthInner.getSessionId(req, cred, AuthInner.sessions)
			const session = id && AuthInner.sessions[q.dslabel]?.[id]
			if (!session) {
				code = 401
				throw `unestablished or expired browser session`
			}
			//if (!session.email) throw `missing session details: please login again through a supported portal`
			AuthInner.checkIPaddress(req, session.ip, cred)
			const time = Date.now()
			/* !!! TODO: may rethink the following assumption !!!
				assumes that the payload.datasets list will not change within the maxSessionAge duration
				including between subsequent checks of jwts, in order to avoid potentially expensive decryption 
			*/
			if (time - session.time > AuthInner.maxSessionAge) {
				const { iat } = AuthInner.getJwtPayload(q, req.headers, cred, session)
				const elapsedSinceIssue = time - iat
				if (elapsedSinceIssue > AuthInner.maxSessionAge) {
					delete AuthInner.sessions[q.dslabel][id]
					throw 'Please login again to access this feature. (expired session)'
				}
				if (elapsedSinceIssue < 300000) {
					// this request is accompanied by a new jwt
					session.time = time
					return
				}
			}
			// TODO: may not to adjust session expiration based on the last active period
			// If any activity happens within the harcoded number of milliseconds below,
			// then update the start time of the active session (account for prolonged user inactivity)
			if (session.time - time < 900) session.time = time
			next()
		} catch (e: any) {
			console.log(e)
			const _code = e.code || code
			if (_code) res.status(_code)
			res.send(typeof e == 'object' ? e : { error: e })
		}
	})

	/*
		__protected__{} are key-values that are added by the server to the request.query payload,
	  to easily pass authentication-related or sensitive information to downstream route handler code 
	  without having to sequentially pass those information as argument to every nested function calls.
	  For example, a route hander's `req` argument is frequently not passed, and therefore not accessible, 
	  when authApi methods that needs it are called.

	  in gdc environment: 
	  - this will pass sessionid from cookie to req.query, to be added to request header where it's querying gdc api
	    by doing this, route code is worry-free and no need to pass "req{}" to gdc purpose-specific code doing the API calls
	  
	  for non-gdc datasets:
	  - these *protected* contents may contain information as extracted from the jwt (authApi.getNonsensitiveInfo()) 
	    and as determined by a server route code that the dataset can use to compute per-user access restrictions/authorizations 
	    when querying data
  */
	function mayUpdate__protected__(req) {
		const __protected__ = req.query.__protected__
		const q = req.query
		if (q.filter) {
			const cohortFilter = q.filter.lst.find(f => f.tvs?.term.id == 'subcohort')
			if (cohortFilter) {
				__protected__.activeCohort = cohortFilter.tvs.values.map(v => v.key)[0]
			}
		}
		if (req.query.dslabel) {
			Object.assign(__protected__, authApi.getNonsensitiveInfo(req))
			if (req.query.genome && req.query.dslabel && req.query.dslabel !== 'msigdb') {
				const genome = genomes[req.query.genome]
				if (!genome) throw 'invalid genome'
				const ds = genome.datasets[req.query.dslabel]
				if (!ds) throw 'invalid dslabel'
				// by not supplying the 3rd argument (routeTwList) to authApi.mayAdjustFilter(),
				// it will add the stricted additional filter by default for any downstream code from here;
				// later, any server route or downstream code may call authApi.mayAdjustFilter() again to
				// loosen the additional filter, to consider fewer tvs terms based on route-specific payloads or aggregation logic
				authApi.mayAdjustFilter(req.query, ds)

				// this flag may be used by downstream code that does not have access to req argument or ds object
				__protected__.isUserLoggedIn = authApi.isUserLoggedIn(req, ds, AuthInner.protectedRoutes.minSampleSize)
			}
		}
		Object.freeze(__protected__)
	}
}
