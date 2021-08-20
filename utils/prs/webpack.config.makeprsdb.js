const config = require('./webpack.config.base')
const path = require('path')

config.entry = path.join(__dirname, './make_prs_db.js')
config.output = {
	path: path.join(__dirname, './'),
	filename: 'make_prs_db.bundle.js'
}

module.exports = config
