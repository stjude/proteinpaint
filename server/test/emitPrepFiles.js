const serverconfig = require('../src/serverconfig')
const fs = require('fs')
const path = require('path')
const augen = require('@sjcrh/augen')

{
	// start moving migrated route handler code here
	const files = fs.readdirSync(path.join(serverconfig.binpath, '/routes'))
	const routes = files.map(file => {
		const route = require(`../routes/${file}`)
		route.file = file
		return route
	})
	augen.emitFiles(routes, {
		apiJson: path.join(__dirname, '../../public/docs/server-api.json'),
		types: {
			importDir: '../types/routes',
			outputFile: path.join(__dirname, '../shared/checkers-raw/index.ts')
		}
	})
}
