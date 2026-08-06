/**
 * gdcCountsH5.unit.spec.js
 * Run test script as follows (from 'proteinpaint/'):
 *  	node python/test/gdcCountsH5.unit.spec.js
 *
 * Unit test for python/src/gdcCountsH5.py, the HDF5 writer for GDC differential expression.
 *
 * The script's offline selftest writes a 3-gene x 2-sample file and reads it back, asserting the
 * matrix is (genes x samples) float32 with the gene/sample name arrays intact. A transposed write
 * still produces a readable HDF5 and a plausible-looking volcano, so this is the check that has to
 * exist.
 */

import tape from 'tape'
import { run_python } from '@sjcrh/proteinpaint-python'

const python_script = 'gdcCountsH5.py'

/**************
 * Test sections
 **************/
tape('\n', function (test) {
	test.comment('-***- gdcCountsH5 specs -***-')
	test.end()
})

tape('selftest: matrix axis order and string datasets', async t => {
	const out = JSON.parse(await run_python(python_script, JSON.stringify({ selftest: true })))
	t.equal(out.selftest, 'ok', out.error || 'offline round-trip passed')
	t.end()
})

tape('missing f32 file is reported, not thrown', async t => {
	const out = JSON.parse(
		await run_python(
			python_script,
			JSON.stringify({
				out_file: '/tmp/sjpp-gdcCountsH5-should-not-exist.h5',
				f32_file: '/tmp/sjpp-gdcCountsH5-should-not-exist.f32',
				genes: ['TP53'],
				samples: ['caseA']
			})
		)
	)
	t.ok(out.error?.includes('could not be found'), `reports the missing file: ${out.error}`)
	t.end()
})
