var context = require.context('../../', true, /\.spec.js$/)
require('../../utils/webpack/exportContext.js').exportContext(context)
