/**
 * gsea.unit.spec.js
 * Run test script as follows (from 'proteinpaint/'):
 *  	node python/test/gsea.unit.spec.js
 *
 * Unit test for the two pure helpers in python/src/gsea.py. Both exist because blitzgsea's output
 * cannot be sent to the client as-is:
 *
 *   _finite_or_label  json has no Infinity literal and pandas' to_json() writes null for inf and
 *                     NaN alike, so an enrichment score that is off the scale arrives looking
 *                     exactly like one that was never computed. The infinities go over as strings.
 *   _recompute_fdr    blitzgsea hands its NaN p-values to multipletests(..., 'fdr_bh') along with
 *                     the rest, and BH is a whole-array operation, so one NaN blanks every FDR.
 *
 * The script's offline selftest asserts both, including the exact spelling 'Infinity'/'-Infinity'.
 * That spelling is a cross-language contract with client formatStat() in
 * plots/gsea/viewModel/GSEAViewModel.ts, which has its own test for the reading half; nothing else
 * would catch the two halves drifting apart, and the symptom is a silently blank column rather than
 * an error.
 */

import tape from 'tape'
import { run_python } from '@sjcrh/proteinpaint-python'

const python_script = 'gsea.py'

/**************
 * Test sections
 **************/
tape('\n', function (test) {
	test.comment('-***- gsea specs -***-')
	test.end()
})

tape('selftest: infinity labelling and FDR recomputation', async t => {
	// the leading '/' is the sentinel byte gsea.py consumes with stdin.read(1) before reading lines,
	// same as the server does in routes/genesetEnrichment.ts
	const stdout = await run_python(python_script, '/' + JSON.stringify({ selftest: true }))
	const line = stdout.split('\n').find(l => l.startsWith('result: '))
	t.ok(line, 'gsea.py should emit a result line')
	const out = JSON.parse(line.replace('result: ', ''))
	t.equal(out.selftest, 'ok', out.error || 'offline helper assertions passed')
	t.end()
})
