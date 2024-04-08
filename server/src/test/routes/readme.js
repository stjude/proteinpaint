const glob = await import('glob')
import path from 'path'
import fs from 'fs/promises'
import serverconfig from '../../serverconfig.js'

export default function setRoutes(app, basepath) {
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
				let parentModule = ''
				try {
					const stat = await fs.stat(superModuleDir)
					if (stat) {
						const root = path.join(serverconfig.binpath, '../..')
						const addlReadmes = glob.sync('**/*.md', { cwd: root, ignore })
						for (const r of addlReadmes) {
							if (!r.includes('proteinpaint/') && !readmes.includes(r)) readmes.push(path.join('..', r))
						}
						if (addlReadmes.length) parentModule = root.split('/').pop()
					}
				} catch (e) {
					console.log(e)
					// no error
				}

				res.send({ readmes, parentModule })
			}
		} catch (e) {
			throw e
		}
	})
}
