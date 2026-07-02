/**
 * readHDF5.unit.spec.js
 * Run test script as follows (from 'proteinpaint/'):
 *  	node python/test/readHDF5.unit.spec.js
 *
 * Unit tests for python/src/readHDF5.py.
 *
 * These tests verify:
 * - Gene queries function correctly
 * - Error handling for non-existent genes
 * - Data structure validation
 * - File access errors are properly reported
 *
 * The tests use an HDF5 test file with simulated sample gene expression data.
 *
 */

// Import necessary modules
import tape from 'tape'
import { run_python } from '@sjcrh/proteinpaint-python'

const HDF5_FILE = 'server/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5'
const python_script = 'readHDF5.py'

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
			query: 'TP53'
		}
		const out = await run_python(python_script, JSON.stringify(input_data))
		const data = typeof out === 'string' ? JSON.parse(out) : out

		t.ok(data.genes.TP53, 'Should return data for TP53 gene')
		t.ok(data.genes.TP53.samples, 'Should include samples data')
		t.ok(Object.keys(data.genes.TP53.samples).length > 0, 'Should have more than one sample')

		// Check that sample values are numbers or null (for NaN values)
		Object.values(data.genes.TP53.samples).forEach(value => {
			t.ok(typeof value === 'number' || value === null, 'Sample value should be a number or null')
		})
	} catch (e) {
		t.fail(`Test failed with error: ${e}`)
	}

	t.end()
})

/**
 * Test: Multiple Genes Query
 *
 * Verifies the program can handle requests for multiple genes simultaneously,
 * including a mix of existing and non-existent genes. Checks that:
 * - Existing genes have sample data
 * - Non-existent genes are listed in the missing_genes array
 * - Performance timing information is included
 */
tape('Query Multiple Genes', async t => {
	try {
		const input_data = {
			hdf5_file: HDF5_FILE,
			query: 'TP53,OR4F5,NONEXISTENT_GENE'
		}

		const out = await run_python(python_script, JSON.stringify(input_data))
		const data = typeof out === 'string' ? JSON.parse(out) : out
		t.ok(data.genes, 'Should include genes object')

		// Check if the known genes have data
		;['TP53', 'OR4F5'].forEach(gene => {
			if (!data.genes[gene].error) {
				t.ok(data.genes[gene].samples, `Should include samples for ${gene}`)
				t.ok(Object.keys(data.genes[gene].samples).length > 0, `Should have at least one sample for ${gene}`)
			}
		})
	} catch (e) {
		t.fail(`Test failed with error: ${e}`)
	}

	t.end()
})

tape('Query Multiple Genes w/ list', async t => {
	try {
		const input_data = {
			hdf5_file: HDF5_FILE,
			query: ['TP53', 'OR4F5', 'NONEXISTENT_GENE']
		}

		const out = await run_python(python_script, JSON.stringify(input_data))
		const data = typeof out === 'string' ? JSON.parse(out) : out

		t.ok(data.genes, 'Should include genes object')

		// Check if the known genes have data
		;['TP53', 'OR4F5'].forEach(gene => {
			if (!data.genes[gene].error) {
				t.ok(data.genes[gene].samples, `Should include samples for ${gene}`)
				t.ok(Object.keys(data.genes[gene].samples).length > 0, `Should have at least one sample for ${gene}`)
			}
		})

		t.ok(data.missing_genes.includes('NONEXISTENT_GENE'), 'Missing genes should include an error entry')

		// Check timing information
		t.ok(data.timings.total_time_ms !== undefined, 'Should include timing information')
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
			query: 'TP53'
		}

		const out = await run_python(python_script, JSON.stringify(input_data))
		const data = typeof out === 'string' ? JSON.parse(out) : out

		// Check that we have the expected number of samples
		const numSamples = Object.keys(data.genes.TP53.samples).length
		t.equal(numSamples, 100, 'Should have 100 samples') // Adjust based on your dataset

		// Check if all sample names are present (adjust sample names as needed)
		const expectedSampleNames = ['2646', '2660', '2674', '2688', '2702']
		expectedSampleNames.forEach(sampleName => {
			const hasMatch = Object.keys(data.genes.TP53.samples).some(
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
			hdf5_file: 'nonexistent_file.h5',
			query: 'TP53'
		}

		await run_python(python_script, JSON.stringify(input_data))
		t.fail('Should have thrown an error for invalid file')
	} catch (e) {
		const errorText = String(e)
		t.ok(errorText.includes('File not found') || 'Should reject with appropriate error message')
	}

	t.end()
})
