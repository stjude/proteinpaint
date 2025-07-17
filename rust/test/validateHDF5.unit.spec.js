/**
 * validateHDF5.unit.spec.js
 *
 * Unit tests for the validateHDF5 Rust module which validates and extracts metadata from HDF5 files.
 *
 * These tests verify:
 * - HDF5 file format detection (dense, sparse, unknown)
 * - Metadata extraction (sample names, gene names, matrix dimensions)
 * - Error handling for invalid files, missing files, and malformed inputs
 * - JSON output structure validation
 *
 * The tests use HDF5 test files with simulated gene expression data in different formats.
 *
 * To run the tests use the command: node validateHDF5.unit.spec.js
 * To run the entire Rust unit test suite use the command: npm run test:unit from proteinpaint/rust
 */

// Import necessary modules
import tape from 'tape'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import path from 'path'
import fs from 'fs'
import serverconfig from '@sjcrh/proteinpaint-server/src/serverconfig.js'

// Load the test HDF5 files
const DENSE_HDF5_FILE = path.join(
	serverconfig.binpath,
	'/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.h5'
)
const SPARSE_HDF5_FILE = path.join(serverconfig.binpath, '/test/tp/files/hg38/TermdbTest/TermdbTest.sparse.matrix.h5')
const UNKNOWN_HDF5_FILE = path.join(serverconfig.binpath, '/test/tp/files/hg38/TermdbTest/TermdbTest.unknown.matrix.h5')

// Verify files exist - skip tests if they don't
const filesExist = {
	dense: fs.existsSync(DENSE_HDF5_FILE),
	sparse: fs.existsSync(SPARSE_HDF5_FILE),
	unknown: fs.existsSync(UNKNOWN_HDF5_FILE)
}

if (!filesExist.dense) {
	console.warn(`Dense format test file not found: ${DENSE_HDF5_FILE}`)
}

/**************
 * Test sections
 **************/
tape('\n', function (test) {
	test.comment('-***- validateHDF5 specs -***-')
	test.end()
})

/**
 * Test: Validate Dense Format HDF5 File
 *
 * Verifies that the program correctly identifies and validates a dense format HDF5 file,
 * extracting the proper metadata including sample names and matrix dimensions.
 */
tape('Validate Dense Format HDF5 File', async t => {
	if (!filesExist.dense) {
		t.skip('Dense format test file not found')
		t.end()
		return
	}

	try {
		const input_data = {
			hdf5_file: DENSE_HDF5_FILE
		}

		const rust_output = await run_rust('validateHDF5', JSON.stringify(input_data))
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

		// Validate the structure and content of the output
		t.equal(data.status, 'success', 'Should return success status')
		t.equal(data.format, 'dense', 'Should identify the format as dense')
		t.ok(data.sampleNames, 'Should include sample names')
		t.ok(Array.isArray(data.sampleNames), 'Sample names should be an array')
		t.ok(data.sampleNames.length > 0, 'Should have at least one sample name')
		t.ok(data.matrix_dimensions, 'Should include matrix dimensions')
		t.ok(data.matrix_dimensions.num_genes > 0, 'Should have a positive number of genes')
		t.ok(data.matrix_dimensions.num_samples > 0, 'Should have a positive number of samples')
		t.equal(
			data.matrix_dimensions.num_samples,
			data.sampleNames.length,
			'Number of samples should match sample names length'
		)
	} catch (e) {
		t.fail(`Test failed with error: ${e}`)
	}

	t.end()
})

/**
 * Test: Validate Sparse Format HDF5 File
 *
 * Verifies that the program correctly identifies and validates a sparse format HDF5 file,
 * extracting the proper metadata including sample names and matrix dimensions.
 */
tape('Validate Sparse Format HDF5 File', async t => {
	if (!filesExist.sparse) {
		t.skip('Sparse format test file not found')
		t.end()
		return
	}

	try {
		const input_data = {
			hdf5_file: SPARSE_HDF5_FILE
		}

		const rust_output = await run_rust('validateHDF5', JSON.stringify(input_data))
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

		// Validate the structure and content of the output
		t.equal(data.status, 'success', 'Should return success status')
		t.equal(data.format, 'sparse', 'Should identify the format as sparse')
		t.ok(data.sampleNames, 'Should include sample names')
		t.ok(Array.isArray(data.sampleNames), 'Sample names should be an array')
		t.ok(data.sampleNames.length > 0, 'Should have at least one sample name')
		t.ok(data.matrix_dimensions, 'Should include matrix dimensions')
		t.ok(data.matrix_dimensions.num_genes > 0, 'Should have a positive number of genes')
		t.ok(data.matrix_dimensions.num_samples > 0, 'Should have a positive number of samples')
		t.equal(
			data.matrix_dimensions.num_samples,
			data.sampleNames.length,
			'Number of samples should match sample names length'
		)
	} catch (e) {
		t.fail(`Test failed with error: ${e}`)
	}

	t.end()
})

/**
 * Test: Validate Unknown Format HDF5 File
 *
 * Verifies that the program correctly handles an HDF5 file with an unknown format,
 * reporting appropriate error status.
 */
tape('Validate Unknown Format HDF5 File', async t => {
	if (!filesExist.unknown) {
		// Create a temporary test file with unknown format if needed
		const tempDir = path.join(path.dirname(DENSE_HDF5_FILE), 'temp')
		fs.mkdirSync(tempDir, { recursive: true })
		const TEMP_UNKNOWN_FILE = path.join(tempDir, 'temp_unknown.h5')

		try {
			// Create an empty file
			fs.writeFileSync(TEMP_UNKNOWN_FILE, '')

			const input_data = {
				hdf5_file: TEMP_UNKNOWN_FILE
			}

			let rust_output
			try {
				rust_output = await run_rust('validateHDF5', JSON.stringify(input_data))
			} catch (e) {
				// Either error or failure status is acceptable for invalid file
				t.ok(e.includes('error') || e.includes('failure'), 'Should return error for invalid file')
				fs.unlinkSync(TEMP_UNKNOWN_FILE)
				fs.rmdirSync(tempDir)
				t.end()
				return
			}

			const output_lines = rust_output.split('\n')

			// Parse the JSON output
			let data
			try {
				data = JSON.parse(output_lines[0])
			} catch (e) {
				t.fail(`Failed to parse JSON output: ${e.message}`)
				fs.unlinkSync(TEMP_UNKNOWN_FILE)
				fs.rmdirSync(tempDir)
				t.end()
				return
			}

			// Validate the structure and content of the output for unknown format
			t.ok(data.status === 'error' || data.status === 'failure', 'Should return error or failure status')

			// Clean up temp file
			fs.unlinkSync(TEMP_UNKNOWN_FILE)
			fs.rmdirSync(tempDir)
		} catch (e) {
			t.fail(`Test failed with error: ${e}`)
			// Clean up if possible
			if (fs.existsSync(TEMP_UNKNOWN_FILE)) {
				fs.unlinkSync(TEMP_UNKNOWN_FILE)
			}
			if (fs.existsSync(tempDir)) {
				fs.rmdirSync(tempDir)
			}
		}
	} else {
		// Use the existing unknown format file
		try {
			const input_data = {
				hdf5_file: UNKNOWN_HDF5_FILE
			}

			const rust_output = await run_rust('validateHDF5', JSON.stringify(input_data))
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

			// Validate the structure and content of the output
			t.equal(data.format, 'unknown', 'Should identify the format as unknown')
			t.ok(data.sampleNames && data.sampleNames.length === 0, 'Should have an empty sample names array')
			t.ok(data.geneNames && data.geneNames.length === 0, 'Should have an empty gene names array')
		} catch (e) {
			t.fail(`Test failed with error: ${e}`)
		}
	}

	t.end()
})

/**
 * Test: Invalid HDF5 File Path
 *
 * Verifies that the program correctly handles non-existent HDF5 files
 * and returns appropriate error messages.
 */
tape('Invalid HDF5 File Path', async t => {
	try {
		const input_data = {
			hdf5_file: path.join('nonexistent_file.h5')
		}

		await run_rust('validateHDF5', JSON.stringify(input_data))
		t.fail('Should have thrown an error for invalid file path')
	} catch (e) {
		t.ok(
			e.includes('error') || e.includes('failure') || e.includes('no such file'),
			'Should reject with appropriate error message'
		)
	}

	t.end()
})

/**
 * Test: Missing HDF5 File Path
 *
 * Verifies that the program correctly handles missing HDF5 file path
 * in the input JSON and returns appropriate error messages.
 */
tape('Missing HDF5 File Path', async t => {
	try {
		const input_data = {}

		const rust_output = await run_rust('validateHDF5', JSON.stringify(input_data))
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

		t.equal(data.status, 'error', 'Should return error status')
		t.ok(data.message.includes('not provided'), 'Error message should indicate file path not provided')
	} catch (e) {
		// If run_rust rejects, check the error message
		t.ok(e.includes('not provided') || e.includes('missing'), 'Error should indicate file path not provided')
	}

	t.end()
})

/**
 * Test: Malformed Input JSON
 *
 * Verifies that the program correctly handles malformed input JSON
 * and returns appropriate error messages.
 */
tape('Malformed Input JSON', async t => {
	try {
		const malformed_input = '{hdf5_file: "invalid_json"}' // Missing quotes around key

		const rust_output = await run_rust('validateHDF5', malformed_input)
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

		t.equal(data.status, 'error', 'Should return error status')
		t.ok(
			data.message.includes('Invalid JSON') || data.message.includes('JSON'),
			'Error message should indicate invalid JSON'
		)
	} catch (e) {
		// If run_rust rejects, check the error message
		t.ok(e.includes('invalid') || e.includes('JSON') || e.includes('parse'), 'Error should indicate invalid JSON input')
	}

	t.end()
})

/**
 * Test: Verify Sample Count Matches
 *
 * Verifies that the number of sample names matches the reported number
 * of samples in the matrix dimensions.
 */
tape('Verify Sample Count Matches', async t => {
	if (!filesExist.dense) {
		t.skip('Dense format test file not found')
		t.end()
		return
	}

	try {
		const input_data = {
			hdf5_file: DENSE_HDF5_FILE
		}

		const rust_output = await run_rust('validateHDF5', JSON.stringify(input_data))
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

		// Verify that the number of samples matches the sample names array length
		t.equal(
			data.matrix_dimensions.num_samples,
			data.sampleNames.length,
			'Number of samples should match the length of the sample names array'
		)

		// Check if the expected number of samples is present (100 samples based on the readHDF5 test)
		t.equal(data.sampleNames.length, 100, 'Should have 100 samples') // Adjust based on your dataset
	} catch (e) {
		t.fail(`Test failed with error: ${e}`)
	}

	t.end()
})

/**
 * Test: Verify Expected Samples
 *
 * Verifies that specific expected sample names are present in the results.
 */
tape('Verify Expected Samples', async t => {
	if (!filesExist.dense) {
		t.skip('Dense format test file not found')
		t.end()
		return
	}

	try {
		const input_data = {
			hdf5_file: DENSE_HDF5_FILE
		}

		const rust_output = await run_rust('validateHDF5', JSON.stringify(input_data))
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

		// Check if expected sample names are present (based on readHDF5 test)
		const expectedSampleNames = ['2646', '2660', '2674', '2688', '2702']
		expectedSampleNames.forEach(sampleName => {
			const hasMatch = data.sampleNames.some(name => name.includes(sampleName) || name === sampleName.toLowerCase())
			t.ok(hasMatch, `Should include sample matching ${sampleName}`)
		})
	} catch (e) {
		t.fail(`Test failed with error: ${e}`)
	}

	t.end()
})
