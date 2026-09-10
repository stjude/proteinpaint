/**
 * readHDF5.unit.spec.js
 * Run test script as follows (from 'proteinpaint/'):
 *  	node python/test/readHDF5.unit.spec.js
 *
 * Unit tests for python/src/readHDF5.py.
 *
 * These tests verify:
 * - Queries function correctly
 * - Error handling for non-existent items
 * - Data structure validation
 * - File access errors are properly reported
 *
 * The tests use an HDF5 test file with simulated sample gene expression data.
 *
 */

// Import necessary modules
import tape from 'tape'
import { run_python, setPythonBinPath } from '@sjcrh/proteinpaint-python'

// local convenience: use the same interpreter the dev server is configured with
if (process.env.PP_PYTHON) setPythonBinPath(process.env.PP_PYTHON)

const HDF5_FILE = 'server/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5'
// panel-based sc expression store: 'assay' root attribute = 'panel', 3 genes
const PANEL_H5 = 'server/test/tp/files/hg38/TermdbTest/scrna/geneExpHdf5/TCGA-22-1017.h5'
// whole-transcriptome-style sc store: no 'assay' attribute
const WHOLE_H5 = 'server/test/tp/files/hg38/TermdbTest/scrna/geneExpHdf5/2646.h5'
// a valid HDF5 file with none of this script's expected datasets (h5ad layout)
const WRONG_SCHEMA_H5 = 'server/test/tp/files/hg38/TermdbTest/spatial/TCGA-22-1017/image1/image1_spatial.h5ad'
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

		t.ok(data.query_output.TP53, 'Should return data for TP53 gene')
		t.ok(data.query_output.TP53.samples, 'Should include samples data')
		t.ok(Object.keys(data.query_output.TP53.samples).length > 0, 'Should have more than one sample')

		// Check that sample values are numbers or null (for NaN values)
		Object.values(data.query_output.TP53.samples).forEach(value => {
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
		t.ok(data.query_output, 'Should include genes object')

		// Check if the known genes have data
		;['TP53', 'OR4F5'].forEach(gene => {
			if (!data.query_output[gene].error) {
				t.ok(data.query_output[gene].samples, `Should include samples for ${gene}`)
				t.ok(Object.keys(data.query_output[gene].samples).length > 0, `Should have at least one sample for ${gene}`)
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

		t.ok(data.query_output, 'Should include genes object')

		// Check if the known genes have data
		;['TP53', 'OR4F5'].forEach(gene => {
			if (!data.query_output[gene].error) {
				t.ok(data.query_output[gene].samples, `Should include samples for ${gene}`)
				t.ok(Object.keys(data.query_output[gene].samples).length > 0, `Should have at least one sample for ${gene}`)
			}
		})

		t.ok(data.missing_items.includes('NONEXISTENT_GENE'), 'Missing genes should include an error entry')

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
		const numSamples = Object.keys(data.query_output.TP53.samples).length
		t.equal(numSamples, 100, 'Should have 100 samples') // Adjust based on your dataset

		// Check if all sample names are present (adjust sample names as needed)
		const expectedSampleNames = ['2646', '2660', '2674', '2688', '2702']
		expectedSampleNames.forEach(sampleName => {
			const hasMatch = Object.keys(data.query_output.TP53.samples).some(
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

		const error_result = await run_python(python_script, JSON.stringify(input_data))
		const errorText = typeof error_result === 'string' ? error_result : JSON.stringify(error_result)
		t.ok(errorText.includes('not be found'))
	} catch (e) {
		const errorText = String(e)
		t.ok(errorText.includes('not be found'))
	}

	t.end()
})

/**
 * Test: List Items — panel assay
 *
 * list_items mode on a store whose 'assay' root attribute is 'panel' must
 * return the exact item names plus assay:'panel', the contract the server's
 * listGenes getter relies on to serve a sample's assayed gene list.
 */
tape('List items: panel assay returns items plus assay', async t => {
	try {
		const input_data = {
			hdf5_file: PANEL_H5,
			list_items: true
		}
		const out = await run_python(python_script, JSON.stringify(input_data))
		const data = typeof out === 'string' ? JSON.parse(out) : out

		t.deepEqual(data.items, ['ACE2', 'ACTA2', 'PTPRC'], 'Should list exactly the assayed genes, in file order')
		t.equal(data.assay, 'panel', "Should report assay 'panel' from the root attribute")
	} catch (e) {
		t.fail(`Test failed with error: ${e}`)
	}

	t.end()
})

/**
 * Test: List Items — absent assay attribute
 *
 * A store without the 'assay' root attribute is whole-transcriptome by
 * default: the script reports assay null and the server-side getter maps
 * that to 'wholeTranscriptome' (gene search stays on the genome db).
 */
tape('List items: absent assay attribute yields null (whole-transcriptome default)', async t => {
	try {
		const input_data = {
			hdf5_file: WHOLE_H5,
			list_items: true
		}
		const out = await run_python(python_script, JSON.stringify(input_data))
		const data = typeof out === 'string' ? JSON.parse(out) : out

		t.equal(data.assay, null, 'Should report assay null when the attribute is absent')
		t.ok(Array.isArray(data.items) && data.items.length > 0, 'Should still list the item names')
		t.ok(data.items.includes('DDX11L1'), 'Should include a known gene from the store')
	} catch (e) {
		t.fail(`Test failed with error: ${e}`)
	}

	t.end()
})

/**
 * Test: List Items — malformed inputs
 *
 * The listing mode must fail the same way the query mode does: a missing
 * file, a non-HDF5 file, and a valid HDF5 file lacking the expected 'item'
 * dataset each produce an error payload, never a partial listing.
 */
tape('List items: malformed files are reported as errors', async t => {
	// helper: the script always prints JSON and exits 0, but run_python may
	// reject on some environments — normalize both paths to text
	const runForText = async input_data => {
		try {
			const out = await run_python(python_script, JSON.stringify(input_data))
			return typeof out === 'string' ? out : JSON.stringify(out)
		} catch (e) {
			return String(e)
		}
	}

	let text = await runForText({ hdf5_file: 'nonexistent_file.h5', list_items: true })
	t.ok(text.includes('not be found'), 'Nonexistent file should report not found')

	text = await runForText({ hdf5_file: 'python/test/readHDF5.unit.spec.js', list_items: true })
	t.ok(text.includes('not a valid hdf5'), 'A non-HDF5 file should be rejected')

	text = await runForText({ hdf5_file: WRONG_SCHEMA_H5, list_items: true })
	t.ok(text.includes('error'), 'A valid HDF5 without the item dataset should report an error')
	t.notOk(text.includes('"items"'), 'No partial item listing should be produced')

	t.end()
})
