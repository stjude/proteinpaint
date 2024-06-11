export function testrunproteinpaint() {
	// polyfill only for testing
	if (!window.structuredClone) window.structuredClone = val => JSON.parse(JSON.stringify(val))
	importIntegrationTests()
}

async function importIntegrationTests() {
	// TODO: use /\.integration.spec.(js|ts)$/ pattern to include ts specs
	var context = require.context('../', true, /\.integration.spec.js$/)
	context.keys().forEach(context)
	module.exports = context
}
