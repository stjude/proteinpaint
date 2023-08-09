// all the arguments to require.context() must be literals, cannot be variables
const context = require.context('../../', true, /\.unit.spec.(js|ts)$/)
require('../../utils/webpack/exportContext.js').exportContext(context)
