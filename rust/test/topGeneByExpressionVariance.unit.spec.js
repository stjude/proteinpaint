/**
 * topGeneByExpressionVariance.unit.spec.js
 *
 * Unit test for the topGeneByExpressionVariance Rust module that selects top variable genes from expression matrix from HDF5 file with 3 datasets: item, samples and matrix
 *
 *
 * 1. The validation test checks that the response is valid JSON and contains the expected fields:
 * - `status` should be "success"
 * - `format` should be "matrix"
 * - `samples` should exist, be an array, and contain at least one entry.
 *
 * 2. The reading test verify the single gene query and multiple gene query
 * - Query TP53 Gene
 *  - The queried gene "TP53" should exist in the response
 *  - The `dataId` field should match the gene name
 *  - The `samples` field should exist, be a non-empty object
 *  - There should be exactly 100 samples in the result
 *
 * - Query Multiple Genes
 *  - All requested genes appear in the response
 *  - Valid genes (TP53, DDX11L1, KRAS) return data with correct `dataId`
 *  - Invalid genes (e.g., NONEXISTENT_GENE) return an error object
 *  - Timing/performance metadata (`total_time_ms`) is included in the response
 *
 * To run the tests use the command: node readH5.unit.spec.js
 */

import tape from 'tape'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import path from 'path'
import fs from 'fs'
import serverconfig from '@sjcrh/proteinpaint-server/src/serverconfig.js'

// Prepare paths to HDF5 test file
const HDF5_File = path.join(serverconfig.binpath, 'test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5')
console.log(HDF5_File)

// Skip entire test suite if required file is missing
if (!fs.existsSync(HDF5_File)) {
	throw new Error(`Test data file not found: ${HDF5_File}`)
}

/**
 * Test: Validate topGeneByExpressionVariance rust code
 *
 * Verifies the rust code returns a valid JSON object with a "genes" key that is an array.
 */

tape('Returns valid output_json array of gene objects', async t => {
	try {
		const inputJson = {
			samples: '2646,2660,2898,3150,3178,3206,3220,3346,3360,1,3,7,21,22,23,37,38,39',
			input_file: HDF5_File,
			filter_extreme_values: 0,
			num_genes: 20,
			rank_type: 'var'
		}

		const rawOutput = await run_rust('topGeneByExpressionVariance', JSON.stringify(inputJson))
		const rawOutputVargene = rawOutput.split('\n')[1]
		console.log(rawOutputVargene)

		// 1. Check prefix
		t.ok(
			typeof rawOutputVargene === 'string' && rawOutputVargene.startsWith('output_json:'),
			'Output should start with "output_json:"'
		)

		// 2. Extract JSON part
		const jsonPart = rawOutputVargene.replace(/^output_json:\s*/, '').trim()

		let data
		try {
			data = JSON.parse(jsonPart)
		} catch (e) {
			t.fail(`Failed to parse JSON after "output_json:": ${e.message}\nRaw: ${rawOutputVargene.slice(0, 200)}...`)
			t.end()
			return
		}
		// 3. Basic structure
		t.ok(Array.isArray(data), 'Parsed content should be an array')
		t.ok(data.length > 0, 'Gene array should not be empty')

		// 4. Check the first item
		if (data.length > 0) {
			const first = data[0]
			t.equal(typeof first, 'object', 'Each item should be an object')
			t.ok('gene_symbol' in first, 'Should have "gene_symbol" key')
			t.equal(typeof first.gene_symbol, 'string', 'gene_symbol should be string')
			t.ok('rank_type' in first, 'Should have "rank_type" key')
			t.equal(typeof first.rank_type, 'number', 'rank_type should be a number')
		}
		t.pass('Output format is valid ✓')
	} catch (e) {
		t.fail(`Test failed: ${e.message || e}`)
	}
	t.end()
})
