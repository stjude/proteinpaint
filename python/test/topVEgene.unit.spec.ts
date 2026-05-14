/********************************************
Unit Test script for 'python/src/topVEgene.py'

Run test script as follows (from 'proteinpaint/'):
    node python/test/topVEgene.unit.spec.ts
*********************************************/

import tape from 'tape'
import { run_python } from '@sjcrh/proteinpaint-python'

const rnaseqTestFile = 'server/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.fpkm.matrix.new.h5'
const samples = '2646,2660,2898,3150,3178,3206,3220,3346,3360,1,3,7,21,22,23,37,38,39'

tape('topVEgene returns the expected top variable genes', async t => {
	const input = {
		input_file: rnaseqTestFile,
		filter_extreme_values: false,
		max_genes: 10,
		rank_type: 'var',
		samples
	}

	try {
		const out = await run_python('topVEgene.py', JSON.stringify(input))
		const result = typeof out === 'string' ? JSON.parse(out) : out

		t.ok(Array.isArray(result), 'Output should be an array of gene symbols')
		t.deepEqual(
			result,
			['ISG15', 'CCNL2', 'GNB1', 'MXRA8', 'ACAP3', 'HES4', 'AGRN', 'DVL1', 'SKI', 'HES5'],
			'Should return the expected top genes'
		)
	} catch (err) {
		t.fail(`Expected success but got error: ${String(err)}`)
	}

	t.end()
})

tape('topVEgene returns the expected top variable genes when filtered', async t => {
	const input = {
		input_file: rnaseqTestFile,
		filter_extreme_values: true,
		max_genes: 10,
		rank_type: 'var',
		samples
	}

	try {
		const out = await run_python('topVEgene.py', JSON.stringify(input))
		const result = typeof out === 'string' ? JSON.parse(out) : out

		t.ok(Array.isArray(result), 'Output should be an array of gene symbols')
		t.deepEqual(
			result,
			['ISG15', 'CCNL2', 'GNB1', 'MXRA8', 'ACAP3', 'HES4', 'AGRN', 'DVL1', 'SKI', 'HES5'],
			'Should return the expected top genes'
		)
	} catch (err) {
		t.fail(`Expected success but got error: ${String(err)}`)
	}

	t.end()
})

tape('topVEgene returns the expected top genes by iqr', async t => {
	const input = {
		input_file: rnaseqTestFile,
		filter_extreme_values: false,
		max_genes: 10,
		rank_type: 'iqr',
		samples
	}

	try {
		const out = await run_python('topVEgene.py', JSON.stringify(input))
		const result = typeof out === 'string' ? JSON.parse(out) : out

		t.ok(Array.isArray(result), 'Output should be an array of gene symbols')
		t.deepEqual(
			result,
			['ISG15', 'CCNL2', 'GNB1', 'AGRN', 'DVL1', 'SKI', 'ACAP3', 'MXRA8', 'SLC35E2B', 'NADK'],
			'Should return the expected top genes when using iqr ranking'
		)
	} catch (err) {
		t.fail(`Expected success but got error: ${String(err)}`)
	}

	t.end()
})

tape('topVEgene rejects an invalid rank_type', async t => {
	const input = {
		input_file: rnaseqTestFile,
		filter_extreme_values: false,
		max_genes: 10,
		rank_type: 'bad-rank',
		samples
	}

	try {
		await run_python('topVEgene.py', JSON.stringify(input))
		t.fail('Expected rank_type validation to fail')
	} catch (err) {
		const errorText = String(err)
		t.ok(errorText.includes('rank_type must be either "iqr" or "var"'), 'Error should mention rank_type validation')
	}

	t.end()
})

tape('topVEgene rejects a non-existing input file', async t => {
	const input = {
		input_file: 'server/test/tp/files/hg38/TermdbTest/rnaseq/does-not-exist.h5',
		filter_extreme_values: false,
		max_genes: 10,
		rank_type: 'var',
		samples
	}

	try {
		await run_python('topVEgene.py', JSON.stringify(input))
		t.fail('Expected missing input_file validation to fail')
	} catch (err) {
		const errorText = String(err)
		t.ok(errorText.includes('could not be found'), 'Error should mention missing input file')
	}

	t.end()
})

tape('topVEgene rejects sample IDs not present in HDF5', async t => {
	const input = {
		input_file: rnaseqTestFile,
		filter_extreme_values: false,
		max_genes: 10,
		rank_type: 'var',
		samples: `${samples},not-a-sample,999999,bad-sample-id,-1`
	}

	try {
		await run_python('topVEgene.py', JSON.stringify(input))
		t.fail('Expected sample validation to fail for missing sample IDs')
	} catch (err) {
		const errorText = String(err)
		t.ok(errorText.includes('not found in HDF5 file'), 'Error should mention missing sample IDs')
	}

	t.end()
})
