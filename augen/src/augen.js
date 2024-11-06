import fs from 'fs'
import path from 'path'

export function setRoutes(app, routes, _opts = {}) {
	const opts = Object.assign({ basepath: '' }, _opts)
	for (const route of routes) {
		const api = route.api
		for (const method in api.methods) {
			const m = api.methods[method]
			app[method](`${opts.basepath}/${api.endpoint}`, m.init(opts))
		}
	}

	emitFiles(routes, opts)
}

export function emitFiles(routes, opts) {
	if (opts.apiJson) {
		const apis = JSON.stringify(routes.map(r => r.api))
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
	for (const { file, route } of fileRoutes) {
		const api = route.api
		for (const method in api.methods) {
			const m = api.methods[method]
			if (m.alternativeFor) continue
			if (!typeIdsByFile[file]) typeIdsByFile[file] = new Set()
			if (m.request.typeId) typeIdsByFile[file].add(m.request.typeId)
			if (m.response.typeId) typeIdsByFile[file].add(m.response.typeId)
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
		for (const typeId of typeIds) {
			createLines.push(`export const valid${typeId} = createValidate<${typeId}>()`)
		}
		for (const t of typeIds) dedupedTypeIds.add(t)
	}
	const content = importLines.join('\n') + '\n\n' + createLines.join('\n')
	return content
}

export function apiJson(fileRoutes) {
	const typeIdsByFile = {}
	const reqres = ['request', 'response'] //; console.log(fileRoutes)
	const routes = fileRoutes.map(fr => fr.route.api)
	return JSON.stringify(routes, null, '  ')
}
