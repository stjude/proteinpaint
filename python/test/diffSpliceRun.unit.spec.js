/**
 * diffSpliceRun.unit.spec.js
 * Run test script as follows (from 'proteinpaint/'):
 *  	node python/test/diffSpliceRun.unit.spec.js
 *
 * Unit test for python/src/diffSpliceRun.py, the leafcutter engine of differential splicing.
 *
 * The script's offline selftest fits a small synthetic store with one shifted cluster and asserts
 * the rows, the junctions and that it tests the same clusters as the filter of the edgeR screen.
 */

import tape from 'tape'
import { run_python } from '@sjcrh/proteinpaint-python'

const python_script = 'diffSpliceRun.py'

/**************
 * Test sections
 **************/
tape('\n', function (test) {
	test.comment('-***- diffSpliceRun specs -***-')
	test.end()
})

tape('selftest: fit, rows, junctions and the cluster filter', async t => {
	const out = JSON.parse(await run_python(python_script, JSON.stringify({ selftest: true })))
	t.equal(out.selftest, 'ok', out.error || 'offline run passed')
	t.end()
})

tape('a bad request is reported in the body, not thrown', async t => {
	const out = JSON.parse(await run_python(python_script, JSON.stringify({ group1: ['a'], group2: ['b'] })))
	t.equal(out.ok, false, 'should not be ok')
	t.ok(out.error?.includes("missing required field: 'h5'"), `should name the field: ${out.error}`)
	t.end()
})
