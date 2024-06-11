export function testrunproteinpaint() {
	// polyfill only for testing
	if (!window.structuredClone) window.structuredClone = val => JSON.parse(JSON.stringify(val))
	importIntegrationTests()
}

async function importIntegrationTests() {
	var context = require.context('../', true, /\.integration.spec.(js|ts)$/)
	context.keys().forEach(context)
	module.exports = context
}
