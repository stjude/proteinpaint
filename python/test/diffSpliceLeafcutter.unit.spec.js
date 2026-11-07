/**
 * diffSpliceLeafcutter.unit.spec.js
 * Run test script as follows (from 'proteinpaint/'):
 *  	node python/test/diffSpliceLeafcutter.unit.spec.js
 *
 * Unit test for python/src/diffSpliceLeafcutter.py, the leafcutter engine of differential splicing.
 *
 * The script's offline selftest fits a small synthetic store with one shifted cluster and asserts
 * the rows, the junctions, the timings and which clusters are tested. It also runs with two spawned
 * workers that write to stdout and stderr: the results must match one process, and run_python would
 * reject the response, or JSON.parse would fail, if that output got out.
 */

import tape from 'tape'
import { run_python } from '@sjcrh/proteinpaint-python'

const python_script = 'diffSpliceLeafcutter.py'

/**************
 * Test sections
 **************/
tape('\n', function (test) {
	test.comment('-***- diffSpliceLeafcutter specs -***-')
	test.end()
})

tape('selftest: fit, rows, junctions, timings, the cluster filter and two workers', async t => {
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
