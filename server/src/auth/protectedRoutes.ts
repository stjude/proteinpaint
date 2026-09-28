import { getAuthApiByApp, authApi, type ProtectedRouteMiddlewares } from '../auth.ts'

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
	and has a protectedRoute property with its name, which is emitted by augen.getProtectedRoutes().
	see getProtectedRouteMiddlewares() in ./AuthMiddleWare.ts for the implementation.

	The protected route endpoints are emitted into server/test/protectedRoutes.json
	by augen.setRoutes() in debugmode, and checked by src/test/protectedRoutes.unit.spec.ts.
*/
export const protectedRoutes = Object.freeze({
	termdb: protectedRoute('termdb'),
	samples: protectedRoute('samples'),
	minSampleSize: protectedRoute('minSampleSize')
})

// returns a middleware that delegates to the authApi of the request's express app,
// with a protectedRoute property that augen.getProtectedRoutes() uses to track the
// auth protection of a route, so that other route-level middlewares are not tracked
function protectedRoute(name: keyof ProtectedRouteMiddlewares) {
	const middleware = function (req, res, next) {
		getRouteAuthApi(req).routeMiddlewares[name](req, res, next)
	}
	Object.defineProperty(middleware, 'name', { value: name })
	Object.defineProperty(middleware, 'protectedRoute', { value: name, enumerable: true })
	return Object.freeze(middleware)
}

function getRouteAuthApi(req) {
	// only use the shared authApi when there is no express app for the request; an app that was
	// not set up with getAuthApi() must not use the auth policy of another app in the same process
	const api = req.app ? getAuthApiByApp(req.app) : authApi
	// fail closed: express will respond with a server error instead of calling the route handler
	if (!api) throw new Error(`authApi has not been set up for this app`)
	return api
}
