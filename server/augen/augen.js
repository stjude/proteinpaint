const fs = require('fs')
const path = require('path')

exports.setRoutes = function setRoutes(app, routes, basepath, opts = {}) {
	for (const route of routes) {
		const api = route.api
		for (const method in api.methods) {
			const m = api.methods[method]
			app[method](`${basepath}/${api.endpoint}`, m.init(opts))
		}
	}

	if (opts.debugmode) {
		// dev bundling with typescript and mixed cjs/esm transpiles correctly,
		// for convenience generate the docs and test inputs here
		// TODO: separate this code when ts-node can be configured to support mixed cjs/esm
		const apis = JSON.stringify(routes.map(r => r.api))
		fs.writeFileSync(path.join(__dirname, '../../public/docs/server-api.json'), apis)
		const fileRoutes = routes.map(route => ({ file: route.file, route }))
		const rawImports = typeCheckers(fileRoutes, '../../../routes')
		fs.writeFileSync(path.join(__dirname, '../server/shared/checkers/raw/index.ts'), rawImports)
	}
}

function typeCheckers(fileRoutes, fromPath) {
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
	for (const file in typeIdsByFile) {
		const typeIds = Array.from(typeIdsByFile[file])
		importLines.push(`import { ${typeIds.join(', ')} } from '${fromPath}/${file}'`)
		for (const typeId of typeIds) {
			createLines.push(`export const valid${typeId} = createValidate<${typeId}>()`)
		}
	}
	const content = importLines.join('\n') + '\n\n' + createLines.join('\n')
	return content
}

exports.typeCheckers = typeCheckers

exports.apiJson = function apiJson(fileRoutes) {
	const typeIdsByFile = {}
	const reqres = ['request', 'response'] //; console.log(fileRoutes)
	const routes = fileRoutes.map(fr => fr.route.api)
	return JSON.stringify(routes, null, '  ')
}
