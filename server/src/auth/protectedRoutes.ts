import { getAuthApiByApp, authApi } from '../auth.ts'

/*
	Route-level auth middlewares, to be listed in a data route's RouteApi.middlewares[],
	so that it is explicit which data routes are protected by code and how:

	termdb: requires a valid session before the route handler is called, if the dataset
	  has a termdb credential for the request's embedder

	samples: for routes that may respond with sample IDs, determines if the request is logged in
	  before the route handler calls authApi.canDisplaySampleIds()

	minSampleSize: for routes that respond with aggregated data, sets q.__protected__.isUserLoggedIn
	  based on the termdb credential, so that dataset code may require a minimum sample size
	  for a logged-out request

	Each middleware delegates to the authApi that was set up for the request's express app,
	see getProtectedRouteMiddlewares() in ./AuthMiddleWare.ts for the implementation.

	The protected route endpoints are emitted into server/test/protectedRoutes.json
	by augen.setRoutes() in debugmode, and checked by src/test/protectedRoutes.unit.spec.ts.
*/
export const protectedRoutes = Object.freeze({
	termdb(req, res, next) {
		getRouteAuthApi(req).routeMiddlewares.termdb(req, res, next)
	},
	samples(req, res, next) {
		getRouteAuthApi(req).routeMiddlewares.samples(req, res, next)
	},
	minSampleSize(req, res, next) {
		getRouteAuthApi(req).routeMiddlewares.minSampleSize(req, res, next)
	}
})

function getRouteAuthApi(req) {
	const api = getAuthApiByApp(req.app) || authApi
	// fail closed: express will respond with a server error instead of calling the route handler
	if (!api) throw new Error(`authApi has not been set up for this app`)
	return api
}
