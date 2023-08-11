const fs = require('fs')

exports.setRoutes = function setRoutes(app, routes, basepath, opts = {}) {
	for (const route of routes) {
		const api = route.api
		for (const method in api.methods) {
			const m = api.methods[method]
			app[method](`${basepath}/${api.endpoint}`, m.init(opts))
		}
	}
}

exports.typeCheckers = function typeCheckers(fileRoutes, fromPath) {
	const typeIdsByFile = {}
	const reqres = ['request', 'response']
	for (const { file, route } of fileRoutes) {
		const api = route.api
		for (const method in api.methods) {
			const m = api.methods[method]
			if (!typeIdsByFile[file]) typeIdsByFile[file] = new Set()
			if (m.request.typeId) typeIdsByFile[file].add(m.request.typeId)
			if (m.response.typeId) typeIdsByFile[file].add(m.response.typeId)
		}
	}
	const importLines = [`import { createValidate } from 'typia'`]
	const createLines = []
	for (const file in typeIdsByFile) {
		const typeIds = Array.from(typeIdsByFile[file])
		importLines.push(`import { ${typeIds.join(',')} } from '${fromPath}/${file}'`)
		for (const typeId of typeIds) {
			createLines.push(`export const valid${typeId} = createValidate<${typeId}>()`)
		}
	}
	const content = importLines.join('\n') + '\n\n' + createLines.join('\n')
	return content
}

exports.apiJson = function apiJson(fileRoutes) {
	const typeIdsByFile = {}
	const reqres = ['request', 'response'] //; console.log(fileRoutes)
	const routes = fileRoutes.map(fr => fr.route.api)
	return JSON.stringify(routes, null, '  ')
}
