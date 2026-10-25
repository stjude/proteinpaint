/*
	Lock the routes and middlewares of an express app, so that none can be added, removed, or replaced
	after the server starts listening. Call it only after all routes and middlewares have been set.

	Express 4 keeps the middlewares and routes of an app in app._router.stack, as an array of layers:
	- a route layer has layer.route, with its own stack of method handler layers and a methods object
	- a nested express.Router() layer has a layer.handle that is itself a router with a stack

	The layer objects are not frozen, since Layer.match() sets layer.params and layer.path on each request.
	Only the properties that determine which handler is called are made non-writable and non-configurable.

	The app settings, such as 'trust proxy', are also frozen, since some are read on each request. The app
	methods that handle each request are locked, and the request and response prototypes of the app may not
	get new properties. The express base request and response prototypes are not frozen, so that
	a middleware may still assign a method, such as res.send, to a request or response instance.
*/

const lockedLayerProps = ['handle', 'route', 'regexp', 'keys', 'method']
const lockedAppProps = ['settings', 'request', 'response', 'handle', 'lazyrouter', 'listen']

export function freezeRoutes(app) {
	const router = app._router
	if (!router) return
	lockProp(app, '_router')
	freezeRouter(router)
	Object.freeze(app.settings)
	Object.freeze(app.request)
	Object.freeze(app.response)
	for (const key of lockedAppProps) lockProp(app, key)
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
	}
	Object.freeze(router.stack)
	lockProp(router, 'stack')
	if (router.params) {
		// each param name has an array of callbacks from router.param()
		for (const callbacks of Object.values(router.params)) Object.freeze(callbacks)
		Object.freeze(router.params)
		lockProp(router, 'params')
	}
}

function lockLayer(layer) {
	if (Array.isArray(layer.keys)) {
		for (const key of layer.keys) Object.freeze(key)
		Object.freeze(layer.keys)
	}
	for (const key of lockedLayerProps) {
		if (Object.hasOwn(layer, key)) lockProp(layer, key)
	}
	// a nested router, such as from app.use(express.Router()) or app.get(path, express.Router())
	if (Array.isArray(layer.handle?.stack)) freezeRouter(layer.handle)
}

function lockProp(obj, key) {
	Object.defineProperty(obj, key, { value: obj[key], writable: false, configurable: false })
}
