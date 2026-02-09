/**
 * topGeneByExpressionVariance.unit.spec.js
 *
 * Unit test for the topGeneByExpressionVariance Rust module that selects top variable genes from expression matrix from HDF5 file with 3 datasets: item, samples and matrix
 *
 *
 * This module reads an expression matrix stored in HDF5 format and returns
 * the top N most variable genes (typically ranked by expression variance).
 *
 * The expected HDF5 file structure contains at least three datasets:
 * 		- item      (gene symbols or IDs)
 * 		- samples   (sample identifiers)
 * 		- matrix    (expression values)
 *
 * Current test suite focuses on:
 * 		- Output starts with "output_json:" prefix
 * 		- Following content is valid JSON
 * 		- JSON parses to an array of gene objects
 * 		- Each gene object contains at least: gene_symbol (string), rank_type (number)
 * 		- Array is non-empty when reasonable parameters are used
 *
 *
 * To run the tests use the command: node topGeneByExpressionVariance.unit.spec.js
 */

import tape from 'tape'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import path from 'path'
import fs from 'fs'
import serverconfig from '@sjcrh/proteinpaint-server/src/serverconfig.js'

// Prepare paths to HDF5 test file
const HDF5_FILE = path.join(serverconfig.binpath, 'test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5')

// Skip entire test suite if required file is missing
if (!fs.existsSync(HDF5_FILE)) {
	tape.skip('Returns valid output_json array of gene objects (HDF5 fixture missing)', t => {
		t.comment(`Skipping test because data file not found: ${HDF5_FILE}`)
		t.end()
	})
} else {
	/**
	 * Test: Validate topGeneByExpressionVariance rust code
	 *
	 * Verifies the rust code returns a valid JSON object with a "genes" key that is an array.
	 */
	tape('Returns valid output_json array of gene objects', async t => {
		try {
			const inputJson = {
				samples: '2646,2660,2898,3150,3178,3206,3220,3346,3360,1,3,7,21,22,23,37,38,39',
				input_file: HDF5_FILE,
				filter_extreme_values: 0,
				num_genes: 20,
				rank_type: 'var'
			}

			const rawOutput = await run_rust('topGeneByExpressionVariance', JSON.stringify(inputJson))
			const rawOutputLines = String(rawOutput).split('\n')
			const rawOutputVargene = rawOutputLines.find(
				line => typeof line === 'string' && line.trim().startsWith('output_json:')
			)

			// 1. Check prefix
			t.ok(rawOutputVargene, 'Rust output should contain a line starting with "output_json:"')
			if (!rawOutputVargene) {
				t.end()
				return
			}

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
}
