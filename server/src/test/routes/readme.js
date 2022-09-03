const glob = require('glob')
const path = require('path')
const serverconfig = require('../../serverconfig')
const fs = require('fs/promises')
const marked = require('marked')

module.exports = function setRoutes(app, basepath) {
	const cwd = path.join(serverconfig.binpath, '..')

	app.get(basepath + '/readme', async (req, res) => {
		const q = req.query
		try {
			console.log(7, req.params, req.body, q)
			if (Object.keys(q).length) {
				const file = path.join(cwd, q.file)
				if (!(await fs.stat(file))) throw `file='${file}' not found`
				const md = await fs.readFile(file, { encoding: 'utf8' })
				res.header('content-type', 'text/markdown')
				res.send(md)
			} else {
				const ignore = ['**/node_modules*/**/*', '**/package/**/*', '**/tmpbuild/**/*', '**/tmppack/**/*']
				const readmes = glob.sync('**/README*', { cwd, ignore }) //.filter(f => f === 'README.md' || f.startsWith('build'))
				res.send({ readmes })
			}
		} catch (e) {
			throw e
		}
	})
}
