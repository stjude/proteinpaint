import serverconfig from '../src/serverconfig.js'
import fs from 'fs'
import path from 'path'
import augen from '@sjcrh/augen'

{
	// start moving migrated route handler code here
	const files = fs.readdirSync(path.join(serverconfig.binpath, '/routes')).filter(f => f.endsWith('.ts'))
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
