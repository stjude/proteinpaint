/* these routes are for testing only */
const fs = require('fs')
const path = require('path')
const serverconfig = require('../../serverconfig')
const clientTestDir = path.join(serverconfig.binpath, '../client/test')
const helpers = require(`${clientTestDir}/specHelpers.js`)
// the target file will be dynamically imported by runproteinpaint(),
// if there is a 'testInternals' argument
const targetFile = `${clientTestDir}/internals.js`

module.exports = function setRoutes(app, basepath) {
	app.get(basepath + '/specs', async (req, res) => {
		try {
			const q = req.params
			const name = q.name || ''
			const dir = q.dir || ''
			const specs = helpers.findMatchingSpecs(req).map(replaceFilePath)
			const active = helpers.getImportedSpecs(targetFile, (format = 'array')).map(replaceFilePath)
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
			const numSpecs = await helpers.writeImportCode(q, targetFile)
			res.send({ numSpecs })
		} catch (e) {
			console.log(e)
			res.send({ error: e })
		}
	})
}

function replaceFilePath(f) {
	return f.replace('../src/', '')
}
