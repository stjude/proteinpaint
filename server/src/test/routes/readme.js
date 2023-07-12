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
				try {
					if (await fs.stat(file)) {
						const md = await fs.readFile(file, { encoding: 'utf8' })
						res.header('content-type', 'text/markdown')
						res.send(md)
					}
				} catch (e) {
					res.send({ error: `file='${file}' not found: ` + e })
				}
			} else {
				const ignore = [
					'**/node_modules*/**/*',
					'**/package/**/*',
					'**/tmpbuild/**/*',
					'**/tmppack/**/*',
					'node_modules'
				]
				const readmes = glob.sync('**/*.md', { cwd, ignore })
				const superModuleDir = path.join(serverconfig.binpath, '../../.git/modules/proteinpaint')
				let parentDir
				try {
					const stat = await fs.stat(superModuleDir)
					if (stat) {
						const root = path.join(serverconfig.binpath, '../..')
						const addlReadmes = glob.sync('**/*.md', { cwd: root, ignore })
						for (const r of addlReadmes) {
							if (!r.includes('proteinpaint/') && !readmes.includes(r)) readmes.push(path.join('..', r))
						}
						if (addlReadmes.length) parentDir = root.split('/').pop()
					}
				} catch (e) {
					console.log(e)
					// no error
				}

				res.send({ readmes, parentDir })
			}
		} catch (e) {
			throw e
		}
	})
}
