export function testrunproteinpaint() {
	importIntegrationTests()
}

async function importIntegrationTests() {
	var context = require.context('../', true, /\.integration.spec.js$/)
	context.keys().forEach(context)
	module.exports = context
}
