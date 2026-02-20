/********************************************
Unit Test script for 'python/src/query_beta_values.py'

Run test script as follows (from 'proteinpaint/'):
    node python/test/dnaMeth.unit.spec.js
*********************************************/

// Import necessary modules
import tape from 'tape'
import { run_python } from '@sjcrh/proteinpaint-python'

const termdb_test_file = 'server/test/tp/files/hg38/TermdbTest/dnaMeth.h5'

tape('Test #0: Validate HDF5', async t => {
	const input = {
		h: termdb_test_file,
		validate: 'True'
	}
	try {
		const out = await run_python('query_beta_values.py', JSON.stringify(input))
		// If Python prints JSON, parse it
		const result = typeof out === 'string' ? JSON.parse(out) : out

		t.ok(Array.isArray(result), 'Output should be a list')
		t.equal(result.length, 100, 'Output list should have length 100')
	} catch (err) {
		const errorText = String(err)
		t.fail(`Validation should pass but failed with error: ${errorText}`)
	}

	console.log('='.repeat(70) + '\n')
	t.end()
})

/***************************
// Genomic Range Query tests
***************************/
tape('Test #1: Out-of-bounds genomic ranges (query_end < genomic_start)', async t => {
	const input = {
		h: termdb_test_file,
		s: '1',
		q: 'chr17:50-50'
	}

	try {
		await run_python('query_beta_values.py', JSON.stringify(input))
		t.fail('Expected Python ValueError but the script succeeded')
	} catch (err) {
		// Convert to string regardless of type
		const errorText = String(err)
		// Check if the error contains the expected message
		t.ok(errorText.includes('is not within'), 'Error message should indicate range is not within bounds')
	}

	console.log('='.repeat(70) + '\n')
	t.end()
})

tape('Test #2: Out-of-bounds genomic ranges (query_start > genomic_end)', async t => {
	const input = {
		h: termdb_test_file,
		s: '1',
		q: 'chr17:7693850-75934950'
	}

	try {
		await run_python('query_beta_values.py', JSON.stringify(input))
		t.fail('Expected Python ValueError but the script succeeded')
	} catch (err) {
		// Convert to string regardless of type
		const errorText = String(err)
		// Check if the error contains the expected message
		t.ok(errorText.includes('is not within'), 'Error message should indicate range is not within bounds')
	}

	console.log('='.repeat(70) + '\n')
	t.end()
})

tape('Test #3: Sample does not exist', async t => {
	const input = {
		h: termdb_test_file,
		s: '0',
		q: 'chr17:7673850-7684495'
	}

	try {
		await run_python('query_beta_values.py', JSON.stringify(input))
		t.fail('Expected Python ValueError but the script succeeded')
	} catch (err) {
		// Convert to string regardless of type
		const errorText = String(err)
		// console.log('Caught error:', errorText);  // This should show

		// Check if the error contains the expected message
		t.ok(
			errorText.includes('Sample(s) not found in HDF5 file.'),
			'Error message should indicate that one or more samples does not exist'
		)
	}
	console.log('='.repeat(70) + '\n')
	t.end()
})

tape('Test #4: Chromosome does not exist', async t => {
	const input = {
		h: termdb_test_file,
		s: '1',
		//g: "chr1:7693850-75934950"
		q: 'chr1:7673850-7680950'
	}

	try {
		await run_python('query_beta_values.py', JSON.stringify(input))
		t.fail('Expected Python KeyError but the script succeeded')
	} catch (err) {
		// Convert to string regardless of type
		const errorText = String(err)

		// console.log('Caught error:', errorText);  // This should show
		// Check if the error contains the expected message
		t.ok(errorText.includes('not found in HDF5'), "Error message should indicate that chromosome doesn't exist")
	}
	console.log('='.repeat(70) + '\n')
	t.end()
})

tape('Test #5: Non-existent HDF file', async t => {
	const input = {
		h: 'server/test/tp/files/hg38/TermdbTest/dnaMethalyane.h5',
		s: '1',
		q: 'chr17:7673850-7680950'
	}

	try {
		await run_python('query_beta_values.py', JSON.stringify(input))
		t.fail('Expected Python KeyError but the script succeeded')
	} catch (err) {
		// Convert to string regardless of type
		const errorText = String(err)
		console.log('Caught error:', errorText) // This should show
		// Check if the error contains the expected message
		t.ok(errorText.includes('HDF5 file not found'), "Error message should indicate that HDF5 doesn't exist")
	}
	console.log('='.repeat(70) + '\n')
	t.end()
})

tape('Test #6: Single genomic position, Single Sample', async t => {
	const input = {
		h: termdb_test_file,
		s: '1',
		q: 'chr17:7669073'
	}

	try {
		const ret = await run_python('query_beta_values.py', JSON.stringify(input))
		// Parse JSON result
		let parsed
		try {
			parsed = JSON.parse(ret)
		} catch (jsonErr) {
			t.fail(`Result is not valid JSON: ${ret}`)
			t.end()
			return
		}

		const beta_value = parsed[0][0]
		t.ok(
			typeof beta_value === 'number' && ((beta_value >= 0.0 && beta_value <= 1.0) || beta_value === -1.0),
			'Valid single beta value in the range [0, 1] or a beta value -1.0 indicates no methylation value for that location'
		)
		//const EXPECTED = 0.773956;
		//const TOLERANCE = 0.0001;
		//t.ok(
		//Math.abs(beta_value - EXPECTED) < TOLERANCE,
		//`Expected ${EXPECTED}, got ${beta_value}`
		//);
	} catch (err) {
		t.fail(`Expected success but got error: ${String(err)}`)
	}
	console.log('='.repeat(70) + '\n')
	t.end()
})

tape('Test #7: Single genomic position, Multiple Samples', async t => {
	const input = {
		h: termdb_test_file,
		s: '1,3,4,7',
		q: 'chr17:7669073'
	}

	try {
		const ret = await run_python('query_beta_values.py', JSON.stringify(input))
		// Parse JSON result
		let parsed
		try {
			parsed = JSON.parse(ret)
		} catch (jsonErr) {
			t.fail(`Result is not valid JSON: ${ret}`)
			t.end()
			return
		}

		// Test dimensions
		const rows = parsed.length
		const cols = parsed[0].length
		console.log(`Array shape: [${rows}, ${cols}]`)
		t.equal(rows, 1, 'Should have 1 rows')
		t.equal(cols, 4, 'Should have 4 columns (sample)')
	} catch (err) {
		t.fail(`Expected success but got error: ${String(err)}`)
	}
	console.log('='.repeat(70) + '\n')
	t.end()
})

tape('Test #8: Whole range of genomic position, Single Sample', async t => {
	const input = {
		h: termdb_test_file,
		s: '4',
		q: 'chr17:7669073-7687424'
	}

	try {
		const ret = await run_python('query_beta_values.py', JSON.stringify(input))
		// Parse JSON result
		let parsed
		try {
			parsed = JSON.parse(ret)
		} catch (jsonErr) {
			t.fail(`Result is not valid JSON: ${ret}`)
			t.end()
			return
		}
		// Test dimensions
		const rows = parsed.length
		const cols = parsed[0].length
		console.log(`Array shape: [${rows}, ${cols}]`)
		t.equal(rows, 33, 'Should have 33 rows')
		t.equal(cols, 1, 'Should have 1 column (sample)')
	} catch (err) {
		t.fail(`Expected success but got error: ${String(err)}`)
	}
	console.log('='.repeat(70) + '\n')
	t.end()
})

/*******************
// CpG Query Unit tests
*******************/

tape('Test #9: Single CpG ID and Single Sample', async t => {
	const input = {
		h: termdb_test_file,
		s: '1',
		q: 'cg22949073'
	}

	try {
		const ret = await run_python('query_beta_values.py', JSON.stringify(input))
		// Parse JSON result
		let parsed
		try {
			parsed = JSON.parse(ret)
		} catch (jsonErr) {
			t.fail(`Result is not valid JSON: ${ret}`)
			t.end()
			return
		}

		const beta_value = parsed[0][0]
		t.ok(
			typeof beta_value === 'number' && ((beta_value >= 0.0 && beta_value <= 1.0) || beta_value === -1.0),
			'Valid single beta value in the range [0, 1] or a beta value -1.0 indicates no methylation value for that location'
		)
		// Test dimensions
		const rows = parsed.length
		const cols = parsed[0].length
		console.log(`Array shape: [${rows}, ${cols}]`)
		t.equal(rows, 1, 'Should have 1 rows')
		t.equal(cols, 1, 'Should have 1 column (sample)')
	} catch (err) {
		t.fail(`Expected success but got error: ${String(err)}`)
	}
	console.log('='.repeat(70) + '\n')
	t.end()
})

tape('Test #10: Check returned float value', async t => {
	const input = {
		h: termdb_test_file,
		s: '1',
		q: 'cg22949073'
	}

	try {
		const out = await run_python('query_beta_values.py', JSON.stringify(input))
		const result = typeof out === 'string' ? JSON.parse(out) : out

		const expected = 0.773956
		const actual = result

		const tolerance = 1e-6
		t.ok(Math.abs(actual - expected) < tolerance, `Expected ~${expected}, got ${actual}`)
	} catch (err) {
		t.fail(`Python script failed: ${String(err)}`)
	}

	t.end()
})

tape('Test #11: Single CpG ID and Multiple Samples', async t => {
	const input = {
		h: termdb_test_file,
		s: '1,2,7,5',
		q: 'cg22949073'
	}
	try {
		const ret = await run_python('query_beta_values.py', JSON.stringify(input))
		// Parse JSON result
		let parsed
		try {
			parsed = JSON.parse(ret)
		} catch (jsonErr) {
			t.fail(`Result is not valid JSON: ${ret}`)
			t.end()
			return
		}

		// Test dimensions
		const rows = parsed.length
		const cols = parsed[0].length
		console.log(`Array shape: [${rows}, ${cols}]`)
		t.equal(rows, 1, 'Should have 1 rows')
		t.equal(cols, 4, 'Should have 4 column (sample)')
	} catch (err) {
		t.fail(`Expected success but got error: ${String(err)}`)
	}
	console.log('='.repeat(70) + '\n')
	t.end()
})

tape('Test #11: Single CpG ID and Multiple Samples', async t => {
	const input = {
		h: termdb_test_file,
		s: '1,2,7,5',
		q: 'cg22949073'
	}

	try {
		const out = await run_python('query_beta_values.py', JSON.stringify(input))
		const result = typeof out === 'string' ? JSON.parse(out) : out

		// Check it is a 2D matrix
		t.ok(Array.isArray(result), 'Output should be an array (matrix)')
		t.ok(Array.isArray(result[0]), 'First element should be a row array')
		// Expected float values (replace with your ground truth)
		const expected = [0.773956, 0.438878, 0.76114, 0.094177]
		const actual = result[0]
		const tol = 1e-6

		for (let i = 0; i < expected.length; i++) {
			t.ok(Math.abs(actual[i] - expected[i]) < tol, `Value at column ${i} should be ~${expected[i]}, got ${actual[i]}`)
		}
	} catch (err) {
		t.fail(`Python script failed: ${String(err)}`)
	}

	t.end()
})

tape('Test #11: Multiple CpG IDs and Single Sample', async t => {
	const input = {
		h: termdb_test_file,
		s: '7',
		//s: '1,2,7,5',
		q: 'cg22949073,cg10792831,cg04405586'
	}

	try {
		const out = await run_python('query_beta_values.py', JSON.stringify(input))
		const result = typeof out === 'string' ? JSON.parse(out) : out

		// Check it is a 2D matrix
		const rows = result.length
		const cols = result[0].length
		console.log(`Array shape: [${rows}, ${cols}]`)
		t.equal(rows, 3, 'Should have 3 rows')
		t.equal(cols, 1, 'Should have 1 column (sample)')
		t.ok(Array.isArray(result), 'Output should be an array (matrix)')
		// Expected float values (replace with your ground truth)
		const expected = [0.76114, 0.283908, 0.131822]
		const tol = 1e-6
		for (let i = 0; i < expected.length; i++) {
			t.ok(
				Math.abs(result[i][0] - expected[i]) < tol,
				`Value at column ${i} should be ~${expected[i]}, got ${result[i][0]}`
			)
		}
	} catch (err) {
		t.fail(`Python script failed: ${String(err)}`)
	}

	t.end()
})
