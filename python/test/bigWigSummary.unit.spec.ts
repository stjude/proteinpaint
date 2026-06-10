/**
Unit Test script for 'python/src/bigWigSummary.py'

Run test script as follows (from 'proteinpaint/'):
    node python/test/bigWigSummary.unit.spec.ts
*/

import tape from 'tape'
import { run_python } from '@sjcrh/proteinpaint-python'

const bwFile = 'server/test/tp/files/hg38/TermdbTest/trackLst/bw1.bw'
const payload = {
	bw_file: bwFile,
	chromosome: 'chr17',
	start: 7666657,
	end: 7688274,
	n_bins: 10
}

// Sample expected output computed from the same static public test bigWig.
const expected = [
	2.192503470615456, 2.3584643848288622, 0.6896392229417206, 1.5256825543729755, 0.862627197039778, 1.2335800185013877,
	1.6385932438685793, 3.5314523589269196, 31.965309898242367, 167.53092783505156
]

function approxEqual(a: number, b: number, eps = 1e-9) {
	return Math.abs(a - b) <= eps
}

tape('bigWigSummary returns expected binned means', async t => {
	try {
		const out = await run_python('bigWigSummary.py', JSON.stringify(payload))
		const result = typeof out === 'string' ? JSON.parse(out) : out

		t.ok(Array.isArray(result), 'Output should be an array')
		t.equal(result.length, payload.n_bins, 'Output length should equal n_bins')

		for (let i = 0; i < expected.length; i++) {
			t.ok(approxEqual(result[i], expected[i]), `Bin ${i} should match expected mean`)
		}
	} catch (err) {
		t.fail(`Expected success but got error: ${String(err)}`)
	}

	t.end()
})

tape('bigWigSummary rejects non-integer n_bins', async t => {
	try {
		await run_python('bigWigSummary.py', JSON.stringify({ ...payload, n_bins: '10' }))
		t.fail('Expected n_bins validation to fail')
	} catch (err) {
		const errorText = String(err)
		t.ok(errorText.includes('n_bins must be an integer'), 'Error should mention n_bins validation')
	}

	t.end()
})

tape('bigWigSummary rejects an invalid URL', async t => {
	try {
		await run_python(
			'bigWigSummary.py',
			JSON.stringify({
				...payload,
				bw_file: 'https://example.invalid/not-a-real-file.bw'
			})
		)
		t.fail('Expected invalid URL validation to fail')
	} catch (err) {
		const errorText = String(err)
		console.log('Received error:', errorText)
		t.ok(errorText.includes('is not accessible'), 'Error should mention invalid URL accessibility')
	}

	t.end()
})
