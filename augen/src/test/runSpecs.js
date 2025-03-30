import tape from 'tape'

tape('loading of all import(spec)', async test => {
	test.plan(1)
	test.timeoutAfter(1000)

	await import('./augen.unit.spec.js')
	await import('./closestSpec.unit.spec.js')
	await import('./ReqResCache.unit.spec.js')

	test.pass('should finish before this assertion is called')
	test.end()
})
