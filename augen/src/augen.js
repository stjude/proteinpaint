import fs from 'fs'
import path from 'path'
// do not transitively export non-prod code here //
export * from './ReqResCache.js'

export function setRoutes(app, routes, _opts = {}) {
	try {
		const opts = Object.assign({ basepath: '' }, _opts)
		for (const route of routes) {
			const api = route.api
			if (api.middlewares && !Array.isArray(api.middlewares))
				throw new Error(`${api.endpoint}: middlewares must be an array`)
			for (const [method, handler] of Object.entries(api.methods)) {
				try {
					const endpoint = `${opts.basepath}/${api.endpoint}`
					// route-level middlewares apply to all methods, and are called before a method-specific middleware
					const middlewares = [...(api.middlewares || [])]
					if (handler.middleware) middlewares.push(handler.middleware)
					app[method](endpoint, ...middlewares, handler.init(opts))
				} catch (e) {
					throw new Error(`${api.endpoint} ${method}: ${e}`)
				}
			}
		}
		if (opts.debugmode && opts.protectedRoutesJson) emitProtectedRoutes(routes, opts.protectedRoutesJson)
		//emitFiles(routes, opts)
	} catch (e) {
		console.trace(e)
		throw e
	}
}

// returns {endpoint: [middleware names]} for the routes that have route-level middlewares,
// sorted by endpoint so that the emitted json has a stable order
export function getProtectedRoutes(routes) {
	const protectedRoutes = {}
	const apis = routes.map(r => r.api).filter(api => api?.middlewares?.length)
	for (const api of apis.sort((a, b) => (a.endpoint < b.endpoint ? -1 : a.endpoint > b.endpoint ? 1 : 0))) {
		protectedRoutes[api.endpoint] = api.middlewares.map(m => m.name || '(anonymous)')
	}
	return protectedRoutes
}

// Emit the protected route endpoints into a git-tracked json file, so that a unit test may detect
// when a middleware is removed from a route endpoint, or when an endpoint is renamed without its middlewares.
// Only emitted when the file's directory exists, and only written when the content has changed,
// to avoid triggering a file watcher that restarts the server.
export function emitProtectedRoutes(routes, file) {
	if (!fs.existsSync(path.dirname(file))) return
	const content = JSON.stringify(getProtectedRoutes(routes), null, '\t') + '\n'
	if (fs.existsSync(file) && fs.readFileSync(file, { encoding: 'utf8' }) === content) return
	fs.writeFileSync(file, content)
}

export function emitFiles(routes, opts) {
	if (opts.apiJson) {
		const apis = JSON.stringify(
			routes.map(r => {
				if (!r.api.file && r.file) r.api.file = r.file.split('.').slice(0, -1) + '.js'
				return r.api
			})
		)
		const outdir = path.dirname(opts.apiJson)
		if (!fs.existsSync(outdir)) {
			fs.mkdirSync(outdir, { recursive: true })
		}
		fs.writeFileSync(opts.apiJson, apis)
	}
	if (opts.types) {
		const fileRoutes = routes.map(route => ({ file: route.file, route }))
		const rawImports = typeCheckers(fileRoutes, opts.types.importDir)
		const outdir = path.dirname(opts.types.outputFile)
		if (!fs.existsSync(outdir)) {
			fs.mkdirSync(outdir, { recursive: true })
		}
		fs.writeFileSync(opts.types.outputFile, rawImports)
	}
}

export function typeCheckers(fileRoutes, fromPath) {
	const typeIdsByFile = {}
	const reqres = ['request', 'response']
	const exportLines = []
	for (const { file, route } of fileRoutes) {
		const api = route.api
		for (const method in api.methods) {
			const m = api.methods[method]
			if (m.alternativeFor) continue
			if (!typeIdsByFile[file]) typeIdsByFile[file] = new Set()
			if (m.request.typeId) typeIdsByFile[file].add(m.request.typeId)
			if (m.response.typeId) typeIdsByFile[file].add(m.response.typeId)
			const filename = file.split('.').slice(0, -1).join('.')
			if (route.payloadName) exportLines.push(`export {${route.payloadName}} from '${fromPath}/${filename}.js'`)
		}
	}
	const importLines = [`import { createValidate } from 'typia'`]
	const createLines = []
	const dedupedTypeIds = new Set()
	for (const file in typeIdsByFile) {
		if (file.endsWith('.js')) continue
		const typeIds = Array.from(typeIdsByFile[file]).filter(t => t !== 'any' && !dedupedTypeIds.has(t))
		if (!typeIds.length) continue
		const filename = file.split('.').slice(0, -1).join('.')
		importLines.push(`import type { ${typeIds.join(', ')} } from '${fromPath}/${filename}.js'`)
		const payloadName = typeIds[0].replace('Request', '')
		for (const typeId of typeIds) {
			createLines.push(`export const valid${typeId} = createValidate<${typeId}>()`)
		}
		for (const t of typeIds) dedupedTypeIds.add(t)
	}
	const content = importLines.join('\n') + '\n' + exportLines.join('\n') + '\n\n' + createLines.join('\n')
	return content
}

export function apiJson(fileRoutes) {
	const typeIdsByFile = {}
	const reqres = ['request', 'response'] //; console.log(fileRoutes)
	const routes = fileRoutes.map(fr => fr.route.api)
	return JSON.stringify(routes, null, '  ')
}
