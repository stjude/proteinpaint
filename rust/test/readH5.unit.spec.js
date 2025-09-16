/**
 * readH5.unit.spec.js
 *
 * Unit test for the readH5 Rust module which validates/reads data from HDF5 files with 3 datasets: item, samples and matrix
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

// Import necessary modules
import tape from 'tape'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import path from 'path'
import fs from 'fs'
import serverconfig from '@sjcrh/proteinpaint-server/src/serverconfig.js'

// Load HDF5 test file
const HDF5_File = path.join(serverconfig.binpath, '/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5')

// Verify file exist - Skip tests if the file doesn’t exist
if (!fs.existsSync(HDF5_File)) {
	throw new Error(`Test data file not found: ${HDF5_File}`)
}

/**************
 * Test sections
 **************/
tape('\n', function (test) {
	test.comment('-***- readH5 specs -***-')
	test.end()
})

/**
 * Test: Validate HDF5 File
 *
 * Verifies that the program correctly identifies and validates HDF5 file,
 * extracting the proper metadata including sample names.
 */

tape('Validate HDF5 File', async t => {
	try {
		const inputJson = {
			hdf5_file: HDF5_File,
			validate: true
		}

		const vali_output = await run_rust('readH5', JSON.stringify(inputJson))
		let data
		try {
			data = JSON.parse(vali_output)
		} catch (e) {
			t.fail(`Failed to parse JSON output: ${e.message}`)
			t.end()
			return
		}

		// Validate the HDF5 file
		t.equal(data.status, 'success', 'Should return success status')
		t.equal(data.format, 'matrix', 'Should identify the format as matrix')
		t.ok(data.samples, 'Should include sample names')
		t.ok(Array.isArray(data.samples), 'Sample names should be an array')
		t.ok(data.samples.length > 0, 'Should have at least one sample name')
	} catch (e) {
		t.fail(`Test failed with error: ${e}`)
	}

	t.end()
})

/**
 * Test: Single Gene Query
 *
 * Verifies that the program can successfully query a specific gene (TP53)
 * and return properly structured expression data.
 */

tape('Query TP53 Gene', async t => {
	try {
		const inputJson = {
			hdf5_file: HDF5_File,
			query: ['TP53']
		}

		const rd_otuput = await run_rust('readH5', JSON.stringify(inputJson))
		let data
		try {
			data = JSON.parse(rd_otuput)
		} catch (e) {
			t.fail(`Failed to parse JSON output: ${e.message}`)
			t.end()
			return
		}

		// 1. Check if TP53 exists
		t.ok('TP53' in data.query_output, "'TP53' should be in query_output")

		// 2. Check if dataId matches
		t.equal(data.query_output.TP53.dataId, 'TP53', "dataId should be 'TP53'")

		// 3. Check if samples is a non-empty object
		const samples = data.query_output.TP53.samples
		t.ok(samples && typeof samples === 'object', "'samples' should be a non-empty object")

		// 4. if number of samples is 100
		t.equal(Object.keys(samples).length, 100, 'Should have 100 samples')
	} catch (e) {
		t.fail(`Test failed with error: ${e}`)
	}
	t.end()
})

/**
 * Test: Multiple Genes Query
 *
 * Verifies the program can handle requests for querying multiple genes simultaneously,
 * including a mix of existing and non-existent genes. Checks that:
 * - All requested genes have entries in the response
 * - Existing genes have sample data
 * - Non-existent genes have error messages
 * - Performance timing information is included
 */

tape('Query Multiple Genes', async t => {
	try {
		const inputJson = {
			hdf5_file: HDF5_File,
			query: ['TP53', 'DDX11L1', 'KRAS', 'NONEXISTENT_GENE']
		}

		const rd_otuput = await run_rust('readH5', JSON.stringify(inputJson))
		let data
		try {
			data = JSON.parse(rd_otuput)
		} catch (e) {
			t.fail(`Failed to parse JSON output: ${e.message}`)
			t.end()
			return
		}

		t.ok(data.query_output, 'Query_output exists')

		const q = data.query_output

		// Genes present
		t.ok(q.TP53 && q.TP53.dataId === 'TP53', 'TP53 present with correct dataID')
		t.ok(q.DDX11L1 && q.DDX11L1.dataId === 'DDX11L1', 'DDX11L1 present with correct dataID')
		t.ok(q.KRAS && q.KRAS.dataId === 'KRAS', 'KRAS present with correct dataID')

		// NONEXISTENT has error object
		t.ok(q.NONEXISTENT_GENE && q.NONEXISTENT_GENE.error, 'NONEXISTENT_GENE should return an error')

		// Check timing information
		t.ok(data.total_time_ms != undefined, 'Should include timing information')
	} catch (e) {
		t.fail(`Test failed with error: ${e}`)
	}
	t.end()
})
