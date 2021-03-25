const wpFront = require('./client/webpack.config')
const wpBack = require('./server/webpack.config')

module.exports = [wpBack, wpFront]
process.traceDeprecation = true
