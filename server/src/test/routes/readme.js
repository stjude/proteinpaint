import path from 'path'
import fs from 'fs'
import serverconfig from '../../serverconfig.js'

process.removeAllListeners('warning')

export default function setRoutes(app, basepath) {
	const cwd = path.join(serverconfig.binpath, '..')
	const root = path.join(serverconfig.binpath, '../..')

	app.get(basepath + '/readme', async (req, res) => {
		const q = req.query
		try {
			if (Object.keys(q).length) {
				const file = path.resolve(cwd, String(q.file))
				try {
					if (!file.endsWith('.md') || !file.startsWith(root + path.sep)) throw 'unsupported file'
					if (await fs.promises.stat(file)) {
						const md = await fs.promises.readFile(file, { encoding: 'utf8' })
						res.header('content-type', 'text/markdown')
						res.send(md)
					}
				} catch (e) {
					res.send({ error: 'file not found' })
				}
			} else {
				const exclude = [
					'**/node_modules*/**/*',
					'**/package/**/*',
					'**/tmpbuild/**/*',
					'**/tmppack/**/*',
					'node_modules'
				]
				const readmes = fs.globSync('**/*.md', { cwd, exclude })
				const superModuleDir = path.join(serverconfig.binpath, '../../.git/modules/proteinpaint')
				let parentModule = ''
				try {
					const stat = await fs.promises.stat(superModuleDir)
					if (stat) {
						const root = path.join(serverconfig.binpath, '../..')
						const addlReadmes = fs.globSync('**/*.md', { cwd: root, exclude })
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
