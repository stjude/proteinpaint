/* these routes are for testing only */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const serverconfig = require('../../serverconfig')

module.exports = function setRoutes(app, basepath) {
	app.use((req, res, next) => {
		const id = crypto
			.createHash('sha1')
			.update(`${req.originalUrl} ${JSON.stringify(req.body)}`)
			.digest('hex')
		const cacheFile = path.join(serverconfig.binpath + '/src/test/data', id)
		console.log(11, id, cacheFile)

		try {
			if (fs.existsSync(cacheFile)) {
				console.log(`Using cache file ${cacheFile}`)
				res.send(fs.readFileSync(cacheFile))
			} else {
				const send = res.send
				res.send = function(body) {
					fs.writeFileSync(cacheFile, body, console.error)
					send.call(this, body)
				}
				next()
			}
		} catch (e) {
			throw e
		}
	})
}
