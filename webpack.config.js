/*
	Cannot use `npm run dev --workspaces` using
	'&' at the end of each workspace's dev script,
	since those processes end up running in the background
	even with control^C
*/

const wpServer = require('./server/webpack.config.js')
const configs = [wpServer]

if (!process.env.PP_MODE?.startsWith('container-')) {
	const wpClient = require('./client/webpack.config.js')
	configs.push(wpClient)
}

module.exports = configs
process.traceDeprecation = true
