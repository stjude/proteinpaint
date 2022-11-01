const path = require('path')
const fs = require('fs')

function readBabelConfig(babelrcPath, nodeVersion) {
	let babelrc
	try {
		babelrc = fs.readFileSync(path.join(babelrcPath, '.babelrc'))
		babelrc = JSON.parse(babelrc)
		if (process.env.PP_MODE?.startsWith('container')) {
			babelrc.presets[0][1].targets.node = nodeVersion
		}
	} catch (e) {
		throw e
	}
	return babelrc
}
exports.readBabelConfig = readBabelConfig
