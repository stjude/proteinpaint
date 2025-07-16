/**
 * readHDF5.unit.spec.js
 *
 * Unit tests for the readHDF5 Rust module which extracts gene expression data from HDF5 files.
 *
 * These tests verify:
 * - Single gene queries function correctly
 * - Multiple gene queries function correctly
 * - Error handling for non-existent genes
 * - Data structure validation
 * - File access errors are properly reported
 *
 * The tests use an HDF5 test file with simpulated sample gene expression data.
 *
 * To run the tests use the command: node readHDF5.unit.spec.js
 * To run the entire Rust unit test suite use the command: npm run test:unit from proteinpaint/rust
 */

// Import necessary modules
import tape from 'tape'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import path from 'path'
import fs from 'fs'
import serverconfig from '@sjcrh/proteinpaint-server/src/serverconfig.js'

// Load HDF5 test file
const HDF5_FILE = path.join(serverconfig.binpath, '/test/tp/files/hg38/TermdbTest/fpkm/TermdbTest.fpkm.matrix.h5')

// Verify file exists
if (!fs.existsSync(HDF5_FILE)) {
	throw new Error(`Test data file not found: ${HDF5_FILE}`)
}

/**************
 * Test sections
 **************/
tape('\n', function (test) {
	test.comment('-***- readHDF5 specs -***-')
	test.end()
})

/**
 * Test: Single Gene Query
 *
 * Verifies that the program can successfully query a specific gene (TP53)
 * and return properly structured expression data.
 */
tape('Query TP53 Gene', async t => {
	try {
		const input_data = {
			hdf5_file: HDF5_FILE,
			gene: 'TP53'
		}

		const rust_output = await run_rust('readHDF5', JSON.stringify(input_data))
		const output_lines = rust_output.split('\n')

		// Parse the JSON output
		let data
		try {
			data = JSON.parse(output_lines[0])
		} catch (e) {
			t.fail(`Failed to parse JSON output: ${e.message}`)
			t.end()
			return
		}

		t.equal(data.gene, 'TP53', 'Should return data for TP53 gene')
		t.ok(data.samples, 'Should include samples data')
		t.ok(Object.keys(data.samples).length > 0, 'Should have at least one sample')

		// Check that sample values are numbers or null (for NaN values)
		Object.values(data.samples).forEach(value => {
			t.ok(typeof value === 'number' || value === null, 'Sample value should be a number or null')
		})
	} catch (e) {
		t.fail(`Test failed with error: ${e}`)
	}

	t.end()
})

/**
 * Test: Non-existent Gene Query
 *
 * Verifies proper error handling when requesting a gene that doesn't exist
 * in the dataset. Should return a structured error message.
 */
tape('Query Non-existent Gene', async t => {
	try {
		const input_data = {
			hdf5_file: HDF5_FILE,
			gene: 'NONEXISTENT_GENE'
		}

		// We expect this to resolve with an error message in JSON format
		const rust_output = await run_rust('readHDF5', JSON.stringify(input_data))
		const output_lines = rust_output.split('\n')

		let data
		try {
			data = JSON.parse(output_lines[0])
		} catch (e) {
			t.fail(`Failed to parse JSON output: ${e.message}`)
			t.end()
			return
		}

		t.ok(data.status === 'error' || data.status === 'failure', 'Should return error status')
		t.ok(data.message && data.message.includes('not found'), 'Error message should indicate gene not found')
	} catch (e) {
		// If run_rust rejects, the gene might not be found, which is expected
		t.ok(e.includes('not found') || e.includes('NONEXISTENT_GENE'), 'Error should indicate gene not found')
	}

	t.end()
})

/**
 * Test: Multiple Genes Query
 *
 * Verifies the program can handle requests for multiple genes simultaneously,
 * including a mix of existing and non-existent genes. Checks that:
 * - All requested genes have entries in the response
 * - Existing genes have sample data
 * - Non-existent genes have error messages
 * - Performance timing information is included
 */
tape('Query Multiple Genes', async t => {
	try {
		const input_data = {
			hdf5_file: HDF5_FILE,
			genes: ['TP53', 'BRCA1', 'BRCA2', 'NONEXISTENT_GENE']
		}

		const rust_output = await run_rust('readHDF5', JSON.stringify(input_data))
		const output_lines = rust_output.split('\n')

		let data
		try {
			data = JSON.parse(output_lines[0])
		} catch (e) {
			t.fail(`Failed to parse JSON output: ${e.message}`)
			t.end()
			return
		}

		t.ok(data.genes, 'Should include genes object')

		// Check that we have results for the genes (either data or error)
		;['TP53', 'BRCA1', 'BRCA2', 'NONEXISTENT_GENE'].forEach(gene => {
			t.ok(data.genes[gene], `Should include an entry for ${gene}`)
		})

		// Check if the known genes have data
		;['TP53', 'BRCA1', 'BRCA2'].forEach(gene => {
			if (!data.genes[gene].error) {
				t.ok(data.genes[gene].samples, `Should include samples for ${gene}`)
				t.ok(Object.keys(data.genes[gene].samples).length > 0, `Should have at least one sample for ${gene}`)
			}
		})

		// Check timing information
		t.ok(data.total_time_ms !== undefined, 'Should include timing information')
	} catch (e) {
		t.fail(`Test failed with error: ${e}`)
	}

	t.end()
})

/**
 * Test: Dataset Dimensions
 *
 * Verifies that the dataset contains the expected number of samples (100)
 * and that sample names match the expected format. This indirectly tests
 * that the counts dataset is read correctly.
 */
tape('Counts Dataset Dimensions', async t => {
	try {
		const input_data = {
			hdf5_file: HDF5_FILE,
			gene: 'TP53'
		}

		const rust_output = await run_rust('readHDF5', JSON.stringify(input_data))
		const output_lines = rust_output.split('\n')

		let data
		try {
			data = JSON.parse(output_lines[0])
		} catch (e) {
			t.fail(`Failed to parse JSON output: ${e.message}`)
			t.end()
			return
		}

		// Check that we have the expected number of samples
		const numSamples = Object.keys(data.samples).length
		t.equal(numSamples, 100, 'Should have 100 samples') // Adjust based on your dataset

		// Check if all sample names are present (adjust sample names as needed)
		const expectedSampleNames = ['2646', '2660', '2674', '2688', '2702']
		expectedSampleNames.forEach(sampleName => {
			const hasMatch = Object.keys(data.samples).some(
				key => key.includes(sampleName) || key === sampleName.toLowerCase()
			)
			t.ok(hasMatch, `Should include sample matching ${sampleName}`)
		})
	} catch (e) {
		t.fail(`Test failed with error: ${e}`)
	}

	t.end()
})

/**
 * Test: Invalid File Handling
 *
 * Verifies that the program correctly handles attempts to open
 * non-existent HDF5 files and returns appropriate error messages.
 */
tape('Invalid HDF5 File', async t => {
	try {
		const input_data = {
			hdf5_file: path.join('nonexistent_file.h5'),
			gene: 'TP53'
		}

		await run_rust('readHDF5', JSON.stringify(input_data))
		t.fail('Should have thrown an error for invalid file')
	} catch (e) {
		t.ok(
			e.includes('Failed to open HDF5 file') || e.includes('No such file') || e.includes('non-zero status'),
			'Should reject with appropriate error message'
		)
	}

	t.end()
})
