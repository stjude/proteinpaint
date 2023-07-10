const glob = require('glob')
const path = require('path')
const serverconfig = require('../../serverconfig')
const fs = require('fs/promises')

module.exports = function setRoutes(app, basepath) {
	const cwd = path.join(serverconfig.binpath, '..')

	app.get(basepath + '/readme', async (req, res) => {
		const q = req.query
		try {
			if (Object.keys(q).length) {
				const file = path.join(cwd, q.file)
				if (!(await fs.stat(file))) throw `file='${file}' not found`
				const md = await fs.readFile(file, { encoding: 'utf8' })
				res.header('content-type', 'text/markdown')
				res.send(md)
			} else {
				const ignore = [
					'**/node_modules*/**/*',
					'**/package/**/*',
					'**/tmpbuild/**/*',
					'**/tmppack/**/*',
					'node_modules'
				]
				const readmes = glob.sync('**/README*', { cwd, ignore }) //.filter(f => f === 'README.md' || f.startsWith('build'))
				if (serverconfig.additionalReadmeRoots) {
					for (const key in serverconfig.additionalReadmeRoots) {
						const root = serverconfig.additionalReadmeRoots[key]
						const addlReadmes = glob.sync('**/README*', { cwd: root, ignore })
						for (const r of addlReadmes) {
							if (!r.includes('proteinpaint/') && !readmes.includes(r)) readmes.push(path.join(key, r))
						}
					}
				}
				res.send({ readmes })
			}
		} catch (e) {
			throw e
		}
	})
}
