/*
	Lock the routes and middlewares of an express app, so that none can be added, removed, or replaced
	after the server starts listening. Call it only after all routes and middlewares have been set.

	Express 4 keeps the middlewares and routes of an app in app._router.stack, as an array of layers:
	- a route layer has layer.route, with its own stack of method handler layers and a methods object
	- a nested express.Router() layer has a layer.handle that is itself a router with a stack

	The layer objects are not frozen, since Layer.match() sets layer.params and layer.path on each request.
	Only the properties that determine which handler is called are made non-writable and non-configurable.
*/

const lockedLayerProps = ['handle', 'route', 'regexp', 'keys', 'method']

export function freezeRoutes(app) {
	const router = app._router
	if (!router) return
	lockProp(app, '_router')
	freezeRouter(router)
}

function freezeRouter(router) {
	if (!Array.isArray(router.stack) || Object.isFrozen(router.stack)) return
	for (const layer of router.stack) {
		lockLayer(layer)
		const route = layer.route
		if (route) {
			for (const routeLayer of route.stack) lockLayer(routeLayer)
			Object.freeze(route.stack)
			Object.freeze(route.methods)
			lockProp(route, 'stack')
			lockProp(route, 'methods')
		}
		// a nested router, such as from app.use(express.Router())
		if (Array.isArray(layer.handle?.stack)) freezeRouter(layer.handle)
	}
	Object.freeze(router.stack)
	lockProp(router, 'stack')
	if (router.params) {
		Object.freeze(router.params)
		lockProp(router, 'params')
	}
}

function lockLayer(layer) {
	for (const key of lockedLayerProps) {
		if (Object.hasOwn(layer, key)) lockProp(layer, key)
	}
}

function lockProp(obj, key) {
	Object.defineProperty(obj, key, { value: obj[key], writable: false, configurable: false })
}
