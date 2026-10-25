import { setRoutes } from '@sjcrh/augen'
import { genomes as loadedGenomes } from '../initGenomesDs.js'
import { routeFiles } from '../app.routes.js'

/*
Sets up route files in a test route table, so that a spec can call a route handler by its path without a launched
server.

allRoutes: the route files in app.routes.js, which app.ts sets up

getTestRoutes(genomes, routes = allRoutes)
	returns { [path]: handler }, such as { '/tkbam': handler }
	- a route method that is not set up, such as when its init is null for the genomes or serverconfig, is not in the table
	- the handler is the last function given to the app method, after the route-level middlewares of the route
	- for a path with more than one method, the handler of the last method set up is kept

The init getter of some routes, such as the legacy mds routes, reads the loaded genomes instead of the given ones, so
the loaded genomes are the given ones while the routes are set up, and are restored after.
*/

export const allRoutes = await Promise.all(routeFiles)

export function getTestRoutes(genomes, routes = allRoutes) {
	const table = {}
	const record = (path, ...fns) => (table[path] = fns.at(-1))
	const app = { get: record, post: record, put: record, delete: record, all: record, use: () => {} }
	const prev = { ...loadedGenomes }
	for (const k of Object.keys(loadedGenomes)) delete loadedGenomes[k]
	Object.assign(loadedGenomes, genomes)
	try {
		setRoutes(app, routes, { app, genomes })
	} finally {
		for (const k of Object.keys(loadedGenomes)) delete loadedGenomes[k]
		Object.assign(loadedGenomes, prev)
	}
	return table
}
