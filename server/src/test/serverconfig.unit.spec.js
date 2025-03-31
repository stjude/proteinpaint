import tape from 'tape'
import serverconfig from '../serverconfig.js'
import path from 'path'

const __dirname = import.meta.dirname

const sc = structuredClone(serverconfig)

tape('basic test', test => {
	test.equal(sc.debugmode, true, 'should have debugmode=true in test environment')
	test.equal(sc.binpath, path.join(__dirname, '../..'), 'should detect the correct binpath')
	test.equal(sc.routeSetters?.length, 5, 'should set the expected routeSetters')
	test.end()
})
