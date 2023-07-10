// the native fetch API will not know the default host or might
// not have access to the localStorage, so
// testHost will be used as default as needed
window.testHost = 'http://localhost:3000'
sessionStorage.setItem('hostURL', window.testHost)

// polyfill only for testing
if (!window.structuredClone) window.structuredClone = val => JSON.parse(JSON.stringify(val))

const context = require.context('../', true, /\.unit.spec.(js|ts)$/)
context.keys().forEach(context)
module.exports = context
