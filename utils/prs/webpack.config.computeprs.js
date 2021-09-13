const config = require('./webpack.config.base')
const path = require('path')

config.entry = path.join(__dirname, './compute_prs.js')
config.output = {
	path: path.join(__dirname, './'),
	filename: 'compute_prs.bundle.js'
}

module.exports = config
