import { type AuthApi } from '../auth.ts'

// will be used when there is no active serverconfig.dsCredentials entry
export const AuthApiOpen: AuthApi = {
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

	canDisplaySampleIds(_, ds) {
		if (!ds.cohort.termdb.displaySampleIds) return false
		return true //AuthApiOpen.isUserLoggedIn(req, ds, protectedRoutes.samples)
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
