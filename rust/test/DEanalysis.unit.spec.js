/********************************************
Test script for 'rust/src/DEanalysis.rs'
This script must be run from the sjpp directory

cd ~/sjpp && node proteinpaint/rust/test/DEanalysis.unit.spec.js

*********************************************/

// Import necessary modules
import tape from 'tape'
import fs from 'fs'
import path from 'path'
import serverconfig from '@sjcrh/proteinpaint-server/src/serverconfig.js'
import { run_rust } from '@sjcrh/proteinpaint-rust'

const p_value_cutoff = 0.0001 // If the difference between the actual and expected p-value is greater than this, the test will fail
const fold_change_cutoff = 0.001 // If the difference between the actual and expected p-value is greater than this, the test will fail

//Wilcoxon DE test
tape('rust DE wilcoxon unit test', async function (test) {
	const inJson = {
		case: '2702,2800,2828,2982,3052,3234,3290,3346,3360,3388,3402,3444,3472',
		control:
			'2646,2674,2688,2744,2758,2786,2814,2842,2856,2884,2912,2926,2954,2968,2996,3010,3038,3080,3094,3122,3164,3220,3248,3416,3430,3458',
		data_type: 'do_DE',
		input_file: serverconfig.binpath + '/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.geneCounts.h5',
		cachedir: serverconfig.cachedir,
		min_count: 10,
		min_total_count: 15,
		storage_type: 'HDF5',
		DE_method: 'wilcoxon',
		mds_cutoff: 10000
	}
	const Rustout = await run_rust('DEanalysis', JSON.stringify(inJson))
	const out = JSON.parse(Rustout)

	const expJson = fs.readFileSync(
		path.join(serverconfig.binpath + '/test/tp/files/hg38/TermdbTest', 'TermdbTest_DE_wilcoxon_exp_output.json'),
		{
			encoding: 'utf8'
		}
	)
	// Gene1
	const gene1_id = 'ENSG00000169962'
	const gene1_out = out.find(user => user.gene_id === gene1_id)
	const gene1_exp_out = JSON.parse(expJson).find(user => user.gene_id === gene1_id)
	test.ok(
		gene1_out.original_p_value - gene1_exp_out.original_p_value < p_value_cutoff,
		`For ${gene1_id}, original pvalue=${gene1_out.original_p_value}, expected pvalue=${gene1_exp_out.original_p_value}`
	)
	test.ok(
		gene1_out.adjusted_p_value - gene1_exp_out.adjusted_p_value < p_value_cutoff,
		`For ${gene1_id}, original adj_pvalue=${gene1_out.adjusted_p_value}, expected adj_pvalue=${gene1_exp_out.adjusted_p_value}`
	)
	test.ok(
		gene1_out.fold_change - gene1_exp_out.fold_change < fold_change_cutoff,
		`For ${gene1_id}, original fold change=${gene1_out.fold_change}, expected fold change=${gene1_exp_out.fold_change}`
	)

	// Gene2
	const gene2_id = 'ENSG00000230368'
	const gene2_out = out.find(user => user.gene_id === gene2_id)
	const gene2_exp_out = JSON.parse(expJson).find(user => user.gene_id === gene2_id)
	test.ok(
		gene2_out.original_p_value - gene2_exp_out.original_p_value < p_value_cutoff,
		`For ${gene2_id}, original pvalue=${gene2_out.original_p_value}, expected pvalue=${gene2_exp_out.original_p_value}`
	)
	test.ok(
		gene2_out.adjusted_p_value - gene2_exp_out.adjusted_p_value < p_value_cutoff,
		`For ${gene2_id}, original adj_pvalue=${gene2_out.adjusted_p_value}, expected adj_pvalue=${gene2_exp_out.adjusted_p_value}`
	)
	test.ok(
		gene2_out.fold_change - gene2_exp_out.fold_change < fold_change_cutoff,
		`For ${gene2_id}, original fold change=${gene2_out.fold_change}, expected fold change=${gene2_exp_out.fold_change}`
	)

	// Gene3
	const gene3_id = 'ENSG00000067606'
	const gene3_out = out.find(user => user.gene_id === gene3_id)
	const gene3_exp_out = JSON.parse(expJson).find(user => user.gene_id === gene3_id)
	test.ok(
		gene3_out.original_p_value - gene3_exp_out.original_p_value < p_value_cutoff,
		`For ${gene3_id}, original pvalue=${gene3_out.original_p_value}, expected pvalue=${gene3_exp_out.original_p_value}`
	)
	test.ok(
		gene3_out.adjusted_p_value - gene3_exp_out.adjusted_p_value < p_value_cutoff,
		`For ${gene3_id}, original adj_pvalue=${gene3_out.adjusted_p_value}, expected adj_pvalue=${gene3_exp_out.adjusted_p_value}`
	)
	test.ok(
		gene3_out.fold_change - gene3_exp_out.fold_change < fold_change_cutoff,
		`For ${gene3_id}, original fold change=${gene3_out.fold_change}, expected fold change=${gene3_exp_out.fold_change}`
	)
	test.end()
})

// This tests the rust gene counts HDF5 query
tape('rust DE sample search test from raw gene counts HDF5 file', async function (test) {
	const inJson = {
		input_file: serverconfig.binpath + '/test/tp/files/hg38/TermdbTest/rnaseq/TermdbTest.geneCounts.h5',
		data_type: 'get_samples'
	}
	const Rustout = await run_rust('DEanalysis', JSON.stringify(inJson))

	const expJson = fs.readFileSync(
		path.join(serverconfig.binpath + '/test/tp/files/hg38/TermdbTest', 'TermdbTest_DE_samples_exp_output.json'),
		{
			encoding: 'utf8'
		}
	)

	test.deepEqual(Rustout, expJson, 'Test rust DE sample search from raw gene counts HDF5 should match expected output')
	test.end()
})
