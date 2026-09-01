import { type AuthInterface } from '../auth.ts'

// will be used when there is no active serverconfig.dsCredentials entry;
// use a literal object to represent a singleton instance, as there are no
// private properties and methods to hide/protect
export const AuthApiOpen: AuthInterface = {
	// credentialed embedders, using an array which can be frozen with Object.freeze(), unlike a Set()
	credEmbedders: [],

	maySetAuthRoutes(app) {
		app.use(function setQueryProtectedProps(req, res, next) {
			const sessionid = req.cookies.sessionid // can be undefined
			req.query.__protected__ = Object.freeze({ sessionid })

			// legacy support for the deprecated mayCopyFromCookie() behavior in route handler code,
			// should migrate such code to using req.query.__protected__.sessionid
			if (req.query.sessionid) throw 'q.sessionid already exists so cannot copy from cookies.sessionid'
			else req.query.sessionid = sessionid

			next()
		})
		// in case maySetAuthRoutes() is called more than once in the same runtime,
		// such as during combined coverage tests, reset to default methods if there are no credentials
		// Object.assign(authApi, defaultApiMethods)
		// no checks for ds, is open access
		// custom auth for testing
		// if (!serverconfig.debugmode || !app.doNotFreezeAuthApi) Object.freeze(authApi)
		return
	},

	canDisplaySampleIds(req, ds) {
		const displaySampleIds = ds?.cohort?.termdb?.displaySampleIds
		if (!displaySampleIds) return false
		// displaySampleIds may be a boolean or a per-request policy (a function of clientAuthResult);
		// a truthy non-function value is an unconditional allow, a function must be evaluated for this
		// request's role and fail closed. Open access carries no clientAuthResult (only sessionid).
		if (typeof displaySampleIds != 'function') return true //AuthApiOpen.isUserLoggedIn(req, ds, protectedRoutes.samples)
		try {
			return !!displaySampleIds(req?.query?.__protected__?.clientAuthResult ?? {})
		} catch {
			return false
		}
	},

	// these open-acces, default methods may be replaced by maySetAuthRoutes()
	getDsAuth() {
		return []
	},

	getNonsensitiveInfo() {
		return { forbiddenRoutes: [] }
	},

	isUserLoggedIn() {
		return true
	},

	getRequiredCredForDsEmbedder() {
		return undefined
	},

	getPayloadFromHeaderAuth() {
		return {}
	},

	getHealth() {
		return undefined
	},

	mayAdjustFilter() {}

	// getJwtPayload(q, headers, cred, session = null) {
	// 	return undefined
	// }
}
