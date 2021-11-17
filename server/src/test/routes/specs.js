/* these routes are for testing only */
const fs = require('fs')
const path = require('path')
const serverconfig = require('../../serverconfig')
const clientTestDir = path.join(serverconfig.binpath, '../client/test')
const helpers = require(`${clientTestDir}/specHelpers.js`)

// the target file will be dynamically imported by runproteinpaint(),
// if there is a 'testInternals' argument
const targetFile = `${clientTestDir}/internals.js`
const bundleFile = path.join(serverconfig.binpath, '../public/bin/proteinpaint.js')

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

			const mtime = +new Date((await fs.promises.stat(bundleFile)).mtime)
			console.log(33, mtime, bundleFile)
			const numSpecs = helpers.writeImportCode(q, targetFile)

			if (numSpecs) {
				for (let i = 0; i < 20; i++) {
					const time = +new Date((await fs.promises.stat(bundleFile)).mtime)
					console.log(37, time, time > mtime)
					if (time > mtime) break
					await sleep(400)
				}
			}
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

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}
