import tape from 'tape'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import serverconfig from '@sjcrh/proteinpaint-server/src/serverconfig.js'
import path from 'path'

const HDF5_FILE = path.join(serverconfig.binpath, '/test/tp/files/hg38/TermdbTest/TermdbTest.fpkm.matrix.h5')

tape('\n', function (test) {
	test.pass('-***- readHDF5 integration tests -***-')
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
			t.fail(`Failed to parse JSON output: ${e instanceof Error ? e.message : String(e)}`)
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
