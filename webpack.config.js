/*
	Cannot use `npm run dev --workspaces` using
	'&' at the end of each workspace's dev script,
	since those processes end up running in the background
	even with control^C
*/

const wpServer = require('./server/webpack.config.js')
const wpClient = require('./client/webpack.config.js')

module.exports = [wpServer, wpClient]
process.traceDeprecation = true
