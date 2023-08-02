console.log(1, process.argv)
const context = require.context('../../', true, /health.unit.spec.js$/)
require('../../utils/webpack/exportContext.js').exportContext(context)
