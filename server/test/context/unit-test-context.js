var context = require.context('../../', true, /auth\.unit.spec.js$/)
require('../../utils/webpack/exportContext.js').exportContext(context)
