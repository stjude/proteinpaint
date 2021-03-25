const wpFront = require('./webpack.config.client')
const wpBack = require('./webpack.config.server')

module.exports = [wpBack, wpFront]
process.traceDeprecation = true
