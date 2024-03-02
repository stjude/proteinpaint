/* these routes are for testing only */
import fs from 'fs'
import path from 'path'
import serverconfig from '../../serverconfig.js'

let helpers, targetFile
async function setHelpers() {
	const clientTestDir = path.join(serverconfig.binpath, '../client/test')
	// the target file will be dynamically imported by runproteinpaint(),
	// if there is a 'testInternals' argument
	targetFile = `${clientTestDir}/internals.js`
	helpers = await import(`${clientTestDir}/specHelpers.js`)
}
setHelpers()

export default function setRoutes(app, basepath) {
	app.get(basepath + '/specs', async (req, res) => {
		try {
			const specs = helpers.findMatchingSpecs(req.query).matched.map(replaceFilePath)
			const active = helpers.getImportedSpecs(targetFile, 'array').map(replaceFilePath)
			res.send({ specs, active })
		} catch (e) {
			throw e
		}
	})

	app.post('/specs', async (req, res) => {
		try {
			const q = req.body
			const name = q.name || ''
			const dir = q.dir || ''
			const specs = await helpers.writeImportCode(q, targetFile)
			res.send(specs)
		} catch (e) {
			console.log(e)
			res.send({ error: e })
		}
	})
}

function replaceFilePath(f) {
	return f.replace('../src/', '')
}
